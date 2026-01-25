import { describe, it, expect, afterEach } from 'bun:test'
import { hitlimit } from '../../src/index'
import { memoryStore } from '../../src/stores/memory'

describe('Tiered Rate Limiting', () => {
  let server: ReturnType<typeof Bun.serve>

  afterEach(() => {
    server?.stop()
  })

  it('applies different limits per tier', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        store: memoryStore(),
        tiers: {
          free: { limit: 2, window: '1m' },
          pro: { limit: 100, window: '1m' }
        },
        tier: (req) => req.headers.get('x-tier') || 'free'
      }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}`, { headers: { 'x-tier': 'free' } })
    await fetch(`http://localhost:${server.port}`, { headers: { 'x-tier': 'free' } })
    const freeBlocked = await fetch(`http://localhost:${server.port}`, { headers: { 'x-tier': 'free' } })
    expect(freeBlocked.status).toBe(429)

    const proAllowed = await fetch(`http://localhost:${server.port}`, { headers: { 'x-tier': 'pro' } })
    expect(proAllowed.status).toBe(200)
  })

  it('handles Infinity limit tier', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        store: memoryStore(),
        tiers: {
          free: { limit: 1, window: '1m' },
          enterprise: { limit: Infinity }
        },
        tier: (req) => req.headers.get('x-tier') || 'free'
      }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}`, { headers: { 'x-tier': 'free' } })
    const freeBlocked = await fetch(`http://localhost:${server.port}`, { headers: { 'x-tier': 'free' } })
    expect(freeBlocked.status).toBe(429)

    for (let i = 0; i < 50; i++) {
      const res = await fetch(`http://localhost:${server.port}`, { headers: { 'x-tier': 'enterprise' } })
      expect(res.status).toBe(200)
    }
  })

  it('supports async tier resolver', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        store: memoryStore(),
        tiers: {
          basic: { limit: 1, window: '1m' },
          premium: { limit: 100, window: '1m' }
        },
        tier: async (req) => {
          await Bun.sleep(5)
          return req.headers.get('x-api-key') === 'premium' ? 'premium' : 'basic'
        }
      }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}`, { headers: { 'x-api-key': 'basic' } })
    const blocked = await fetch(`http://localhost:${server.port}`, { headers: { 'x-api-key': 'basic' } })
    expect(blocked.status).toBe(429)

    const premiumAllowed = await fetch(`http://localhost:${server.port}`, { headers: { 'x-api-key': 'premium' } })
    expect(premiumAllowed.status).toBe(200)
  })
})
