import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
import { memoryStore } from '../../../../packages/hitlimit/dist/stores/memory.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()
const store = memoryStore()

await run({
  framework: 'store',
  library: 'hitlimit',
  store: 'memory',
  runtime: 'node',
  versions: { hitlimit: version },
  fn: (key) => store.hit(key, 60000, 1_000_000),
  isSync: true,
  cleanup: () => store.shutdown?.()
})
