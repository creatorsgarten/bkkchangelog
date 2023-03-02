import { MongoClient } from 'mongodb'
import { client } from './_api'
import {
  getStateCollection,
  getTweetTaskCollection,
  getTwitterThreadCollection,
} from './_db'
import { getTweet } from './_tweet'
import { generateImage } from './_image'
import { Env } from 'lazy-strict-env'
import { z } from 'zod'
import { fork } from 'child_process'

let forkMode = false

export function enableForkMode() {
  forkMode = true
}

const stdlibEnv = Env(
  z.object({
    STDLIB_SECRET_TOKEN: z.string(),
  }),
)

export async function getNextChangelogEntry(
  mongo: MongoClient,
  log: (message: string) => void = console.log,
) {
  const state = (await getStateCollection(mongo).findOne({ _id: 'state' })) || {
    _id: 'state',
  }
  const nextSince = state.nextSince?.getTime() || 0
  const since = Math.max(
    Date.now() - 3 * 86400e3,
    Date.parse('2023-02-27T17:00:00Z'),
    nextSince,
  )

  const today = new Date(Date.now() + 7 * 3600e3).toISOString().split('T')[0]
  const until = Date.parse(today + 'T00:00:00Z') - 7 * 3600e3
  const endOfDay = until + 86400e3
  log(
    `Looking for changes between ${new Date(since).toISOString()} ` +
      `and ${new Date(until).toISOString()}...`,
  )
  const data = await client.changelogEntries.list.query({
    since: new Date(since).toISOString(),
    until: new Date(until).toISOString(),
    sort: 'asc',
  })
  const afterUntil = await client.changelogEntries.count.query({
    since: new Date(until).toISOString(),
    until: new Date().toISOString(),
  })
  const timeLeft = Math.max(1, endOfDay - Date.now())
  const timePerTweet = Math.round(timeLeft / Math.max(1, data.total))
  const timeLeftHours = (timeLeft / 3600e3).toFixed(2)
  log(
    `Got ${data.total} changelog entries in scope to be posted in ${timeLeftHours}h -- that is ${timePerTweet}ms per tweet`,
  )
  log(
    `After that, there are ${afterUntil.totalBeforeUntil} entries to waiting to be scheduled on the next day`,
  )
  const lastTweetedAt = state.lastTweetedAt?.getTime() || 0
  const collection = getTweetTaskCollection(mongo)
  const timeUntilNextTweet = lastTweetedAt + timePerTweet - 32e3 - Date.now()
  if (timeUntilNextTweet > 0) {
    log(`Gonna wait for ${timeUntilNextTweet}ms, so doing nothing for now`)
    return
  }
  let nextNextSince = nextSince
  try {
    for (const item of data.results) {
      nextNextSince = Date.parse(item.finished)
      const found = await collection.findOne({ _id: item._id })
      if (found) continue
      return item
    }
  } finally {
    if (nextNextSince > nextSince) {
      await getStateCollection(mongo).updateOne(
        { _id: 'state' },
        { $set: { nextSince: new Date(nextNextSince) } },
        { upsert: true },
      )
    }
  }
}

type Entry = Exclude<
  Awaited<ReturnType<typeof getNextChangelogEntry>>,
  undefined
>

export async function workOnNextTask(
  mongo: MongoClient,
  log: (message: string) => void = console.log,
) {
  const entry = await getNextChangelogEntry(mongo, log)
  if (!entry) {
    log('No changelog entry found')
    return
  }
  await workOnTask(mongo, entry, log)
}

export async function workOnTask(
  mongo: MongoClient,
  entry: Entry,
  log: (message: string) => void = console.log,
) {
  const collection = getTweetTaskCollection(mongo)
  const threadStates = getTwitterThreadCollection(mongo)
  log(`Got changelog entry: ${entry._id} (finished at ${entry?.finished})`)
  const lib = require('lib')({ token: stdlibEnv.STDLIB_SECRET_TOKEN })
  const tweet = await getTweet(entry)
  log('Generated tweet: ' + JSON.stringify(tweet))
  const threadState = tweet.threadId
    ? await threadStates.findOne({ _id: tweet.threadId })
    : null
  try {
    await collection.updateOne(
      { _id: entry._id },
      { $set: { status: 'pending' } },
      { upsert: true },
    )
    const image = forkMode
      ? await generateImageWithFork(entry.snapshot)
      : await generateImage(entry.snapshot)
    log('Generated image, number of bytes: ' + image.length)
    const media = await lib.twitter.media['@1.1.0'].upload.simple({
      media: image,
    })
    log('Created media: ' + JSON.stringify(media))
    const status = await lib.twitter.tweets['@1.1.2'].statuses.create({
      ...tweet.tweet,
      media_ids: media.media_id_string,
      display_coordinates: true,
      ...(threadState
        ? { in_reply_to_status_id: threadState.lastTweetId }
        : {}),
    })
    log('Created status: ' + JSON.stringify(status))
    const result = { media, status }
    await collection.updateOne(
      { _id: entry._id },
      { $set: { status: 'completed', result } },
      { upsert: true },
    )
    if (tweet.threadId) {
      await threadStates.updateOne(
        { _id: tweet.threadId },
        {
          $set: { lastTweetId: status.id_str },
          $setOnInsert: { firstTweetId: status.id_str },
        },
        { upsert: true },
      )
    }
    await getStateCollection(mongo).updateOne(
      { _id: 'state' },
      { $set: { lastTweetedAt: new Date() } },
      { upsert: true },
    )
    return result
  } catch (error: any) {
    await collection.updateOne(
      { _id: entry._id },
      { $set: { status: 'error', error: String(error) } },
      { upsert: true },
    )
    throw error
  }
}

const generateImageWithFork: typeof generateImage = async (snapshot) => {
  const child = fork(__filename, ['--generate-image'], {
    timeout: 30e3,
    serialization: 'advanced',
  })
  return new Promise((resolve, reject) => {
    child.on('message', (message: any) => {
      if (message.result) {
        resolve(message.result)
      } else if (message.error) {
        reject(new Error('Error from child process: ' + message.error))
      }
    })
    child.on('error', (error: any) => {
      reject(error)
    })
    child.send({ snapshot })
  })
}

export async function forkGenerateImageWorker() {
  process.on('message', async (message: any) => {
    if (message.snapshot) {
      try {
        const result = await generateImage(message.snapshot)
        process.send!({ result })
      } catch (error: any) {
        process.send!({ error: String(error?.stack || error) })
      }
    }
  })
}
