import Fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify'
import {
  connectToDatabase,
  getChangelogCollection,
  getTicketSnapshotsCollection,
} from './_db'

const dbPromise = connectToDatabase()
const server: FastifyInstance = Fastify({
  logger: true,
})

server.get('/ping', async (request, reply) => {
  return { pong: 'it worked!' }
})

server.get('/', async (request, reply) => {
  return { name: 'bkkchangelog' }
})

server.get('/changelog', async (request, reply) => {
  const query = request.query as {
    sort?: string
    since?: string
    until?: string
  }
  const client = await dbPromise
  const snapshots = getTicketSnapshotsCollection(client)
  const changelog = getChangelogCollection(client)
  const parseDate = (value?: string) => {
    const date = value ? new Date(value) : null
    return date && !isNaN(date.getTime()) ? date : null
  }
  const since = parseDate(query.since)
  const until = parseDate(query.until)
  let cursor = changelog
    .find(
      since || until
        ? {
            finished: {
              ...(since ? { $gte: since } : {}),
              ...(until ? { $lte: until } : {}),
            },
          }
        : {},
    )
    .sort({ finished: query.sort === 'asc' ? 1 : -1 })
    .limit(64)
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
  return { results }
})

server.get('/tickets/:id', async (request, reply) => {
  const client = await dbPromise
  const snapshots = getTicketSnapshotsCollection(client)
  const params = request.params as { id: string }
  const ticketId = String(params.id)
  const snapshotsCursor = snapshots
    .find({ 'data.ticket_id': ticketId })
    .sort({ updated: -1 })
    .limit(64)
  return { results: await snapshotsCursor.toArray() }
})

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
