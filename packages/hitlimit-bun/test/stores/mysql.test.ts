import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test'
import { mysqlStore } from '../../src/stores/mysql'
import type { HitLimitStore } from '@joint-ops/hitlimit-types'

const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost'
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || '3306')
const MYSQL_USER = process.env.MYSQL_USER || 'hitlimit'
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'hitlimit'
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'hitlimit_test'

describe('MySQLStore', () => {
  let store: HitLimitStore
  let pool: any
  let prefix: string
  let isAvailable = false

  beforeAll(async () => {
    try {
      const mysql = await import('mysql2/promise')
      pool = await mysql.default.createPool({
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
        database: MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 20
      })
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      )
      await Promise.race([pool.execute('SELECT 1'), timeout])
      isAvailable = true
    } catch {
      isAvailable = false
    }
  }, 5000)

  afterAll(async () => {
    if (!isAvailable) return
    await pool?.end()
  })

  beforeEach(async () => {
    if (!isAvailable) return
    prefix = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    store = mysqlStore({ pool, tablePrefix: prefix })
  })

  afterEach(async () => {
    if (!isAvailable) return
    store.shutdown?.()
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_hits`).catch(() => {})
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_bans`).catch(() => {})
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_violations`).catch(() => {})
  })

  it('increments count on hit', async () => {
    if (!isAvailable) return
    const r1 = await store.hit('key1', 60000, 100)
    expect(r1.count).toBe(1)
    const r2 = await store.hit('key1', 60000, 100)
    expect(r2.count).toBe(2)
  })

  it('handles multiple keys independently', async () => {
    if (!isAvailable) return
    await store.hit('key1', 60000, 100)
    await store.hit('key1', 60000, 100)
    await store.hit('key2', 60000, 100)
    const r1 = await store.hit('key1', 60000, 100)
    const r2 = await store.hit('key2', 60000, 100)
    expect(r1.count).toBe(3)
    expect(r2.count).toBe(2)
  })

  it('resets specific key', async () => {
    if (!isAvailable) return
    await store.hit('key1', 60000, 100)
    await store.hit('key1', 60000, 100)
    await store.reset('key1')
    const r = await store.hit('key1', 60000, 100)
    expect(r.count).toBe(1)
  })

  it('returns resetAt in the future', async () => {
    if (!isAvailable) return
    const before = Date.now()
    const r = await store.hit('key1', 60000, 100)
    const after = Date.now()
    expect(r.resetAt).toBeGreaterThanOrEqual(before)
    expect(r.resetAt).toBeLessThanOrEqual(after + 60000)
  })

  it('resets window when expired', async () => {
    if (!isAvailable) return
    const r1 = await store.hit('key1', 50, 100)
    expect(r1.count).toBe(1)
    await new Promise(r => setTimeout(r, 100))
    const r2 = await store.hit('key1', 50, 100)
    expect(r2.count).toBe(1)
  })

  it('uses custom tablePrefix', async () => {
    if (!isAvailable) return
    const prefix = `custom_${Date.now()}`
    const customStore = mysqlStore({ pool, tablePrefix: prefix })
    const r = await customStore.hit('key1', 60000, 100)
    expect(r.count).toBe(1)
    customStore.shutdown?.()
  })
})

describe('MySQLStore Ban & Violations', () => {
  let store: HitLimitStore
  let pool: any
  let prefix: string
  let isAvailable = false

  beforeAll(async () => {
    try {
      const mysql = await import('mysql2/promise')
      pool = await mysql.default.createPool({
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
        database: MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 20
      })
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      )
      await Promise.race([pool.execute('SELECT 1'), timeout])
      isAvailable = true
    } catch {
      isAvailable = false
    }
  }, 5000)

  afterAll(async () => {
    if (!isAvailable) return
    await pool?.end()
  })

  beforeEach(async () => {
    if (!isAvailable) return
    prefix = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    store = mysqlStore({ pool, tablePrefix: prefix })
  })

  afterEach(async () => {
    if (!isAvailable) return
    store.shutdown?.()
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_hits`).catch(() => {})
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_bans`).catch(() => {})
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_violations`).catch(() => {})
  })

  it('isBanned returns false for non-banned keys', async () => {
    if (!isAvailable) return
    const result = await store.isBanned!('k1')
    expect(result).toBe(false)
  })

  it('ban + isBanned round-trip', async () => {
    if (!isAvailable) return
    await store.ban!('k1', 60000)
    const result = await store.isBanned!('k1')
    expect(result).toBe(true)
  })

  it('recordViolation increments', async () => {
    if (!isAvailable) return
    const v1 = await store.recordViolation!('k1', 60000)
    expect(v1).toBe(1)
    const v2 = await store.recordViolation!('k1', 60000)
    expect(v2).toBe(2)
  })

  it('reset clears hit, ban, and violation keys', async () => {
    if (!isAvailable) return
    await store.hit('k1', 60000, 10)
    await store.ban!('k1', 60000)
    await store.recordViolation!('k1', 60000)
    await store.reset('k1')
    const hit = await store.hit('k1', 60000, 10)
    expect(hit.count).toBe(1)
    const banned = await store.isBanned!('k1')
    expect(banned).toBe(false)
  })
})

