# @joint-ops/hitlimit-types

[![npm version](https://img.shields.io/npm/v/@joint-ops/hitlimit-types.svg)](https://www.npmjs.com/package/@joint-ops/hitlimit-types)
[![GitHub](https://img.shields.io/github/license/JointOps/hitlimit-monorepo)](https://github.com/JointOps/hitlimit-monorepo)

> TypeScript type definitions for hitlimit rate limiting libraries

This package contains shared TypeScript interfaces and types used by [hitlimit](https://www.npmjs.com/package/hitlimit) and [hitlimit-bun](https://www.npmjs.com/package/hitlimit-bun).

## Installation

This package is automatically installed as a dependency of `hitlimit` and `hitlimit-bun`. You don't need to install it directly.

```bash
# Install hitlimit (includes types automatically)
npm install hitlimit

# Or for Bun
bun add hitlimit-bun
```

## Usage

Types are re-exported from the main packages:

```typescript
import type {
  HitLimitConfig,
  RateLimitResult,
  Store,
  TierConfig
} from '@joint-ops/hitlimit'

// Or from hitlimit-bun
import type { HitLimitConfig, Store } from '@joint-ops/hitlimit-bun'
```

## Available Types

### Core Types

```typescript
// Main configuration
interface HitLimitConfig {
  limit?: number
  window?: string | number
  key?: (req: Request) => string | Promise<string>
  tiers?: Record<string, TierConfig>
  tier?: (req: Request) => string | Promise<string>
  response?: RateLimitResponse | ((info: RateLimitInfo) => RateLimitResponse)
  headers?: HeadersConfig
  store?: Store
  skip?: (req: Request) => boolean | Promise<boolean>
  onStoreError?: (error: Error, req: Request) => 'allow' | 'deny'
}

// Store interface for custom backends
interface Store {
  increment(key: string, window: number): Promise<RateLimitResult>
  decrement?(key: string): Promise<void>
  reset?(key: string): Promise<void>
  close?(): Promise<void>
}

// Rate limit result
interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
}

// Tier configuration
interface TierConfig {
  limit: number
  window?: string | number
}
```

### Logger Types

```typescript
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}
```

## Related Packages

- [hitlimit](https://www.npmjs.com/package/hitlimit) - Rate limiting for Node.js (Express, NestJS)
- [hitlimit-bun](https://www.npmjs.com/package/hitlimit-bun) - Rate limiting for Bun (Bun.serve, Elysia)

## License

MIT
