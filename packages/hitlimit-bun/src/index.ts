import type { HitLimitOptions } from '@joint-ops/hitlimit-types'
import { resolveConfig } from './core/config.js'
import { checkLimit } from './core/limiter.js'
import { sqliteStore } from './stores/sqlite.js'

export type { HitLimitOptions, HitLimitInfo, HitLimitResult, HitLimitStore, StoreResult, TierConfig, HeadersConfig, ResolvedConfig, KeyGenerator, TierResolver, SkipFunction, StoreErrorHandler, ResponseFormatter, ResponseConfig } from '@joint-ops/hitlimit-types'
export { DEFAULT_LIMIT, DEFAULT_WINDOW, DEFAULT_WINDOW_MS, DEFAULT_MESSAGE } from '@joint-ops/hitlimit-types'
export { sqliteStore } from './stores/sqlite.js'

export interface BunHitLimitOptions extends HitLimitOptions<Request> {
  sqlitePath?: string
}

type BunServer = { requestIP(req: Request): { address: string } | null }

type FetchHandler = (req: Request, server: BunServer) => Response | Promise<Response>

function getDefaultKey(req: Request, server: BunServer): string {
  return server.requestIP(req)?.address || 'unknown'
}

export function hitlimit(
  options: BunHitLimitOptions,
  handler: FetchHandler
): (req: Request, server: BunServer) => Response | Promise<Response> {
  const store = options.store ?? sqliteStore({ path: options.sqlitePath })
  const config = resolveConfig(options, store, () => 'unknown')

  return async (req: Request, server: BunServer) => {
    const keyFn = options.key ?? ((r: Request) => getDefaultKey(r, server))
    const configWithKey = { ...config, key: keyFn }

    if (configWithKey.skip) {
      const shouldSkip = await configWithKey.skip(req)
      if (shouldSkip) {
        return handler(req, server)
      }
    }

    try {
      const result = await checkLimit(configWithKey, req)

      if (!result.allowed) {
        return new Response(JSON.stringify(result.body), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...result.headers }
        })
      }

      const response = await handler(req, server)

      const newHeaders = new Headers(response.headers)
      Object.entries(result.headers).forEach(([key, value]) => {
        newHeaders.set(key, value)
      })

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      })
    } catch (error) {
      const action = await configWithKey.onStoreError(error as Error, req)
      if (action === 'deny') {
        return new Response(JSON.stringify({ hitlimit: true, message: 'Rate limit error' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return handler(req, server)
    }
  }
}

export interface HitLimiter {
  check(req: Request, server: BunServer): Response | null | Promise<Response | null>
  reset(key: string): Promise<void> | void
}

export function createHitLimit(options: BunHitLimitOptions = {}): HitLimiter {
  const store = options.store ?? sqliteStore({ path: options.sqlitePath })
  const config = resolveConfig(options, store, () => 'unknown')

  return {
    async check(req: Request, server: BunServer): Promise<Response | null> {
      const keyFn = options.key ?? ((r: Request) => getDefaultKey(r, server))
      const configWithKey = { ...config, key: keyFn }

      if (configWithKey.skip) {
        const shouldSkip = await configWithKey.skip(req)
        if (shouldSkip) {
          return null
        }
      }

      try {
        const result = await checkLimit(configWithKey, req)

        if (!result.allowed) {
          return new Response(JSON.stringify(result.body), {
            status: 429,
            headers: { 'Content-Type': 'application/json', ...result.headers }
          })
        }

        return null
      } catch (error) {
        const action = await configWithKey.onStoreError(error as Error, req)
        if (action === 'deny') {
          return new Response(JSON.stringify({ hitlimit: true, message: 'Rate limit error' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        return null
      }
    },

    reset(key: string) {
      return store.reset(key)
    }
  }
}
