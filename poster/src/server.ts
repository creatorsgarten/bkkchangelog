import Fastify, { FastifyInstance, FastifyRequest } from 'fastify'
import { connectToDatabase, getTwitterThreadCollection } from './_db'
import {
  enableForkMode,
  forkGenerateImageWorker,
  workOnNextTask,
} from './_tasks'
import { Transform } from 'stream'
import { Env } from 'lazy-strict-env'
import { z } from 'zod'

enableForkMode()

async function main() {
  if (process.argv.includes('--generate-image')) {
    await forkGenerateImageWorker()
  } else {
    await runServer()
  }
}

const authorizationEnv = Env(
  z.object({
    SERVICE_API_TOKEN: z.string(),
  }),
)
function authorize(req: FastifyRequest) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token || token !== authorizationEnv.SERVICE_API_TOKEN) {
    throw new Error('This API requires a valid API token (it is not public)')
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

  server.get('/twitterThreads', async (request, reply) => {
    authorize(request)
    const twitterThreads = getTwitterThreadCollection(db)
    return await twitterThreads.find({}).toArray()
  })

  server.post('/work', async (request, reply) => {
    authorize(request)
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
