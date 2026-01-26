# @joint-ops/hitlimit-types

[![npm version](https://img.shields.io/npm/v/@joint-ops/hitlimit-types.svg)](https://www.npmjs.com/package/@joint-ops/hitlimit-types)
[![GitHub](https://img.shields.io/github/license/JointOps/hitlimit-monorepo)](https://github.com/JointOps/hitlimit-monorepo)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

> TypeScript type definitions for hitlimit rate limiting libraries

This package contains shared TypeScript interfaces and types used by [@joint-ops/hitlimit](https://www.npmjs.com/package/@joint-ops/hitlimit) and [@joint-ops/hitlimit-bun](https://www.npmjs.com/package/@joint-ops/hitlimit-bun).

## Installation

This package is automatically installed as a dependency of `hitlimit` and `hitlimit-bun`. You don't need to install it directly.

```bash
# Install hitlimit (includes types automatically)
npm install @joint-ops/hitlimit

# Or for Bun
bun add @joint-ops/hitlimit-bun
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

- [@joint-ops/hitlimit](https://www.npmjs.com/package/@joint-ops/hitlimit) - Rate limiting for Node.js (Express, NestJS)
- [@joint-ops/hitlimit-bun](https://www.npmjs.com/package/@joint-ops/hitlimit-bun) - Rate limiting for Bun (Bun.serve, Elysia)

## License

MIT

## Keywords

rate limit types, typescript rate limit, rate limiter types, hitlimit, api types, middleware types, typescript definitions
