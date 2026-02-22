import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
import { RateLimiterMemory } from 'rate-limiter-flexible'

const pkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/rate-limiter-flexible/package.json', import.meta.url), 'utf-8'))
const limiter = new RateLimiterMemory({ points: 1_000_000, duration: 60 })

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

await run({
  framework: 'express',
  library: 'rate-limiter-flexible',
  store: 'memory',
  runtime: 'node',
  versions: { 'rate-limiter-flexible': pkg.version },
  fn: async (key) => {
    await limiter.consume(key)
    next()
  },
  isSync: false,
  cleanup: () => {}
})
