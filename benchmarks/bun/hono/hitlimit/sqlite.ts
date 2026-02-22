import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
import { Hono } from 'hono'
import { hitlimit } from '../../../../packages/hitlimit-bun/dist/hono.js'
import { sqliteStore } from '../../../../packages/hitlimit-bun/dist/stores/sqlite.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()
const store = sqliteStore({ path: ':memory:' })
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
  store: 'sqlite',
  runtime: 'bun',
  versions: { 'hitlimit-bun': version, hono: JSON.parse(fs.readFileSync(new URL('../../../node_modules/hono/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => app.request('/test', { headers: { 'x-forwarded-for': key } }),
  isSync: false, // Hono middleware is always async
  cleanup: () => store.shutdown?.()
})
