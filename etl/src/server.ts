import { initTRPC, TRPCError } from '@trpc/server'
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
import {
  OperationMeta,
  generateOpenAPIDocumentFromTRPCRouter,
} from 'openapi-trpc'

const dbPromise = connectToDatabase()

const server: FastifyInstance = Fastify({
  logger: true,
})

server.get('/', async (request, reply) => {
  return { name: 'bkkchangelog' }
})

export const t = initTRPC
  .meta<OperationMeta>()
  .context<FastifyRequest>()
  .create()

const parseDate = (value?: string) => {
  const date = value ? new Date(value) : null
  return date && !isNaN(date.getTime()) ? date : null
}

const getChangelog = t.procedure
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
  })

const getTicketSnapshots = t.procedure
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
  })

export const appRouter = t.router({
  getChangelog,
  getTicketSnapshots,

  changelogEntries: t.router({
    list: getChangelog,
    get: t.procedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const client = await dbPromise
        const changelog = getChangelogCollection(client)
        const entry = await changelog.findOne({ _id: input.id })
        if (!entry) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Changelog entry ${input.id} not found`,
          })
        }
        const { ticketSnapshotId, ...rest } = entry
        const snapshot = await getTicketSnapshotsCollection(client).findOne({
          _id: ticketSnapshotId,
        })
        if (!snapshot) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Snapshot ${ticketSnapshotId} not found for changelog entry ${input.id}`,
          })
        }
        return { ...rest, snapshot }
      }),
    count: t.procedure
      .input(
        z.object({
          since: z.string().datetime(),
          until: z.string().datetime(),
        }),
      )
      .query(async ({ input }) => {
        const client = await dbPromise
        const changelog = getChangelogCollection(client)
        const totalBeforeUntilPromise = changelog.countDocuments({
          finished: { $gte: new Date(input.since), $lt: new Date(input.until) },
        })
        const idsOnUntilPromise = changelog
          .find({ finished: new Date(input.until) }, { projection: { _id: 1 } })
          .toArray()
          .then((results) => results.map((result) => result._id))
        return {
          totalBeforeUntil: await totalBeforeUntilPromise,
          idsOnUntil: await idsOnUntilPromise,
        }
      }),
  }),

  ticketSnapshots: t.router({
    list: getTicketSnapshots,
  }),
})

export type AppRouter = typeof appRouter

const doc = generateOpenAPIDocumentFromTRPCRouter(appRouter, {
  pathPrefix: '/api',
})

server.get('/api.json', async (request, reply) => {
  return doc
})

server.get('/api', async (request, reply) => {
  reply.header('Content-Type', 'text/html')
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="SwaggerUI" />
    <title>SwaggerUI</title>
    <link href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4.15.5/swagger-ui.min.css" rel="stylesheet" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => { window.ui = SwaggerUIBundle({ url: '/api.json', dom_id: '#swagger-ui' }) }
    </script>
  </body>
</html>`
})

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
