import { describe, it, expect, afterEach } from 'bun:test'
import { Elysia } from 'elysia'
import { hitlimit } from '../../src/elysia'
import { memoryStore } from '../../src/stores/memory'

describe('Elysia Plugin', () => {
  let app: Elysia

  afterEach(() => {
    app?.stop()
  })

  it('allows requests under limit', async () => {
    app = new Elysia()
      .use(hitlimit({ limit: 5, window: '1m', store: memoryStore() }))
      .get('/', () => 'OK')
      .listen(0)

    const res = await fetch(`http://localhost:${app.server!.port}`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OK')
  })

  it('blocks requests over limit', async () => {
    app = new Elysia()
      .use(hitlimit({ limit: 2, window: '1m', store: memoryStore() }))
      .get('/', () => 'OK')
      .listen(0)

    await fetch(`http://localhost:${app.server!.port}`)
    await fetch(`http://localhost:${app.server!.port}`)
    const res = await fetch(`http://localhost:${app.server!.port}`)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.hitlimit).toBe(true)
  })

  it('includes rate limit headers', async () => {
    app = new Elysia()
      .use(hitlimit({ limit: 10, window: '1m', store: memoryStore() }))
      .get('/', () => 'OK')
      .listen(0)

    const res = await fetch(`http://localhost:${app.server!.port}`)

    expect(res.headers.get('RateLimit-Limit')).toBe('10')
    expect(res.headers.get('RateLimit-Remaining')).toBe('9')
  })

  it('supports custom key function', async () => {
    app = new Elysia()
      .use(hitlimit({
        limit: 1,
        window: '1m',
        store: memoryStore(),
        key: ({ request }) => request.headers.get('x-user-id') || 'anonymous'
      }))
      .get('/', () => 'OK')
      .listen(0)

    await fetch(`http://localhost:${app.server!.port}`, { headers: { 'x-user-id': 'user1' } })
    const blocked = await fetch(`http://localhost:${app.server!.port}`, { headers: { 'x-user-id': 'user1' } })
    expect(blocked.status).toBe(429)

    const allowed = await fetch(`http://localhost:${app.server!.port}`, { headers: { 'x-user-id': 'user2' } })
    expect(allowed.status).toBe(200)
  })

  it('supports multiple instances with different limits per group', async () => {
    app = new Elysia()
      .group('/strict', app =>
        app.use(hitlimit({ limit: 1, window: '1m', store: memoryStore(), name: 'strict' }))
          .get('/test', () => 'strict')
      )
      .group('/loose', app =>
        app.use(hitlimit({ limit: 100, window: '1m', store: memoryStore(), name: 'loose' }))
          .get('/test', () => 'loose')
      )
      .listen(0)

    // Exhaust strict limit
    await fetch(`http://localhost:${app.server!.port}/strict/test`)
    const blocked = await fetch(`http://localhost:${app.server!.port}/strict/test`)
    expect(blocked.status).toBe(429)

    // Loose should still work independently
    const allowed = await fetch(`http://localhost:${app.server!.port}/loose/test`)
    expect(allowed.status).toBe(200)
  })

  it('auto-generates unique names when name not provided', async () => {
    app = new Elysia()
      .use(hitlimit({ limit: 5, window: '1m', store: memoryStore() }))
      .use(hitlimit({ limit: 10, window: '1m', store: memoryStore() }))
      .get('/', () => 'OK')
      .listen(0)

    const res = await fetch(`http://localhost:${app.server!.port}`)
    expect(res.status).toBe(200)
  })

  it('supports tiered limits', async () => {
    app = new Elysia()
      .use(hitlimit({
        store: memoryStore(),
        tiers: {
          free: { limit: 1, window: '1m' },
          pro: { limit: 100, window: '1m' }
        },
        tier: ({ request }) => request.headers.get('x-plan') || 'free'
      }))
      .get('/', () => 'OK')
      .listen(0)

    await fetch(`http://localhost:${app.server!.port}`, { headers: { 'x-plan': 'free' } })
    const blocked = await fetch(`http://localhost:${app.server!.port}`, { headers: { 'x-plan': 'free' } })
    expect(blocked.status).toBe(429)

    const pro = await fetch(`http://localhost:${app.server!.port}`, { headers: { 'x-plan': 'pro' } })
    expect(pro.status).toBe(200)
  })
})
