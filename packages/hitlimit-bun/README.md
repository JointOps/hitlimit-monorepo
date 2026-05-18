# @joint-ops/hitlimit-bun

> Rate limiting built for Bun. Not ported — built.

<!-- BENCH:BUN_HERO -->
**7.73M ops/sec** at single IP. **5.57M at 10K unique IPs**. Native bun:sqlite. Atomic Lua. Postgres via Bun SQL. Zero dependencies.
<!-- /BENCH:BUN_HERO -->

```bash
bun add @joint-ops/hitlimit-bun
```

```typescript
import { hitlimit } from '@joint-ops/hitlimit-bun'

Bun.serve({
  fetch: hitlimit({}, (req) => new Response('Hello!'))
})
```

100 req/min per IP. Done. Works with **Bun.serve**, **Elysia**, and **Hono** — no adapter packages, no wrappers.

**[Full Docs](https://hitlimit.jointops.dev/docs/bun)** · **[GitHub](https://github.com/JointOps/hitlimit-monorepo)**

---

## Frameworks

### Bun.serve

```typescript
import { hitlimit } from '@joint-ops/hitlimit-bun'

Bun.serve({
  fetch: hitlimit({ limit: 100, window: '1m' }, (req) => {
    return new Response('Hello!')
  })
})
```

### Elysia

```typescript
import { Elysia } from 'elysia'
import { hitlimit } from '@joint-ops/hitlimit-bun/elysia'

new Elysia()
  .use(hitlimit({ limit: 100, window: '1m' }))
  .get('/', () => 'Hello!')
  .listen(3000)
```

### Hono

```typescript
import { Hono } from 'hono'
import { hitlimit } from '@joint-ops/hitlimit-bun/hono'

const app = new Hono()
app.use(hitlimit({ limit: 100, window: '1m' }))
app.get('/', (c) => c.text('Hello!'))
Bun.serve({ port: 3000, fetch: app.fetch })
```

---

## 8 Storage Backends

One line to swap. Your rate limiting logic stays exactly the same.

```
               Single Server                          Multi-Server
          ┌──────────────────────┐          ┌──────────────────────────┐
          │  Memory  │  SQLite   │          │  Redis   │  Postgres    │
          │ (default) (bun:sqlite)          │  Valkey  │  MongoDB     │
          │                      │          │ Dragonfly│  MySQL       │
          └──────────────────────┘          └──────────────────────────┘
```

<!-- BENCH:BUN_STORE_TABLE -->
| Store | Ops/sec | Latency | When to use |
|-------|---------|---------|-------------|
| Memory | 5,574,103 | 179ns | Single server, maximum speed |
| bun:sqlite | 372,247 | 2.7μs | Single server, need persistence |
| MongoDB | 2,132 | 469μs | Multi-server / NoSQL infrastructure |
<!-- /BENCH:BUN_STORE_TABLE -->

> Redis, Valkey, DragonflyDB, Postgres, and MySQL are network-bound. Full numbers at [hitlimit.jointops.dev/docs/benchmarks](https://hitlimit.jointops.dev/docs/benchmarks).

### Memory — default, zero config, zero dependencies

```typescript
Bun.serve({ fetch: hitlimit({}, handler) })
```

### bun:sqlite — native, no N-API, no C++ bindings, survives restarts

```typescript
import { sqliteStore } from '@joint-ops/hitlimit-bun/stores/sqlite'

Bun.serve({ fetch: hitlimit({ store: sqliteStore({ path: './ratelimit.db' }) }, handler) })
```

No peer dependency — `bun:sqlite` is built into Bun.

### Redis — distributed, atomic Lua scripts, single round-trip

```typescript
import { redisStore } from '@joint-ops/hitlimit-bun/stores/redis'

Bun.serve({ fetch: hitlimit({ store: redisStore({ url: 'redis://localhost:6379' }) }, handler) })
```

Peer dep: `ioredis`

### Valkey — open-source Redis fork (BSD-3), drop-in replacement

```typescript
import { valkeyStore } from '@joint-ops/hitlimit-bun/stores/valkey'

Bun.serve({ fetch: hitlimit({ store: valkeyStore({ url: 'redis://localhost:6379' }) }, handler) })
```

Peer dep: `ioredis`

### DragonflyDB — Redis-compatible, handles more throughput

```typescript
import { dragonflyStore } from '@joint-ops/hitlimit-bun/stores/dragonfly'

Bun.serve({ fetch: hitlimit({ store: dragonflyStore({ url: 'redis://localhost:6379' }) }, handler) })
```

Peer dep: `ioredis`

### PostgreSQL — Bun native SQL, no extra driver needed

**Connection string (recommended):**

```typescript
import { postgresStore } from '@joint-ops/hitlimit-bun/stores/postgres'

Bun.serve({ fetch: hitlimit({ store: postgresStore({ url: process.env.DATABASE_URL }) }, handler) })
```

**Caller-owned `Bun.SQL` client:**

```typescript
import { SQL } from 'bun'
import { postgresStore } from '@joint-ops/hitlimit-bun/stores/postgres'

const sql = new SQL(process.env.DATABASE_URL)
Bun.serve({ fetch: hitlimit({ store: postgresStore({ client: sql }) }, handler) })
```

**Legacy `pg.Pool` (deprecated — `url` or `client` preferred):**

```typescript
import pg from 'pg'
import { postgresStore } from '@joint-ops/hitlimit-bun/stores/postgres'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
Bun.serve({ fetch: hitlimit({ store: postgresStore({ pool }) }, handler) })
```

Optional peer dep: `pg` — only needed if you use the deprecated `{ pool }` option.

### MongoDB — TTL indexes, MEAN/MERN stacks

```typescript
import { MongoClient } from 'mongodb'
import { mongoStore } from '@joint-ops/hitlimit-bun/stores/mongodb'

const client = new MongoClient('mongodb://localhost:27017')
await client.connect()
Bun.serve({ fetch: hitlimit({ store: mongoStore({ db: client.db('myapp') }) }, handler) })
```

Peer dep: `mongodb`

### MySQL / MariaDB — LAMP stacks, PlanetScale, RDS

```typescript
import mysql from 'mysql2/promise'
import { mysqlStore } from '@joint-ops/hitlimit-bun/stores/mysql'

const pool = mysql.createPool({ host: 'localhost', database: 'myapp', user: 'root', password: '' })
Bun.serve({ fetch: hitlimit({ store: mysqlStore({ pool }) }, handler) })
```

Peer dep: `mysql2`

---

## Features

### Tiered limits — Free, Pro, Enterprise in one config

```typescript
hitlimit({
  tiers: {
    free:       { limit: 100,   window: '1h' },
    pro:        { limit: 5000,  window: '1h' },
    enterprise: { limit: 50000, window: '1h' }
  },
  tier: (req) => req.headers.get('x-tier') || 'free'
}, handler)
```

### Auto-ban — block repeat offenders automatically

```typescript
hitlimit({
  limit: 100,
  window: '1m',
  ban: {
    threshold: 5,   // ban after 5 violations
    duration: '1h'  // ban lasts 1 hour
  }
}, handler)
```

When a client is banned: response includes `X-RateLimit-Ban: true` and `X-RateLimit-Ban-Expires`, body includes `banned: true`.

### Group limits — shared quotas across clients

```typescript
hitlimit({
  limit: 10000,
  window: '1h',
  group: (req) => new URL(req.url).searchParams.get('teamId') || 'default'
}, handler)
```

### Custom rate limit key

```typescript
hitlimit({
  key: (req) => req.headers.get('x-api-key') || 'anon'
}, handler)
```

### Skip rules — whitelist whatever you want

```typescript
hitlimit({
  skip: (req) => new URL(req.url).pathname === '/health'
}, handler)
```

### Custom response body

```typescript
hitlimit({
  response: (info) => ({
    error: 'RATE_LIMITED',
    message: `Slow down. Try again in ${info.resetIn}s.`,
    limit: info.limit,
    remaining: info.remaining
  })
}, handler)
```

### Rate limit headers

```typescript
hitlimit({
  headers: {
    standard: true,   // RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset (IETF)
    legacy: true,     // X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
    retryAfter: true  // Retry-After on 429 responses
  }
}, handler)
```

### Store error handling — allow or deny on failure

```typescript
hitlimit({
  onStoreError: (err, req) => {
    if (new URL(req.url).pathname.startsWith('/admin')) return 'deny'
    return 'allow'
  }
}, handler)
```

### Built-in logger

```typescript
import { consoleLogger } from '@joint-ops/hitlimit-bun/loggers/console'

hitlimit({ logger: consoleLogger() }, handler)
```

---

## `createHitLimit` — Manual Control

For when you need to check the limit yourself and handle the rest:

```typescript
import { createHitLimit } from '@joint-ops/hitlimit-bun'

const limiter = createHitLimit({ limit: 100, window: '1m' })

Bun.serve({
  fetch: async (req, server) => {
    const blocked = await limiter.check(req, server)
    if (blocked) return blocked  // 429 Response

    // Your logic here
    return new Response('OK')
  }
})
```

`check()` returns a `Response` if the request is blocked, `null` if it's allowed. Reset a key manually:

```typescript
await limiter.reset('some-key')
```

---

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

---

## All Options

```typescript
hitlimit({
  limit: 100,              // max requests per window (default: 100)
  window: '1m',            // time window: 's', 'm', 'h', 'd' or milliseconds (default: '1m')
  key: (req) => req.headers.get('x-api-key') || 'anon',  // what to rate limit by (default: IP)

  tiers: { free: { limit: 100, window: '1h' } },
  tier:  (req) => req.headers.get('x-tier') || 'free',

  ban: { threshold: 5, duration: '1h' },

  group: (req) => req.headers.get('x-team-id') || 'default',

  skip: (req) => new URL(req.url).pathname === '/health',

  response: (info) => ({ error: 'Too many requests', retryAfter: info.resetIn }),

  headers: { standard: true, legacy: false, retryAfter: true },

  store: redisStore({ url: 'redis://localhost:6379' }),

  onStoreError: (err, req) => 'allow',

  logger: consoleLogger()
}, handler)
```

---

## Related

- **[@joint-ops/hitlimit](https://www.npmjs.com/package/@joint-ops/hitlimit)** — same thing, built for Node.js (Express, Fastify, Hono, NestJS)

**[Full Documentation](https://hitlimit.jointops.dev/docs/bun)** · **[GitHub](https://github.com/JointOps/hitlimit-monorepo)**

## License

MIT
