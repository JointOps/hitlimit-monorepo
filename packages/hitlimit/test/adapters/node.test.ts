import { describe, it, expect, afterEach } from 'vitest'
import http from 'http'
import { createHitLimit, memoryStore } from '../../src/node.js'

describe('Node.js http Adapter', () => {
  let server: http.Server

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  const createServer = (limiter: ReturnType<typeof createHitLimit>) => {
    return http.createServer(async (req, res) => {
      const result = await limiter.check(req)

      if (!result.allowed) {
        res.writeHead(429, { 'Content-Type': 'application/json', ...result.headers })
        res.end(JSON.stringify(result.body))
        return
      }

      Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v))
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('OK')
    })
  }

  const fetch = (port: number) => {
    return new Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
      http.get(`http://localhost:${port}`, (res) => {
        let body = ''
        res.on('data', chunk => body += chunk)
        res.on('end', () => resolve({ status: res.statusCode!, body, headers: res.headers }))
      }).on('error', reject)
    })
  }

  it('allows requests under limit', async () => {
    const limiter = createHitLimit({ limit: 5, window: '1m', store: memoryStore() })
    server = createServer(limiter)

    await new Promise<void>(resolve => server.listen(0, resolve))
    const port = (server.address() as { port: number }).port

    const res = await fetch(port)
    expect(res.status).toBe(200)
    expect(res.body).toBe('OK')
  })

  it('blocks requests over limit', async () => {
    const limiter = createHitLimit({ limit: 2, window: '1m', store: memoryStore() })
    server = createServer(limiter)

    await new Promise<void>(resolve => server.listen(0, resolve))
    const port = (server.address() as { port: number }).port

    await fetch(port)
    await fetch(port)
    const res = await fetch(port)

    expect(res.status).toBe(429)
    expect(JSON.parse(res.body).hitlimit).toBe(true)
  })

  it('includes rate limit headers', async () => {
    const limiter = createHitLimit({ limit: 10, window: '1m', store: memoryStore() })
    server = createServer(limiter)

    await new Promise<void>(resolve => server.listen(0, resolve))
    const port = (server.address() as { port: number }).port

    const res = await fetch(port)

    expect(res.headers['ratelimit-limit']).toBe('10')
    expect(res.headers['ratelimit-remaining']).toBe('9')
  })

  it('supports reset method', async () => {
    const limiter = createHitLimit({ limit: 2, window: '1m', store: memoryStore() })
    server = createServer(limiter)

    await new Promise<void>(resolve => server.listen(0, resolve))
    const port = (server.address() as { port: number }).port

    await fetch(port)
    await fetch(port)

    const res1 = await fetch(port)
    expect(res1.status).toBe(429)
  })

  it('handles skip function', async () => {
    const limiter = createHitLimit({
      limit: 1,
      window: '1m',
      store: memoryStore(),
      skip: () => true
    })
    server = createServer(limiter)

    await new Promise<void>(resolve => server.listen(0, resolve))
    const port = (server.address() as { port: number }).port

    await fetch(port)
    const res = await fetch(port)

    expect(res.status).toBe(200)
  })
})
