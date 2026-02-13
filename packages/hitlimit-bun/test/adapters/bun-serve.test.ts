import { describe, it, expect, afterEach } from 'bun:test'
import { hitlimit, createHitLimit } from '../../src/index'
import { memoryStore } from '../../src/stores/memory'

describe('Bun.serve Adapter', () => {
  let server: ReturnType<typeof Bun.serve>

  afterEach(() => {
    server?.stop()
  })

  it('allows requests under limit', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({ limit: 5, window: '1m', store: memoryStore() }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OK')
  })

  it('blocks requests over limit', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({ limit: 2, window: '1m', store: memoryStore() }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}`)
    await fetch(`http://localhost:${server.port}`)
    const res = await fetch(`http://localhost:${server.port}`)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.hitlimit).toBe(true)
  })

  it('includes headers on success', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({ limit: 10, window: '1m', store: memoryStore() }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)

    expect(res.headers.get('RateLimit-Limit')).toBe('10')
    expect(res.headers.get('RateLimit-Remaining')).toBe('9')
  })

  it('uses createHitLimit middleware style', async () => {
    const limiter = createHitLimit({ limit: 2, window: '1m', store: memoryStore() })

    server = Bun.serve({
      port: 0,
      async fetch(req, server) {
        const blocked = await limiter.check(req, server)
        if (blocked) return blocked
        return new Response('OK')
      }
    })

    await fetch(`http://localhost:${server.port}`)
    await fetch(`http://localhost:${server.port}`)
    const res = await fetch(`http://localhost:${server.port}`)

    expect(res.status).toBe(429)
  })

  it('defaults to sqlite store', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({ limit: 100, window: '1m' }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect(res.status).toBe(200)
  })

  it('supports skip function', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        limit: 1,
        window: '1m',
        store: memoryStore(),
        skip: (req) => new URL(req.url).pathname === '/health'
      }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}/`)
    const blocked = await fetch(`http://localhost:${server.port}/`)
    expect(blocked.status).toBe(429)

    const health = await fetch(`http://localhost:${server.port}/health`)
    expect(health.status).toBe(200)
  })

  it('supports tiered limits', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        store: memoryStore(),
        tiers: {
          free: { limit: 1, window: '1m' },
          pro: { limit: 100, window: '1m' }
        },
        tier: (req) => req.headers.get('x-tier') || 'free'
      }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}`, { headers: { 'x-tier': 'free' } })
    const blocked = await fetch(`http://localhost:${server.port}`, { headers: { 'x-tier': 'free' } })
    expect(blocked.status).toBe(429)

    const pro = await fetch(`http://localhost:${server.port}`, { headers: { 'x-tier': 'pro' } })
    expect(pro.status).toBe(200)
  })

  describe('ban support', () => {
    it('bans after repeated violations', async () => {
      server = Bun.serve({
        port: 0,
        fetch: hitlimit({
          limit: 1,
          window: '1m',
          store: memoryStore(),
          ban: { threshold: 2, duration: '1h' },
          key: () => 'ban-test-1'
        }, () => new Response('OK'))
      })

      // First request: allowed
      await fetch(`http://localhost:${server.port}`)
      // Second request: rate limited (violation 1)
      await fetch(`http://localhost:${server.port}`)
      // Third request: rate limited (violation 2 = threshold, triggers ban)
      await fetch(`http://localhost:${server.port}`)
      // Fourth request: banned
      const res = await fetch(`http://localhost:${server.port}`)

      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.banned).toBe(true)
    })

    it('includes ban headers', async () => {
      server = Bun.serve({
        port: 0,
        fetch: hitlimit({
          limit: 1,
          window: '1m',
          store: memoryStore(),
          ban: { threshold: 2, duration: '1h' },
          key: () => 'ban-test-2'
        }, () => new Response('OK'))
      })

      await fetch(`http://localhost:${server.port}`)
      await fetch(`http://localhost:${server.port}`)
      await fetch(`http://localhost:${server.port}`)
      const res = await fetch(`http://localhost:${server.port}`)

      expect(res.headers.get('X-RateLimit-Ban')).toBe('true')
      expect(res.headers.get('X-RateLimit-Ban-Expires')).toBeDefined()
    })

    it('ban works with createHitLimit', async () => {
      const limiter = createHitLimit({
        limit: 1,
        window: '1m',
        store: memoryStore(),
        ban: { threshold: 2, duration: '1h' },
        key: () => 'ban-test-3'
      })

      server = Bun.serve({
        port: 0,
        async fetch(req, server) {
          const blocked = await limiter.check(req, server)
          if (blocked) return blocked
          return new Response('OK')
        }
      })

      await fetch(`http://localhost:${server.port}`)
      await fetch(`http://localhost:${server.port}`)
      await fetch(`http://localhost:${server.port}`)
      const res = await fetch(`http://localhost:${server.port}`)

      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.banned).toBe(true)
    })
  })

  describe('group support', () => {
    it('uses dynamic group function', async () => {
      server = Bun.serve({
        port: 0,
        fetch: hitlimit({
          limit: 2,
          window: '1m',
          store: memoryStore(),
          group: (req) => req.headers.get('x-api-key') || 'default'
        }, () => new Response('OK'))
      })

      await fetch(`http://localhost:${server.port}`, { headers: { 'x-api-key': 'key1' } })
      await fetch(`http://localhost:${server.port}`, { headers: { 'x-api-key': 'key1' } })
      const blocked = await fetch(`http://localhost:${server.port}`, { headers: { 'x-api-key': 'key1' } })
      expect(blocked.status).toBe(429)

      // Different key has its own limit
      const ok = await fetch(`http://localhost:${server.port}`, { headers: { 'x-api-key': 'key2' } })
      expect(ok.status).toBe(200)
    })
  })
})
