import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { hitlimit } from '../../src/hono.js'
import { memoryStore } from '../../src/stores/memory.js'

describe('Hono Adapter (Node.js)', () => {
  it('allows requests under limit', async () => {
    const app = new Hono()
    app.use(hitlimit({ limit: 5, window: '1m', store: memoryStore() }))
    app.get('/', (c) => c.text('OK'))

    const res = await app.request('http://localhost/')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OK')
  })

  it('blocks requests over limit', async () => {
    const app = new Hono()
    app.use(hitlimit({ limit: 2, window: '1m', store: memoryStore() }))
    app.get('/', (c) => c.text('OK'))

    await app.request('http://localhost/')
    await app.request('http://localhost/')
    const res = await app.request('http://localhost/')

    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.hitlimit).toBe(true)
  })

  it('includes standard RateLimit-* headers', async () => {
    const app = new Hono()
    app.use(hitlimit({ limit: 10, window: '1m', store: memoryStore() }))
    app.get('/', (c) => c.text('OK'))

    const res = await app.request('http://localhost/')

    expect(res.headers.get('ratelimit-limit')).toBe('10')
    expect(res.headers.get('ratelimit-remaining')).toBe('9')
    expect(res.headers.get('ratelimit-reset')).toBeDefined()
  })

  it('includes legacy X-RateLimit-* headers', async () => {
    const app = new Hono()
    app.use(hitlimit({ limit: 10, window: '1m', store: memoryStore() }))
    app.get('/', (c) => c.text('OK'))

    const res = await app.request('http://localhost/')

    expect(res.headers.get('x-ratelimit-limit')).toBe('10')
    expect(res.headers.get('x-ratelimit-remaining')).toBe('9')
    expect(res.headers.get('x-ratelimit-reset')).toBeDefined()
  })

  it('includes Retry-After header on 429', async () => {
    const app = new Hono()
    app.use(hitlimit({ limit: 1, window: '1m', store: memoryStore() }))
    app.get('/', (c) => c.text('OK'))

    await app.request('http://localhost/')
    const res = await app.request('http://localhost/')

    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBeDefined()
  })

  it('uses custom key function', async () => {
    const app = new Hono()
    app.use(hitlimit({
      limit: 2,
      window: '1m',
      store: memoryStore(),
      key: (c) => c.req.header('x-user-id') || 'anonymous'
    }))
    app.get('/', (c) => c.text('OK'))

    await app.request('http://localhost/', { headers: { 'x-user-id': 'user1' } })
    await app.request('http://localhost/', { headers: { 'x-user-id': 'user1' } })

    const blocked = await app.request('http://localhost/', { headers: { 'x-user-id': 'user1' } })
    expect(blocked.status).toBe(429)

    const allowed = await app.request('http://localhost/', { headers: { 'x-user-id': 'user2' } })
    expect(allowed.status).toBe(200)
  })

  it('applies tiered limits', async () => {
    const app = new Hono()
    app.use(hitlimit({
      store: memoryStore(),
      tiers: {
        free: { limit: 2, window: '1m' },
        pro: { limit: 100, window: '1m' }
      },
      tier: (c) => c.req.header('x-plan') || 'free'
    }))
    app.get('/', (c) => c.text('OK'))

    await app.request('http://localhost/', { headers: { 'x-plan': 'free' } })
    await app.request('http://localhost/', { headers: { 'x-plan': 'free' } })

    const freeRes = await app.request('http://localhost/', { headers: { 'x-plan': 'free' } })
    expect(freeRes.status).toBe(429)

    const proRes = await app.request('http://localhost/', { headers: { 'x-plan': 'pro' } })
    expect(proRes.status).toBe(200)
  })

  it('skips when skip returns true', async () => {
    const app = new Hono()
    app.use(hitlimit({
      limit: 1,
      window: '1m',
      store: memoryStore(),
      skip: (c) => c.req.path === '/health'
    }))
    app.get('/health', (c) => c.text('OK'))
    app.get('/', (c) => c.text('OK'))

    await app.request('http://localhost/')

    const healthRes = await app.request('http://localhost/health')
    expect(healthRes.status).toBe(200)

    const normalRes = await app.request('http://localhost/')
    expect(normalRes.status).toBe(429)
  })

  it('handles Infinity limit', async () => {
    const app = new Hono()
    app.use(hitlimit({
      store: memoryStore(),
      tiers: { enterprise: { limit: Infinity } },
      tier: () => 'enterprise'
    }))
    app.get('/', (c) => c.text('OK'))

    for (let i = 0; i < 50; i++) {
      const res = await app.request('http://localhost/')
      expect(res.status).toBe(200)
    }
  })

  it('uses custom response formatter', async () => {
    const app = new Hono()
    app.use(hitlimit({
      limit: 1,
      window: '1m',
      store: memoryStore(),
      response: (info) => ({
        error: 'TOO_MANY_REQUESTS',
        retryIn: info.resetIn
      })
    }))
    app.get('/', (c) => c.text('OK'))

    await app.request('http://localhost/')
    const res = await app.request('http://localhost/')

    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toBe('TOO_MANY_REQUESTS')
    expect(json.retryIn).toBeDefined()
  })

  it('handles store errors with allow strategy', async () => {
    const failingStore = {
      hit: () => { throw new Error('Store error') },
      reset: () => {}
    }

    const app = new Hono()
    app.use(hitlimit({
      store: failingStore,
      onStoreError: () => 'allow' as const
    }))
    app.get('/', (c) => c.text('OK'))

    const res = await app.request('http://localhost/')
    expect(res.status).toBe(200)
  })

  it('handles store errors with deny strategy', async () => {
    const failingStore = {
      hit: () => { throw new Error('Store error') },
      reset: () => {}
    }

    const app = new Hono()
    app.use(hitlimit({
      store: failingStore,
      onStoreError: () => 'deny' as const
    }))
    app.get('/', (c) => c.text('OK'))

    const res = await app.request('http://localhost/')
    expect(res.status).toBe(429)
  })

  it('supports route-group scoping', async () => {
    const app = new Hono()

    const api = new Hono()
    api.use(hitlimit({ limit: 1, window: '1m', store: memoryStore() }))
    api.get('/test', (c) => c.text('api'))

    const publicRoute = new Hono()
    publicRoute.use(hitlimit({ limit: 100, window: '1m', store: memoryStore() }))
    publicRoute.get('/test', (c) => c.text('public'))

    app.route('/api', api)
    app.route('/public', publicRoute)

    await app.request('http://localhost/api/test')
    const apiBlocked = await app.request('http://localhost/api/test')
    expect(apiBlocked.status).toBe(429)

    const publicAllowed = await app.request('http://localhost/public/test')
    expect(publicAllowed.status).toBe(200)
  })
})
