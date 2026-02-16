import { describe, it, expect, afterEach } from 'bun:test'
import { hitlimit, memoryStore } from '../../src/index'
import type { HitLimitStore, StoreResult } from '@joint-ops/hitlimit-types'

describe('Sync Fast Path', () => {
  let server: ReturnType<typeof Bun.serve>

  afterEach(() => {
    server?.stop()
  })

  it('uses sync path for memory store with default key', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({ limit: 5, window: '1m', store: memoryStore() }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OK')
  })

  it('sync path sets standard headers correctly', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({ limit: 10, window: '1m', store: memoryStore() }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect(res.headers.get('RateLimit-Limit')).toBe('10')
    expect(res.headers.get('RateLimit-Remaining')).toBe('9')
    expect(res.headers.get('RateLimit-Reset')).toBeDefined()
  })

  it('sync path sets legacy headers correctly', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({ limit: 10, window: '1m', store: memoryStore() }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('9')
  })

  it('sync path blocks and returns 429 with Retry-After', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({ limit: 1, window: '1m', store: memoryStore() }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}`)
    const res = await fetch(`http://localhost:${server.port}`)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeDefined()
  })

  it('falls back to async path with custom key function', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        limit: 5,
        window: '1m',
        store: memoryStore(),
        key: (req) => req.headers.get('x-api-key') || 'default'
      }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`, {
      headers: { 'x-api-key': 'test' }
    })
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

    server = Bun.serve({
      port: 0,
      fetch: hitlimit({ limit: 5, window: '1m', store: asyncStore }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect(res.status).toBe(200)
  })

  it('sync path produces identical results to async path', async () => {
    const syncStore = memoryStore()
    const asyncStore = memoryStore()
    delete (asyncStore as any).isSync

    const syncServer = Bun.serve({
      port: 0,
      fetch: hitlimit({ limit: 3, window: '1m', store: syncStore }, () => new Response('OK'))
    })

    const asyncServer = Bun.serve({
      port: 0,
      fetch: hitlimit({ limit: 3, window: '1m', store: asyncStore }, () => new Response('OK'))
    })

    try {
      for (let i = 0; i < 4; i++) {
        const syncRes = await fetch(`http://localhost:${syncServer.port}`)
        const asyncRes = await fetch(`http://localhost:${asyncServer.port}`)
        expect(syncRes.status).toBe(asyncRes.status)
      }
    } finally {
      syncServer.stop()
      asyncServer.stop()
    }
  })

  it('memory store has isSync property', () => {
    const store = memoryStore()
    expect(store.isSync).toBe(true)
  })
})
