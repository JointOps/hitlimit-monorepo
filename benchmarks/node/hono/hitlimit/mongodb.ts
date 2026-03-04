import fs from 'node:fs'
import { MongoClient } from 'mongodb'
import { run } from '../../../lib/runner.js'
import { Hono } from 'hono'
import { hitlimit } from '../../../../packages/hitlimit/dist/hono.js'
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

const store = mongoStore({ db, collectionPrefix: 'bench_node_hono_hl' })
const app = new Hono()

app.use(hitlimit({
  limit: 1_000_000,
  window: '1m',
  store,
  headers: { standard: false, legacy: false }
}))
app.get('/test', (c) => c.text('ok'))

await run({
  framework: 'hono',
  library: 'hitlimit',
  store: 'mongodb',
  runtime: 'node',
  versions: { hitlimit: version, hono: JSON.parse(fs.readFileSync(new URL('../../../node_modules/hono/package.json', import.meta.url), 'utf-8')).version, mongodb: JSON.parse(fs.readFileSync(new URL('../../../node_modules/mongodb/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => app.request('/test', { headers: { 'x-forwarded-for': key } }),
  isSync: false,
  cleanup: async () => {
    await db.collection('bench_node_hono_hl_hits').drop().catch(() => {})
    await db.collection('bench_node_hono_hl_bans').drop().catch(() => {})
    await db.collection('bench_node_hono_hl_violations').drop().catch(() => {})
    store.shutdown?.()
    await client.close()
  }
})
