import 'fetch-types'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { parseArgs } from 'util'
import { generateImage } from './_image'
import { client } from './_api'
import { getTweet } from './_tweet'

async function main() {
  const { positionals } = parseArgs({ allowPositionals: true })
  if (positionals.length !== 1) {
    throw new Error(
      'Expected exactly one positional argument for the ticket ID',
    )
  }

  const id = positionals[0]
  const entry = await client.changelogEntries.get.query({ id })
  const { results: snapshots } = await client.ticketSnapshots.list.query({ id })
  snapshots.sort((a: any, b: any) => (a.updated < b.updated ? -1 : 1))
  const tweet = getTweet(entry, snapshots)
  console.log(tweet)
  const image = await generateImage(entry.snapshot)
  const imagePath = `.data/output/${id}.jpg`
  mkdirSync('.data/output', { recursive: true })
  writeFileSync(imagePath, image)
  console.log(imagePath)
}

main()
