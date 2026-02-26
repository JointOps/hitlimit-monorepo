import fs from 'node:fs'
import Redis from 'ioredis'
import { run } from '../../../lib/runner.js'
import { Hono } from 'hono'
import { hitlimit } from '../../../../packages/hitlimit-bun/dist/hono.js'
import { valkeyStore } from '../../../../packages/hitlimit-bun/dist/stores/valkey.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()

const redis = new Redis({ host: 'localhost', port: 6381, maxRetriesPerRequest: 1, lazyConnect: true })
try {
  await redis.connect()
  await redis.ping()
} catch {
  console.log('Valkey not available, skipping')
  process.exit(0)
}
await redis.quit()

const store = valkeyStore({ url: 'redis://localhost:6381', keyPrefix: 'bench:bun-hono-hl:' })
const app = new Hono()

app.use(hitlimit({
  limit: 1_000_000,
  window: '1m',
  store,
  headers: { standard: false, legacy: false }
}))
app.get('/test', (c) => c.text('ok'))

await run({
  framework: 'hono',
  library: 'hitlimit',
  store: 'valkey',
  runtime: 'bun',
  versions: { 'hitlimit-bun': version, hono: JSON.parse(fs.readFileSync(new URL('../../../node_modules/hono/package.json', import.meta.url), 'utf-8')).version, ioredis: JSON.parse(fs.readFileSync(new URL('../../../node_modules/ioredis/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => app.request('/test', { headers: { 'x-forwarded-for': key } }),
  isSync: false,
  cleanup: async () => {
    const c = new Redis({ host: 'localhost', port: 6381 })
    const keys = await c.keys('bench:bun-hono-hl:*')
    if (keys.length) await c.del(...keys)
    await c.quit()
    await store.shutdown?.()
  }
})
