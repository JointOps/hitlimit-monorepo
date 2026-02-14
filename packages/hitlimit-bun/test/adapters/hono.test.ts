import { describe, it, expect, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { hitlimit } from '../../src/hono'
import { memoryStore } from '../../src/stores/memory'

describe('Hono Adapter (Bun)', () => {
  let server: ReturnType<typeof Bun.serve> | null = null

  afterEach(() => {
    server?.stop()
    server = null
  })

  it('allows requests under limit', async () => {
    const app = new Hono()
    app.use(hitlimit({ limit: 5, window: '1m', store: memoryStore() }))
    app.get('/', (c) => c.text('OK'))

    server = Bun.serve({ port: 0, fetch: app.fetch })
    const res = await fetch(`http://localhost:${server.port}`)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OK')
  })

  it('blocks requests over limit', async () => {
    const app = new Hono()
    app.use(hitlimit({ limit: 2, window: '1m', store: memoryStore() }))
    app.get('/', (c) => c.text('OK'))

    server = Bun.serve({ port: 0, fetch: app.fetch })
    const url = `http://localhost:${server.port}`

    await fetch(url)
    await fetch(url)
    const res = await fetch(url)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.hitlimit).toBe(true)
  })

  it('includes rate limit headers', async () => {
    const app = new Hono()
    app.use(hitlimit({ limit: 10, window: '1m', store: memoryStore() }))
    app.get('/', (c) => c.text('OK'))

    server = Bun.serve({ port: 0, fetch: app.fetch })
    const res = await fetch(`http://localhost:${server.port}`)

    expect(res.headers.get('RateLimit-Limit')).toBe('10')
    expect(res.headers.get('RateLimit-Remaining')).toBe('9')
  })

  it('includes Retry-After header on 429', async () => {
    const app = new Hono()
    app.use(hitlimit({ limit: 1, window: '1m', store: memoryStore() }))
    app.get('/', (c) => c.text('OK'))

    server = Bun.serve({ port: 0, fetch: app.fetch })
    const url = `http://localhost:${server.port}`

    await fetch(url)
    const res = await fetch(url)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeDefined()
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

    server = Bun.serve({ port: 0, fetch: app.fetch })
    const url = `http://localhost:${server.port}`

    await fetch(url, { headers: { 'x-user-id': 'user1' } })
    await fetch(url, { headers: { 'x-user-id': 'user1' } })

    const blocked = await fetch(url, { headers: { 'x-user-id': 'user1' } })
    expect(blocked.status).toBe(429)

    const allowed = await fetch(url, { headers: { 'x-user-id': 'user2' } })
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

    server = Bun.serve({ port: 0, fetch: app.fetch })
    const url = `http://localhost:${server.port}`

    await fetch(url, { headers: { 'x-plan': 'free' } })
    await fetch(url, { headers: { 'x-plan': 'free' } })

    const freeRes = await fetch(url, { headers: { 'x-plan': 'free' } })
    expect(freeRes.status).toBe(429)

    const proRes = await fetch(url, { headers: { 'x-plan': 'pro' } })
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

    server = Bun.serve({ port: 0, fetch: app.fetch })
    const baseUrl = `http://localhost:${server.port}`

    await fetch(baseUrl)

    const healthRes = await fetch(`${baseUrl}/health`)
    expect(healthRes.status).toBe(200)

    const normalRes = await fetch(baseUrl)
    expect(normalRes.status).toBe(429)
  })

  it('supports route-group scoping', async () => {
    const api = new Hono()
    api.use(hitlimit({ limit: 1, window: '1m', store: memoryStore() }))
    api.get('/test', (c) => c.text('api'))

    const publicRoute = new Hono()
    publicRoute.use(hitlimit({ limit: 100, window: '1m', store: memoryStore() }))
    publicRoute.get('/test', (c) => c.text('public'))

    const app = new Hono()
    app.route('/api', api)
    app.route('/public', publicRoute)

    server = Bun.serve({ port: 0, fetch: app.fetch })
    const baseUrl = `http://localhost:${server.port}`

    await fetch(`${baseUrl}/api/test`)
    const apiBlocked = await fetch(`${baseUrl}/api/test`)
    expect(apiBlocked.status).toBe(429)

    const publicAllowed = await fetch(`${baseUrl}/public/test`)
    expect(publicAllowed.status).toBe(200)
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

    server = Bun.serve({ port: 0, fetch: app.fetch })
    const res = await fetch(`http://localhost:${server.port}`)

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

    server = Bun.serve({ port: 0, fetch: app.fetch })
    const res = await fetch(`http://localhost:${server.port}`)

    expect(res.status).toBe(429)
  })
})
