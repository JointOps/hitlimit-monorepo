import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
import { hitlimit } from '../../../../packages/hitlimit-bun/dist/index.js'
import { memoryStore } from '../../../../packages/hitlimit-bun/dist/stores/memory.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()
const store = memoryStore()

const handler = (_req: Request) => new Response('ok')
const mw = hitlimit(
  { limit: 1_000_000, window: '1m', store, headers: { standard: false, legacy: false } },
  handler
)

const req = new Request('http://localhost/test')
let currentIp = '127.0.0.1'
const server: any = {
  requestIP: () => ({ address: currentIp })
}

await run({
  framework: 'bun-serve',
  library: 'hitlimit',
  store: 'memory',
  runtime: 'bun',
  versions: { 'hitlimit-bun': version },
  fn: (key) => {
    currentIp = key
    return mw(req, server)
  },
  isSync: true, // memory store + sync fast path
  cleanup: () => store.shutdown?.()
})
