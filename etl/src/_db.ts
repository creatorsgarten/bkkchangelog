import { Env } from 'lazy-strict-env'
import { MongoClient } from 'mongodb'
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

export type ConnectFn = () => Promise<MongoClient>

export async function withDb(f: (connect: ConnectFn) => Promise<void>) {
  let client: MongoClient | undefined
  try {
    await f(async () => {
      client ??= await MongoClient.connect(env.MONGODB_URI)
      return client
    })
  } finally {
    await client?.close()
  }
}

export function getTicketSnapshotsCollection(client: MongoClient) {
  return client.db().collection<TicketSnapshot>('ticket_snapshots')
}
