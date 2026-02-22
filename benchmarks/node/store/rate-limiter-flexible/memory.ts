import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
import { RateLimiterMemory } from 'rate-limiter-flexible'

const pkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/rate-limiter-flexible/package.json', import.meta.url), 'utf-8'))
const limiter = new RateLimiterMemory({ points: 1_000_000, duration: 60 })

await run({
  framework: 'store',
  library: 'rate-limiter-flexible',
  store: 'memory',
  runtime: 'node',
  versions: { 'rate-limiter-flexible': pkg.version },
  fn: (key) => limiter.consume(key),
  isSync: false, // consume() always returns Promise
  cleanup: () => {}
})
