import { AnyBulkWriteOperation, WithId } from 'mongodb'
import { z } from 'zod'
import {
  Changelog,
  ConnectFn,
  getTicketSnapshotsCollection,
  TicketSnapshot,
  withDb,
} from './_db'

const ChangelogEntryInfo = z.object({
  state: z.string(),
  address: z.string(),
  coords: z.tuple([z.coerce.number(), z.coerce.number()]),
  problem_type_abdul: z.array(z.string()).optional().default([]),
})

async function main(connect: ConnectFn) {
  const client = await connect()
  const collection = getTicketSnapshotsCollection(client)
  const changelog = client.db().collection<Changelog>('changelog')

  await changelog.createIndexes([
    // Search by finish time
    { key: { finished: -1 } },
  ])

  // Get the ticket IDs that have changed in the last 3 days
  const FINISHED = 'เสร็จสิ้น'
  const ticketIds = await collection
    .aggregate([
      { $match: { updated: { $gte: new Date(Date.now() - 3 * 86400e3) } } },
      { $match: { 'data.state': FINISHED } },
      { $group: { _id: '$data.ticket_id' } },
    ])
    .toArray()
    .then((results) => results.map((result) => result._id))

  // Get all the history of the tickets that have changed
  const ticketsCursor = collection.aggregate([
    { $match: { 'data.ticket_id': { $in: ticketIds } } },
    { $group: { _id: '$data.ticket_id', entries: { $push: '$$ROOT' } } },
  ])
  let writeOperations: AnyBulkWriteOperation<Changelog>[] = []
  let added = 0
  let removed = 0
  const flush = async () => {
    if (writeOperations.length > 0) {
      await changelog.bulkWrite(writeOperations)
      console.log(`=> ${added} added, ${removed} removed`)
      writeOperations = []
    }
  }
  for await (const ticket of ticketsCursor) {
    const entries = (ticket.entries as any[]).flatMap(
      (e: WithId<TicketSnapshot>) => {
        const info = ChangelogEntryInfo.safeParse(e.data)
        if (info.success) {
          return [{ _id: e._id, updated: e.updated, data: info.data }]
        } else {
          console.error(
            'Invalid changelog entry',
            JSON.stringify(e.data),
            String(info.error),
          )
          return []
        }
      },
    )
    entries.sort((a, b) => a.updated.getTime() - b.updated.getTime())
    let finishingEntry: (typeof entries)[number] | null = null
    for (const entry of entries) {
      if (entry.data.state === FINISHED) {
        finishingEntry = finishingEntry || entry
      } else {
        finishingEntry = null
      }
    }
    const lastEntry = entries.slice(-1)[0]
    if (finishingEntry) {
      const finishedAt = finishingEntry.updated
      // The address should end with "แขวง__ เขต__ กรุงเทพมหานคร <รหัสไปรษณีย์> ประเทศไทย"
      const m = lastEntry.data.address
        .trim()
        .match(
          /แขวง\s*(\S*?)\s+เขต\s*(\S*?)\s+กรุงเทพมหานคร\s+(\d+)\s+ประเทศไทย$/,
        )
      if (!m) continue
      const [, subdistrict, district, postcode] = m
      console.log(
        ticket._id,
        finishedAt,
        lastEntry.data.address,
        lastEntry.data.coords,
      )
      const changelog: Changelog = {
        _id: ticket._id,
        finished: finishedAt,
        district,
        subdistrict,
        postcode,
        location: { type: 'Point', coordinates: lastEntry.data.coords },
        ticketSnapshotId: lastEntry._id,
        problemTypes: lastEntry.data.problem_type_abdul,
      }
      writeOperations.push({
        updateOne: {
          filter: { _id: ticket._id },
          update: { $set: changelog },
          upsert: true,
        },
      })
      added++
      console.log(
        '✅',
        changelog._id,
        changelog.location.coordinates,
        changelog.problemTypes,
        lastEntry.data.address,
      )
    } else {
      writeOperations.push({ deleteOne: { filter: { _id: ticket._id } } })
      removed++
      console.log('❌', ticket._id, lastEntry.data.state)
    }
    if (writeOperations.length >= 100) {
      await flush()
    }
  }
  await flush()
}

withDb(main)
