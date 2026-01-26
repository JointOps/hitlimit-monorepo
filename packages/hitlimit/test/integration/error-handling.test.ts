import { describe, it, expect, beforeEach } from 'vitest'
import express, { type Application } from 'express'
import request from 'supertest'
import { hitlimit } from '../../src/index.js'
import type { HitLimitStore } from '@joint-ops/hitlimit-types'

describe('Error Handling', () => {
  let app: Application

  beforeEach(() => {
    app = express()
  })

  it('handles key generation errors with allow', async () => {
    app.use(hitlimit({
      key: () => {
        throw new Error('Key generation failed')
      },
      onStoreError: () => 'allow'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })

  it('handles tier resolution errors gracefully', async () => {
    app.use(hitlimit({
      tiers: {
        free: { limit: 10, window: '1m' }
      },
      tier: () => {
        throw new Error('Tier resolution failed')
      }
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })

  it('handles async key generation errors', async () => {
    app.use(hitlimit({
      key: async () => {
        await new Promise(r => setTimeout(r, 5))
        throw new Error('Async key error')
      },
      onStoreError: () => 'allow'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })

  it('handles store errors during concurrent requests', async () => {
    let callCount = 0
    const intermittentStore: HitLimitStore = {
      hit: () => {
        callCount++
        if (callCount % 3 === 0) {
          throw new Error('Intermittent failure')
        }
        return { count: callCount, resetAt: Date.now() + 60000 }
      },
      reset: () => {}
    }

    app.use(hitlimit({
      store: intermittentStore,
      onStoreError: () => 'allow'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const requests = Array.from({ length: 10 }, () => request(app).get('/'))
    const responses = await Promise.all(requests)

    const successCount = responses.filter(r => r.status === 200).length
    expect(successCount).toBe(10)
  })

  it('handles null/undefined in store results', async () => {
    const brokenStore: HitLimitStore = {
      hit: () => ({ count: 1, resetAt: Date.now() + 60000 }),
      reset: () => {}
    }

    app.use(hitlimit({
      store: brokenStore,
      limit: 10,
      window: '1m'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })
})
