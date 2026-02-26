import fs from 'node:fs'
import Redis from 'ioredis'
import { run } from '../../../lib/runner.js'
import { hitlimit } from '../../../../packages/hitlimit-bun/dist/index.js'
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

const store = dragonflyStore({ url: 'redis://localhost:6382', keyPrefix: 'bench:bun-serve-hl:' })

const handler = (_req: Request) => new Response('ok')
const mw = hitlimit(
  { limit: 1_000_000, window: '1m', store, headers: { standard: false, legacy: false } },
  handler
)

const req = new Request('http://localhost/test')
let currentIp = '127.0.0.1'
const server: any = {
  requestIP: () => ({ address: currentIp })
}

await run({
  framework: 'bun-serve',
  library: 'hitlimit',
  store: 'dragonfly',
  runtime: 'bun',
  versions: { 'hitlimit-bun': version, ioredis: JSON.parse(fs.readFileSync(new URL('../../../node_modules/ioredis/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => {
    currentIp = key
    return mw(req, server)
  },
  isSync: false,
  cleanup: async () => {
    const c = new Redis({ host: 'localhost', port: 6382 })
    const keys = await c.keys('bench:bun-serve-hl:*')
    if (keys.length) await c.del(...keys)
    await c.quit()
    await store.shutdown?.()
  }
})
