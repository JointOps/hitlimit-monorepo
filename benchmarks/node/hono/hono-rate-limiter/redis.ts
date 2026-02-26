import fs from 'node:fs'
import Redis from 'ioredis'
import { run } from '../../../lib/runner.js'
import { Hono } from 'hono'
import { rateLimiter, RedisStore } from 'hono-rate-limiter'

const pkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/hono-rate-limiter/package.json', import.meta.url), 'utf-8'))
const honoPkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/hono/package.json', import.meta.url), 'utf-8'))

const redis = new Redis({ host: 'localhost', port: 6379, maxRetriesPerRequest: 1, lazyConnect: true })
try {
  await redis.connect()
  await redis.ping()
} catch {
  console.log('Redis not available, skipping')
  process.exit(0)
}

const client = {
  scriptLoad: (script: string) => redis.call('SCRIPT', 'LOAD', script) as Promise<string>,
  evalsha: (sha1: string, keys: string[], args: unknown[]) => redis.evalsha(sha1, keys.length, ...keys, ...(args as string[])),
  decr: (key: string) => redis.decr(key),
  del: (key: string) => redis.del(key),
}

const app = new Hono()

app.use(rateLimiter({
  windowMs: 60_000,
  limit: 1_000_000,
  keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown',
  store: new RedisStore({ client })
}))
app.get('/test', (c) => c.text('ok'))

await run({
  framework: 'hono',
  library: 'hono-rate-limiter',
  store: 'redis',
  runtime: 'node',
  versions: { 'hono-rate-limiter': pkg.version, hono: honoPkg.version, ioredis: JSON.parse(fs.readFileSync(new URL('../../../node_modules/ioredis/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => app.request('/test', { headers: { 'x-forwarded-for': key } }),
  isSync: false,
  cleanup: async () => {
    await redis.quit()
  }
})
