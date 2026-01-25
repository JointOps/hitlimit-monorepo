# hitlimit-bun

[![npm version](https://img.shields.io/npm/v/hitlimit-bun.svg)](https://www.npmjs.com/package/hitlimit-bun)
[![npm downloads](https://img.shields.io/npm/dm/hitlimit-bun.svg)](https://www.npmjs.com/package/hitlimit-bun)
[![GitHub](https://img.shields.io/github/license/JointOps/hitlimit-monorepo)](https://github.com/JointOps/hitlimit-monorepo)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

> The fastest rate limiter for Bun - Native performance with bun:sqlite

**hitlimit-bun** is a high-performance, Bun-native rate limiting library for Bun.serve and Elysia applications. Built specifically for Bun's runtime with native bun:sqlite for maximum performance.

**[Documentation](https://hitlimit.dev/docs/bun)** | **[GitHub](https://github.com/JointOps/hitlimit-monorepo)** | **[npm](https://www.npmjs.com/package/hitlimit-bun)**

## Why hitlimit-bun?

- **Bun Native** - Built specifically for Bun's runtime, not a Node.js port
- **Blazing Fast** - 50,000+ requests/second with bun:sqlite
- **Zero Config** - Works out of the box with sensible defaults
- **Native SQLite** - Uses bun:sqlite by default for persistence
- **Elysia Plugin** - First-class Elysia framework integration
- **TypeScript First** - Full type safety and IntelliSense support
- **Tiny Footprint** - Only ~3KB minified, no bloat
- **Flexible Keys** - Rate limit by IP, user ID, API key, or custom logic
- **Tiered Limits** - Different limits for free/pro/enterprise users

## Installation

```bash
bun add hitlimit-bun
```

## Quick Start

### Bun.serve Rate Limiting

```typescript
import { hitlimit } from 'hitlimit-bun'

Bun.serve({
  fetch: hitlimit({}, (req) => new Response('Hello!'))
})
```

### Elysia Rate Limiting

```typescript
import { Elysia } from 'elysia'
import { hitlimit } from 'hitlimit-bun/elysia'

new Elysia()
  .use(hitlimit({ limit: 100, window: '1m' }))
  .get('/', () => 'Hello World!')
  .listen(3000)
```

### Using createHitLimit

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
  async fetch(req) {
    const url = new URL(req.url)

    if (url.pathname.startsWith('/auth')) {
      const result = await authLimiter(req)
      if (!result.allowed) {
        return new Response('Too many attempts', { status: 429 })
      }
    }

    return handler(req)
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

### Elysia Route-Specific Limits

Apply different limits to different route groups in Elysia.

```typescript
new Elysia()
  // Global limit
  .use(hitlimit({ limit: 100, window: '1m' }))

  // Stricter limit for auth
  .group('/auth', (app) =>
    app
      .use(hitlimit({ limit: 5, window: '15m' }))
      .post('/login', handler)
  )

  // Higher limit for API
  .group('/api', (app) =>
    app
      .use(hitlimit({ limit: 1000, window: '1m' }))
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
  }
}, handler)
```

## Storage Backends

### SQLite Store (Default)

Uses Bun's native bun:sqlite for maximum performance. Default store.

```typescript
import { hitlimit } from 'hitlimit-bun'

// Default - uses bun:sqlite with in-memory database
Bun.serve({
  fetch: hitlimit({}, handler)
})

// Custom path for persistence
import { sqliteStore } from 'hitlimit-bun'

Bun.serve({
  fetch: hitlimit({
    store: sqliteStore({ path: './ratelimit.db' })
  }, handler)
})
```

### Memory Store

For simple use cases without persistence.

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

For distributed systems and multi-server deployments.

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

hitlimit-bun is optimized for Bun's runtime:

- Uses `Bun.hash()` for fast key hashing
- Native bun:sqlite for persistent storage
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

- [hitlimit](https://www.npmjs.com/package/hitlimit) - Node.js rate limiting for Express, NestJS

## License

MIT - Use freely in personal and commercial projects.

## Keywords

bun rate limit, bun rate limiter, bun middleware, elysia rate limit, elysia plugin, bun serve rate limiting, bun sqlite, bun native, api rate limiting, throttle requests, request throttling, bun api protection, ddos protection, brute force protection, redis rate limit, high performance rate limit, bun framework, elysia framework