describe('MySQLStore hitWithBan', () => {
  let store: HitLimitStore
  let pool: any
  let prefix: string
  let isAvailable = false

  beforeAll(async () => {
    try {
      const mysql = await import('mysql2/promise')
      pool = await mysql.default.createPool({
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
        database: MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 20
      })
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      )
      await Promise.race([pool.execute('SELECT 1'), timeout])
      isAvailable = true
    } catch {
      isAvailable = false
    }
  }, 5000)

  afterAll(async () => {
    if (!isAvailable) return
    await pool?.end()
  })

  beforeEach(async () => {
    if (!isAvailable) return
    prefix = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    store = mysqlStore({ pool, tablePrefix: prefix })
  })

  afterEach(async () => {
    if (!isAvailable) return
    store.shutdown?.()
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_hits`).catch(() => {})
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_bans`).catch(() => {})
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_violations`).catch(() => {})
  })

  it('counts hits atomically', async () => {
    if (!isAvailable) return
    const r1 = await store.hitWithBan!('k1', 60000, 10, 3, 60000)
    expect(r1.count).toBe(1)
    expect(r1.banned).toBe(false)
    expect(r1.violations).toBe(0)
    const r2 = await store.hitWithBan!('k1', 60000, 10, 3, 60000)
    expect(r2.count).toBe(2)
    expect(r2.banned).toBe(false)
  })

  it('tracks violations when over limit', async () => {
    if (!isAvailable) return
    for (let i = 0; i < 5; i++) {
      await store.hitWithBan!('k1', 60000, 5, 3, 60000)
    }
    const r = await store.hitWithBan!('k1', 60000, 5, 3, 60000)
    expect(r.count).toBe(6)
    expect(r.violations).toBe(1)
    expect(r.banned).toBe(false)
  })

  it('bans after reaching threshold', async () => {
    if (!isAvailable) return
    await store.hitWithBan!('k1', 60000, 2, 3, 60000)
    await store.hitWithBan!('k1', 60000, 2, 3, 60000)
    await store.hitWithBan!('k1', 60000, 2, 3, 60000)
    await store.hitWithBan!('k1', 60000, 2, 3, 60000)
    const r = await store.hitWithBan!('k1', 60000, 2, 3, 60000)
    expect(r.violations).toBe(3)
    expect(r.banned).toBe(true)
    expect(r.banExpiresAt).toBeGreaterThan(Date.now())
  })

  it('returns banned status for already-banned keys', async () => {
    if (!isAvailable) return
    await store.hitWithBan!('k1', 60000, 1, 1, 60000)
    await store.hitWithBan!('k1', 60000, 1, 1, 60000)
    const r = await store.hitWithBan!('k1', 60000, 1, 1, 60000)
    expect(r.count).toBe(0)
    expect(r.banned).toBe(true)
    expect(r.banExpiresAt).toBeGreaterThan(Date.now())
  })

  it('independent keys do not share ban state', async () => {
    if (!isAvailable) return
    await store.hitWithBan!('k1', 60000, 1, 1, 60000)
    await store.hitWithBan!('k1', 60000, 1, 1, 60000)
    const r = await store.hitWithBan!('k2', 60000, 1, 1, 60000)
    expect(r.count).toBe(1)
    expect(r.banned).toBe(false)
  })

  it('returns correct resetAt', async () => {
    if (!isAvailable) return
    const before = Date.now()
    const r = await store.hitWithBan!('k1', 10000, 10, 3, 60000)
    const after = Date.now()
    expect(r.resetAt).toBeGreaterThanOrEqual(before)
    expect(r.resetAt).toBeLessThanOrEqual(after + 10000)
  })
})

describe('MySQLStore concurrent', () => {
  let store: HitLimitStore
  let pool: any
  let prefix: string
  let isAvailable = false

  beforeAll(async () => {
    try {
      const mysql = await import('mysql2/promise')
      pool = await mysql.default.createPool({
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
        database: MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 20
      })
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      )
      await Promise.race([pool.execute('SELECT 1'), timeout])
      isAvailable = true
    } catch {
      isAvailable = false
    }
  }, 5000)

  afterAll(async () => {
    if (!isAvailable) return
    await pool?.end()
  })

  beforeEach(async () => {
    if (!isAvailable) return
    prefix = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    store = mysqlStore({ pool, tablePrefix: prefix })
  })

  afterEach(async () => {
    if (!isAvailable) return
    store.shutdown?.()
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_hits`).catch(() => {})
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_bans`).catch(() => {})
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_violations`).catch(() => {})
  })

  it('concurrent hits produce sequential counts', async () => {
    if (!isAvailable) return
    const promises = Array.from({ length: 20 }, () =>
      store.hit('concurrent', 60000, 100)
    )
    const results = await Promise.all(promises)
    const counts = results.map(r => r.count).sort((a, b) => a - b)
    expect(counts).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('concurrent hitWithBan produces correct violation count', async () => {
    if (!isAvailable) return
    const promises = Array.from({ length: 10 }, () =>
      store.hitWithBan!('conc-ban', 60000, 1, 100, 60000)
    )
    const results = await Promise.all(promises)
    const counts = results.map(r => r.count).sort((a, b) => a - b)
    expect(counts).toEqual(Array.from({ length: 10 }, (_, i) => i + 1))
    const overLimit = results.filter(r => r.count > 1)
    expect(overLimit.length).toBe(9)
  })
})
