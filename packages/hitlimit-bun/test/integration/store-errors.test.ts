import { describe, it, expect, afterEach } from 'bun:test'
import { hitlimit } from '../../src/index'
import type { HitLimitStore } from '@joint-ops/hitlimit-types'

describe('Store Error Handling', () => {
  let server: ReturnType<typeof Bun.serve>

  afterEach(() => {
    server?.stop()
  })

  const createFailingStore = (): HitLimitStore => ({
    hit: () => { throw new Error('Store connection failed') },
    reset: () => { throw new Error('Store connection failed') }
  })

  const createIntermittentStore = (failUntil: number): HitLimitStore => {
    let calls = 0
    return {
      hit: (_key, windowMs) => {
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
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        store: createFailingStore(),
        onStoreError: () => 'allow'
      }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect(res.status).toBe(200)
  })

  it('denies requests when onStoreError returns deny', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        store: createFailingStore(),
        onStoreError: () => 'deny'
      }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.hitlimit).toBe(true)
  })

  it('supports async onStoreError handler', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        store: createFailingStore(),
        onStoreError: async () => {
          await new Promise(r => setTimeout(r, 5))
          return 'allow'
        }
      }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect(res.status).toBe(200)
  })

  it('passes error and request to onStoreError', async () => {
    let capturedError: Error | null = null
    let capturedUrl: string | null = null

    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        store: createFailingStore(),
        onStoreError: (error, req) => {
          capturedError = error
          capturedUrl = req.url
          return 'allow'
        }
      }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}/test-path`)

    expect(capturedError?.message).toBe('Store connection failed')
    expect(capturedUrl).toContain('/test-path')
  })

  it('can apply different policies based on request path', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        store: createFailingStore(),
        onStoreError: (_error, req) => {
          const url = new URL(req.url)
          if (url.pathname.startsWith('/admin')) {
            return 'deny'
          }
          return 'allow'
        }
      }, () => new Response('OK'))
    })

    const adminRes = await fetch(`http://localhost:${server.port}/admin/dashboard`)
    expect(adminRes.status).toBe(429)

    const publicRes = await fetch(`http://localhost:${server.port}/public`)
    expect(publicRes.status).toBe(200)
  })

  it('recovers after intermittent failures', async () => {
    const store = createIntermittentStore(2)

    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        limit: 10,
        window: '1m',
        store,
        onStoreError: () => 'allow'
      }, () => new Response('OK'))
    })

    const res1 = await fetch(`http://localhost:${server.port}`)
    expect(res1.status).toBe(200)

    const res2 = await fetch(`http://localhost:${server.port}`)
    expect(res2.status).toBe(200)

    const res3 = await fetch(`http://localhost:${server.port}`)
    expect(res3.status).toBe(200)
    expect(res3.headers.get('RateLimit-Remaining')).toBe('9')
  })

  it('default behavior allows on store error', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        store: createFailingStore()
      }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
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

    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        limit: 1000,
        window: '1m',
        store: unreliableStore,
        onStoreError: () => 'allow'
      }, () => new Response('OK'))
    })

    const requests = Array.from({ length: 50 }, () =>
      fetch(`http://localhost:${server.port}`)
    )
    const responses = await Promise.all(requests)

    const successCount = responses.filter(r => r.status === 200).length
    expect(successCount).toBe(50)
    expect(errorCount).toBeGreaterThan(0)
  })

  it('handles store that returns invalid data', async () => {
    const badStore: HitLimitStore = {
      hit: () => ({ count: NaN, resetAt: NaN }),
      reset: () => {}
    }

    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        limit: 10,
        window: '1m',
        store: badStore
      }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect([200, 429]).toContain(res.status)
  })

  it('can use onStoreError for logging', async () => {
    const logs: string[] = []

    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        store: createFailingStore(),
        onStoreError: (error, req) => {
          logs.push(`Error: ${error.message} for ${new URL(req.url).pathname}`)
          return 'allow'
        }
      }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}/api/test`)

    expect(logs.length).toBe(1)
    expect(logs[0]).toContain('Store connection failed')
    expect(logs[0]).toContain('/api/test')
  })
})
