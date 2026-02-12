import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { HitLimitOptions } from '@joint-ops/hitlimit-types'
import { resolveConfig } from './core/config.js'
import { checkLimit } from './core/limiter.js'
import { memoryStore } from './stores/memory.js'

function getDefaultKey(req: FastifyRequest): string {
  return req.ip || 'unknown'
}

async function hitlimitPlugin(
  fastify: FastifyInstance,
  options: HitLimitOptions<FastifyRequest>
) {
  const store = options.store ?? memoryStore()
  const config = resolveConfig(options, store, getDefaultKey)

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
