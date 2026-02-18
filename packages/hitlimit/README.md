# @joint-ops/hitlimit

[![npm version](https://img.shields.io/npm/v/@joint-ops/hitlimit.svg)](https://www.npmjs.com/package/@joint-ops/hitlimit)
[![npm downloads](https://img.shields.io/npm/dm/@joint-ops/hitlimit.svg)](https://www.npmjs.com/package/@joint-ops/hitlimit)
[![GitHub](https://img.shields.io/github/license/JointOps/hitlimit-monorepo)](https://github.com/JointOps/hitlimit-monorepo)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen.svg)](https://www.npmjs.com/package/@joint-ops/hitlimit)

> The fastest rate limiter for Node.js — Express, Fastify, Hono, NestJS & native HTTP

**hitlimit** is a high-performance rate limiting middleware for Node.js. 3.4x faster than express-rate-limit under real-world load. Atomic Redis Lua scripts for distributed systems. Zero runtime dependencies.

**[Documentation](https://hitlimit.jointops.dev)** | **[GitHub](https://github.com/JointOps/hitlimit-monorepo)** | **[npm](https://www.npmjs.com/package/@joint-ops/hitlimit)**

## Why hitlimit?

- **3.25M+ ops/sec** under real-world load (10K unique IPs), ~7% HTTP overhead
- **8 framework adapters** — Express, Fastify, Hono, NestJS, native HTTP
- **Zero runtime dependencies** — nothing extra to install
- **3 storage backends** — Memory, Redis (atomic Lua scripts), SQLite
- **Atomic Redis** — Single-roundtrip Lua scripts with EVALSHA caching
- **TypeScript native** — Full type safety and IntelliSense
- **Human-readable windows** — `'1m'`, `'15m'`, `'1h'` instead of milliseconds
- **Tiered limits** — Free/Pro/Enterprise in 8 lines of code
- **Auto-ban** — Ban repeat offenders after threshold violations
- **Shared limits** — Group rate limits via `groupId` for teams/tenants
- **Standard headers** — Both RFC `RateLimit-*` and legacy `X-RateLimit-*`

## Performance

### Store Benchmarks (Node.js v24)

| Store | Operations/sec | Avg Latency | Use Case |
|-------|----------------|-------------|----------|
| **Memory** | 4,110,000+ | 0.24μs | Single instance, no persistence |
| **SQLite** | 490,000+ | 2.04μs | Single instance, persistence needed |
| **Redis** | 6,800+ | 146μs | Multi-instance, distributed |

### vs Competitors (Memory Store, 10K IPs)

| Library | ops/sec | Zero Deps | Framework Adapters |
|---------|---------|-----------|-------------------|
| **hitlimit** | **3,250,000** | Yes | 8 built-in |
| rate-limiter-flexible | 1,840,000 | Yes | DIY |
| express-rate-limit | 957,000 | No (1 dep) | 1 |

> 3.4x faster than express-rate-limit, 1.8x faster than rate-limiter-flexible under high-traffic load. Results vary by hardware — [run the benchmarks yourself](https://github.com/JointOps/hitlimit-monorepo). These are our benchmarks and we've done our best to keep them fair and reproducible. They're not set in stone — there's always room for improvement. If you find issues or have suggestions, please open an issue or PR.

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

For Fastify, also install peer dependencies:

```bash
npm install fastify fastify-plugin
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

### Fastify Rate Limiting

```typescript
import Fastify from 'fastify'
import { hitlimit } from '@joint-ops/hitlimit/fastify'

const app = Fastify()

await app.register(hitlimit, {
  limit: 100,
  window: '1m'
})

app.get('/api', () => ({ status: 'ok' }))
await app.listen({ port: 3000 })
```

### Hono Rate Limiting

```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { hitlimit } from '@joint-ops/hitlimit/hono'

const app = new Hono()

app.use(hitlimit({
  limit: 100,
  window: '1m'
}))

app.get('/api', (c) => c.json({ status: 'ok' }))
serve({ fetch: app.fetch, port: 3000 })
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

### Auto-Ban Repeat Offenders

Automatically ban IPs that violate rate limits repeatedly.

```javascript
hitlimit({
  limit: 100,
  window: '1m',
  ban: {
    threshold: 5,      // Ban after 5 violations
    duration: '15m'    // Ban for 15 minutes
  }
})
```

When a client exceeds the rate limit 5 times, they'll be banned for 15 minutes. During the ban, all requests return 429 immediately.

### Shared Rate Limits (Group)

Share rate limits across multiple clients using a group identifier.

```javascript
hitlimit({
  limit: 10000,
  window: '1h',
  group: (req) => req.user.teamId  // Share limit across team
})
```

All requests with the same team ID share the same rate limit counter. Perfect for team-based SaaS quotas.

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
  onStoreError: (error, req) => 'allow', // or 'deny'

  // Ban repeat offenders
  ban: {
    threshold: 5,    // violations before ban
    duration: '1h'   // ban duration
  },

  // Group/shared limits
  group: (req) => req.headers['x-api-key'] || 'default'
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

Best for distributed systems. Uses atomic Lua scripts — single-roundtrip with EVALSHA caching.

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

// After (hitlimit) — 3x faster with many unique IPs, zero deps
import { hitlimit } from '@joint-ops/hitlimit'
app.use(hitlimit({ window: '1m', limit: 100 }))
```

### From rate-limiter-flexible

```javascript
// Before (rate-limiter-flexible)
import { RateLimiterMemory } from 'rate-limiter-flexible'
const limiter = new RateLimiterMemory({ points: 100, duration: 60 })

// After (hitlimit) — built-in middleware, human-readable windows
import { hitlimit } from '@joint-ops/hitlimit'
app.use(hitlimit({ limit: 100, window: '1m' }))
```

### From @fastify/rate-limit

```typescript
// Before (@fastify/rate-limit)
import rateLimit from '@fastify/rate-limit'
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

// After (hitlimit) — tiered limits, Redis/SQLite, multi-framework
import { hitlimit } from '@joint-ops/hitlimit/fastify'
await app.register(hitlimit, { limit: 100, window: '1m' })
```

### From @nestjs/throttler

```typescript
// Before (@nestjs/throttler)
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 100, ttl: 60000 } })

// After (hitlimit) — tiered limits, Redis/SQLite stores
import { HitLimitGuard, HitLimit } from '@joint-ops/hitlimit/nest'
@UseGuards(HitLimitGuard)
@HitLimit({ limit: 100, window: '1m' })
```

## License

MIT
