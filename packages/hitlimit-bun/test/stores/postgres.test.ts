import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'bun:test'
import { postgresStore } from '../../src/stores/postgres'
import type { HitLimitStore } from '@joint-ops/hitlimit-types'

const POSTGRES_URL = process.env.POSTGRES_URL || 'postgres://hitlimit:hitlimit@localhost:5433/hitlimit_test'

// Unique prefix per test run to avoid cross-test pollution
const testPrefix = `hitlimit_test_${Date.now()}`

describe('PostgresStore', () => {
  let store: HitLimitStore
  let pool: any
  let isPostgresAvailable = false

  beforeAll(async () => {
    try {
      const pg = await import('pg')
      pool = new pg.default.Pool({ connectionString: POSTGRES_URL })
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      )
      await Promise.race([pool.query('SELECT 1'), timeout])
      isPostgresAvailable = true
    } catch {
      isPostgresAvailable = false
    }
  }, 5000)

  beforeEach(async () => {
    if (!isPostgresAvailable) return
    const prefix = `${testPrefix}_${Math.random().toString(36).slice(2, 8)}`
    store = postgresStore({ pool, tablePrefix: prefix })
  })

  afterEach(async () => {
    if (!isPostgresAvailable) return
    store.shutdown?.()
  })

  it('increments count on hit', async () => {
    if (!isPostgresAvailable) return

    const result1 = await store.hit('key1', 60000, 100)
    expect(result1.count).toBe(1)

    const result2 = await store.hit('key1', 60000, 100)
    expect(result2.count).toBe(2)
  })

  it('handles multiple keys independently', async () => {
    if (!isPostgresAvailable) return

    await store.hit('key1', 60000, 100)
    await store.hit('key1', 60000, 100)
    await store.hit('key2', 60000, 100)

    const result1 = await store.hit('key1', 60000, 100)
    const result2 = await store.hit('key2', 60000, 100)

    expect(result1.count).toBe(3)
    expect(result2.count).toBe(2)
  })

  it('resets specific key', async () => {
    if (!isPostgresAvailable) return

    await store.hit('key1', 60000, 100)
    await store.hit('key1', 60000, 100)
    await store.reset('key1')

    const result = await store.hit('key1', 60000, 100)
    expect(result.count).toBe(1)
  })

  it('returns resetAt in the future', async () => {
    if (!isPostgresAvailable) return

    const before = Date.now()
    const result = await store.hit('key1', 60000, 100)
    const after = Date.now()

    expect(result.resetAt).toBeGreaterThanOrEqual(before)
    expect(result.resetAt).toBeLessThanOrEqual(after + 60000)
  })

  it('resets window when expired', async () => {
    if (!isPostgresAvailable) return

    const result1 = await store.hit('key1', 50, 100)
    expect(result1.count).toBe(1)

    await new Promise(r => setTimeout(r, 100))

    const result2 = await store.hit('key1', 50, 100)
    expect(result2.count).toBe(1)
  })

  it('uses custom tablePrefix', async () => {
    if (!isPostgresAvailable) return

    const customStore = postgresStore({ pool, tablePrefix: `${testPrefix}_custom` })
    const result = await customStore.hit('key1', 60000, 100)
    expect(result.count).toBe(1)
    customStore.shutdown?.()
  })
})

