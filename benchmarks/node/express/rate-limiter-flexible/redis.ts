import fs from 'node:fs'
import Redis from 'ioredis'
import { run } from '../../../lib/runner.js'
import { RateLimiterRedis } from 'rate-limiter-flexible'

const pkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/rate-limiter-flexible/package.json', import.meta.url), 'utf-8'))

const redis = new Redis({ host: 'localhost', port: 6379, maxRetriesPerRequest: 1, lazyConnect: true })
try {
  await redis.connect()
  await redis.ping()
} catch {
  console.log('Redis not available, skipping')
  process.exit(0)
}

const limiter = new RateLimiterRedis({ storeClient: redis, points: 1_000_000, duration: 60, keyPrefix: 'bench:node-express-rlf:' })

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

await run({
  framework: 'express',
  library: 'rate-limiter-flexible',
  store: 'redis',
  runtime: 'node',
  versions: { 'rate-limiter-flexible': pkg.version, ioredis: JSON.parse(fs.readFileSync(new URL('../../../node_modules/ioredis/package.json', import.meta.url), 'utf-8')).version },
  fn: async (key) => {
    await limiter.consume(key)
    next()
  },
  isSync: false,
  cleanup: async () => {
    const keys = await redis.keys('bench:node-express-rlf:*')
    if (keys.length) await redis.del(...keys)
    await redis.quit()
  }
})
