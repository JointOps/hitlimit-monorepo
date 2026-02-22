import fs from 'node:fs'
import Redis from 'ioredis'
import { run } from '../../../lib/runner.js'
import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'

const fastifyPkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/fastify/package.json', import.meta.url), 'utf-8'))
const rateLimitPkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/@fastify/rate-limit/package.json', import.meta.url), 'utf-8'))

const redis = new Redis({ host: 'localhost', port: 6379, maxRetriesPerRequest: 1, lazyConnect: true })
try {
  await redis.connect()
  await redis.ping()
} catch {
  console.log('Redis not available, skipping')
  process.exit(0)
}

const app = Fastify()

await app.register(rateLimit, {
  max: 1_000_000,
  timeWindow: '1 minute',
  redis
})

app.get('/test', () => 'ok')
await app.ready()

await run({
  framework: 'fastify',
  library: 'fastify-rate-limit',
  store: 'redis',
  runtime: 'node',
  versions: { '@fastify/rate-limit': rateLimitPkg.version, fastify: fastifyPkg.version, ioredis: JSON.parse(fs.readFileSync(new URL('../../../node_modules/ioredis/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => app.inject({ method: 'GET', url: '/test', remoteAddress: key }),
  isSync: false,
  cleanup: async () => {
    await app.close()
    await redis.quit()
  }
})
