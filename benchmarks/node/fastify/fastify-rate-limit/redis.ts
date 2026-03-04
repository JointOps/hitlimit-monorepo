import fs from 'node:fs'
import { createRequire } from 'node:module'
import Redis from 'ioredis'
import { run } from '../../../lib/runner.js'

const require = createRequire(import.meta.url)
const RedisStore = require('@fastify/rate-limit/store/RedisStore')

const rateLimitPkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/@fastify/rate-limit/package.json', import.meta.url), 'utf-8'))

const redis = new Redis({ host: 'localhost', port: 6379, maxRetriesPerRequest: 1, lazyConnect: true })
try {
  await redis.connect()
  await redis.ping()
} catch {
  console.log('Redis not available, skipping')
  process.exit(0)
}

const store = new RedisStore(redis, 'bench:node-fastify-frl:', false, false)
const timeWindow = 60_000
const max = 1_000_000

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

// Matches the overhead in hitlimit's middleware: key extraction, store call,
// allowed check, remaining/resetIn math, and next() call
function rateLimit(req: any, _res: any, done: any): Promise<void> {
  const ip = req.ip
  return new Promise((resolve, reject) => {
    store.incr(ip, (err: any, result: any) => {
      if (err) return reject(err)
      const allowed = result.current <= max
      const remaining = Math.max(0, max - result.current)
      const resetIn = Math.ceil(result.ttl / 1000)
      if (!allowed) return resolve()
      done()
      resolve()
    }, timeWindow, max)
  })
}

await run({
  framework: 'fastify',
  library: 'fastify-rate-limit',
  store: 'redis',
  runtime: 'node',
  versions: { '@fastify/rate-limit': rateLimitPkg.version, ioredis: JSON.parse(fs.readFileSync(new URL('../../../node_modules/ioredis/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => rateLimit(getReq(key), res, next),
  isSync: false,
  cleanup: async () => {
    const keys = await redis.keys('bench:node-fastify-frl:*')
    if (keys.length) await redis.del(...keys)
    await redis.quit()
  }
})
