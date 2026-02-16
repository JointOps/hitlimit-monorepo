import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { HitLimitOptions, HitLimitInfo, ResponseConfig, ResponseFormatter, StoreResult } from '@joint-ops/hitlimit-types'
import { resolveConfig } from './core/config.js'
import { checkLimit } from './core/limiter.js'
import { memoryStore } from './stores/memory.js'

function getDefaultKey(req: FastifyRequest): string {
  return req.ip || 'unknown'
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

async function hitlimitPlugin(
  fastify: FastifyInstance,
  options: HitLimitOptions<FastifyRequest>
) {
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
    fastify.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done) => {
      const key = request.ip || 'unknown'
      const result = store.hit(key, windowMs, limit) as StoreResult
      const allowed = result.count <= limit
      const remaining = Math.max(0, limit - result.count)
      const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000)

      if (standardHeaders) {
        reply.header('RateLimit-Limit', limit)
        reply.header('RateLimit-Remaining', remaining)
        reply.header('RateLimit-Reset', resetIn)
      }
      if (legacyHeaders) {
        reply.header('X-RateLimit-Limit', limit)
        reply.header('X-RateLimit-Remaining', remaining)
        reply.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000))
      }

      if (!allowed) {
        if (retryAfterHeader) {
          reply.header('Retry-After', resetIn)
        }
        const body = buildResponseBody(responseConfig, {
          limit, remaining: 0, resetIn, resetAt: result.resetAt, key
        })
        reply.status(429).send(body)
        return
      }

      done()
    })
    return
  }

  // Full path: async with checkLimit
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (config.skip) {
      const shouldSkip = await config.skip(request)
      if (shouldSkip) return
    }

    try {
      const result = await checkLimit(config, request)

      for (const [key, value] of Object.entries(result.headers)) {
        reply.header(key, value)
      }

      if (!result.allowed) {
        reply.status(429).send(result.body)
        return
      }
    } catch (error) {
      const action = await config.onStoreError(error as Error, request)
      if (action === 'deny') {
        reply.status(429).send({ hitlimit: true, message: 'Rate limit error' })
        return
      }
    }
  })
}

export const hitlimit = fp(hitlimitPlugin, {
  name: 'hitlimit',
  fastify: '>=4.0.0'
})
