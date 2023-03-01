import { Env } from 'lazy-strict-env'
import { MongoClient, ObjectId } from 'mongodb'
import { z } from 'zod'

const env = Env(
  z.object({
    MONGODB_URI: z.string().url(),
  }),
)

export interface TicketSnapshot {
  data: any
  updated: Date
}

export interface Changelog {
  /** _id is the ticket ID */
  _id: string
  /** The time that we detect the ticket transitioned into a finished state */
  finished: Date

  district: string
  subdistrict: string
  postcode: string
  location: { type: 'Point'; coordinates: [number, number] }
  ticketSnapshotId: ObjectId
  problemTypes: string[]
}

export type ConnectFn = () => Promise<MongoClient>

export async function withDb(f: (connect: ConnectFn) => Promise<void>) {
  let client: MongoClient | undefined
  try {
    await f(async () => {
      client ??= await connectToDatabase()
      return client
    })
  } finally {
    await client?.close()
  }
}

export async function connectToDatabase(): Promise<MongoClient> {
  return await MongoClient.connect(env.MONGODB_URI)
}

export function getTicketSnapshotsCollection(client: MongoClient) {
  return client.db().collection<TicketSnapshot>('ticket_snapshots')
}
export function getChangelogCollection(client: MongoClient) {
  return client.db().collection<Changelog>('changelog')
}
