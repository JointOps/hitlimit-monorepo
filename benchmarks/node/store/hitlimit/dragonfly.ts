import fs from 'node:fs'
import Redis from 'ioredis'
import { run } from '../../../lib/runner.js'
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

const store = dragonflyStore({ url: 'redis://localhost:6382', keyPrefix: 'bench:node-store-hl:' })

await run({
  framework: 'store',
  library: 'hitlimit',
  store: 'dragonfly',
  runtime: 'node',
  versions: { hitlimit: version, ioredis: JSON.parse(fs.readFileSync(new URL('../../../node_modules/ioredis/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => store.hit(key, 60000, 1_000_000),
  isSync: false,
  cleanup: async () => {
    const c = new Redis({ host: 'localhost', port: 6382 })
    const keys = await c.keys('bench:node-store-hl:*')
    if (keys.length) await c.del(...keys)
    await c.quit()
    await store.shutdown?.()
  }
})
