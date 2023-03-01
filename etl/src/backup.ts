import { createWriteStream, mkdirSync } from 'fs'
import { ConnectFn, getTicketSnapshotsCollection, withDb } from './_db'

async function main(connect: ConnectFn) {
  const client = await connect()
  try {
    const collection = getTicketSnapshotsCollection(client)
    mkdirSync('.data', { recursive: true })
    const stream = createWriteStream('.data/backup.ndjson')
    let lastPrinted = 0
    let count = 0
    for await (const doc of collection.find()) {
      stream.write(JSON.stringify(doc.data) + '\n')
      count++
      if (Date.now() - lastPrinted > 5000) {
        console.log(`[${new Date().toISOString()}] ${count} records downloaded`)
        lastPrinted = Date.now()
      }
    }
    stream.end()
  } finally {
    await client.close()
  }
}

withDb(main)
