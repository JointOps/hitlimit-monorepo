import fs from 'node:fs'
import Redis from 'ioredis'
import { run } from '../../../lib/runner.js'
import { valkeyStore } from '../../../../packages/hitlimit/dist/stores/valkey.js'

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

const store = valkeyStore({ url: 'redis://localhost:6381', keyPrefix: 'bench:node-store-hl:' })

await run({
  framework: 'store',
  library: 'hitlimit',
  store: 'valkey',
  runtime: 'node',
  versions: { hitlimit: version, ioredis: JSON.parse(fs.readFileSync(new URL('../../../node_modules/ioredis/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => store.hit(key, 60000, 1_000_000),
  isSync: false,
  cleanup: async () => {
    const c = new Redis({ host: 'localhost', port: 6381 })
    const keys = await c.keys('bench:node-store-hl:*')
    if (keys.length) await c.del(...keys)
    await c.quit()
    await store.shutdown?.()
  }
})
