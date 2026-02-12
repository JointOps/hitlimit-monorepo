import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { hitlimit } from '../../src/fastify.js'
import { memoryStore } from '../../src/stores/memory.js'

describe('Fastify Adapter', () => {
  let app: FastifyInstance

  beforeEach(() => {
    app = Fastify()
  })

  afterEach(async () => {
    await app.close()
  })

  it('allows requests under limit', async () => {
    await app.register(hitlimit, { limit: 5, window: '1m', store: memoryStore() })
    app.get('/', () => 'OK')

    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('OK')
  })

  it('blocks requests over limit', async () => {
    await app.register(hitlimit, { limit: 2, window: '1m', store: memoryStore() })
    app.get('/', () => 'OK')

    await app.inject({ method: 'GET', url: '/' })
    await app.inject({ method: 'GET', url: '/' })
    const res = await app.inject({ method: 'GET', url: '/' })

    expect(res.statusCode).toBe(429)
    expect(res.json().hitlimit).toBe(true)
  })

  it('includes standard RateLimit-* headers', async () => {
    await app.register(hitlimit, { limit: 10, window: '1m', store: memoryStore() })
    app.get('/', () => 'OK')

    const res = await app.inject({ method: 'GET', url: '/' })

    expect(res.headers['ratelimit-limit']).toBe('10')
    expect(res.headers['ratelimit-remaining']).toBe('9')
    expect(res.headers['ratelimit-reset']).toBeDefined()
  })

  it('includes legacy X-RateLimit-* headers', async () => {
    await app.register(hitlimit, { limit: 10, window: '1m', store: memoryStore() })
    app.get('/', () => 'OK')

    const res = await app.inject({ method: 'GET', url: '/' })

    expect(res.headers['x-ratelimit-limit']).toBe('10')
    expect(res.headers['x-ratelimit-remaining']).toBe('9')
    expect(res.headers['x-ratelimit-reset']).toBeDefined()
  })

  it('includes Retry-After header on 429', async () => {
    await app.register(hitlimit, { limit: 1, window: '1m', store: memoryStore() })
    app.get('/', () => 'OK')

    await app.inject({ method: 'GET', url: '/' })
    const res = await app.inject({ method: 'GET', url: '/' })

    expect(res.statusCode).toBe(429)
    expect(res.headers['retry-after']).toBeDefined()
  })

  it('uses custom key function', async () => {
    await app.register(hitlimit, {
      limit: 2,
      window: '1m',
      store: memoryStore(),
      key: (req) => req.headers['x-user-id'] as string || 'anonymous'
    })
    app.get('/', () => 'OK')

    await app.inject({ method: 'GET', url: '/', headers: { 'x-user-id': 'user1' } })
    await app.inject({ method: 'GET', url: '/', headers: { 'x-user-id': 'user1' } })

    const blocked = await app.inject({ method: 'GET', url: '/', headers: { 'x-user-id': 'user1' } })
    expect(blocked.statusCode).toBe(429)

    const allowed = await app.inject({ method: 'GET', url: '/', headers: { 'x-user-id': 'user2' } })
    expect(allowed.statusCode).toBe(200)
  })

  it('applies tiered limits', async () => {
    await app.register(hitlimit, {
      store: memoryStore(),
      tiers: {
        free: { limit: 2, window: '1m' },
        pro: { limit: 100, window: '1m' }
      },
      tier: (req) => req.headers['x-plan'] as string || 'free'
    })
    app.get('/', () => 'OK')

    await app.inject({ method: 'GET', url: '/', headers: { 'x-plan': 'free' } })
    await app.inject({ method: 'GET', url: '/', headers: { 'x-plan': 'free' } })

    const freeRes = await app.inject({ method: 'GET', url: '/', headers: { 'x-plan': 'free' } })
    expect(freeRes.statusCode).toBe(429)

    const proRes = await app.inject({ method: 'GET', url: '/', headers: { 'x-plan': 'pro' } })
    expect(proRes.statusCode).toBe(200)
  })

  it('skips when skip returns true', async () => {
    await app.register(hitlimit, {
      limit: 1,
      window: '1m',
      store: memoryStore(),
      skip: (req) => req.url === '/health'
    })
    app.get('/health', () => 'OK')
    app.get('/', () => 'OK')

    await app.inject({ method: 'GET', url: '/' })

    const healthRes = await app.inject({ method: 'GET', url: '/health' })
    expect(healthRes.statusCode).toBe(200)

    const normalRes = await app.inject({ method: 'GET', url: '/' })
    expect(normalRes.statusCode).toBe(429)
  })

  it('handles Infinity limit', async () => {
    await app.register(hitlimit, {
      store: memoryStore(),
      tiers: { enterprise: { limit: Infinity } },
      tier: () => 'enterprise'
    })
    app.get('/', () => 'OK')

    for (let i = 0; i < 50; i++) {
      const res = await app.inject({ method: 'GET', url: '/' })
      expect(res.statusCode).toBe(200)
    }
  })

  it('uses custom response formatter', async () => {
    await app.register(hitlimit, {
      limit: 1,
      window: '1m',
      store: memoryStore(),
      response: (info) => ({
        error: 'TOO_MANY_REQUESTS',
        retryIn: info.resetIn
      })
    })
    app.get('/', () => 'OK')

    await app.inject({ method: 'GET', url: '/' })
    const res = await app.inject({ method: 'GET', url: '/' })

    expect(res.statusCode).toBe(429)
    expect(res.json().error).toBe('TOO_MANY_REQUESTS')
    expect(res.json().retryIn).toBeDefined()
  })

  it('handles store errors with allow strategy', async () => {
    const failingStore = {
      hit: () => { throw new Error('Store error') },
      reset: () => {}
    }

    await app.register(hitlimit, {
      store: failingStore,
      onStoreError: () => 'allow' as const
    })
    app.get('/', () => 'OK')

    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
  })

  it('handles store errors with deny strategy', async () => {
    const failingStore = {
      hit: () => { throw new Error('Store error') },
      reset: () => {}
    }

    await app.register(hitlimit, {
      store: failingStore,
      onStoreError: () => 'deny' as const
    })
    app.get('/', () => 'OK')

    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(429)
  })

  it('supports route-specific limits via register scoping', async () => {
    app.register(async (scope) => {
      await scope.register(hitlimit, { limit: 1, window: '1m', store: memoryStore() })
      scope.get('/test', () => 'api')
    }, { prefix: '/api' })

    app.register(async (scope) => {
      await scope.register(hitlimit, { limit: 100, window: '1m', store: memoryStore() })
      scope.get('/test', () => 'public')
    }, { prefix: '/public' })

    await app.inject({ method: 'GET', url: '/api/test' })
    const apiBlocked = await app.inject({ method: 'GET', url: '/api/test' })
    expect(apiBlocked.statusCode).toBe(429)

    const publicAllowed = await app.inject({ method: 'GET', url: '/public/test' })
    expect(publicAllowed.statusCode).toBe(200)
  })
})
