import { Env } from 'lazy-strict-env'
import { MongoClient } from 'mongodb'
import { z } from 'zod'

const env = Env(
  z.object({
    POSTER_MONGODB_URI: z.string().url(),
  }),
)

export interface TweetTask {
  /** Ticket ID or tweet key */
  _id: string

  /** Status */
  status: 'pending' | 'completed' | 'error'

  /** More information */
  result: any

  /** Error if any */
  error?: any
}

export interface PosterState {
  _id: 'state'
  lastTweetedAt?: Date
  nextSince?: Date
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
  return await MongoClient.connect(env.POSTER_MONGODB_URI)
}
export function getTweetTaskCollection(client: MongoClient) {
  return client.db().collection<TweetTask>('tweet_tasks')
}
export function getStateCollection(client: MongoClient) {
  return client.db().collection<PosterState>('state')
}
