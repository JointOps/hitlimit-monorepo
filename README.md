# hitlimit

[![npm version](https://img.shields.io/npm/v/@joint-ops/hitlimit.svg)](https://www.npmjs.com/package/@joint-ops/hitlimit)
[![npm version](https://img.shields.io/npm/v/@joint-ops/hitlimit-bun.svg?label=hitlimit-bun)](https://www.npmjs.com/package/@joint-ops/hitlimit-bun)
[![GitHub](https://img.shields.io/github/license/JointOps/hitlimit-monorepo)](https://github.com/JointOps/hitlimit-monorepo)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

> The fastest rate limiter for Node.js & Bun | express-rate-limit alternative

High-performance, framework-agnostic rate limiting for Node.js and Bun. A faster, lighter alternative to express-rate-limit and rate-limiter-flexible.

**[Documentation](https://hitlimit.jointops.dev)** | **[GitHub](https://github.com/JointOps/hitlimit-monorepo)** | **[Discussions](https://github.com/JointOps/hitlimit-monorepo/discussions)**

## Packages

| Package | Runtime | Default Store | Install |
|---------|---------|---------------|---------|
| [`@joint-ops/hitlimit`](./packages/hitlimit) | Node.js | Memory | `npm i @joint-ops/hitlimit` |
| [`@joint-ops/hitlimit-bun`](./packages/hitlimit-bun) | Bun | bun:sqlite | `bun add @joint-ops/hitlimit-bun` |

## Quick Start

### Express

```javascript
import { hitlimit } from '@joint-ops/hitlimit'

app.use(hitlimit()) // 100 req/min per IP
```

### Bun

```javascript
import { hitlimit } from '@joint-ops/hitlimit-bun'

Bun.serve({
  fetch: hitlimit({}, (req) => new Response('Hello!'))
})
```

### NestJS

```typescript
import { HitLimitModule } from '@joint-ops/hitlimit/nest'

@Module({
  imports: [HitLimitModule.register({ limit: 100, window: '1m' })]
})
export class AppModule {}
```

### Elysia

```typescript
import { Elysia } from 'elysia'
import { hitlimit } from '@joint-ops/hitlimit-bun/elysia'

new Elysia()
  .use(hitlimit({ limit: 100, window: '1m' }))
  .listen(3000)
```

## Community

- 💬 **[Discussions](https://github.com/JointOps/hitlimit-monorepo/discussions)** - Ask questions, share ideas, show off your projects
- 🐛 **[Issues](https://github.com/JointOps/hitlimit-monorepo/issues)** - Report bugs and request features
- 📖 **[Documentation](https://hitlimit.jointops.dev)** - Comprehensive guides and API reference

## Features

- **Blazing fast** - Optimized for each runtime
- **Zero config** - Works out of the box
- **Tiny** - ~7KB (hitlimit), ~23KB (hitlimit-bun)
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
import { hitlimit } from '@joint-ops/hitlimit'
app.use(hitlimit()) // uses memory store
```

### SQLite

```javascript
// Node.js (uses better-sqlite3)
import { sqliteStore } from '@joint-ops/hitlimit/stores/sqlite'
app.use(hitlimit({ store: sqliteStore({ path: './ratelimit.db' }) }))

// Bun (uses bun:sqlite - DEFAULT)
import { hitlimit } from '@joint-ops/hitlimit-bun'
Bun.serve({ fetch: hitlimit({}, handler) }) // uses bun:sqlite by default
```

### Redis

```javascript
// Node.js
import { redisStore } from '@joint-ops/hitlimit/stores/redis'
app.use(hitlimit({ store: redisStore({ url: 'redis://localhost:6379' }) }))

// Bun
import { redisStore } from '@joint-ops/hitlimit-bun/stores/redis'
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

## Contributing

We welcome contributions! After cloning the repo, run the setup script:

```bash
git clone https://github.com/JointOps/hitlimit-monorepo
cd hitlimit-monorepo
npx tsx scripts/setup.ts
```

The setup script will:
- Check that you have Node.js (18+), pnpm, and Bun installed
- Provide helpful installation instructions if anything is missing
- Install all dependencies for both Node.js and Bun packages
- Build all packages
- Run tests to verify everything works

**Requirements:**
- [Node.js](https://nodejs.org) 18+
- [pnpm](https://pnpm.io) 8+
- [Bun](https://bun.sh) 1.0+

**Quick Commands:**
```bash
pnpm test          # Run all tests
pnpm build         # Build all packages
pnpm benchmark     # Run benchmarks
pnpm docs:dev      # Start docs dev server
```

## License

MIT
