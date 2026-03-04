import fs from 'node:fs'
import { MongoClient } from 'mongodb'
import { run } from '../../../lib/runner.js'
import { hitlimit } from '../../../../packages/hitlimit-bun/dist/index.js'
import { mongoStore } from '../../../../packages/hitlimit-bun/dist/stores/mongodb.js'

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

const store = mongoStore({ db, collectionPrefix: 'bench_bun_serve_hl' })

const handler = (_req: Request) => new Response('ok')
const mw = hitlimit(
  { limit: 1_000_000, window: '1m', store, headers: { standard: false, legacy: false } },
  handler
)

const req = new Request('http://localhost/test')
let currentIp = '127.0.0.1'
const server: any = {
  requestIP: () => ({ address: currentIp })
}

await run({
  framework: 'bun-serve',
  library: 'hitlimit',
  store: 'mongodb',
  runtime: 'bun',
  versions: { 'hitlimit-bun': version, mongodb: JSON.parse(fs.readFileSync(new URL('../../../node_modules/mongodb/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => {
    currentIp = key
    return mw(req, server)
  },
  isSync: false,
  cleanup: async () => {
    await db.collection('bench_bun_serve_hl_hits').drop().catch(() => {})
    await db.collection('bench_bun_serve_hl_bans').drop().catch(() => {})
    await db.collection('bench_bun_serve_hl_violations').drop().catch(() => {})
    store.shutdown?.()
    await client.close()
  }
})
