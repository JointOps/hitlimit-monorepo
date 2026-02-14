import { Elysia } from 'elysia'
import type { HitLimitOptions } from '@joint-ops/hitlimit-types'
import { resolveConfig } from './core/config.js'
import { checkLimit } from './core/limiter.js'
import { memoryStore } from './stores/memory.js'

export interface ElysiaHitLimitOptions extends HitLimitOptions<{ request: Request }> {
  /**
   * @deprecated Use `store: sqliteStore({ path })` instead.
   *
   * Starting with v1.1.0, the default store is Memory for 15.7x better performance.
   * If you need SQLite persistence:
   *
   * ```typescript
   * import { sqliteStore } from '@joint-ops/hitlimit-bun/stores/sqlite'
   * hitlimit({ store: sqliteStore({ path: './db.sqlite' }) })
   * ```
   */
  sqlitePath?: string
  name?: string
}

let instanceCounter = 0

function getDefaultKey(_ctx: { request: Request }): string {
  return 'unknown'
}

export function hitlimit(options: ElysiaHitLimitOptions = {}) {
  const pluginName = options.name ?? `hitlimit-${instanceCounter++}`

  // Deprecation warning for sqlitePath
  if (options.sqlitePath && !options.store) {
    console.warn(
      '[hitlimit-bun] DEPRECATION WARNING: ' +
      'sqlitePath is deprecated and will be ignored. ' +
      'Use store: sqliteStore({ path }) instead. ' +
      'See migration guide: https://hitlimit.jointops.dev/docs/migration/v1.1.0'
    )
  }

  const store = options.store ?? memoryStore()
  const config = resolveConfig(options, store, getDefaultKey)

  return new Elysia({ name: pluginName })
    .onBeforeHandle({ as: 'scoped' }, async ({ request, set }) => {
      const ctx = { request }

      if (config.skip) {
        const shouldSkip = await config.skip(ctx)
        if (shouldSkip) {
          return
        }
      }

      try {
        const result = await checkLimit(config, ctx)

        Object.entries(result.headers).forEach(([key, value]) => {
          set.headers[key] = value
        })

        if (!result.allowed) {
          set.status = 429
          return new Response(JSON.stringify(result.body), {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              ...result.headers
            }
          })
        }
      } catch (error) {
        const action = await config.onStoreError(error as Error, ctx)
        if (action === 'deny') {
          set.status = 429
          return new Response(JSON.stringify({ hitlimit: true, message: 'Rate limit error' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    })
}
