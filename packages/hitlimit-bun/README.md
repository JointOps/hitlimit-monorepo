# hitlimit-bun

[![npm version](https://img.shields.io/npm/v/hitlimit-bun.svg)](https://www.npmjs.com/package/hitlimit-bun)
[![npm downloads](https://img.shields.io/npm/dm/hitlimit-bun.svg)](https://www.npmjs.com/package/hitlimit-bun)
[![GitHub](https://img.shields.io/github/license/JointOps/hitlimit-monorepo)](https://github.com/JointOps/hitlimit-monorepo)

> The fastest way to say no - Bun-native rate limiting

High-performance rate limiting for Bun.serve and Elysia, using bun:sqlite by default for maximum performance.

**[Documentation](https://hitlimit.dev/docs/bun)** | **[GitHub](https://github.com/JointOps/hitlimit-monorepo)**

## Install

```bash
bun add hitlimit-bun
```

## Quick Start

### Bun.serve

```typescript
import { hitlimit } from 'hitlimit-bun'

Bun.serve({
  fetch: hitlimit({}, (req) => new Response('Hello!'))
})
```

### Elysia

```typescript
import { Elysia } from 'elysia'
import { hitlimit } from 'hitlimit-bun/elysia'

new Elysia()
  .use(hitlimit({ limit: 100, window: '1m' }))
  .get('/', () => 'Hello!')
  .listen(3000)
```

### With createHitLimit

```typescript
import { createHitLimit } from 'hitlimit-bun'

const limiter = createHitLimit({ limit: 100, window: '1m' })

Bun.serve({
  async fetch(req) {
    const result = await limiter(req)
    if (!result.allowed) {
      return new Response(JSON.stringify(result.body), {
        status: 429,
        headers: result.headers
      })
    }
    return new Response('Hello!')
  }
})
```

## Configuration

```typescript
hitlimit({
  // Basic options
  limit: 100,              // requests per window (default: 100)
  window: '1m',            // time window: 30s, 15m, 1h, 1d (default: '1m')

  // Custom key extraction
  key: (req) => req.headers.get('x-api-key') || 'anonymous',

  // Tiered rate limits
  tiers: {
    free: { limit: 100, window: '1h' },
    pro: { limit: 5000, window: '1h' },
    enterprise: { limit: Infinity }
  },
  tier: (req) => req.headers.get('x-tier') || 'free',

  // Custom response
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
    standard: true,   // RateLimit-* headers (default: true)
    legacy: true,     // X-RateLimit-* headers (default: true)
    retryAfter: true  // Retry-After header on 429 (default: true)
  },

  // Store (default: bun:sqlite)
  store: sqliteStore({ path: './ratelimit.db' }),

  // Error handling
  onStoreError: (error, req) => {
    console.error('Store error:', error)
    return 'allow' // or 'deny'
  },

  // Skip rate limiting
  skip: (req) => req.url.includes('/health')
}, handler)
```

## Stores

### SQLite Store (Default)

Uses bun:sqlite for maximum performance.

```typescript
import { hitlimit } from 'hitlimit-bun'

// Default - uses bun:sqlite with in-memory database
Bun.serve({
  fetch: hitlimit({}, handler)
})

// Custom path
import { sqliteStore } from 'hitlimit-bun'

Bun.serve({
  fetch: hitlimit({
    store: sqliteStore({ path: './ratelimit.db' })
  }, handler)
})
```

### Memory Store

```typescript
import { hitlimit } from 'hitlimit-bun'
import { memoryStore } from 'hitlimit-bun/stores/memory'

Bun.serve({
  fetch: hitlimit({
    store: memoryStore()
  }, handler)
})
```

### Redis Store

```typescript
import { hitlimit } from 'hitlimit-bun'
import { redisStore } from 'hitlimit-bun/stores/redis'

Bun.serve({
  fetch: hitlimit({
    store: redisStore({ url: 'redis://localhost:6379' })
  }, handler)
})
```

## Response Headers

On every response:

```
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 1234567890
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1234567890
```

On 429 response:

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

hitlimit-bun is optimized for Bun's runtime:

- Uses `Bun.hash()` for fast key hashing
- Default SQLite store uses bun:sqlite for native performance
- Minimal allocations and overhead

Benchmark results (10,000 requests):

```
Memory store: ~50,000+ req/sec
SQLite store: ~45,000+ req/sec
```

## Elysia Plugin Options

```typescript
import { Elysia } from 'elysia'
import { hitlimit } from 'hitlimit-bun/elysia'

new Elysia()
  .use(hitlimit({
    limit: 100,
    window: '1m',
    sqlitePath: './ratelimit.db', // optional custom path
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

## License

MIT