describe('PostgresStore Ban & Violations', () => {
  let store: HitLimitStore
  let pool: any
  let isPostgresAvailable = false

  beforeAll(async () => {
    try {
      const pg = await import('pg')
      pool = new pg.default.Pool({ connectionString: POSTGRES_URL })
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      )
      await Promise.race([pool.query('SELECT 1'), timeout])
      isPostgresAvailable = true
    } catch {
      isPostgresAvailable = false
    }
  }, 5000)

  beforeEach(async () => {
    if (!isPostgresAvailable) return
    const prefix = `${testPrefix}_${Math.random().toString(36).slice(2, 8)}`
    store = postgresStore({ pool, tablePrefix: prefix })
  })

  afterEach(async () => {
    if (!isPostgresAvailable) return
    store.shutdown?.()
  })

  it('isBanned returns false for non-banned keys', async () => {
    if (!isPostgresAvailable) return

    const result = await store.isBanned!('k1')
    expect(result).toBe(false)
  })

  it('ban + isBanned round-trip', async () => {
    if (!isPostgresAvailable) return

    await store.ban!('k1', 60000)
    const result = await store.isBanned!('k1')
    expect(result).toBe(true)
  })

  it('recordViolation increments', async () => {
    if (!isPostgresAvailable) return

    const v1 = await store.recordViolation!('k1', 60000)
    expect(v1).toBe(1)

    const v2 = await store.recordViolation!('k1', 60000)
    expect(v2).toBe(2)
  })

  it('reset clears hit, ban, and violation keys', async () => {
    if (!isPostgresAvailable) return

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

describe('PostgresStore hitWithBan', () => {
  let store: HitLimitStore
  let pool: any
  let isPostgresAvailable = false

  beforeAll(async () => {
    try {
      const pg = await import('pg')
      pool = new pg.default.Pool({ connectionString: POSTGRES_URL })
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      )
      await Promise.race([pool.query('SELECT 1'), timeout])
      isPostgresAvailable = true
    } catch {
      isPostgresAvailable = false
    }
  }, 5000)

  beforeEach(async () => {
    if (!isPostgresAvailable) return
    const prefix = `${testPrefix}_${Math.random().toString(36).slice(2, 8)}`
    store = postgresStore({ pool, tablePrefix: prefix })
  })

  afterEach(async () => {
    if (!isPostgresAvailable) return
    store.shutdown?.()
  })

  it('counts hits atomically', async () => {
    if (!isPostgresAvailable) return

    const r1 = await store.hitWithBan!('k1', 60000, 10, 3, 60000)
    expect(r1.count).toBe(1)
    expect(r1.banned).toBe(false)
    expect(r1.violations).toBe(0)

    const r2 = await store.hitWithBan!('k1', 60000, 10, 3, 60000)
    expect(r2.count).toBe(2)
    expect(r2.banned).toBe(false)
  })

  it('tracks violations when over limit', async () => {
    if (!isPostgresAvailable) return

    for (let i = 0; i < 5; i++) {
      await store.hitWithBan!('k1', 60000, 5, 3, 60000)
    }

    const r = await store.hitWithBan!('k1', 60000, 5, 3, 60000)
    expect(r.count).toBe(6)
    expect(r.violations).toBe(1)
    expect(r.banned).toBe(false)
  })

  it('bans after reaching threshold', async () => {
    if (!isPostgresAvailable) return

    await store.hitWithBan!('k1', 60000, 2, 3, 60000)
    await store.hitWithBan!('k1', 60000, 2, 3, 60000)

    await store.hitWithBan!('k1', 60000, 2, 3, 60000) // violation 1
    await store.hitWithBan!('k1', 60000, 2, 3, 60000) // violation 2
    const r = await store.hitWithBan!('k1', 60000, 2, 3, 60000) // violation 3

    expect(r.violations).toBe(3)
    expect(r.banned).toBe(true)
    expect(r.banExpiresAt).toBeGreaterThan(Date.now())
  })

  it('returns banned status for already-banned keys', async () => {
    if (!isPostgresAvailable) return

    await store.hitWithBan!('k1', 60000, 1, 1, 60000)
    await store.hitWithBan!('k1', 60000, 1, 1, 60000)

    const r = await store.hitWithBan!('k1', 60000, 1, 1, 60000)
    expect(r.count).toBe(0)
    expect(r.banned).toBe(true)
    expect(r.banExpiresAt).toBeGreaterThan(Date.now())
  })

  it('independent keys do not share ban state', async () => {
    if (!isPostgresAvailable) return

    await store.hitWithBan!('k1', 60000, 1, 1, 60000)
    await store.hitWithBan!('k1', 60000, 1, 1, 60000)

    const r = await store.hitWithBan!('k2', 60000, 1, 1, 60000)
    expect(r.count).toBe(1)
    expect(r.banned).toBe(false)
  })

  it('returns correct resetAt', async () => {
    if (!isPostgresAvailable) return

    const before = Date.now()
    const r = await store.hitWithBan!('k1', 10000, 10, 3, 60000)
    const after = Date.now()

    expect(r.resetAt).toBeGreaterThanOrEqual(before)
    expect(r.resetAt).toBeLessThanOrEqual(after + 10000)
  })
})

describe('PostgresStore concurrent', () => {
  let store: HitLimitStore
  let pool: any
  let isPostgresAvailable = false

  beforeAll(async () => {
    try {
      const pg = await import('pg')
      pool = new pg.default.Pool({ connectionString: POSTGRES_URL, max: 20 })
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      )
      await Promise.race([pool.query('SELECT 1'), timeout])
      isPostgresAvailable = true
    } catch {
      isPostgresAvailable = false
    }
  }, 5000)

  beforeEach(async () => {
    if (!isPostgresAvailable) return
    const prefix = `${testPrefix}_${Math.random().toString(36).slice(2, 8)}`
    store = postgresStore({ pool, tablePrefix: prefix })
  })

  afterEach(async () => {
    if (!isPostgresAvailable) return
    store.shutdown?.()
  })

  it('concurrent hits produce sequential counts', async () => {
    if (!isPostgresAvailable) return

    const promises = Array.from({ length: 20 }, () =>
      store.hit('concurrent', 60000, 100)
    )
    const results = await Promise.all(promises)
    const counts = results.map(r => r.count).sort((a, b) => a - b)

    expect(counts).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('concurrent hitWithBan produces correct violation count', async () => {
    if (!isPostgresAvailable) return

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
