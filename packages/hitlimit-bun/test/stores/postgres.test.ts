import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test'
import { SQL } from 'bun'
import { postgresStore } from '../../src/stores/postgres'
import type { HitLimitStore } from '@joint-ops/hitlimit-types'

const POSTGRES_URL =
  process.env.POSTGRES_URL || 'postgres://hitlimit:hitlimit@localhost:5433/hitlimit_test'

// ─── Cleanup helpers ───────────────────────────────────────────────────────────
// Drop only the three tables created by the store for a given prefix.
// prefix is a validated string — safe to interpolate.

async function dropTablesBun(client: SQL, prefix: string): Promise<void> {
  await client.unsafe(`DROP TABLE IF EXISTS ${prefix}_hits`)
  await client.unsafe(`DROP TABLE IF EXISTS ${prefix}_bans`)
  await client.unsafe(`DROP TABLE IF EXISTS ${prefix}_violations`)
}

async function dropTablesPg(pool: any, prefix: string): Promise<void> {
  await pool.query(`DROP TABLE IF EXISTS ${prefix}_hits`)
  await pool.query(`DROP TABLE IF EXISTS ${prefix}_bans`)
  await pool.query(`DROP TABLE IF EXISTS ${prefix}_violations`)
}

// ─── Validation tests (no live database required) ─────────────────────────────

describe('PostgresStore — constructor validation', () => {
  const fakePool = { query: async () => ({ rows: [] }) }

  it('throws when no connection option is provided', () => {
    expect(() => postgresStore({} as any)).toThrow(
      'postgresStore requires exactly one of url, client, or pool'
    )
  })

  it('throws when url and client are both provided', () => {
    const fakeClient = {} as any
    expect(() => postgresStore({ url: 'postgres://x', client: fakeClient })).toThrow(
      'postgresStore accepts only one of url, client, or pool'
    )
  })

  it('throws when url and pool are both provided', () => {
    expect(() => postgresStore({ url: 'postgres://x', pool: fakePool })).toThrow(
      'postgresStore accepts only one of url, client, or pool'
    )
  })

  it('throws when client and pool are both provided', () => {
    const fakeClient = {} as any
    expect(() => postgresStore({ client: fakeClient, pool: fakePool })).toThrow(
      'postgresStore accepts only one of url, client, or pool'
    )
  })

  it('throws when url, client, and pool are all provided', () => {
    const fakeClient = {} as any
    expect(() => postgresStore({ url: 'postgres://x', client: fakeClient, pool: fakePool })).toThrow(
      'postgresStore accepts only one of url, client, or pool'
    )
  })

  it('throws for tablePrefix with hyphens', () => {
    expect(() => postgresStore({ pool: fakePool, tablePrefix: 'bad-prefix' })).toThrow(
      'Invalid tablePrefix: bad-prefix'
    )
  })

  it('throws for tablePrefix with semicolons', () => {
    expect(() => postgresStore({ pool: fakePool, tablePrefix: 'bad;prefix' })).toThrow(
      'Invalid tablePrefix: bad;prefix'
    )
  })

  it('throws for tablePrefix with spaces', () => {
    expect(() => postgresStore({ pool: fakePool, tablePrefix: 'bad prefix' })).toThrow(
      'Invalid tablePrefix: bad prefix'
    )
  })

  it('throws for tablePrefix with dots', () => {
    expect(() => postgresStore({ pool: fakePool, tablePrefix: 'bad.prefix' })).toThrow(
      'Invalid tablePrefix: bad.prefix'
    )
  })

  it('throws for tablePrefix starting with a digit', () => {
    expect(() => postgresStore({ pool: fakePool, tablePrefix: '1bad' })).toThrow(
      'Invalid tablePrefix: 1bad'
    )
  })

  it('accepts valid tablePrefix with underscores and digits', () => {
    // Does not throw — URL is fake but constructor validation passes before connection
    expect(() => postgresStore({ pool: fakePool, tablePrefix: 'valid_prefix_123' })).not.toThrow()
  })

  it('uses default tablePrefix "hitlimit" when none is provided', () => {
    expect(() => postgresStore({ pool: fakePool })).not.toThrow()
  })
})

// ─── Driver matrix ─────────────────────────────────────────────────────────────
// Run the full behavior suite against all three connection modes.

type DriverName = 'native-url' | 'native-client' | 'legacy-pool'

const DRIVER_NAMES: DriverName[] = ['native-url', 'native-client', 'legacy-pool']

