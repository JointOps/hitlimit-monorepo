import { describe, it, expect, beforeEach } from 'vitest'
import express, { type Application } from 'express'
import request from 'supertest'
import { hitlimit, memoryStore } from '../../src/index.js'
import type { HitLimitStore, StoreResult } from '@joint-ops/hitlimit-types'

describe('Sync Fast Path', () => {
  let app: Application

  beforeEach(() => {
    app = express()
  })

  it('uses sync path for memory store with default key', async () => {
    app.use(hitlimit({ limit: 5, window: '1m', store: memoryStore() }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.text).toBe('OK')
  })

  it('sync path produces identical results to async path', async () => {
    const syncStore = memoryStore()
    const asyncStore = memoryStore()

    // Remove isSync to force async path
    delete (asyncStore as any).isSync

    const syncApp = express()
    syncApp.use(hitlimit({ limit: 3, window: '1m', store: syncStore }))
    syncApp.get('/', (_req, res) => res.send('OK'))

    const asyncApp = express()
    asyncApp.use(hitlimit({ limit: 3, window: '1m', store: asyncStore }))
    asyncApp.get('/', (_req, res) => res.send('OK'))

    // Make identical requests to both
    for (let i = 0; i < 4; i++) {
      const syncRes = await request(syncApp).get('/')
      const asyncRes = await request(asyncApp).get('/')
      expect(syncRes.status).toBe(asyncRes.status)
    }
  })

  it('sync path sets standard headers correctly', async () => {
    app.use(hitlimit({ limit: 10, window: '1m', store: memoryStore() }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.headers['ratelimit-limit']).toBe('10')
    expect(res.headers['ratelimit-remaining']).toBe('9')
    expect(res.headers['ratelimit-reset']).toBeDefined()
  })

  it('sync path sets legacy headers correctly', async () => {
    app.use(hitlimit({ limit: 10, window: '1m', store: memoryStore() }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.headers['x-ratelimit-limit']).toBe('10')
    expect(res.headers['x-ratelimit-remaining']).toBe('9')
  })

  it('sync path blocks and returns 429 with Retry-After', async () => {
    app.use(hitlimit({ limit: 1, window: '1m', store: memoryStore() }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/')
    const res = await request(app).get('/')

    expect(res.status).toBe(429)
    expect(res.headers['retry-after']).toBeDefined()
    expect(res.body.hitlimit).toBe(true)
  })

  it('falls back to async path with custom key function', async () => {
    app.use(hitlimit({
      limit: 5,
      window: '1m',
      store: memoryStore(),
      key: (req) => req.headers['x-api-key'] as string || 'default'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/').set('X-API-Key', 'test')
    expect(res.status).toBe(200)
  })

  it('falls back to async path with skip function', async () => {
    app.use(hitlimit({
      limit: 1,
      window: '1m',
      store: memoryStore(),
      skip: (req) => req.path === '/health'
    }))
    app.get('/', (_req, res) => res.send('OK'))
    app.get('/health', (_req, res) => res.send('healthy'))

    await request(app).get('/')
    const blocked = await request(app).get('/')
    expect(blocked.status).toBe(429)

    const health = await request(app).get('/health')
    expect(health.status).toBe(200)
  })

  it('falls back to full path with ban config', async () => {
    app.use(hitlimit({
      limit: 1,
      window: '1m',
      store: memoryStore(),
      ban: { threshold: 3, duration: '1h' }
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })

  it('falls back to full path with group config', async () => {
    app.use(hitlimit({
      limit: 5,
      window: '1m',
      store: memoryStore(),
      group: 'api'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })

  it('falls back to async path for stores without isSync', async () => {
    const asyncStore: HitLimitStore = {
      hit(_key: string, windowMs: number, _limit: number): Promise<StoreResult> {
        return Promise.resolve({ count: 1, resetAt: Date.now() + windowMs })
      },
      reset(): Promise<void> {
        return Promise.resolve()
      }
    }

    app.use(hitlimit({ limit: 5, window: '1m', store: asyncStore }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })

  it('memory store has isSync property', () => {
    const store = memoryStore()
    expect(store.isSync).toBe(true)
  })
})
