import Fastify, { FastifyInstance, FastifyRequest } from 'fastify'

const server: FastifyInstance = Fastify({
  logger: true,
})

server.get('/', async (request, reply) => {
  return { name: 'bkkchangelog-poster' }
})

const start = async () => {
  try {
    await server.listen({ port: +process.env.PORT! || 34762, host: '0.0.0.0' })
    const address = server.server.address()
    const port = typeof address === 'string' ? address : address?.port
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
