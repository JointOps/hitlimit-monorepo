import { Elysia } from 'elysia'
import type { HitLimitOptions, HitLimitInfo, ResponseConfig, ResponseFormatter, StoreResult } from '@joint-ops/hitlimit-types'
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

function buildResponseBody(
  response: ResponseConfig | ResponseFormatter,
  info: HitLimitInfo
): Record<string, any> {
  if (typeof response === 'function') {
    return response(info)
  }
  return { ...response, limit: info.limit, remaining: info.remaining, resetIn: info.resetIn }
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

  const hasSkip = !!config.skip
  const hasTiers = !!(config.tier && config.tiers)
  const hasBan = !!config.ban
  const hasGroup = !!config.group
  const standardHeaders = config.headers.standard
  const legacyHeaders = config.headers.legacy
  const retryAfterHeader = config.headers.retryAfter
  const limit = config.limit
  const windowMs = config.windowMs
  const responseConfig = config.response
  const isSyncStore = store.isSync === true
  const isSyncKey = !options.key

  // Sync fast path: sync store + default key + no skip/tiers/ban/group
  if (!hasSkip && !hasTiers && !hasBan && !hasGroup && isSyncStore && isSyncKey) {
    return new Elysia({ name: pluginName })
      .onBeforeHandle({ as: 'scoped' }, ({ set }) => {
        const key = 'unknown'
        const result = store.hit(key, windowMs, limit) as StoreResult
        const allowed = result.count <= limit
        const remaining = Math.max(0, limit - result.count)
        const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000)

        if (standardHeaders) {
          set.headers['RateLimit-Limit'] = String(limit)
          set.headers['RateLimit-Remaining'] = String(remaining)
          set.headers['RateLimit-Reset'] = String(resetIn)
        }
        if (legacyHeaders) {
          set.headers['X-RateLimit-Limit'] = String(limit)
          set.headers['X-RateLimit-Remaining'] = String(remaining)
          set.headers['X-RateLimit-Reset'] = String(Math.ceil(result.resetAt / 1000))
        }

        if (!allowed) {
          if (retryAfterHeader) {
            set.headers['Retry-After'] = String(resetIn)
          }
          const body = buildResponseBody(responseConfig, {
            limit, remaining: 0, resetIn, resetAt: result.resetAt, key
          })
          set.status = 429
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          for (const [k, v] of Object.entries(set.headers)) {
            if (v != null) headers[k] = String(v)
          }
          return new Response(JSON.stringify(body), { status: 429, headers })
        }
      })
  }

  // Full path: async with checkLimit
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
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          for (const [k, v] of Object.entries(result.headers)) {
            if (v != null) headers[k] = String(v)
          }
          return new Response(JSON.stringify(result.body), { status: 429, headers })
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
