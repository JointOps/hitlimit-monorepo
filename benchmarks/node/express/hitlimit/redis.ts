import fs from 'node:fs'
import Redis from 'ioredis'
import { run } from '../../../lib/runner.js'
import { hitlimit } from '../../../../packages/hitlimit/dist/index.js'
import { redisStore } from '../../../../packages/hitlimit/dist/stores/redis.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()

const redis = new Redis({ host: 'localhost', port: 6379, maxRetriesPerRequest: 1, lazyConnect: true })
try {
  await redis.connect()
  await redis.ping()
} catch {
  console.log('Redis not available, skipping')
  process.exit(0)
}
await redis.quit()

const store = redisStore({ url: 'redis://localhost:6379', keyPrefix: 'bench:node-express-hl:' })
const mw = hitlimit({
  limit: 1_000_000,
  window: '1m',
  store,
  headers: { standard: false, legacy: false }
})

const res: any = {
  statusCode: 200,
  headersSent: false,
  setHeader: () => {},
  getHeader: () => undefined,
  status: function(c: number) { this.statusCode = c; return this },
  json: function() { return this },
  send: function() { return this },
  set: () => {},
  end: () => {}
}
const next = () => {}

const reqCache = new Map<string, any>()
function getReq(ip: string) {
  let r = reqCache.get(ip)
  if (!r) {
    r = {
      ip,
      socket: { remoteAddress: ip },
      headers: {},
      path: '/api/test',
      method: 'GET',
      url: '/api/test',
      app: { get: (s: string) => s === 'trust proxy' ? false : undefined }
    }
    reqCache.set(ip, r)
  }
  return r
}

await run({
  framework: 'express',
  library: 'hitlimit',
  store: 'redis',
  runtime: 'node',
  versions: { hitlimit: version, ioredis: JSON.parse(fs.readFileSync(new URL('../../../node_modules/ioredis/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => mw(getReq(key), res, next),
  isSync: false,
  cleanup: async () => {
    const c = new Redis({ host: 'localhost', port: 6379 })
    const keys = await c.keys('bench:node-express-hl:*')
    if (keys.length) await c.del(...keys)
    await c.quit()
    await store.shutdown?.()
  }
})
