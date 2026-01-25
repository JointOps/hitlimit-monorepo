import { Elysia } from 'elysia'
import type { HitLimitOptions } from '@hitlimit/types'
import { resolveConfig } from './core/config.js'
import { checkLimit } from './core/limiter.js'
import { sqliteStore } from './stores/sqlite.js'

export interface ElysiaHitLimitOptions extends HitLimitOptions<{ request: Request }> {
  sqlitePath?: string
}

function getDefaultKey(_ctx: { request: Request }): string {
  return 'unknown'
}

export function hitlimit(options: ElysiaHitLimitOptions = {}) {
  const store = options.store ?? sqliteStore({ path: options.sqlitePath })
  const config = resolveConfig(options, store, getDefaultKey)

  return new Elysia({ name: 'hitlimit' })
    .onBeforeHandle({ as: 'global' }, async ({ request, set }) => {
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
