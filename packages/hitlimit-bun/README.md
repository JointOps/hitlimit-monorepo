# @joint-ops/hitlimit-bun

[![npm version](https://img.shields.io/npm/v/@joint-ops/hitlimit-bun.svg)](https://www.npmjs.com/package/@joint-ops/hitlimit-bun)
[![npm downloads](https://img.shields.io/npm/dm/@joint-ops/hitlimit-bun.svg)](https://www.npmjs.com/package/@joint-ops/hitlimit-bun)
[![GitHub](https://img.shields.io/github/license/JointOps/hitlimit-monorepo)](https://github.com/JointOps/hitlimit-monorepo)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-Native-black.svg)](https://bun.sh)

> The fastest rate limiter for Bun - 6M+ ops/sec with memory-first design | Elysia, Hono & Bun.serve

**hitlimit-bun** is a blazing-fast, Bun-native rate limiting library for Bun.serve, Elysia, and Hono applications. **Memory-first by default** with 6.10M ops/sec performance (15.7x faster than SQLite). Optional persistence with native bun:sqlite or Redis when you need it.

**[Documentation](https://hitlimit.jointops.dev/docs/bun)** | **[GitHub](https://github.com/JointOps/hitlimit-monorepo)** | **[npm](https://www.npmjs.com/package/@joint-ops/hitlimit-bun)**

## ⚡ Why hitlimit-bun?

**Memory-first for maximum performance.** 15.7x faster than SQLite in high-traffic scenarios.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Memory (v1.1+)     ██████████████████████████████  6.10M ops/s │
│  SQLite (v1.0)      █░░░░░░░░░░░░░░░░░░░░░░░░░░░░  386K ops/s  │
│                                                                 │
│  15.7x performance improvement with memory default             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- **🚀 Memory-First** - 6.10M ops/sec by default (v1.1.0+), 15.7x faster than SQLite
- **Bun Native** - Built specifically for Bun's runtime, not a Node.js port
- **Zero Config** - Works out of the box with sensible defaults
- **Framework Support** - First-class Elysia and Hono integration
- **Optional Persistence** - SQLite (386K ops/sec) or Redis (6.9K ops/sec) when needed
- **TypeScript First** - Full type safety and IntelliSense support
- **Auto-Ban** - Automatically ban repeat offenders after threshold violations
- **Shared Limits** - Group rate limits via groupId for teams/tenants
- **Tiny Footprint** - ~23KB total, zero runtime dependencies

## Installation

```bash
bun add @joint-ops/hitlimit-bun
```

## Quick Start

### Bun.serve Rate Limiting

```typescript
import { hitlimit } from '@joint-ops/hitlimit-bun'

Bun.serve({
  fetch: hitlimit({}, (req) => new Response('Hello!'))
})
```

### Elysia Rate Limiting

```typescript
import { Elysia } from 'elysia'
import { hitlimit } from '@joint-ops/hitlimit-bun/elysia'

new Elysia()
  .use(hitlimit({ limit: 100, window: '1m' }))
  .get('/', () => 'Hello World!')
  .listen(3000)
```

### Hono Rate Limiting

```typescript
import { Hono } from 'hono'
import { hitlimit } from '@joint-ops/hitlimit-bun/hono'

const app = new Hono()

app.use(hitlimit({ limit: 100, window: '1m' }))
app.get('/', (c) => c.text('Hello Bun!'))

Bun.serve({ port: 3000, fetch: app.fetch })
```

### Using createHitLimit

```typescript
import { createHitLimit } from '@joint-ops/hitlimit-bun'

const limiter = createHitLimit({ limit: 100, window: '1m' })

Bun.serve({
  async fetch(req, server) {
    // Returns a 429 Response if blocked, or null if allowed
    const blocked = await limiter.check(req, server)
    if (blocked) return blocked

    return new Response('Hello!')
  }
})
```

## Features

### API Rate Limiting

Protect your Bun APIs from abuse with high-performance rate limiting.

```typescript
Bun.serve({
  fetch: hitlimit({ limit: 1000, window: '1h' }, handler)
})
```

### Login & Authentication Protection

Prevent brute force attacks on login endpoints.

```typescript
const authLimiter = createHitLimit({ limit: 5, window: '15m' })

Bun.serve({
  async fetch(req, server) {
    const url = new URL(req.url)

    if (url.pathname.startsWith('/auth')) {
      const blocked = await authLimiter.check(req, server)
      if (blocked) return blocked
    }

    return handler(req, server)
  }
})
```

### Tiered Rate Limits

Different limits for different user tiers (free, pro, enterprise).

```typescript
hitlimit({
  tiers: {
    free: { limit: 100, window: '1h' },
    pro: { limit: 5000, window: '1h' },
    enterprise: { limit: Infinity }
  },
  tier: (req) => req.headers.get('x-tier') || 'free'
}, handler)
```

### Custom Rate Limit Keys

Rate limit by IP address, user ID, API key, or any custom identifier.

```typescript
hitlimit({
  key: (req) => req.headers.get('x-api-key') || 'anonymous'
}, handler)
```

### Auto-Ban Repeat Offenders

Automatically ban clients that repeatedly exceed rate limits.

```typescript
hitlimit({
  limit: 10,
  window: '1m',
  ban: {
    threshold: 5,  // Ban after 5 violations
    duration: '1h' // Ban lasts 1 hour
  }
}, handler)
```

Banned clients receive `X-RateLimit-Ban: true` header and `banned: true` in the response body.

### Grouped / Shared Limits

Rate limit by organization, API key, or any shared identifier.

```typescript
// Per-API-key rate limiting
hitlimit({
  limit: 1000,
  window: '1h',
  group: (req) => req.headers.get('x-api-key') || 'anonymous'
}, handler)
```

### Elysia Route-Specific Limits

Apply different limits to different route groups in Elysia.

```typescript
new Elysia()
  // Global limit
  .use(hitlimit({ limit: 100, window: '1m', name: 'global' }))

  // Stricter limit for auth
  .group('/auth', (app) =>
    app
      .use(hitlimit({ limit: 5, window: '15m', name: 'auth' }))
      .post('/login', handler)
  )

  // Higher limit for API
  .group('/api', (app) =>
    app
      .use(hitlimit({ limit: 1000, window: '1m', name: 'api' }))
      .get('/data', handler)
  )
  .listen(3000)
```

## Configuration Options

```typescript
hitlimit({
  // Basic options
  limit: 100,              // Max requests per window (default: 100)
  window: '1m',            // Time window: 30s, 15m, 1h, 1d (default: '1m')

  // Custom key extraction
  key: (req) => req.headers.get('x-api-key') || 'anonymous',

  // Tiered rate limits
  tiers: {
    free: { limit: 100, window: '1h' },
    pro: { limit: 5000, window: '1h' },
    enterprise: { limit: Infinity }
  },
  tier: (req) => req.headers.get('x-tier') || 'free',

  // Custom 429 response
  response: {
    message: 'Too many requests',
    statusCode: 429
  },
  // Or function:
  response: (info) => ({
    error: 'RATE_LIMITED',
    retryIn: info.resetIn
  }),

  // Headers configuration
  headers: {
    standard: true,   // RateLimit-* headers
    legacy: true,     // X-RateLimit-* headers
    retryAfter: true  // Retry-After header on 429
  },

  // Store (default: bun:sqlite)
  store: sqliteStore({ path: './ratelimit.db' }),

  // Skip rate limiting
  skip: (req) => req.url.includes('/health'),

  // Error handling
  onStoreError: (error, req) => {
    console.error('Store error:', error)
    return 'allow' // or 'deny'
  },

  // Ban repeat offenders
  ban: {
    threshold: 5,    // violations before ban
    duration: '1h'   // ban duration
  },

  // Group/shared limits
  group: (req) => req.headers.get('x-api-key') || 'default'
}, handler)
```

## Storage Backends

### SQLite Store (Default)

Uses Bun's native bun:sqlite for maximum performance. Default store.

```typescript
import { hitlimit } from '@joint-ops/hitlimit-bun'

// Default - uses bun:sqlite with in-memory database
Bun.serve({
  fetch: hitlimit({}, handler)
})

// Custom path for persistence
import { sqliteStore } from '@joint-ops/hitlimit-bun'

Bun.serve({
  fetch: hitlimit({
    store: sqliteStore({ path: './ratelimit.db' })
  }, handler)
})
```

### Memory Store

For simple use cases without persistence.

```typescript
import { hitlimit } from '@joint-ops/hitlimit-bun'
import { memoryStore } from '@joint-ops/hitlimit-bun/stores/memory'

Bun.serve({
  fetch: hitlimit({
    store: memoryStore()
  }, handler)
})
```

### Redis Store

For distributed systems and multi-server deployments.

```typescript
import { hitlimit } from '@joint-ops/hitlimit-bun'
import { redisStore } from '@joint-ops/hitlimit-bun/stores/redis'

Bun.serve({
  fetch: hitlimit({
    store: redisStore({ url: 'redis://localhost:6379' })
  }, handler)
})
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

## Performance

hitlimit-bun is optimized for Bun's runtime with native performance:

### Store Benchmarks (Bun 1.3)

| Store | Operations/sec | vs Node.js |
|-------|----------------|------------|
| **Memory** | 7,210,000+ | +130% faster |
| **bun:sqlite** | 520,000+ | **+10% faster** 🔥 |
| **Redis** | 6,900+ | +3% faster |

### HTTP Throughput

| Framework | With hitlimit-bun | Overhead |
|-----------|-------------------|----------|
| **Bun.serve** | 105,000 req/s | 12% |
| **Elysia** | 115,000 req/s | 11% |

> **Note:** Benchmark results vary by hardware and environment. Run your own benchmarks to see results on your specific setup.

### Why bun:sqlite is So Fast

```
Node.js (better-sqlite3)          Bun (bun:sqlite)
─────────────────────────         ─────────────────
JavaScript                        JavaScript
    ↓                                 ↓
  N-API                           Direct Call
    ↓                                 ↓
  C++ Binding                     Native SQLite
    ↓                             (No overhead!)
  SQLite
```

better-sqlite3 uses N-API bindings with C++ overhead.
bun:sqlite calls SQLite directly from Bun's native layer.

<details>
<summary>Run benchmarks yourself</summary>

```bash
git clone https://github.com/JointOps/hitlimit-monorepo
cd hitlimit-monorepo
bun install
bun run benchmark:bun
```

</details>

## Elysia Plugin Options

```typescript
import { Elysia } from 'elysia'
import { hitlimit } from '@joint-ops/hitlimit-bun/elysia'

new Elysia()
  .use(hitlimit({
    limit: 100,
    window: '1m',
    key: ({ request }) => request.headers.get('x-api-key') || 'anonymous',
    tiers: {
      free: { limit: 100, window: '1h' },
      pro: { limit: 5000, window: '1h' }
    },
    tier: ({ request }) => request.headers.get('x-tier') || 'free'
  }))
  .get('/', () => 'Hello!')
  .listen(3000)
```

## Related Packages

- [@joint-ops/hitlimit](https://www.npmjs.com/package/@joint-ops/hitlimit) - Node.js rate limiting for Express, NestJS

## Why Not Use Node.js Rate Limiters in Bun?

Node.js rate limiters like express-rate-limit use better-sqlite3 which relies on N-API bindings. In Bun, this adds overhead and loses the performance benefits of Bun's native runtime.

**hitlimit-bun** is built specifically for Bun:
- Uses native `bun:sqlite` (2.7x faster than better-sqlite3)
- No FFI overhead or Node.js polyfills
- First-class Elysia framework support
- Optimized for Bun.serve's request handling

## License

MIT - Use freely in personal and commercial projects.

## Keywords

bun rate limit, bun rate limiter, bun middleware, bun api, bun server, bun serve, bun framework, bun native, bun sqlite, elysia rate limit, elysia plugin, elysia middleware, elysia throttle, elysia framework, api rate limiting, throttle requests, request throttling, bun api protection, ddos protection, brute force protection, login protection, redis rate limit, high performance rate limit, fast rate limiter, sliding window, fixed window, rate-limiter-flexible bun, express-rate-limit bun, bun http, bun backend, bun rest api
