# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-XX-XX

### Added
- MySQL store (`mysqlStore()`) — SQL rate limiting with atomic `INSERT ON DUPLICATE KEY UPDATE`
- Available for both Node.js (`@joint-ops/hitlimit`) and Bun (`@joint-ops/hitlimit-bun`)
- Peer dependency: `mysql2` >=3.0.0 (optional)
- Full test suites for both packages
- Documentation page with usage guide
- Benchmarks: Node.js and Bun store benchmarks, Express middleware benchmarks

## [1.4.0] - 2026-XX-XX

### Added
- MongoDB store (`mongoStore()`) — NoSQL rate limiting with atomic `findOneAndUpdate`, TTL indexes
- Available for both Node.js (`@joint-ops/hitlimit`) and Bun (`@joint-ops/hitlimit-bun`)
- Peer dependency: `mongodb` >=6.0.0 (optional)
- Full test suites for both packages
- Documentation page with usage guide
- Benchmarks: Node.js and Bun store benchmarks, Express middleware benchmarks

## [1.3.0] - 2026-02-26

### Added
- Valkey store (`valkeyStore()`) — open-source Redis alternative, uses same atomic Lua scripts
  - Available for both Node.js and Bun packages
  - Peer dependency: `ioredis` (shared with Redis store)
  - Full test suites for both packages
  - Documentation page and benchmarks
- DragonflyDB store (`dragonflyStore()`) — high-throughput Redis-compatible store
  - Available for both Node.js and Bun packages
  - Peer dependency: `ioredis` (shared with Redis store)
  - Full test suites for both packages
  - Documentation page and benchmarks
- Docker services for Valkey and DragonflyDB

### Changed
- Updated package exports, keywords, and Bun build config for new stores
- Updated docs: comparison table, store overview, SEO, and llms.txt

## [1.2.0] - 2026-02-22

### Added
- PostgreSQL store (`postgresStore()`) — distributed rate limiting with atomic upserts
  - Available for both Node.js and Bun packages
  - Peer dependency: `pg` (optional)
  - Full test suites for both packages
  - Documentation page with usage guide
- Comprehensive benchmark suite — all frameworks (Express, Fastify, Hono, NestJS, Bun.serve, Elysia) across all stores
- Benchmark methodology documentation with full transparency

### Changed
- Optimized Redis store — `ioredis` `defineCommand()` for native SHA caching
- Optimized Postgres store — named prepared statements + ready flag
- Async fast path for sync key extraction in middleware
- Improved benchmark runner fairness — `hrtime.bigint()`, GC between runs

## [1.1.3] - 2026-02-17

### Performance

- **Atomic Redis Lua scripts** — combine ban check + hit + violation tracking in a single `EVALSHA` round-trip
  - `HIT_SCRIPT`: atomic INCR + PTTL + PEXPIRE (1 round-trip, down from 1-2)
  - `HIT_WITH_BAN_SCRIPT`: atomic ban check + hit + violation + auto-ban (1 round-trip, down from 3-4)
- **EVALSHA with NOSCRIPT recovery** — scripts loaded once via `SCRIPT LOAD`, called by SHA hash. Auto-reload on Redis restart or script eviction
- Eliminates race conditions between separate ban check and hit calls

### Added

- `HitWithBanResult` interface on `HitLimitStore` — stores can declare atomic hit+ban support
- `hitWithBan` optional method on store interface — enables single round-trip path
- Dual-path limiter: atomic path (stores with `hitWithBan`) vs fallback path (separate calls)

### Internal

- Limiter detects `hitWithBan` on store and uses atomic path automatically
- Custom stores without `hitWithBan` continue to work via fallback path
- Legacy methods (`isBanned`, `ban`, `recordViolation`) preserved for backward compatibility
- Zero breaking changes — all existing code works identically

### Tests

- Added 12 new Redis Lua script tests per package (both Node.js and Bun):
  - Atomic hit counting, violation tracking, ban triggering
  - Already-banned detection, key independence, resetAt correctness
  - Legacy method round-trips, reset clearing all keys
  - Concurrent atomicity: parallel hits → sequential counts

## [1.1.2] - 2026-02-17

### Internal

- **Zero-allocation hot path** — reuse a single result object in memory store instead of creating a new one per hit
- **Sweep timer** — replace per-key setTimeout with a single setInterval (10s) for cleanup
  - Eliminates thousands of timer handles under high concurrency
  - Leaner entry objects (no more timeoutId per entry)
  - Inline expiry check handles entries that expire between sweeps
- Reduced GC pressure under sustained load
- Zero breaking changes — all existing code works identically

### Tests

- Added zero-allocation result reuse tests (both packages)
- Added sweep timer and inline expiry tests
- Added 100K key memory-bounded test

## [1.1.1] - 2026-02-16

### Performance

- **Sync fast path** for memory and SQLite stores — eliminates async/await overhead when store is synchronous
  - Node.js memory single-IP: 3.14M → 4.79M ops/sec (+52.5%)
  - Node.js memory 10K IPs: 2.45M → 3.26M ops/sec (+33.1%)
  - Node.js SQLite single-IP: 472K → 499K ops/sec (+5.7%)
  - Bun memory single-IP: 7.21M → 7.29M ops/sec (+1.1%)
- hitlimit now beats rate-limiter-flexible on ALL memory scenarios:
  - Single-IP: 4.79M vs 3.30M (1.45x faster)
  - 10K IPs: 3.26M vs 1.64M (2x faster)

### Added

- `isSync` optional property on `HitLimitStore` interface — stores can declare synchronous operation
- Sync fast path in all framework adapters: Express, Fastify, Hono, NestJS, Node.js HTTP, Bun.serve, Elysia
- New integration tests for sync fast path (Node.js + Bun)

### Internal

- Three-tier middleware architecture: sync fast path → async fast path → full checkLimit path
- Memory and SQLite stores marked with `isSync = true`
- Redis store remains async (no change)
- Zero breaking changes — all existing code works identically

## [1.1.0] - 2026-02-13

### Added

- Memory store as default (previously SQLite for Bun)
- Hono adapter for both Node.js and Bun packages

### Performance

- 15.7x faster default store (memory vs SQLite) for hitlimit-bun

## [1.0.6] - 2026-02-06

### Added

- Ban system — automatically ban repeat offenders after threshold violations
- Group rate limits — share limits across multiple clients via groupId

## [1.0.0] - 2026-01-29

### Added

- Initial release
- Express, Fastify, NestJS, Node.js HTTP, Bun.serve, Elysia adapters
- Memory, SQLite, Redis stores
- Tiered rate limits
- Custom key extraction
- Standard and legacy headers
- Skip function
- Custom response formatting
