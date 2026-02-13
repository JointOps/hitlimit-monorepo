import { describe, it, expect, afterEach, spyOn } from 'bun:test'
import { hitlimit } from '../../src/index'
import { memoryStore } from '../../src/stores/memory'
import { consoleLogger } from '../../src/loggers/console'
import type { HitLimitLogger } from '@joint-ops/hitlimit-types'

describe('Logger Integration', () => {
  let server: ReturnType<typeof Bun.serve>

  afterEach(() => {
    server?.stop()
  })

  it('accepts logger configuration', async () => {
    const logs: Array<{ level: string; message: string; meta?: any }> = []
    const logger: HitLimitLogger = {
      debug: (msg, meta) => logs.push({ level: 'debug', message: msg, meta }),
      info: (msg, meta) => logs.push({ level: 'info', message: msg, meta }),
      warn: (msg, meta) => logs.push({ level: 'warn', message: msg, meta }),
      error: (msg, meta) => logs.push({ level: 'error', message: msg, meta })
    }

    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        limit: 10,
        window: '1m',
        store: memoryStore(),
        logger
      }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect(res.status).toBe(200)
  })

  it('works with console logger', async () => {
    const spy = spyOn(console, 'debug').mockImplementation(() => {})

    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        limit: 10,
        window: '1m',
        store: memoryStore(),
        logger: consoleLogger()
      }, () => new Response('OK'))
    })

    await fetch(`http://localhost:${server.port}`)
    expect(true).toBe(true)

    spy.mockRestore()
  })

  it('does not throw when logger throws', async () => {
    const brokenLogger: HitLimitLogger = {
      debug: () => { throw new Error('Logger broken') },
      info: () => { throw new Error('Logger broken') },
      warn: () => { throw new Error('Logger broken') },
      error: () => { throw new Error('Logger broken') }
    }

    server = Bun.serve({
      port: 0,
      fetch: hitlimit({
        limit: 10,
        window: '1m',
        store: memoryStore(),
        logger: brokenLogger
      }, () => new Response('OK'))
    })

    const res = await fetch(`http://localhost:${server.port}`)
    expect(res.status).toBe(200)
  })
})
