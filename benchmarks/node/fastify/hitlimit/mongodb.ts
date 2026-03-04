import fs from 'node:fs'
import { MongoClient } from 'mongodb'
import { run } from '../../../lib/runner.js'
import { hitlimit } from '../../../../packages/hitlimit/dist/index.js'
import { mongoStore } from '../../../../packages/hitlimit/dist/stores/mongodb.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()

let client: MongoClient
let db: any
try {
  client = new MongoClient('mongodb://localhost:27017')
  await client.connect()
  await client.db('admin').command({ ping: 1 })
  db = client.db('hitlimit_bench')
} catch {
  console.log('MongoDB not available, skipping')
  process.exit(0)
}

const store = mongoStore({ db, collectionPrefix: 'bench_node_fastify_hl' })
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
  store: 'mongodb',
  runtime: 'node',
  versions: { hitlimit: version, mongodb: JSON.parse(fs.readFileSync(new URL('../../../node_modules/mongodb/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => mw(getReq(key), res, next),
  isSync: false,
  cleanup: async () => {
    await db.collection('bench_node_fastify_hl_hits').drop().catch(() => {})
    await db.collection('bench_node_fastify_hl_bans').drop().catch(() => {})
    await db.collection('bench_node_fastify_hl_violations').drop().catch(() => {})
    store.shutdown?.()
    await client.close()
  }
})
