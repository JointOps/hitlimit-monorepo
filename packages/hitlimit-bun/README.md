# @joint-ops/hitlimit-bun

[![npm version](https://img.shields.io/npm/v/@joint-ops/hitlimit-bun.svg)](https://www.npmjs.com/package/@joint-ops/hitlimit-bun)
[![npm downloads](https://img.shields.io/npm/dm/@joint-ops/hitlimit-bun.svg)](https://www.npmjs.com/package/@joint-ops/hitlimit-bun)
[![GitHub](https://img.shields.io/github/license/JointOps/hitlimit-monorepo)](https://github.com/JointOps/hitlimit-monorepo)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-Native-black.svg)](https://bun.sh)

> The fastest rate limiter for Bun — 5M+ ops/sec | Bun.serve, Elysia & Hono

**hitlimit-bun** is a Bun-native rate limiting library. Memory-first with 5.09M+ ops/sec under real-world load. Atomic Redis Lua scripts for distributed systems. Native bun:sqlite for persistence. Postgres for distributed SQL. Zero runtime dependencies.

**[Documentation](https://hitlimit.jointops.dev/docs/bun)** | **[GitHub](https://github.com/JointOps/hitlimit-monorepo)** | **[npm](https://www.npmjs.com/package/@joint-ops/hitlimit-bun)**

## Why hitlimit-bun?

- **2.86M ops/sec** under real-world load (10K IPs), 5.09M single-IP peak
- **Bun native** — built for Bun's runtime, not a Node.js port
- **3 frameworks** — Bun.serve, Elysia, Hono from one package
- **4 storage backends** — Memory, bun:sqlite, Redis (atomic Lua scripts), Postgres
- **Atomic Redis** — Single-roundtrip Lua scripts with EVALSHA caching
- **Zero runtime dependencies** — nothing extra to install
- **Human-readable windows** — `'1m'`, `'15m'`, `'1h'` instead of milliseconds
- **Tiered limits** — Free/Pro/Enterprise in 8 lines
- **Auto-ban** — Ban repeat offenders after threshold violations
- **TypeScript native** — Full type safety and IntelliSense

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

  // Store (default: memory)
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

### Memory Store (Default)

Fastest option, used by default. No persistence.

```typescript
import { hitlimit } from '@joint-ops/hitlimit-bun'

// Default - uses memory store (no config needed)
Bun.serve({
  fetch: hitlimit({}, handler)
})
```

### SQLite Store

Uses Bun's native bun:sqlite for persistent rate limiting.

```typescript
import { hitlimit } from '@joint-ops/hitlimit-bun'
import { sqliteStore } from '@joint-ops/hitlimit-bun'

Bun.serve({
  fetch: hitlimit({
    store: sqliteStore({ path: './ratelimit.db' })
  }, handler)
})
```

### Redis Store

For distributed systems and multi-server deployments. Uses atomic Lua scripts — single-roundtrip with EVALSHA caching.

```typescript
import { hitlimit } from '@joint-ops/hitlimit-bun'
import { redisStore } from '@joint-ops/hitlimit-bun/stores/redis'

Bun.serve({
  fetch: hitlimit({
    store: redisStore({ url: 'redis://localhost:6379' })
  }, handler)
})
```

### Postgres Store

For distributed systems using PostgreSQL. Atomic upserts for consistency.

```typescript
import { hitlimit } from '@joint-ops/hitlimit-bun'
import { postgresStore } from '@joint-ops/hitlimit-bun/stores/postgres'

Bun.serve({
  fetch: hitlimit({
    store: postgresStore({ url: 'postgres://localhost:5432/mydb' })
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

### Store Benchmarks

| Store | Operations/sec | vs Node.js |
|-------|----------------|------------|
| **Memory** | 5,090,000+ | +84% faster |
| **bun:sqlite** | 428,000+ | ~same |
| **Redis** | 6,600+ | ~same |
| **Postgres** | 2,900+ | ~same |

### HTTP Throughput

| Framework | With hitlimit-bun | Overhead |
|-----------|-------------------|----------|
| **Bun.serve** | 105,000 req/s | 12% |
| **Elysia** | 115,000 req/s | 11% |

> **Note:** Memory store on Bun is 1.5x faster than the same code on Node.js (2.86M vs 1.85M ops/sec at 10K IPs). These are our benchmarks and we've done our best to keep them fair and reproducible. Results vary by hardware and environment — clone the repo and run them yourself. They're not set in stone — if you find issues or have suggestions for improvement, please open an issue or PR.

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

- [@joint-ops/hitlimit](https://www.npmjs.com/package/@joint-ops/hitlimit) - Node.js rate limiting for Express, Fastify, Hono, NestJS

## Why Not Use Node.js Rate Limiters in Bun?

Node.js rate limiters like express-rate-limit use better-sqlite3 which relies on N-API bindings. In Bun, this adds overhead and loses the performance benefits of Bun's native runtime.

**hitlimit-bun** is built specifically for Bun:
- Uses native `bun:sqlite` (no N-API overhead)
- Atomic Redis Lua scripts for distributed deployments
- No FFI overhead or Node.js polyfills
- First-class Bun.serve, Elysia, and Hono support

## License

MIT - Use freely in personal and commercial projects.

