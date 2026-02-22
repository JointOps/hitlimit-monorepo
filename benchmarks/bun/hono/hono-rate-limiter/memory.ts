import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
import { Hono } from 'hono'
import { rateLimiter } from 'hono-rate-limiter'

const pkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/hono-rate-limiter/package.json', import.meta.url), 'utf-8'))
const honoPkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/hono/package.json', import.meta.url), 'utf-8'))

const app = new Hono()

app.use(rateLimiter({
  windowMs: 60_000,
  limit: 1_000_000,
  keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown'
}))
app.get('/test', (c) => c.text('ok'))

await run({
  framework: 'hono',
  library: 'hono-rate-limiter',
  store: 'memory',
  runtime: 'bun',
  versions: { 'hono-rate-limiter': pkg.version, hono: honoPkg.version },
  fn: (key) => app.request('/test', { headers: { 'x-forwarded-for': key } }),
  isSync: false,
  cleanup: () => {}
})
