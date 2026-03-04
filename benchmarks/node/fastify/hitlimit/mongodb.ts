import fs from 'node:fs'
import { MongoClient } from 'mongodb'
import { run } from '../../../lib/runner.js'
import Fastify from 'fastify'
import { hitlimit } from '../../../../packages/hitlimit/dist/fastify.js'
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
const app = Fastify()

await app.register(hitlimit, {
  limit: 1_000_000,
  window: '1m',
  store,
  headers: { standard: false, legacy: false }
})

app.get('/test', () => 'ok')
await app.ready()

await run({
  framework: 'fastify',
  library: 'hitlimit',
  store: 'mongodb',
  runtime: 'node',
  versions: { hitlimit: version, fastify: JSON.parse(fs.readFileSync(new URL('../../../node_modules/fastify/package.json', import.meta.url), 'utf-8')).version, mongodb: JSON.parse(fs.readFileSync(new URL('../../../node_modules/mongodb/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => app.inject({ method: 'GET', url: '/test', remoteAddress: key }),
  isSync: false,
  cleanup: async () => {
    await app.close()
    await db.collection('bench_node_fastify_hl_hits').drop().catch(() => {})
    await db.collection('bench_node_fastify_hl_bans').drop().catch(() => {})
    await db.collection('bench_node_fastify_hl_violations').drop().catch(() => {})
    store.shutdown?.()
    await client.close()
  }
})
