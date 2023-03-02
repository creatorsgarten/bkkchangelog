import { client } from './_api'
import { ConnectFn, withDb } from './_db'
import { getTweet } from './_tweet'
import { getNextChangelogEntry } from './_tasks'

async function main(connect: ConnectFn) {
  const mongo = await connect()
  const entry = await getNextChangelogEntry(mongo)
  if (!entry) {
    console.log('No changelog entry found')
    return
  }
  console.log(await getTweet(entry))
}

withDb(main)
