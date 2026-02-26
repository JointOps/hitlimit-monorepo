import fs from 'node:fs'
import Redis from 'ioredis'
import { run } from '../../../lib/runner.js'
import { Elysia } from 'elysia'
import { hitlimit } from '../../../../packages/hitlimit-bun/dist/elysia.js'
import { dragonflyStore } from '../../../../packages/hitlimit-bun/dist/stores/dragonfly.js'

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

const store = dragonflyStore({ url: 'redis://localhost:6382', keyPrefix: 'bench:bun-elysia-hl:' })

const app = new Elysia()
  .use(hitlimit({
    limit: 1_000_000,
    window: '1m',
    store,
    headers: { standard: false, legacy: false }
  }))
  .get('/test', () => 'ok')

await run({
  framework: 'elysia',
  library: 'hitlimit',
  store: 'dragonfly',
  runtime: 'bun',
  versions: { 'hitlimit-bun': version, elysia: JSON.parse(fs.readFileSync(new URL('../../../node_modules/elysia/package.json', import.meta.url), 'utf-8')).version, ioredis: JSON.parse(fs.readFileSync(new URL('../../../node_modules/ioredis/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => app.handle(new Request('http://localhost/test', { headers: { 'x-forwarded-for': key } })),
  isSync: false,
  cleanup: async () => {
    const c = new Redis({ host: 'localhost', port: 6382 })
    const keys = await c.keys('bench:bun-elysia-hl:*')
    if (keys.length) await c.del(...keys)
    await c.quit()
    await store.shutdown?.()
  }
})
