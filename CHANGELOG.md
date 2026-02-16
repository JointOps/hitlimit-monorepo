# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - v1.1.2

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
