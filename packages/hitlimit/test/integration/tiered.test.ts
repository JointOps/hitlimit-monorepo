import { describe, it, expect, beforeEach } from 'vitest'
import express, { type Application } from 'express'
import request from 'supertest'
import { hitlimit, memoryStore } from '../../src/index.js'

describe('Tiered Rate Limiting', () => {
  let app: Application

  beforeEach(() => {
    app = express()
  })

  it('applies different limits per tier', async () => {
    app.use(hitlimit({
      store: memoryStore(),
      tiers: {
        free: { limit: 2, window: '1m' },
        pro: { limit: 5, window: '1m' }
      },
      tier: (req) => req.headers['x-tier'] as string || 'free'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/').set('X-Tier', 'free')
    await request(app).get('/').set('X-Tier', 'free')
    const freeBlocked = await request(app).get('/').set('X-Tier', 'free')
    expect(freeBlocked.status).toBe(429)

    const proAllowed = await request(app).get('/').set('X-Tier', 'pro')
    expect(proAllowed.status).toBe(200)
  })

  it('uses tier-specific window', async () => {
    app.use(hitlimit({
      store: memoryStore(),
      tiers: {
        fast: { limit: 2, window: 100 },
        slow: { limit: 2, window: '1h' }
      },
      tier: (req) => req.headers['x-tier'] as string || 'fast'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/').set('X-Tier', 'fast')
    await request(app).get('/').set('X-Tier', 'fast')
    const blocked = await request(app).get('/').set('X-Tier', 'fast')
    expect(blocked.status).toBe(429)

    await new Promise(r => setTimeout(r, 150))

    const afterExpiry = await request(app).get('/').set('X-Tier', 'fast')
    expect(afterExpiry.status).toBe(200)
  })

  it('handles Infinity limit tier', async () => {
    app.use(hitlimit({
      store: memoryStore(),
      tiers: {
        free: { limit: 1, window: '1m' },
        enterprise: { limit: Infinity }
      },
      tier: (req) => req.headers['x-tier'] as string || 'free'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/').set('X-Tier', 'free')
    const freeBlocked = await request(app).get('/').set('X-Tier', 'free')
    expect(freeBlocked.status).toBe(429)

    for (let i = 0; i < 50; i++) {
      const res = await request(app).get('/').set('X-Tier', 'enterprise')
      expect(res.status).toBe(200)
    }
  })

  it('supports async tier resolver', async () => {
    app.use(hitlimit({
      store: memoryStore(),
      tiers: {
        basic: { limit: 1, window: '1m' },
        premium: { limit: 100, window: '1m' }
      },
      tier: async (req) => {
        await new Promise(r => setTimeout(r, 10))
        return req.headers['x-api-key'] === 'premium' ? 'premium' : 'basic'
      }
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/').set('X-API-Key', 'basic')
    const blocked = await request(app).get('/').set('X-API-Key', 'basic')
    expect(blocked.status).toBe(429)

    const premiumAllowed = await request(app).get('/').set('X-API-Key', 'premium')
    expect(premiumAllowed.status).toBe(200)
  })

  it('falls back to default when tier not found', async () => {
    app.use(hitlimit({
      limit: 5,
      window: '1m',
      store: memoryStore(),
      tiers: {
        premium: { limit: 100, window: '1m' }
      },
      tier: (req) => req.headers['x-tier'] as string || 'unknown'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/')
      expect(res.status).toBe(200)
    }

    const blocked = await request(app).get('/')
    expect(blocked.status).toBe(429)
  })

  it('tracks different tiers separately by key', async () => {
    app.use(hitlimit({
      store: memoryStore(),
      tiers: {
        free: { limit: 2, window: '1m' },
        pro: { limit: 2, window: '1m' }
      },
      tier: (req) => req.headers['x-tier'] as string || 'free',
      key: (req) => `${req.headers['x-user-id']}-${req.headers['x-tier']}`
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/').set('X-User-Id', 'user1').set('X-Tier', 'free')
    await request(app).get('/').set('X-User-Id', 'user1').set('X-Tier', 'free')

    const user1FreeBlocked = await request(app).get('/').set('X-User-Id', 'user1').set('X-Tier', 'free')
    expect(user1FreeBlocked.status).toBe(429)

    const user1ProAllowed = await request(app).get('/').set('X-User-Id', 'user1').set('X-Tier', 'pro')
    expect(user1ProAllowed.status).toBe(200)
  })
})
