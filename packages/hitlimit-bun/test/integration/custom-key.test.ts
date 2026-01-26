import { describe, it, expect, afterEach } from 'bun:test'
import { hitlimit } from '../../src/index'
import { memoryStore } from '../../src/stores/memory'

describe('Custom Key Generation', () => {
  let server: ReturnType<typeof Bun.serve>

  afterEach(() => {
    server?.stop()
  })

  it('uses custom sync key function', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        limit: 2,
        window: '1m',
        store: memoryStore(),
        key: (req) => req.headers.get('x-user-id') || 'anonymous'
      }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}`, { headers: { 'x-user-id': 'user1' } })
    await fetch(`http://localhost:${server.port}`, { headers: { 'x-user-id': 'user1' } })
    const user1Blocked = await fetch(`http://localhost:${server.port}`, { headers: { 'x-user-id': 'user1' } })
    expect(user1Blocked.status).toBe(429)

    const user2Allowed = await fetch(`http://localhost:${server.port}`, { headers: { 'x-user-id': 'user2' } })
    expect(user2Allowed.status).toBe(200)
  })

  it('uses custom async key function', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        limit: 2,
        window: '1m',
        store: memoryStore(),
        key: async (req) => {
          await new Promise(r => setTimeout(r, 5))
          const apiKey = req.headers.get('x-api-key')
          return apiKey ? `api:${apiKey}` : 'anonymous'
        }
      }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}`, { headers: { 'x-api-key': 'key123' } })
    await fetch(`http://localhost:${server.port}`, { headers: { 'x-api-key': 'key123' } })
    const blocked = await fetch(`http://localhost:${server.port}`, { headers: { 'x-api-key': 'key123' } })
    expect(blocked.status).toBe(429)

    const differentKey = await fetch(`http://localhost:${server.port}`, { headers: { 'x-api-key': 'key456' } })
    expect(differentKey.status).toBe(200)
  })

  it('can combine multiple factors in key', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        limit: 1,
        window: '1m',
        store: memoryStore(),
        key: (req) => {
          const url = new URL(req.url)
          return `${req.method}:${url.pathname}:${req.headers.get('x-user-id') || 'anon'}`
        }
      }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}/resource`, { headers: { 'x-user-id': 'user1' } })
    const getBlocked = await fetch(`http://localhost:${server.port}/resource`, { headers: { 'x-user-id': 'user1' } })
    expect(getBlocked.status).toBe(429)

    const postAllowed = await fetch(`http://localhost:${server.port}/resource`, {
      method: 'POST',
      headers: { 'x-user-id': 'user1' }
    })
    expect(postAllowed.status).toBe(200)
  })

  it('tracks anonymous users separately from authenticated', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        limit: 1,
        window: '1m',
        store: memoryStore(),
        key: (req) => req.headers.get('x-user-id') || 'anonymous'
      }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}`)
    const anonBlocked = await fetch(`http://localhost:${server.port}`)
    expect(anonBlocked.status).toBe(429)

    const authAllowed = await fetch(`http://localhost:${server.port}`, { headers: { 'x-user-id': 'user1' } })
    expect(authAllowed.status).toBe(200)
  })

  it('handles different paths as different keys', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        limit: 1,
        window: '1m',
        store: memoryStore(),
        key: (req) => new URL(req.url).pathname
      }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}/api/users`)
    const usersBlocked = await fetch(`http://localhost:${server.port}/api/users`)
    expect(usersBlocked.status).toBe(429)

    const productsAllowed = await fetch(`http://localhost:${server.port}/api/products`)
    expect(productsAllowed.status).toBe(200)
  })

  it('handles IP-based rate limiting', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        limit: 2,
        window: '1m',
        store: memoryStore(),
        key: (req) => req.headers.get('x-forwarded-for') || '127.0.0.1'
      }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}`, { headers: { 'x-forwarded-for': '1.2.3.4' } })
    await fetch(`http://localhost:${server.port}`, { headers: { 'x-forwarded-for': '1.2.3.4' } })
    const blocked = await fetch(`http://localhost:${server.port}`, { headers: { 'x-forwarded-for': '1.2.3.4' } })
    expect(blocked.status).toBe(429)

    const differentIp = await fetch(`http://localhost:${server.port}`, { headers: { 'x-forwarded-for': '5.6.7.8' } })
    expect(differentIp.status).toBe(200)
  })

  it('handles window reset for same key', async () => {
    const store = memoryStore()

    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        limit: 1,
        window: 100,
        store,
        key: () => 'fixed-key'
      }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}`)
    const blocked = await fetch(`http://localhost:${server.port}`)
    expect(blocked.status).toBe(429)

    await new Promise(r => setTimeout(r, 150))

    const allowed = await fetch(`http://localhost:${server.port}`)
    expect(allowed.status).toBe(200)

    store.shutdown?.()
  })
})
