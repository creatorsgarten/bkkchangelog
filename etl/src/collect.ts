import { readFileSync } from 'fs'
import { globbySync } from 'globby'
import { z } from 'zod'
import { AnyBulkWriteOperation, MongoClient } from 'mongodb'
import { Env } from 'lazy-strict-env'
import { ConnectFn, getTicketSnapshotsCollection, TicketSnapshot, withDb } from './_db'

const EntryInfo = z.object({
  ticket_id: z.coerce.string().min(1),
  last_activity: z.coerce.string(),
})

async function main(connect: ConnectFn) {
  const files = globbySync('.data/fetched/*.json')
  const client = await connect()
  const collection = getTicketSnapshotsCollection(client)

  // Ensure that a unique index exists for (data.ticket_id, updated)
  await collection.createIndex(
    { 'data.ticket_id': 1, updated: 1 },
    { unique: true },
  )
  await collection.createIndex({ updated: -1 })
  await collection.createIndex({ state: 1 })

  let nextWarningId = 1
  let totalProcessed = 0
  let totalAdded = 0
  for (const [fileIndex, file] of files.entries()) {
    console.log(`[${fileIndex + 1}/${files.length}] Processing ${file}...`)
    try {
      const fileData = JSON.parse(readFileSync(file, 'utf-8'))
      const operations = fileData.results.flatMap((data: any) => {
        if (!data.ticket_id) {
          console.log(
            `[Warning #${nextWarningId++}] Missing ticket_id`,
            JSON.stringify(data),
          )
          return []
        }
        const info = EntryInfo.parse(data)
        const updated = new Date(Date.parse(info.last_activity))
        updated.setMilliseconds(0)
        const operation: AnyBulkWriteOperation<TicketSnapshot> = {
          updateOne: {
            filter: { 'data.ticket_id': info.ticket_id, updated },
            update: { $setOnInsert: { data, updated } },
            upsert: true,
          },
        }
        return [operation]
      })
      const writeResult = await collection.bulkWrite(operations)
      const nProcessed = operations.length
      const nAdded = writeResult.getUpsertedIds().length
      totalProcessed += nProcessed
      totalAdded += nAdded
      console.log(
        `Processed ${file} (${totalProcessed} (+${nProcessed}) processed, ${totalAdded} (+${nAdded}) added)`,
      )
    } catch (error) {
      console.error(`Unable to process ${file}`, error)
    }
  }
}

withDb(main)
