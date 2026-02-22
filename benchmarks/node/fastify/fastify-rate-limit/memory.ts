import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'

const fastifyPkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/fastify/package.json', import.meta.url), 'utf-8'))
const rateLimitPkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/@fastify/rate-limit/package.json', import.meta.url), 'utf-8'))

const app = Fastify()

await app.register(rateLimit, {
  max: 1_000_000,
  timeWindow: '1 minute'
})

app.get('/test', () => 'ok')
await app.ready()

await run({
  framework: 'fastify',
  library: 'fastify-rate-limit',
  store: 'memory',
  runtime: 'node',
  versions: { '@fastify/rate-limit': rateLimitPkg.version, fastify: fastifyPkg.version },
  fn: (key) => app.inject({ method: 'GET', url: '/test', remoteAddress: key }),
  isSync: false,
  cleanup: () => app.close()
})
