# hitlimit

> The fastest way to say no

High-performance, framework-agnostic rate limiting for Node.js and Bun.

## Packages

| Package | Runtime | Default Store | Install |
|---------|---------|---------------|---------|
| [`hitlimit`](./packages/hitlimit) | Node.js | Memory | `npm i hitlimit` |
| [`hitlimit-bun`](./packages/hitlimit-bun) | Bun | bun:sqlite | `bun add hitlimit-bun` |

## Quick Start

### Express

```javascript
import { hitlimit } from 'hitlimit'

app.use(hitlimit()) // 100 req/min per IP
```

### Bun

```javascript
import { hitlimit } from 'hitlimit-bun'

Bun.serve({
  fetch: hitlimit({}, (req) => new Response('Hello!'))
})
```

### NestJS

```typescript
import { HitLimitModule } from 'hitlimit/nest'

@Module({
  imports: [HitLimitModule.register({ limit: 100, window: '1m' })]
})
export class AppModule {}
```

### Elysia

```typescript
import { Elysia } from 'elysia'
import { hitlimit } from 'hitlimit-bun/elysia'

new Elysia()
  .use(hitlimit({ limit: 100, window: '1m' }))
  .listen(3000)
```

## Features

- **Blazing fast** - Optimized for each runtime
- **Zero config** - Works out of the box
- **Tiny** - ~3-5KB minified
- **Pluggable stores** - Memory, SQLite, Redis
- **Tiered limits** - Different limits per user plan
- **Customizable** - Keys, responses, headers
- **TypeScript** - Full type safety

## Configuration

```javascript
hitlimit({
  limit: 100,              // requests per window
  window: '15m',           // time window (s, m, h, d)
  key: (req) => req.ip,    // rate limit key

  // Tiered limits
  tiers: {
    free: { limit: 100, window: '1h' },
    pro: { limit: 5000, window: '1h' },
    enterprise: { limit: Infinity }
  },
  tier: (req) => req.user?.plan || 'free',

  // Custom response
  response: (info) => ({
    error: 'RATE_LIMITED',
    message: 'Slow down cowboy!',
    retryAfter: info.resetIn
  }),

  // Headers
  headers: {
    standard: true,   // RateLimit-*
    legacy: true,     // X-RateLimit-*
    retryAfter: true  // Retry-After
  },

  // Store error handling (per-request)
  onStoreError: (err, req) => {
    if (req.path.startsWith('/admin')) return 'deny'
    return 'allow'
  },

  // Skip rate limiting
  skip: (req) => req.path === '/health'
})
```

## Stores

### Memory (default for hitlimit)

```javascript
import { hitlimit } from 'hitlimit'
app.use(hitlimit()) // uses memory store
```

### SQLite

```javascript
// Node.js (uses better-sqlite3)
import { sqliteStore } from 'hitlimit/stores/sqlite'
app.use(hitlimit({ store: sqliteStore({ path: './ratelimit.db' }) }))

// Bun (uses bun:sqlite - DEFAULT)
import { hitlimit } from 'hitlimit-bun'
Bun.serve({ fetch: hitlimit({}, handler) }) // uses bun:sqlite by default
```

### Redis

```javascript
// Node.js
import { redisStore } from 'hitlimit/stores/redis'
app.use(hitlimit({ store: redisStore({ url: 'redis://localhost:6379' }) }))

// Bun
import { redisStore } from 'hitlimit-bun/stores/redis'
```

## Default Response (429)

```json
{
  "hitlimit": true,
  "message": "Whoa there! Rate limit exceeded.",
  "limit": 100,
  "remaining": 0,
  "resetIn": 42
}
```

## License

MIT
