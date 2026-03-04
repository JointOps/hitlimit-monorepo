import fs from 'node:fs'
import { createRequire } from 'node:module'
import { run } from '../../../lib/runner.js'

const require = createRequire(import.meta.url)
const LocalStore = require('@fastify/rate-limit/store/LocalStore')

const rateLimitPkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/@fastify/rate-limit/package.json', import.meta.url), 'utf-8'))

const store = new LocalStore(false, false, 5000)
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

const next = () => {}

// Matches the overhead in hitlimit's middleware: key extraction, store call,
// allowed check, remaining/resetIn math, and next() call
function rateLimit(req: any, _res: any, done: any) {
  const ip = req.ip
  store.incr(ip, (_err: any, result: any) => {
    const allowed = result.current <= max
    const remaining = Math.max(0, max - result.current)
    const resetIn = Math.ceil(result.ttl / 1000)
    if (!allowed) return
    done()
  }, timeWindow, max)
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

await run({
  framework: 'fastify',
  library: 'fastify-rate-limit',
  store: 'memory',
  runtime: 'node',
  versions: { '@fastify/rate-limit': rateLimitPkg.version },
  fn: (key) => rateLimit(getReq(key), res, next),
  isSync: true,
  cleanup: () => {}
})
