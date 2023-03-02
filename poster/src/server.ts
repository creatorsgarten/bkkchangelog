import Fastify, { FastifyInstance } from 'fastify'
import { connectToDatabase } from './_db'
import { workOnNextTask } from './_tasks'
import { Transform } from 'stream'

const dbPromise = connectToDatabase()

const server: FastifyInstance = Fastify({
  logger: true,
})

server.get('/', async (request, reply) => {
  return { name: 'bkkchangelog-poster' }
})

server.post('/work', async (request, reply) => {
  const stream = new Transform()
  workOnNextTask(await dbPromise, (message) => {
    request.log.info(message)
    stream.push(Buffer.from(message + '\n'))
  })
    .then(() => {
      stream.end()
    })
    .catch((err) => {
      stream.end(Buffer.from(String(err?.stack || err) + '\n'))
    })
  return reply.send(stream)
})

const start = async () => {
  try {
    await dbPromise
    await server.listen({ port: +process.env.PORT! || 34763, host: '0.0.0.0' })
    const address = server.server.address()
    const port = typeof address === 'string' ? address : address?.port
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
