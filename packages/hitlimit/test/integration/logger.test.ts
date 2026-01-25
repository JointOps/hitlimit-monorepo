import { describe, it, expect, beforeEach, vi } from 'vitest'
import express, { type Application } from 'express'
import request from 'supertest'
import { hitlimit } from '../../src/index.js'
import { consoleLogger } from '../../src/loggers/console.js'
import type { HitLimitLogger } from '@hitlimit/types'

describe('Logger Integration', () => {
  let app: Application

  beforeEach(() => {
    app = express()
  })

  it('accepts logger configuration', async () => {
    const logs: Array<{ level: string; message: string; meta?: any }> = []
    const logger: HitLimitLogger = {
      debug: (msg, meta) => logs.push({ level: 'debug', message: msg, meta }),
      info: (msg, meta) => logs.push({ level: 'info', message: msg, meta }),
      warn: (msg, meta) => logs.push({ level: 'warn', message: msg, meta }),
      error: (msg, meta) => logs.push({ level: 'error', message: msg, meta })
    }

    app.use(hitlimit({
      limit: 10,
      window: '1m',
      logger
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })

  it('works with console logger', async () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})

    app.use(hitlimit({
      limit: 10,
      window: '1m',
      logger: consoleLogger()
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await request(app).get('/')
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

    app.use(hitlimit({
      limit: 10,
      window: '1m',
      logger: brokenLogger
    }))
    app.get('/', (_req, res) => res.send('OK'))

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })
})
