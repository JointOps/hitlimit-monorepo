import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
import { hitlimit } from '../../../../packages/hitlimit/dist/index.js'
import { sqliteStore } from '../../../../packages/hitlimit/dist/stores/sqlite.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()
const store = sqliteStore({ path: ':memory:' })
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
  framework: 'fastify',
  library: 'hitlimit',
  store: 'sqlite',
  runtime: 'node',
  versions: { hitlimit: version },
  fn: (key) => mw(getReq(key), res, next),
  isSync: true,
  cleanup: () => store.shutdown?.()
})
