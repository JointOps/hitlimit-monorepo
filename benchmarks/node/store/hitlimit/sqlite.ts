import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
import { sqliteStore } from '../../../../packages/hitlimit/dist/stores/sqlite.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()
const store = sqliteStore({ path: ':memory:' })

await run({
  framework: 'store',
  library: 'hitlimit',
  store: 'sqlite',
  runtime: 'node',
  versions: { hitlimit: version },
  fn: (key) => store.hit(key, 60000, 1_000_000),
  isSync: true,
  cleanup: () => store.shutdown?.()
})
