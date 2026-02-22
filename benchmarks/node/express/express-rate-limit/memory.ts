import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
import { rateLimit } from 'express-rate-limit'

const pkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/express-rate-limit/package.json', import.meta.url), 'utf-8'))

const limiter = rateLimit({
  windowMs: 60_000,
  max: 1_000_000,
  standardHeaders: false,
  legacyHeaders: false
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
  library: 'express-rate-limit',
  store: 'memory',
  runtime: 'node',
  versions: { 'express-rate-limit': pkg.version },
  fn: (key) => limiter(getReq(key), res, next),
  isSync: false, // express-rate-limit uses internal async store
  cleanup: () => {}
})
