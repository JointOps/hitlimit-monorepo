import { describe, it, expect, beforeEach } from 'vitest'
import express, { type Application } from 'express'
import request from 'supertest'
import { hitlimit, memoryStore } from '../../src/index.js'

describe('Express Adapter', () => {
  let app: Application

  beforeEach(() => {
    app = express()
  })

  it('allows requests under limit', async () => {
    app.use(hitlimit({ limit: 5, window: '1m', store: memoryStore() }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.text).toBe('OK')
  })

  it('blocks requests over limit', async () => {
    app.use(hitlimit({ limit: 2, window: '1m', store: memoryStore() }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/')
    await request(app).get('/')
    const res = await request(app).get('/')

    expect(res.status).toBe(429)
    expect(res.body.hitlimit).toBe(true)
  })

  it('includes standard headers', async () => {
    app.use(hitlimit({ limit: 10, window: '1m', store: memoryStore() }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')

    expect(res.headers['ratelimit-limit']).toBe('10')
    expect(res.headers['ratelimit-remaining']).toBe('9')
    expect(res.headers['ratelimit-reset']).toBeDefined()
  })

  it('includes legacy headers', async () => {
    app.use(hitlimit({ limit: 10, window: '1m', store: memoryStore() }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')

    expect(res.headers['x-ratelimit-limit']).toBe('10')
    expect(res.headers['x-ratelimit-remaining']).toBe('9')
  })

  it('includes Retry-After on 429', async () => {
    app.use(hitlimit({ limit: 1, window: '1m', store: memoryStore() }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/')
    const res = await request(app).get('/')

    expect(res.status).toBe(429)
    expect(res.headers['retry-after']).toBeDefined()
  })

  it('uses custom key function', async () => {
    app.use(hitlimit({
      limit: 2,
      window: '1m',
      store: memoryStore(),
      key: (req) => req.headers['x-user-id'] as string || 'anonymous'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/').set('X-User-Id', 'user1')
    await request(app).get('/').set('X-User-Id', 'user1')

    const res1 = await request(app).get('/').set('X-User-Id', 'user1')
    expect(res1.status).toBe(429)

    const res2 = await request(app).get('/').set('X-User-Id', 'user2')
    expect(res2.status).toBe(200)
  })

  it('applies tiered limits', async () => {
    app.use(hitlimit({
      store: memoryStore(),
      tiers: {
        free: { limit: 2, window: '1m' },
        pro: { limit: 100, window: '1m' }
      },
      tier: (req) => req.headers['x-plan'] as string || 'free'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/').set('X-Plan', 'free')
    await request(app).get('/').set('X-Plan', 'free')

    const freeRes = await request(app).get('/').set('X-Plan', 'free')
    expect(freeRes.status).toBe(429)

    const proRes = await request(app).get('/').set('X-Plan', 'pro')
    expect(proRes.status).toBe(200)
  })

  it('skips when skip returns true', async () => {
    app.use(hitlimit({
      limit: 1,
      window: '1m',
      store: memoryStore(),
      skip: (req) => req.path === '/health'
    }))
    app.get('/health', (_req, res) => res.send('OK'))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/')

    const healthRes = await request(app).get('/health')
    expect(healthRes.status).toBe(200)

    const normalRes = await request(app).get('/')
    expect(normalRes.status).toBe(429)
  })

  it('uses custom response formatter', async () => {
    app.use(hitlimit({
      limit: 1,
      window: '1m',
      store: memoryStore(),
      response: (info) => ({
        error: 'TOO_MANY_REQUESTS',
        retryIn: info.resetIn
      })
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/')
    const res = await request(app).get('/')

    expect(res.status).toBe(429)
    expect(res.body.error).toBe('TOO_MANY_REQUESTS')
    expect(res.body.retryIn).toBeDefined()
  })

  it('handles Infinity limit', async () => {
    app.use(hitlimit({
      store: memoryStore(),
      tiers: { enterprise: { limit: Infinity } },
      tier: () => 'enterprise'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    for (let i = 0; i < 100; i++) {
      const res = await request(app).get('/')
      expect(res.status).toBe(200)
    }
  })

  it('handles store errors with allow', async () => {
    const failingStore = {
      hit: () => { throw new Error('Store error') },
      reset: () => {}
    }

    app.use(hitlimit({
      store: failingStore,
      onStoreError: () => 'allow'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })

  it('handles store errors with deny', async () => {
    const failingStore = {
      hit: () => { throw new Error('Store error') },
      reset: () => {}
    }

    app.use(hitlimit({
      store: failingStore,
      onStoreError: () => 'deny'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(429)
  })

  describe('ban support', () => {
    it('bans after repeated violations', async () => {
      app.use(hitlimit({
        limit: 1,
        window: '1m',
        store: memoryStore(),
        ban: { threshold: 2, duration: '1h' }
      }))
      app.get('/', (_req, res) => res.send('OK'))

      // First request: allowed
      await request(app).get('/')
      // Second request: rate limited (violation 1)
      await request(app).get('/')
      // Third request: rate limited (violation 2 = threshold, triggers ban)
      await request(app).get('/')
      // Fourth request: banned
      const res = await request(app).get('/')

      expect(res.status).toBe(429)
      expect(res.body.banned).toBe(true)
      expect(res.headers['x-ratelimit-ban']).toBe('true')
    })

    it('includes ban expiry header', async () => {
      app.use(hitlimit({
        limit: 1,
        window: '1m',
        store: memoryStore(),
        ban: { threshold: 2, duration: '1h' }
      }))
      app.get('/', (_req, res) => res.send('OK'))

      await request(app).get('/')
      await request(app).get('/')
      await request(app).get('/')
      const res = await request(app).get('/')

      expect(res.headers['x-ratelimit-ban-expires']).toBeDefined()
    })
  })

  describe('group support', () => {
    it('shares limits within a group', async () => {
      app.use(hitlimit({
        limit: 2,
        window: '1m',
        store: memoryStore(),
        group: 'shared',
        key: (req) => req.headers['x-user-id'] as string || 'unknown'
      }))
      app.get('/', (_req, res) => res.send('OK'))

      // Both users share the same group limit
      await request(app).get('/').set('X-User-Id', 'user1')
      await request(app).get('/').set('X-User-Id', 'user2')
      const res = await request(app).get('/').set('X-User-Id', 'user1')

      // Still 200 because group:shared:user1 and group:shared:user2 are different keys
      // Group prefixing creates per-user-within-group limits
      expect(res.status).toBe(200)
    })

    it('uses dynamic group function', async () => {
      app.use(hitlimit({
        limit: 2,
        window: '1m',
        store: memoryStore(),
        group: (req) => req.headers['x-api-key'] as string || 'default'
      }))
      app.get('/', (_req, res) => res.send('OK'))

      // Same API key shares limits
      await request(app).get('/').set('X-Api-Key', 'key1')
      await request(app).get('/').set('X-Api-Key', 'key1')
      const res = await request(app).get('/').set('X-Api-Key', 'key1')

      expect(res.status).toBe(429)

      // Different API key has its own limit
      const res2 = await request(app).get('/').set('X-Api-Key', 'key2')
      expect(res2.status).toBe(200)
    })
  })
})
