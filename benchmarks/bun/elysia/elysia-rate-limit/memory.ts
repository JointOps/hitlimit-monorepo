import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
import { Elysia } from 'elysia'
import { rateLimit } from 'elysia-rate-limit'

const pkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/elysia-rate-limit/package.json', import.meta.url), 'utf-8'))
const elysiaPkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/elysia/package.json', import.meta.url), 'utf-8'))

const app = new Elysia()
  .use(rateLimit({
    max: 1_000_000,
    duration: 60_000,
    generator: (req) => req.headers.get('x-forwarded-for') ?? 'unknown'
  }))
  .get('/test', () => 'ok')

await run({
  framework: 'elysia',
  library: 'elysia-rate-limit',
  store: 'memory',
  runtime: 'bun',
  versions: { 'elysia-rate-limit': pkg.version, elysia: elysiaPkg.version },
  fn: (key) => app.handle(new Request('http://localhost/test', { headers: { 'x-forwarded-for': key } })),
  isSync: false, // app.handle returns Promise
  cleanup: () => {}
})
