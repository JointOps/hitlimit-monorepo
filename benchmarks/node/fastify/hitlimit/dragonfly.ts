import fs from 'node:fs'
import Redis from 'ioredis'
import { run } from '../../../lib/runner.js'
import Fastify from 'fastify'
import { hitlimit } from '../../../../packages/hitlimit/dist/fastify.js'
import { dragonflyStore } from '../../../../packages/hitlimit/dist/stores/dragonfly.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()

const redis = new Redis({ host: 'localhost', port: 6382, maxRetriesPerRequest: 1, lazyConnect: true })
try {
  await redis.connect()
  await redis.ping()
} catch {
  console.log('DragonflyDB not available, skipping')
  process.exit(0)
}
await redis.quit()

const store = dragonflyStore({ url: 'redis://localhost:6382', keyPrefix: 'bench:node-fastify-hl:' })
const app = Fastify()

await app.register(hitlimit, {
  limit: 1_000_000,
  window: '1m',
  store,
  headers: { standard: false, legacy: false }
})

app.get('/test', () => 'ok')
await app.ready()

await run({
  framework: 'fastify',
  library: 'hitlimit',
  store: 'dragonfly',
  runtime: 'node',
  versions: { hitlimit: version, fastify: JSON.parse(fs.readFileSync(new URL('../../../node_modules/fastify/package.json', import.meta.url), 'utf-8')).version, ioredis: JSON.parse(fs.readFileSync(new URL('../../../node_modules/ioredis/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => app.inject({ method: 'GET', url: '/test', remoteAddress: key }),
  isSync: false,
  cleanup: async () => {
    await app.close()
    const c = new Redis({ host: 'localhost', port: 6382 })
    const keys = await c.keys('bench:node-fastify-hl:*')
    if (keys.length) await c.del(...keys)
    await c.quit()
    await store.shutdown?.()
  }
})