for (const driverName of DRIVER_NAMES) {
  describe(`PostgresStore (${driverName})`, () => {
    let store: HitLimitStore
    let prefix: string
    let isAvailable = false

    // Shared connection used for:
    // - Availability check (all modes)
    // - Store queries directly (native-client mode)
    // - Cleanup table drops (all bun modes — still alive after store.shutdown() in url mode)
    let sharedClient: SQL | null = null

    // Shared pg pool used for:
    // - Availability check (legacy-pool mode)
    // - Store queries directly (legacy-pool mode)
    // - Cleanup table drops (legacy-pool mode)
    let sharedPool: any = null

    beforeAll(async () => {
      if (driverName === 'legacy-pool') {
        try {
          const pg = await import('pg')
          // max: 20 is needed for concurrent tests
          sharedPool = new pg.default.Pool({ connectionString: POSTGRES_URL, max: 20 })
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 3000)
          )
          await Promise.race([sharedPool.query('SELECT 1'), timeout])
          isAvailable = true
        } catch {
          isAvailable = false
        }
      } else {
        // native-url and native-client both need a Bun SQL client available
        try {
          const client = new SQL(POSTGRES_URL)
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 3000)
          )
          await Promise.race([client`SELECT 1`, timeout])
          sharedClient = client
          isAvailable = true
        } catch {
          isAvailable = false
        }
      }
    }, 5000)

    afterAll(async () => {
      if (!isAvailable) return
      if (driverName === 'legacy-pool') {
        await sharedPool?.end()
      } else {
        await sharedClient?.close()
      }
    })

    beforeEach(async () => {
      if (!isAvailable) return
      // hl_ prefix is valid per VALID_PREFIX — starts with letter, contains only [A-Za-z0-9_]
      prefix = `hl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

      if (driverName === 'native-url') {
        // Store creates its own internal SQL client from the URL.
        // shutdown() will close that internal client (not sharedClient).
        store = postgresStore({ url: POSTGRES_URL, tablePrefix: prefix })
      } else if (driverName === 'native-client') {
        // Store uses sharedClient directly.
        // shutdown() will NOT close sharedClient.
        store = postgresStore({ client: sharedClient!, tablePrefix: prefix })
      } else {
        store = postgresStore({ pool: sharedPool, tablePrefix: prefix })
      }

      await store.hit('_init_', 1, 1) // flush createTables so skipTableCreation tests see tables
    })

    afterEach(async () => {
      if (!isAvailable) return
      // Always shut down the store first (stops cleanup timer, closes url-owned client)
      await store.shutdown?.()
      // Then drop the tables using the surviving connection
      if (driverName === 'legacy-pool') {
        await dropTablesPg(sharedPool, prefix).catch(() => {})
      } else {
        // sharedClient is still alive:
        // - In native-url mode: sharedClient was never the store's client; store.shutdown() closed a different client.
        // - In native-client mode: store.shutdown() does NOT close sharedClient.
        await dropTablesBun(sharedClient!, prefix).catch(() => {})
      }
    })

    // ── Behavior: hit() ─────────────────────────────────────────────────────

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

    // ── Behavior: reset() ───────────────────────────────────────────────────

    it('reset clears hit count', async () => {
      if (!isAvailable) return
      await store.hit('key1', 60000, 100)
      await store.hit('key1', 60000, 100)
      await store.reset('key1')
      const r = await store.hit('key1', 60000, 100)
      expect(r.count).toBe(1)
    })

    it('reset clears ban', async () => {
      if (!isAvailable) return
      await store.ban!('key1', 60000)
      await store.reset('key1')
      const banned = await store.isBanned!('key1')
      expect(banned).toBe(false)
    })

    it('reset clears violations', async () => {
      if (!isAvailable) return
      await store.recordViolation!('key1', 60000)
      await store.recordViolation!('key1', 60000)
      await store.reset('key1')
      // After reset, violation count restarts at 1
      const count = await store.recordViolation!('key1', 60000)
      expect(count).toBe(1)
    })

    // ── Behavior: isBanned() and ban() ─────────────────────────────────────

    it('isBanned returns false for non-banned key', async () => {
      if (!isAvailable) return
      const result = await store.isBanned!('key1')
      expect(result).toBe(false)
    })

    it('ban + isBanned round-trip', async () => {
      if (!isAvailable) return
      await store.ban!('key1', 60000)
      const result = await store.isBanned!('key1')
      expect(result).toBe(true)
    })

    it('ban with zero duration is not detected as banned (already expired)', async () => {
      if (!isAvailable) return
      await store.ban!('key1', 0)
      const result = await store.isBanned!('key1')
      // expires_at = Date.now() + 0 = Date.now(), which is <= Date.now() in the next query
      expect(result).toBe(false)
    })

    // ── Behavior: recordViolation() ─────────────────────────────────────────

    it('recordViolation increments', async () => {
      if (!isAvailable) return
      const v1 = await store.recordViolation!('key1', 60000)
      expect(v1).toBe(1)
      const v2 = await store.recordViolation!('key1', 60000)
      expect(v2).toBe(2)
    })

    it('recordViolation resets when window expires', async () => {
      if (!isAvailable) return
      const v1 = await store.recordViolation!('key1', 50)
      expect(v1).toBe(1)
      await new Promise(r => setTimeout(r, 100))
      const v2 = await store.recordViolation!('key1', 50)
      expect(v2).toBe(1)
    })

    // ── Behavior: custom tablePrefix ────────────────────────────────────────

    it('uses custom tablePrefix', async () => {
      if (!isAvailable) return
      // Create a second store with a different prefix — must not share state
      const prefix2 = `${prefix}_b`
      let store2: HitLimitStore

      if (driverName === 'native-url') {
        store2 = postgresStore({ url: POSTGRES_URL, tablePrefix: prefix2 })
      } else if (driverName === 'native-client') {
        store2 = postgresStore({ client: sharedClient!, tablePrefix: prefix2 })
      } else {
        store2 = postgresStore({ pool: sharedPool, tablePrefix: prefix2 })
      }

      const r = await store2.hit('key1', 60000, 100)
      expect(r.count).toBe(1)

      // prefix and prefix2 are independent
      const r2 = await store.hit('key1', 60000, 100)
      expect(r2.count).toBe(1)

      await store2.shutdown?.()
      if (driverName === 'legacy-pool') {
        await dropTablesPg(sharedPool, prefix2).catch(() => {})
      } else {
        await dropTablesBun(sharedClient!, prefix2).catch(() => {})
      }
    })

    // ── Behavior: skipTableCreation ─────────────────────────────────────────

    it('skipTableCreation: true works when tables already exist', async () => {
      if (!isAvailable) return
      // store already created the tables in beforeEach (skipTableCreation defaults to false)
      // Create a second store pointing to the same tables with skipTableCreation: true
      let store2: HitLimitStore
      if (driverName === 'native-url') {
        store2 = postgresStore({ url: POSTGRES_URL, tablePrefix: prefix, skipTableCreation: true })
      } else if (driverName === 'native-client') {
        store2 = postgresStore({ client: sharedClient!, tablePrefix: prefix, skipTableCreation: true })
      } else {
        store2 = postgresStore({ pool: sharedPool, tablePrefix: prefix, skipTableCreation: true })
      }
      const r = await store2.hit('key2', 60000, 100)
      expect(r.count).toBe(1)
      await store2.shutdown?.()
    })

    it('skipTableCreation: true throws on first query when tables do not exist', async () => {
      if (!isAvailable) return
      const newPrefix = `${prefix}_skip`
      let skipStore: HitLimitStore
      if (driverName === 'native-url') {
        skipStore = postgresStore({ url: POSTGRES_URL, tablePrefix: newPrefix, skipTableCreation: true })
      } else if (driverName === 'native-client') {
        skipStore = postgresStore({ client: sharedClient!, tablePrefix: newPrefix, skipTableCreation: true })
      } else {
        skipStore = postgresStore({ pool: sharedPool, tablePrefix: newPrefix, skipTableCreation: true })
      }
      await expect(skipStore.hit('key1', 60000, 100)).rejects.toThrow()
      await skipStore.shutdown?.()
    })

    // ── Behavior: hitWithBan() ──────────────────────────────────────────────

    it('hitWithBan counts hits', async () => {
      if (!isAvailable) return
      const r1 = await store.hitWithBan!('k1', 60000, 10, 3, 60000)
      expect(r1.count).toBe(1)
      expect(r1.banned).toBe(false)
      expect(r1.violations).toBe(0)
      const r2 = await store.hitWithBan!('k1', 60000, 10, 3, 60000)
      expect(r2.count).toBe(2)
      expect(r2.banned).toBe(false)
    })

    it('hitWithBan tracks violations when over limit', async () => {
      if (!isAvailable) return
      for (let i = 0; i < 5; i++) await store.hitWithBan!('k1', 60000, 5, 3, 60000)
      const r = await store.hitWithBan!('k1', 60000, 5, 3, 60000)
      expect(r.count).toBe(6)
      expect(r.violations).toBe(1)
      expect(r.banned).toBe(false)
    })

    it('hitWithBan bans after reaching threshold', async () => {
      if (!isAvailable) return
      // limit=2, threshold=3: need 3 violations (each violation = a hit over the limit)
      await store.hitWithBan!('k1', 60000, 2, 3, 60000)
      await store.hitWithBan!('k1', 60000, 2, 3, 60000)
      await store.hitWithBan!('k1', 60000, 2, 3, 60000) // violation 1 (count=3 > limit=2)
      await store.hitWithBan!('k1', 60000, 2, 3, 60000) // violation 2
      const r = await store.hitWithBan!('k1', 60000, 2, 3, 60000) // violation 3
      expect(r.violations).toBe(3)
      expect(r.banned).toBe(true)
      expect(r.banExpiresAt).toBeGreaterThan(Date.now())
    })

    it('hitWithBan returns banned status for already-banned key', async () => {
      if (!isAvailable) return
      // limit=1, threshold=1: ban triggers on the second hit
      await store.hitWithBan!('k1', 60000, 1, 1, 60000)
      await store.hitWithBan!('k1', 60000, 1, 1, 60000) // violation 1 → ban
      const r = await store.hitWithBan!('k1', 60000, 1, 1, 60000)
      expect(r.count).toBe(0)
      expect(r.banned).toBe(true)
      expect(r.banExpiresAt).toBeGreaterThan(Date.now())
    })

    it('hitWithBan: independent keys do not share ban state', async () => {
      if (!isAvailable) return
      await store.hitWithBan!('k1', 60000, 1, 1, 60000)
      await store.hitWithBan!('k1', 60000, 1, 1, 60000) // k1 gets banned
      const r = await store.hitWithBan!('k2', 60000, 1, 1, 60000)
      expect(r.count).toBe(1)
      expect(r.banned).toBe(false)
    })

    it('hitWithBan returns correct resetAt', async () => {
      if (!isAvailable) return
      const before = Date.now()
      const r = await store.hitWithBan!('k1', 10000, 10, 3, 60000)
      const after = Date.now()
      expect(r.resetAt).toBeGreaterThanOrEqual(before)
      expect(r.resetAt).toBeLessThanOrEqual(after + 10000)
    })

    it('hitWithBan banExpiresAt is 0 when not banned', async () => {
      if (!isAvailable) return
      const r = await store.hitWithBan!('k1', 60000, 10, 3, 60000)
      expect(r.banExpiresAt).toBe(0)
    })

    // ── Behavior: concurrent access ─────────────────────────────────────────

    it('concurrent hits produce sequential counts', async () => {
      if (!isAvailable) return
      const promises = Array.from({ length: 20 }, () =>
        store.hit('concurrent', 60000, 100)
      )
      const results = await Promise.all(promises)
      const counts = results.map(r => r.count).sort((a, b) => a - b)
      expect(counts).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    })

    it('concurrent hitWithBan produces correct counts', async () => {
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
}

// ─── Shutdown ownership tests (need live database) ─────────────────────────────

describe('PostgresStore — shutdown ownership', () => {
  const POSTGRES_URL_LOCAL =
    process.env.POSTGRES_URL || 'postgres://hitlimit:hitlimit@localhost:5433/hitlimit_test'

  let isAvailable = false
  let helperClient: SQL | null = null
  let helperPool: any = null

  beforeAll(async () => {
    try {
      helperClient = new SQL(POSTGRES_URL_LOCAL)
      await helperClient`SELECT 1`
      isAvailable = true

      const pg = await import('pg')
      helperPool = new pg.default.Pool({ connectionString: POSTGRES_URL_LOCAL })
      await helperPool.query('SELECT 1')
    } catch {
      isAvailable = false
    }
  }, 5000)

  afterAll(async () => {
    await helperClient?.close()
    await helperPool?.end()
  })

  it('url mode: shutdown() closes the internally-created client', async () => {
    if (!isAvailable) return
    const prefix = `hl_own_url_${Date.now()}`
    const store = postgresStore({ url: POSTGRES_URL_LOCAL, tablePrefix: prefix })
    await store.hit('k', 60000, 10)
    await store.shutdown?.()
    // Tables still exist in DB — we can verify from the helper client
    const rows = await helperClient!.unsafe(`SELECT 1 FROM ${prefix}_hits LIMIT 1`)
    expect(rows.length).toBe(1)
    await dropTablesBun(helperClient!, prefix)
  })

  it('client mode: shutdown() does NOT close the caller-owned client', async () => {
    if (!isAvailable) return
    const callerClient = new SQL(POSTGRES_URL_LOCAL)
    const prefix = `hl_own_client_${Date.now()}`
    const store = postgresStore({ client: callerClient, tablePrefix: prefix })
    await store.hit('k', 60000, 10)
    await store.shutdown?.()
    // callerClient should still be usable
    const rows = await callerClient`SELECT 1`
    expect(rows.length).toBe(1)
    await dropTablesBun(callerClient, prefix)
    await callerClient.close()
  })

  it('pool mode: shutdown() does NOT end the caller-owned pool', async () => {
    if (!isAvailable || !helperPool) return
    const prefix = `hl_own_pool_${Date.now()}`
    const store = postgresStore({ pool: helperPool, tablePrefix: prefix })
    await store.hit('k', 60000, 10)
    await store.shutdown?.()
    // helperPool should still be usable
    const result = await helperPool.query('SELECT 1')
    expect(result.rows.length).toBe(1)
    await dropTablesPg(helperPool, prefix)
  })
})
