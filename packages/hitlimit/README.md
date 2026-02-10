# @joint-ops/hitlimit

[![npm version](https://img.shields.io/npm/v/@joint-ops/hitlimit.svg)](https://www.npmjs.com/package/@joint-ops/hitlimit)
[![npm downloads](https://img.shields.io/npm/dm/@joint-ops/hitlimit.svg)](https://www.npmjs.com/package/@joint-ops/hitlimit)
[![GitHub](https://img.shields.io/github/license/JointOps/hitlimit-monorepo)](https://github.com/JointOps/hitlimit-monorepo)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@joint-ops/hitlimit)](https://bundlephobia.com/package/@joint-ops/hitlimit)

> The fastest rate limiter for Node.js - Express, NestJS, and native HTTP | express-rate-limit alternative

**hitlimit** is a high-performance rate limiting middleware for Node.js applications. Protect your APIs from abuse, prevent brute force attacks, and throttle requests with sub-millisecond overhead. A faster, lighter alternative to express-rate-limit and rate-limiter-flexible.

**[Documentation](https://hitlimit.jointops.dev)** | **[GitHub](https://github.com/JointOps/hitlimit-monorepo)** | **[npm](https://www.npmjs.com/package/@joint-ops/hitlimit)**

## Why hitlimit?

- **Blazing Fast** - 400,000+ ops/sec with memory store, ~7% HTTP overhead
- **Zero Config** - Works out of the box with sensible defaults
- **Tiny Footprint** - Only ~7KB core, zero runtime dependencies
- **Framework Agnostic** - Express, NestJS, Fastify, native HTTP
- **Multiple Stores** - Memory, Redis, SQLite for distributed systems
- **TypeScript First** - Full type safety and IntelliSense support
- **Flexible Keys** - Rate limit by IP, user ID, API key, or custom logic
- **Tiered Limits** - Different limits for free/pro/enterprise users
- **Standard Headers** - RFC-compliant RateLimit-* and X-RateLimit-* headers

## Performance

hitlimit is designed for speed. Here's how it performs:

### Store Benchmarks

| Store | Operations/sec | Avg Latency | Use Case |
|-------|----------------|-------------|----------|
| **Memory** | 2,320,000+ | 0.43μs | Single instance, no persistence |
| **SQLite** | 393,000+ | 2.54μs | Single instance, persistence needed |
| **Redis** | 6,500+ | 153μs | Multi-instance, distributed |

### vs Competitors

| Library | Memory 10K IPs (ops/s) | Bundle Size |
|---------|------------------------|-------------|
| **hitlimit** | **2,320,000** | **~7KB** |
| rate-limiter-flexible | 1,630,000 | ~155KB |
| express-rate-limit | 1,220,000 | ~66KB |

> **Note:** Benchmark results vary by hardware and environment. Run your own benchmarks to see results on your specific setup.

### HTTP Overhead

| Framework | Without Limiter | With hitlimit | Overhead |
|-----------|-----------------|---------------|----------|
| Express | 45,000 req/s | 42,000 req/s | **7%** |
| Fastify | 65,000 req/s | 61,000 req/s | **6%** |

<details>
<summary>Run benchmarks yourself</summary>

```bash
git clone https://github.com/JointOps/hitlimit-monorepo
cd hitlimit-monorepo
pnpm install
pnpm build
pnpm benchmark
```

</details>

## Installation

```bash
npm install @joint-ops/hitlimit
# or
pnpm add @joint-ops/hitlimit
# or
yarn add @joint-ops/hitlimit
```

## Quick Start

### Express Rate Limiting

```javascript
import express from 'express'
import { hitlimit } from '@joint-ops/hitlimit'

const app = express()

// Default: 100 requests per minute per IP
app.use(hitlimit())

// Or with custom options
app.use(hitlimit({
  limit: 100,     // max requests
  window: '15m'   // per 15 minutes
}))

app.get('/api', (req, res) => res.json({ status: 'ok' }))
app.listen(3000)
```

### NestJS Rate Limiting

```typescript
import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { HitLimitModule, HitLimitGuard } from '@joint-ops/hitlimit/nest'

@Module({
  imports: [
    HitLimitModule.register({
      limit: 100,
      window: '1m'
    })
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: HitLimitGuard
    }
  ]
})
export class AppModule {}
```

### Node.js HTTP Rate Limiting

```javascript
import http from 'node:http'
import { createHitLimit } from '@joint-ops/hitlimit/node'

const limiter = createHitLimit({ limit: 100, window: '1m' })

const server = http.createServer(async (req, res) => {
  const result = await limiter.check(req)
  if (!result.allowed) {
    res.writeHead(429, { 'Content-Type': 'application/json', ...result.headers })
    res.end(JSON.stringify(result.body))
    return
  }

  res.writeHead(200)
  res.end('Hello!')
})

server.listen(3000)
```

## Features

### API Rate Limiting

Protect your REST APIs from abuse and ensure fair usage across all clients.

```javascript
// Limit API endpoints
app.use('/api', hitlimit({ limit: 1000, window: '1h' }))
```

### Login & Authentication Protection

Prevent brute force attacks on login endpoints with strict rate limits.

```javascript
// Strict limits for auth routes
app.use('/auth/login', hitlimit({ limit: 5, window: '15m' }))
app.use('/auth/register', hitlimit({ limit: 3, window: '1h' }))
```

### Tiered Rate Limits

Different limits for different user tiers (free, pro, enterprise).

```javascript
hitlimit({
  tiers: {
    free: { limit: 100, window: '1h' },
    pro: { limit: 5000, window: '1h' },
    enterprise: { limit: Infinity }
  },
  tier: (req) => req.user?.plan || 'free'
})
```

### Custom Rate Limit Keys

Rate limit by IP address, user ID, API key, or any custom identifier.

```javascript
hitlimit({
  key: (req) => {
    // By API key
    const apiKey = req.headers['x-api-key']
    if (apiKey) return String(apiKey)
    // By user ID
    if (req.user?.id) return `user:${req.user.id}`
    // Fallback to IP
    return req.ip || 'unknown'
  }
})
```

### Skip Certain Requests

Whitelist health checks, internal routes, or admin users.

```javascript
hitlimit({
  skip: (req) => {
    if (req.path === '/health') return true
    if (req.user?.role === 'admin') return true
    return false
  }
})
```

## Configuration Options

```javascript
hitlimit({
  // Basic options
  limit: 100,              // Max requests per window (default: 100)
  window: '1m',            // Time window: 30s, 15m, 1h, 1d (default: '1m')

  // Custom key extraction
  key: (req) => req.ip || 'unknown',

  // Tiered rate limits
  tiers: {
    free: { limit: 100, window: '1h' },
    pro: { limit: 5000, window: '1h' },
    enterprise: { limit: Infinity }
  },
  tier: (req) => req.user?.plan || 'free',

  // Custom 429 response
  response: {
    message: 'Too many requests',
    statusCode: 429
  },

  // Headers configuration
  headers: {
    standard: true,   // RateLimit-* headers
    legacy: true,     // X-RateLimit-* headers
    retryAfter: true  // Retry-After header on 429
  },

  // Store backend
  store: memoryStore(),

  // Skip rate limiting
  skip: (req) => req.path === '/health',

  // Error handling
  onStoreError: (error, req) => 'allow' // or 'deny'
})
```

## Storage Backends

### Memory Store (Default)

Best for single-server deployments. Fast and zero-config.

```javascript
import { hitlimit } from '@joint-ops/hitlimit'

app.use(hitlimit()) // Uses memory store by default
```

### Redis Store

Best for distributed systems and multi-server deployments.

```javascript
import { hitlimit } from '@joint-ops/hitlimit'
import { redisStore } from '@joint-ops/hitlimit/stores/redis'

app.use(hitlimit({
  store: redisStore({ url: 'redis://localhost:6379' })
}))
```

### SQLite Store

Best for persistent rate limiting with local storage.

```javascript
import { hitlimit } from '@joint-ops/hitlimit'
import { sqliteStore } from '@joint-ops/hitlimit/stores/sqlite'

app.use(hitlimit({
  store: sqliteStore({ path: './ratelimit.db' })
}))
```

## Response Headers

Every response includes rate limit information:

```
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 1234567890
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1234567890
```

When rate limited (429 Too Many Requests):

```
Retry-After: 42
```

## Default 429 Response

```json
{
  "hitlimit": true,
  "message": "Whoa there! Rate limit exceeded.",
  "limit": 100,
  "remaining": 0,
  "resetIn": 42
}
```

## NestJS Decorators

Apply different limits to specific routes:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common'
import { HitLimitGuard, HitLimit } from '@joint-ops/hitlimit/nest'

@Controller()
@UseGuards(HitLimitGuard)
export class AppController {
  @Get()
  @HitLimit({ limit: 10, window: '1m' })
  strictEndpoint() {
    return 'Limited to 10/min'
  }

  @Get('relaxed')
  @HitLimit({ limit: 1000, window: '1m' })
  relaxedEndpoint() {
    return 'Limited to 1000/min'
  }
}
```

## Related Packages

- [@joint-ops/hitlimit-bun](https://www.npmjs.com/package/@joint-ops/hitlimit-bun) - Bun-native rate limiting with bun:sqlite

## Migrating from Other Libraries

### From express-rate-limit

```javascript
// Before (express-rate-limit)
import rateLimit from 'express-rate-limit'
app.use(rateLimit({ windowMs: 60000, max: 100 }))

// After (hitlimit) - 2x faster, smaller bundle
import { hitlimit } from '@joint-ops/hitlimit'
app.use(hitlimit({ window: '1m', limit: 100 }))
```

### From rate-limiter-flexible

```javascript
// Before (rate-limiter-flexible)
import { RateLimiterMemory } from 'rate-limiter-flexible'
const limiter = new RateLimiterMemory({ points: 100, duration: 60 })

// After (hitlimit) - simpler API, better DX
import { hitlimit } from '@joint-ops/hitlimit'
app.use(hitlimit({ limit: 100, window: '1m' }))
```

### From @nestjs/throttler

```typescript
// Before (@nestjs/throttler)
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 100, ttl: 60000 } })

// After (hitlimit) - more flexible, better performance
import { HitLimitGuard, HitLimit } from '@joint-ops/hitlimit/nest'
@UseGuards(HitLimitGuard)
@HitLimit({ limit: 100, window: '1m' })
```

## License

MIT - Use freely in personal and commercial projects.

## Keywords

rate limit, rate limiter, rate limiting, express rate limit, express middleware, express-rate-limit, express-rate-limit alternative, nestjs rate limit, nestjs throttler, @nestjs/throttler alternative, nestjs guard, nodejs rate limit, node rate limiter, api rate limiting, throttle requests, request throttling, api throttling, ddos protection, brute force protection, redis rate limit, memory rate limit, sqlite rate limit, sliding window, fixed window, token bucket, leaky bucket, rate-limiter-flexible alternative, api security, request limiter, http rate limit, express slow down, api protection, login protection, authentication rate limit
