import Fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify'

const server: FastifyInstance = Fastify({
  logger: true,
})

server.get('/ping', async (request, reply) => {
  return { pong: 'it worked!' }
})
server.get('/', async (request, reply) => {
  return { name: 'bkkchangelog' }
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
