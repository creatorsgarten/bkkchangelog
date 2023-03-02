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
  const snapshots = await client.getTicketSnapshots.query({ id: entry._id })
  console.log(getTweet(entry, snapshots.results))
}

withDb(main)
