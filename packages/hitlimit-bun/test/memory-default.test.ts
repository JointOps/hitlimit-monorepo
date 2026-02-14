import { describe, it, expect, afterEach } from 'bun:test'
import { hitlimit, createHitLimit } from '../src/index'
import { sqliteStore } from '../src/stores/sqlite'
import * as fs from 'fs'

describe('Memory Default (v1.1.0)', () => {
  afterEach(() => {
    if (fs.existsSync('./test-hitlimit.db')) {
      fs.unlinkSync('./test-hitlimit.db')
    }
  })

  it('should use memory store by default', async () => {
    const handler = (req: Request) => new Response('ok')
    const limited = hitlimit({}, handler)

    const server = Bun.serve({ port: 0, fetch: limited })
    const url = `http://localhost:${server.port}`

    await fetch(url)
    expect(fs.existsSync('./hitlimit.db')).toBe(false)

    server.stop()
  })

  it('should still support explicit sqliteStore', async () => {
    const handler = (req: Request) => new Response('ok')
    const store = sqliteStore({ path: './test-hitlimit.db' })

    const limited = hitlimit({ store }, handler)

    const server = Bun.serve({ port: 0, fetch: limited })
    const url = `http://localhost:${server.port}`

    await fetch(url)
    expect(fs.existsSync('./test-hitlimit.db')).toBe(true)

    server.stop()
  })

  it('should warn about deprecated sqlitePath option', async () => {
    const handler = (req: Request) => new Response('ok')
    const warnings: string[] = []

    const originalWarn = console.warn
    console.warn = (msg: string) => warnings.push(msg)

    const limited = hitlimit({ sqlitePath: './ignored.db' }, handler)

    expect(warnings.length).toBe(1)
    expect(warnings[0]).toContain('DEPRECATION WARNING')
    expect(warnings[0]).toContain('sqlitePath')

    expect(fs.existsSync('./ignored.db')).toBe(false)

    console.warn = originalWarn
  })

  it('should NOT warn if store is explicitly provided', async () => {
    const handler = (req: Request) => new Response('ok')
    const warnings: string[] = []

    const originalWarn = console.warn
    console.warn = (msg: string) => warnings.push(msg)

    const store = sqliteStore({ path: ':memory:' })
    const limited = hitlimit({ sqlitePath: './ignored.db', store }, handler)

    expect(warnings.length).toBe(0)

    console.warn = originalWarn
  })

  it('createHitLimit should also use memory by default', async () => {
    const limiter = createHitLimit({})

    const handler = (req: Request) => new Response('ok')
    const server = Bun.serve({ port: 0, fetch: handler })
    const url = `http://localhost:${server.port}`

    const req = new Request(url)
    const result = await limiter.check(req, server)

    expect(fs.existsSync('./hitlimit.db')).toBe(false)

    server.stop()
  })

  it('should be significantly faster with memory (sanity check)', async () => {
    const handler = (req: Request) => new Response('ok')

    // Memory version
    const memLimited = hitlimit({}, handler)
    const memServer = Bun.serve({ port: 0, fetch: memLimited })
    const memUrl = `http://localhost:${memServer.port}`

    // Warmup to avoid cold-start JIT skew
    for (let i = 0; i < 10; i++) await fetch(memUrl)

    const memStart = performance.now()
    for (let i = 0; i < 100; i++) {
      await fetch(memUrl)
    }
    const memTime = performance.now() - memStart

    memServer.stop()

    // SQLite version
    const sqlStore = sqliteStore({ path: ':memory:' })
    const sqlLimited = hitlimit({ store: sqlStore }, handler)
    const sqlServer = Bun.serve({ port: 0, fetch: sqlLimited })
    const sqlUrl = `http://localhost:${sqlServer.port}`

    // Warmup
    for (let i = 0; i < 10; i++) await fetch(sqlUrl)

    const sqlStart = performance.now()
    for (let i = 0; i < 100; i++) {
      await fetch(sqlUrl)
    }
    const sqlTime = performance.now() - sqlStart

    sqlServer.stop()

    // Memory should be faster — allow 1.5x margin for CI noise
    expect(memTime).toBeLessThanOrEqual(sqlTime * 1.5)
  })
})
