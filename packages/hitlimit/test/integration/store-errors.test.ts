import { describe, it, expect, beforeEach } from 'vitest'
import express, { type Application } from 'express'
import request from 'supertest'
import { hitlimit } from '../../src/index.js'
import type { HitLimitStore } from '@hitlimit/types'

describe('Store Error Handling', () => {
  let app: Application

  beforeEach(() => {
    app = express()
  })

  const createFailingStore = (): HitLimitStore => ({
    hit: () => { throw new Error('Store connection failed') },
    reset: () => { throw new Error('Store connection failed') }
  })

  const createIntermittentStore = (failUntil: number): HitLimitStore => {
    let calls = 0
    return {
      hit: (key, windowMs) => {
        calls++
        if (calls <= failUntil) {
          throw new Error('Temporary failure')
        }
        return { count: calls - failUntil, resetAt: Date.now() + windowMs }
      },
      reset: () => {}
    }
  }

  it('allows requests when onStoreError returns allow', async () => {
    app.use(hitlimit({
      store: createFailingStore(),
      onStoreError: () => 'allow'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })

  it('denies requests when onStoreError returns deny', async () => {
    app.use(hitlimit({
      store: createFailingStore(),
      onStoreError: () => 'deny'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(429)
    expect(res.body.hitlimit).toBe(true)
  })

  it('supports async onStoreError handler', async () => {
    app.use(hitlimit({
      store: createFailingStore(),
      onStoreError: async () => {
        await new Promise(r => setTimeout(r, 5))
        return 'allow'
      }
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })

  it('passes error and request to onStoreError', async () => {
    let capturedError: Error | null = null
    let capturedPath: string | null = null

    app.use(hitlimit({
      store: createFailingStore(),
      onStoreError: (error, req) => {
        capturedError = error
        capturedPath = req.path
        return 'allow'
      }
    }))
    app.get('/test-path', (_req, res) => res.send('OK'))

    await request(app).get('/test-path')

    expect(capturedError?.message).toBe('Store connection failed')
    expect(capturedPath).toBe('/test-path')
  })

  it('can apply different policies based on request', async () => {
    app.use(hitlimit({
      store: createFailingStore(),
      onStoreError: (_error, req) => {
        if (req.path.startsWith('/admin')) {
          return 'deny'
        }
        return 'allow'
      }
    }))
    app.get('/admin/dashboard', (_req, res) => res.send('Admin'))
    app.get('/public', (_req, res) => res.send('Public'))

    const adminRes = await request(app).get('/admin/dashboard')
    expect(adminRes.status).toBe(429)

    const publicRes = await request(app).get('/public')
    expect(publicRes.status).toBe(200)
  })

  it('recovers after intermittent failures', async () => {
    const store = createIntermittentStore(2)

    app.use(hitlimit({
      limit: 10,
      window: '1m',
      store,
      onStoreError: () => 'allow'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res1 = await request(app).get('/')
    expect(res1.status).toBe(200)

    const res2 = await request(app).get('/')
    expect(res2.status).toBe(200)

    const res3 = await request(app).get('/')
    expect(res3.status).toBe(200)
    expect(res3.headers['ratelimit-remaining']).toBe('9')
  })

  it('default behavior allows on store error', async () => {
    app.use(hitlimit({
      store: createFailingStore()
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })

  it('handles store errors during high load', async () => {
    let errorCount = 0
    const unreliableStore: HitLimitStore = {
      hit: () => {
        if (Math.random() < 0.3) {
          errorCount++
          throw new Error('Random failure')
        }
        return { count: 1, resetAt: Date.now() + 60000 }
      },
      reset: () => {}
    }

    app.use(hitlimit({
      limit: 1000,
      window: '1m',
      store: unreliableStore,
      onStoreError: () => 'allow'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const requests = Array.from({ length: 50 }, () => request(app).get('/'))
    const responses = await Promise.all(requests)

    const successCount = responses.filter(r => r.status === 200).length
    expect(successCount).toBe(50)
    expect(errorCount).toBeGreaterThan(0)
  })
})
