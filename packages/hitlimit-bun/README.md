# @joint-ops/hitlimit-bun

> Rate limiting built for Bun. Not ported — built.

**5M+ ops/sec** on memory. **2.86M at 10K IPs**. Native bun:sqlite. Atomic Redis Lua. Postgres. Zero dependencies.

```bash
bun add @joint-ops/hitlimit-bun
```

```typescript
Bun.serve({
  fetch: hitlimit({}, (req) => new Response('Hello!'))
})
```

One line. Done. Works with **Bun.serve**, **Elysia**, and **Hono** out of the box.

**[Docs](https://hitlimit.jointops.dev/docs/bun)** · **[GitHub](https://github.com/JointOps/hitlimit-monorepo)** · **[Benchmarks](https://github.com/JointOps/hitlimit-monorepo/tree/main/benchmarks)**

---

## 30 Seconds to Production

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

## What You Get

**Tiered limits** — Free, Pro, Enterprise:

```typescript
hitlimit({
  tiers: { free: { limit: 100, window: '1h' }, pro: { limit: 5000, window: '1h' } },
  tier: (req) => req.headers.get('x-tier') || 'free'
}, handler)
```

**Auto-ban** — Repeat offenders get blocked:

```typescript
hitlimit({ limit: 10, window: '1m', ban: { threshold: 5, duration: '1h' } }, handler)
```

**Custom keys** — Rate limit by anything:

```typescript
hitlimit({ key: (req) => req.headers.get('x-api-key') || 'anon' }, handler)
```

**Route-specific limits** (Elysia):

```typescript
new Elysia()
  .use(hitlimit({ limit: 100, window: '1m', name: 'global' }))
  .group('/auth', app => app.use(hitlimit({ limit: 5, window: '15m', name: 'auth' })))
  .listen(3000)
```

---

## 4 Storage Backends

All built in. No extra packages to install.

```typescript
import { hitlimit } from '@joint-ops/hitlimit-bun'

// Memory (default) — fastest, no config
Bun.serve({ fetch: hitlimit({}, handler) })

// bun:sqlite — persists across restarts, native performance
import { sqliteStore } from '@joint-ops/hitlimit-bun'
Bun.serve({ fetch: hitlimit({ store: sqliteStore({ path: './ratelimit.db' }) }, handler) })

// Redis — distributed, atomic Lua scripts
import { redisStore } from '@joint-ops/hitlimit-bun/stores/redis'
Bun.serve({ fetch: hitlimit({ store: redisStore({ url: 'redis://localhost:6379' }) }, handler) })

// Postgres — distributed, atomic upserts
import { postgresStore } from '@joint-ops/hitlimit-bun/stores/postgres'
Bun.serve({ fetch: hitlimit({ store: postgresStore({ url: 'postgres://localhost:5432/mydb' }) }, handler) })
```

| Store | Ops/sec | Latency | When to use |
|-------|---------|---------|-------------|
| Memory | 5,090,000 | 196ns | Single server, maximum speed |
| bun:sqlite | 428,000 | 2.3μs | Single server, need persistence |
| Redis | 6,800 | 147μs | Multi-server / distributed |
| Postgres | 2,900 | 350μs | Multi-server / already using Postgres |

---

## Performance

### Bun vs Node.js — Memory Store, 10K unique IPs

| Runtime | Ops/sec | |
|---------|---------|---|
| **Bun** | **2,860,000** | ████████████████████ |
| Node.js | 1,850,000 | ████████████ |

84% faster on Bun. Same library, same algorithm, **memory store** — Bun's runtime does the heavy lifting. For Redis, Postgres, and cross-store breakdowns, see the [full benchmark results](https://github.com/JointOps/hitlimit-monorepo/tree/main/benchmarks). Controlled-environment microbenchmarks with transparent methodology. Run them yourself.

### Why bun:sqlite is faster than better-sqlite3

```
Node.js: JS → N-API → C++ binding → SQLite
Bun:     JS → Native call → SQLite (no overhead)
```

No N-API. No C++ bindings. No FFI. Bun calls SQLite directly.

---

## Related

- **[@joint-ops/hitlimit](https://www.npmjs.com/package/@joint-ops/hitlimit)** — Node.js variant for Express, Fastify, Hono, NestJS

## License

MIT
