import { describe, it, expect, afterEach } from 'bun:test'
import { hitlimit } from '../../src/index'
import type { HitLimitStore } from '@joint-ops/hitlimit-types'

describe('Error Handling', () => {
  let server: ReturnType<typeof Bun.serve>

  afterEach(() => {
    server?.stop()
  })

  it('handles key generation errors with allow', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        key: () => {
          throw new Error('Key generation failed')
        },
        onStoreError: () => 'allow'
      }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect(res.status).toBe(200)
  })

  it('handles tier resolution errors gracefully', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        tiers: {
          free: { limit: 10, window: '1m' }
        },
        tier: () => {
          throw new Error('Tier resolution failed')
        }
      }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect(res.status).toBe(200)
  })

  it('handles async key generation errors', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        key: async () => {
          await new Promise(r => setTimeout(r, 5))
          throw new Error('Async key error')
        },
        onStoreError: () => 'allow'
      }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
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

    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        store: intermittentStore,
        onStoreError: () => 'allow'
      }, () => new Response('OK'))
    })

    const requests = Array.from({ length: 10 }, () =>
      fetch(`http://localhost:${server.port}`)
    )
    const responses = await Promise.all(requests)

    const successCount = responses.filter(r => r.status === 200).length
    expect(successCount).toBe(10)
  })

  it('handles null/undefined in store results gracefully', async () => {
    const brokenStore: HitLimitStore = {
      hit: () => ({ count: 1, resetAt: Date.now() + 60000 }),
      reset: () => {}
    }

    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        store: brokenStore,
        limit: 10,
        window: '1m'
      }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect(res.status).toBe(200)
  })

  it('handles async tier resolution errors', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        tiers: {
          pro: { limit: 1000, window: '1m' }
        },
        tier: async () => {
          await new Promise(r => setTimeout(r, 5))
          throw new Error('Async tier error')
        },
        onStoreError: () => 'allow'
      }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect(res.status).toBe(200)
  })

})
