import { createWriteStream, readFileSync } from 'fs'
import { globbySync } from 'globby'
import { Env } from 'lazy-strict-env'
import { MongoClient } from 'mongodb'
import { z } from 'zod'

interface TicketSnapshot {
  data: any
  updated: Date
}
interface Changelog {
  /** This is the ticket ID */
  _id: string
  finished: Date
}

const env = Env(
  z.object({
    MONGODB_URI: z.string().url(),
  }),
)

async function main() {
  const client = await MongoClient.connect(env.MONGODB_URI)
  try {
    const collection = client
      .db()
      .collection<TicketSnapshot>('ticket_snapshots')
    const changelog = client.db().collection<Changelog>('changelog')

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
    for await (const ticket of ticketsCursor) {
      const entries: TicketSnapshot[] = ticket.entries
      entries.sort((a, b) => a.updated.getTime() - b.updated.getTime())
      let finishedAt = null
      for (const entry of entries) {
        if (entry.data.state === FINISHED) {
          finishedAt = finishedAt || entry.updated
        } else {
          finishedAt = null
        }
      }
      const entry = entries.slice(-1)[0]
      console.log(ticket._id, finishedAt, entry.data.address, entry.data.coords)
    }

    // Ensure changelog has an index on the date
  } finally {
    await client.close()
  }
}

main()
