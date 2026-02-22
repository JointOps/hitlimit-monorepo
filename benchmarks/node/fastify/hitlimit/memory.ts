import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
import Fastify from 'fastify'
import { hitlimit } from '../../../../packages/hitlimit/dist/fastify.js'
import { memoryStore } from '../../../../packages/hitlimit/dist/stores/memory.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()
const store = memoryStore()
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
  store: 'memory',
  runtime: 'node',
  versions: { hitlimit: version, fastify: JSON.parse(fs.readFileSync(new URL('../../../node_modules/fastify/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => app.inject({ method: 'GET', url: '/test', remoteAddress: key }),
  isSync: false, // inject() returns Promise
  cleanup: async () => {
    await app.close()
    store.shutdown?.()
  }
})
