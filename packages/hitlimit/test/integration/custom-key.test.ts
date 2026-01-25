import { describe, it, expect, beforeEach } from 'vitest'
import express, { type Application } from 'express'
import request from 'supertest'
import { hitlimit, memoryStore } from '../../src/index.js'

describe('Custom Key Generation', () => {
  let app: Application

  beforeEach(() => {
    app = express()
  })

  it('uses custom sync key function', async () => {
    app.use(hitlimit({
      limit: 2,
      window: '1m',
      store: memoryStore(),
      key: (req) => req.headers['x-user-id'] as string || 'anonymous'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/').set('X-User-Id', 'user1')
    await request(app).get('/').set('X-User-Id', 'user1')
    const user1Blocked = await request(app).get('/').set('X-User-Id', 'user1')
    expect(user1Blocked.status).toBe(429)

    const user2Allowed = await request(app).get('/').set('X-User-Id', 'user2')
    expect(user2Allowed.status).toBe(200)
  })

  it('uses custom async key function', async () => {
    app.use(hitlimit({
      limit: 2,
      window: '1m',
      store: memoryStore(),
      key: async (req) => {
        await new Promise(r => setTimeout(r, 5))
        const apiKey = req.headers['x-api-key'] as string
        return apiKey ? `api:${apiKey}` : 'anonymous'
      }
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/').set('X-API-Key', 'key123')
    await request(app).get('/').set('X-API-Key', 'key123')
    const blocked = await request(app).get('/').set('X-API-Key', 'key123')
    expect(blocked.status).toBe(429)

    const differentKey = await request(app).get('/').set('X-API-Key', 'key456')
    expect(differentKey.status).toBe(200)
  })

  it('can combine multiple factors in key', async () => {
    app.use(hitlimit({
      limit: 1,
      window: '1m',
      store: memoryStore(),
      key: (req) => `${req.method}:${req.path}:${req.headers['x-user-id'] || 'anon'}`
    }))
    app.get('/resource', (_req, res) => res.send('OK'))
    app.post('/resource', (_req, res) => res.send('OK'))

    await request(app).get('/resource').set('X-User-Id', 'user1')
    const getBlocked = await request(app).get('/resource').set('X-User-Id', 'user1')
    expect(getBlocked.status).toBe(429)

    const postAllowed = await request(app).post('/resource').set('X-User-Id', 'user1')
    expect(postAllowed.status).toBe(200)
  })

  it('tracks anonymous users separately from authenticated', async () => {
    app.use(hitlimit({
      limit: 1,
      window: '1m',
      store: memoryStore(),
      key: (req) => req.headers['x-user-id'] as string || 'anonymous'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/')
    const anonBlocked = await request(app).get('/')
    expect(anonBlocked.status).toBe(429)

    const authAllowed = await request(app).get('/').set('X-User-Id', 'user1')
    expect(authAllowed.status).toBe(200)
  })

  it('handles key function that throws', async () => {
    app.use(hitlimit({
      limit: 1,
      window: '1m',
      store: memoryStore(),
      key: () => {
        throw new Error('Key generation failed')
      },
      onStoreError: () => 'allow'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })

  it('exposes key in response body when limited', async () => {
    app.use(hitlimit({
      limit: 1,
      window: '1m',
      store: memoryStore(),
      key: (req) => req.headers['x-user-id'] as string || 'anonymous'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/').set('X-User-Id', 'testuser')
    const res = await request(app).get('/').set('X-User-Id', 'testuser')

    expect(res.status).toBe(429)
  })

  it('maintains separate counts per key with different windows', async () => {
    const fastStore = memoryStore()
    const slowStore = memoryStore()

    const fastApp = express()
    fastApp.use(hitlimit({
      limit: 1,
      window: 100,
      store: fastStore,
      key: () => 'shared-key'
    }))
    fastApp.get('/', (_req, res) => res.send('OK'))

    await request(fastApp).get('/')
    const blocked = await request(fastApp).get('/')
    expect(blocked.status).toBe(429)

    await new Promise(r => setTimeout(r, 150))

    const allowed = await request(fastApp).get('/')
    expect(allowed.status).toBe(200)

    fastStore.shutdown?.()
    slowStore.shutdown?.()
  })
})
