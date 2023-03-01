import { initTRPC } from '@trpc/server'
import Fastify, { FastifyInstance, FastifyRequest } from 'fastify'
import {
  FastifyTRPCPluginOptions,
  fastifyTRPCPlugin,
} from '@trpc/server/adapters/fastify'
import {
  connectToDatabase,
  getChangelogCollection,
  getTicketSnapshotsCollection,
} from './_db'
import { z } from 'zod'

const dbPromise = connectToDatabase()

const server: FastifyInstance = Fastify({
  logger: true,
})

server.get('/', async (request, reply) => {
  return { name: 'bkkchangelog' }
})

export const t = initTRPC.context<FastifyRequest>().create()

export const appRouter = t.router({
  getChangelog: t.procedure
    .input(
      z.object({
        sort: z.enum(['asc', 'desc']).default('desc'),
        since: z.string().datetime().optional(),
        until: z.string().datetime().optional(),
      }),
    )
    .query(async ({ input }) => {
      const client = await dbPromise
      const snapshots = getTicketSnapshotsCollection(client)
      const changelog = getChangelogCollection(client)
      const parseDate = (value?: string) => {
        const date = value ? new Date(value) : null
        return date && !isNaN(date.getTime()) ? date : null
      }
      const since = parseDate(input.since)
      const until = parseDate(input.until)
      const filter =
        since || until
          ? {
              finished: {
                ...(since ? { $gte: since } : {}),
                ...(until ? { $lte: until } : {}),
              },
            }
          : {}
      let cursor = changelog
        .find(filter)
        .sort({ finished: input.sort === 'asc' ? 1 : -1 })
        .limit(64)
      const totalPromise = changelog.countDocuments(filter)
      const items = await cursor.toArray()
      const foundSnapshots = new Map(
        await snapshots
          .find({ _id: { $in: items.map((item) => item.ticketSnapshotId) } })
          .toArray()
          .then((results) =>
            results.map((result) => [result.data.ticket_id, result]),
          ),
      )
      const results = items.flatMap(({ ticketSnapshotId, ...rest }) => {
        const snapshot = foundSnapshots.get(rest._id)
        if (!snapshot) return []
        return [{ ...rest, snapshot }]
      })
      const total = await totalPromise
      return { total, results }
    }),

  getTicketSnapshots: t.procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const client = await dbPromise
      const snapshots = getTicketSnapshotsCollection(client)
      const filter = { 'data.ticket_id': input.id }
      const countPromise = snapshots.countDocuments(filter)
      const snapshotsCursor = snapshots
        .find(filter)
        .sort({ updated: -1 })
        .limit(64)
      const total = await countPromise
      return { total, results: await snapshotsCursor.toArray() }
    }),
})

export type AppRouter = typeof appRouter

server.register(fastifyTRPCPlugin, {
  prefix: '/api',
  trpcOptions: {
    router: appRouter,
    createContext: ({ req }) => {
      return req
    },
    onError: ({ path, error, ctx }) => {
      ctx?.log.error({ err: error }, `[${path}] ${error}`)
    },
  },
} as FastifyTRPCPluginOptions<typeof appRouter>)

const start = async () => {
  try {
    await dbPromise
    await server.listen({ port: +process.env.PORT! || 34762, host: '0.0.0.0' })
    const address = server.server.address()
    const port = typeof address === 'string' ? address : address?.port
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
