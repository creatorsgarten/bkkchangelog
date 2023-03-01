import { parseArgs } from 'util'
import { ConnectFn, getTicketSnapshotsCollection, withDb } from './_db'

async function main(connect: ConnectFn) {
  const { positionals } = parseArgs({ allowPositionals: true })
  if (positionals.length !== 1) {
    throw new Error(
      'Expected exactly one positional argument for the ticket ID',
    )
  }

  const client = await connect()
  const collection = getTicketSnapshotsCollection(client)

  try {
    const records = await collection
      .find({ 'data.ticket_id': positionals[0] })
      .toArray()
    console.log(JSON.stringify(records, null, 2))
  } finally {
    await client.close()
  }
}

withDb(main)
