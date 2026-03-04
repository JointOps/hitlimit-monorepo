import fs from 'node:fs'
import { MongoClient } from 'mongodb'
import { run } from '../../../lib/runner.js'
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

const prefix = 'bench_node_store_hl'
const store = mongoStore({ db, collectionPrefix: prefix })

await run({
  framework: 'store',
  library: 'hitlimit',
  store: 'mongodb',
  runtime: 'node',
  versions: {
    hitlimit: version,
    mongodb: JSON.parse(fs.readFileSync(new URL('../../../node_modules/mongodb/package.json', import.meta.url), 'utf-8')).version
  },
  fn: (key) => store.hit(key, 60000, 1_000_000),
  isSync: false,
  cleanup: async () => {
    await db.collection(`${prefix}_hits`).drop().catch(() => {})
    await db.collection(`${prefix}_bans`).drop().catch(() => {})
    await db.collection(`${prefix}_violations`).drop().catch(() => {})
    store.shutdown?.()
    await client.close()
  }
})
