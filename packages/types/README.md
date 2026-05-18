# @joint-ops/hitlimit-types

[![npm version](https://img.shields.io/npm/v/@joint-ops/hitlimit-types.svg)](https://www.npmjs.com/package/@joint-ops/hitlimit-types)
[![GitHub](https://img.shields.io/github/license/JointOps/hitlimit-monorepo)](https://github.com/JointOps/hitlimit-monorepo)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

> Shared TypeScript type definitions for hitlimit rate limiting libraries

This package contains the canonical interfaces and types used by both
[@joint-ops/hitlimit](https://www.npmjs.com/package/@joint-ops/hitlimit) and
[@joint-ops/hitlimit-bun](https://www.npmjs.com/package/@joint-ops/hitlimit-bun).

## Installation

This package is installed automatically as a dependency of `hitlimit` and `hitlimit-bun`.
You do not need to install it directly unless you are building a custom store or plugin.

```bash
# Comes bundled — no direct install needed
npm install @joint-ops/hitlimit
bun add @joint-ops/hitlimit-bun
```

## Types

Types are re-exported from the main packages:

```typescript
import type {
  HitLimitOptions,
  HitLimitInfo,
  HitLimitResult,
  HitLimitStore,
  StoreResult,
  HeadersConfig,
  TierConfig,
  HitLimitLogger
} from '@joint-ops/hitlimit'

// Or from hitlimit-bun
import type { HitLimitOptions, HitLimitStore, StoreResult } from '@joint-ops/hitlimit-bun'
```

## Core Interfaces

### HitLimitOptions

```typescript
interface HitLimitOptions<TRequest = any> {
  limit?: number
  window?: string | number
  key?: (req: TRequest) => string | Promise<string>
  tiers?: Record<string, TierConfig>
  tier?: (req: TRequest) => string | Promise<string>
  response?: Record<string, any> | ((info: HitLimitInfo) => Record<string, any>)
  headers?: HeadersConfig
  store?: HitLimitStore
  skip?: (req: TRequest) => boolean | Promise<boolean>
  onStoreError?: (error: Error, req: TRequest) => void
  logger?: HitLimitLogger
  ban?: { threshold: number; duration: string | number }
  group?: string | ((req: TRequest) => string | Promise<string>)
}
```

### HitLimitInfo

Rate limit state passed to `response` callbacks and available on request objects:

```typescript
interface HitLimitInfo {
  limit: number
  remaining: number
  resetIn: number    // seconds until window resets
  resetAt: number    // unix timestamp (ms) when window resets
  key: string
  tier?: string
  banned?: boolean
  banExpiresAt?: number
  violations?: number
  group?: string
}
```

### HitLimitStore + StoreResult

Implement this interface to build a custom storage backend:

```typescript
interface HitLimitStore {
  isSync?: boolean
  hit(key: string, windowMs: number, limit: number): Promise<StoreResult> | StoreResult
  reset(key: string): Promise<void> | void
  shutdown?(): Promise<void> | void
}

interface StoreResult {
  count: number    // current request count in this window
  resetAt: number  // unix timestamp (ms) when the window resets
}
```

### HeadersConfig

```typescript
interface HeadersConfig {
  standard?: boolean   // RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
  legacy?: boolean     // X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  retryAfter?: boolean // Retry-After (on 429 responses only)
}
```

### TierConfig

```typescript
interface TierConfig {
  limit: number
  window?: string | number
}
```

### HitLimitLogger

```typescript
interface HitLimitLogger {
  debug(message: string, meta?: Record<string, any>): void
  info(message: string, meta?: Record<string, any>): void
  warn(message: string, meta?: Record<string, any>): void
  error(message: string, meta?: Record<string, any>): void
}
```

## Related Packages

- [@joint-ops/hitlimit](https://www.npmjs.com/package/@joint-ops/hitlimit) — Rate limiting for Node.js (Express, Fastify, Hono, NestJS)
- [@joint-ops/hitlimit-bun](https://www.npmjs.com/package/@joint-ops/hitlimit-bun) — Rate limiting for Bun (Bun.serve, Elysia, Hono)

## License

MIT
