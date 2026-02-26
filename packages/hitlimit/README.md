# @joint-ops/hitlimit

> Rate limiting that doesn't slow you down.

**3.16M ops/sec** at 10K unique IPs. Zero dependencies. One line to protect any Node.js API.

```bash
npm install @joint-ops/hitlimit
```

```javascript
app.use(hitlimit())  // That's it. 100 req/min per IP.
```

Works with **Express, Fastify, Hono, NestJS**, and **native HTTP** — no config, no adapters to install, no boilerplate.

**[Docs](https://hitlimit.jointops.dev)** · **[GitHub](https://github.com/JointOps/hitlimit-monorepo)** · **[Benchmarks](https://github.com/JointOps/hitlimit-monorepo/tree/main/benchmarks)**

---

## 30 Seconds to Production

### Express

```javascript
import express from 'express'
import { hitlimit } from '@joint-ops/hitlimit'

const app = express()
app.use(hitlimit({ limit: 100, window: '15m' }))
```

### Fastify

```typescript
import { hitlimit } from '@joint-ops/hitlimit/fastify'
await app.register(hitlimit, { limit: 100, window: '1m' })
```

### Hono

```typescript
import { hitlimit } from '@joint-ops/hitlimit/hono'
app.use(hitlimit({ limit: 100, window: '1m' }))
```

### NestJS

```typescript
import { HitLimitModule, HitLimitGuard } from '@joint-ops/hitlimit/nest'

@Module({
  imports: [HitLimitModule.register({ limit: 100, window: '1m' })],
  providers: [{ provide: APP_GUARD, useClass: HitLimitGuard }]
})
export class AppModule {}
```

### Native HTTP

```javascript
import { createHitLimit } from '@joint-ops/hitlimit/node'

const limiter = createHitLimit({ limit: 100, window: '1m' })
const server = http.createServer(async (req, res) => {
  const result = await limiter.check(req)
  if (!result.allowed) return res.writeHead(429).end()
  res.end('OK')
})
```

---

## What You Get

**Tiered limits** — Free, Pro, Enterprise in 4 lines:

```javascript
hitlimit({
  tiers: { free: { limit: 100, window: '1h' }, pro: { limit: 5000, window: '1h' } },
  tier: (req) => req.user?.plan || 'free'
})
```

**Auto-ban** — Ban repeat offenders automatically:

```javascript
hitlimit({ limit: 100, window: '1m', ban: { threshold: 5, duration: '15m' } })
```

**Custom keys** — Rate limit by IP, user, API key, or anything:

```javascript
hitlimit({ key: (req) => req.headers['x-api-key'] || req.ip })
```

**Shared limits** — Team-wide quotas with `group`:

```javascript
hitlimit({ limit: 10000, window: '1h', group: (req) => req.user.teamId })
```

**Skip rules** — Whitelist health checks, admins, internal routes:

```javascript
hitlimit({ skip: (req) => req.path === '/health' || req.user?.role === 'admin' })
```

---

## 6 Storage Backends

Pick the right backend for your deployment — all built in, no extra packages.

| Store | Best For | Peer Dependency |
|---|---|---|
| Memory | Development, single server | None |
| SQLite | Single server + persistence | `better-sqlite3` |
| Redis | Distributed, production | `ioredis` |
| **Valkey** | **Distributed, open-source Redis alternative** | `ioredis` |
| **DragonflyDB** | **High-throughput distributed** | `ioredis` |
| PostgreSQL | Shared database infrastructure | `pg` |

```javascript
import { hitlimit } from '@joint-ops/hitlimit'

// Memory (default) — single server, fastest
app.use(hitlimit())

// SQLite — single server, survives restarts
import { sqliteStore } from '@joint-ops/hitlimit/stores/sqlite'
app.use(hitlimit({ store: sqliteStore({ path: './ratelimit.db' }) }))

// Redis — distributed, atomic Lua scripts
import { redisStore } from '@joint-ops/hitlimit/stores/redis'
app.use(hitlimit({ store: redisStore({ url: 'redis://localhost:6379' }) }))

// Valkey — open-source Redis alternative
import { valkeyStore } from '@joint-ops/hitlimit/stores/valkey'
app.use(hitlimit({ store: valkeyStore({ url: 'redis://localhost:6379' }) }))

// DragonflyDB — high-throughput Redis alternative
import { dragonflyStore } from '@joint-ops/hitlimit/stores/dragonfly'
app.use(hitlimit({ store: dragonflyStore({ url: 'redis://localhost:6379' }) }))

// Postgres — distributed, atomic upserts
import { postgresStore } from '@joint-ops/hitlimit/stores/postgres'
app.use(hitlimit({ store: postgresStore({ url: 'postgres://localhost:5432/mydb' }) }))
```

| Store | Ops/sec | Latency | When to use |
|-------|---------|---------|-------------|
| Memory | 3,160,000 | 316ns | Single server, no persistence needed |
| SQLite | 352,000 | 2.8μs | Single server, need persistence |
| Redis | 6,700 | 149μs | Multi-server / distributed |
| Postgres | 3,000 | 336μs | Multi-server / already using Postgres |

### Valkey (Redis Alternative)
```typescript
import { hitlimit } from '@joint-ops/hitlimit'
import { valkeyStore } from '@joint-ops/hitlimit/stores/valkey'

app.use(hitlimit({
  store: valkeyStore({ url: 'redis://localhost:6379' }),
  limit: 100,
  window: '1m'
}))
```

### DragonflyDB
```typescript
import { hitlimit } from '@joint-ops/hitlimit'
import { dragonflyStore } from '@joint-ops/hitlimit/stores/dragonfly'

app.use(hitlimit({
  store: dragonflyStore({ url: 'redis://localhost:6379' }),
  limit: 100,
  window: '1m'
}))
```

---

## Performance

### vs Competitors (Memory Store, 10K unique IPs)

| Library | Ops/sec | |
|---------|---------|---|
| **hitlimit** | **3,160,000** | ████████████████████ |
| rate-limiter-flexible | 1,140,000 | ███████ |
| express-rate-limit | 749,000 | █████ |

This is the **memory store** comparison — the default for all three libraries. For Redis, Postgres, and cross-store breakdowns, see the [full benchmark results](https://github.com/JointOps/hitlimit-monorepo/tree/main/benchmarks). Controlled-environment microbenchmarks with transparent methodology. We report scenarios where competitors beat us. Run them yourself.

---

## Migrating?

```javascript
// express-rate-limit → hitlimit
- import rateLimit from 'express-rate-limit'
- app.use(rateLimit({ windowMs: 60000, max: 100 }))
+ import { hitlimit } from '@joint-ops/hitlimit'
+ app.use(hitlimit({ window: '1m', limit: 100 }))
```

Full [migration guide](https://hitlimit.jointops.dev/docs/guides/migration) in the docs.

---

## Related

- **[@joint-ops/hitlimit-bun](https://www.npmjs.com/package/@joint-ops/hitlimit-bun)** — Bun-native variant with bun:sqlite and 12M+ ops/sec

## License

MIT
