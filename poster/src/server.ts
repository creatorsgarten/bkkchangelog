import Fastify, { FastifyInstance } from 'fastify'
import { connectToDatabase } from './_db'
import {
  enableForkMode,
  forkGenerateImageWorker,
  workOnNextTask,
} from './_tasks'
import { Transform } from 'stream'

enableForkMode()

async function main() {
  if (process.argv.includes('--generate-image')) {
    await forkGenerateImageWorker()
  } else {
    await runServer()
  }
}

async function runServer() {
  const db = await connectToDatabase()
  const server: FastifyInstance = Fastify({
    logger: true,
  })

  server.get('/', async (request, reply) => {
    return { name: 'bkkchangelog-poster' }
  })

  server.post('/work', async (request, reply) => {
    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/plain',
    })
    workOnNextTask(db, (message) => {
      request.log.info(message)
      reply.raw.write(Buffer.from(message + '\n'))
    })
      .then(() => {
        reply.raw.end()
      })
      .catch((err) => {
        reply.raw.write(Buffer.from(String(err?.stack || err) + '\n'))
        reply.raw.end()
      })
  })

  try {
    await server.listen({ port: +process.env.PORT! || 34763, host: '0.0.0.0' })
    const address = server.server.address()
    const port = typeof address === 'string' ? address : address?.port
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

main()
