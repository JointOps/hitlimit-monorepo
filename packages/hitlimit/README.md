# @joint-ops/hitlimit

> Rate limiting that doesn't slow you down.

<!-- BENCH:NODE_HERO -->
**4.08M ops/sec** at 10K unique IPs. Zero dependencies. One line to protect any Node.js API.
<!-- /BENCH:NODE_HERO -->

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

## Pick Your Store

Every store is built in. Swap one line — your rate limiting code stays the same.

```
               Single Server                          Multi-Server
          ┌──────────────────────┐          ┌──────────────────────────┐
          │  Memory  │  SQLite   │          │  Redis   │  Postgres    │
          │  (default)           │          │  Valkey  │  MongoDB     │
          │                      │          │  Dragonfly  MySQL       │
          └──────────────────────┘          └──────────────────────────┘
             No persistence         Your existing infrastructure, zero lock-in
```

<!-- BENCH:NODE_STORE_TABLE -->
| Store | Ops/sec | Latency | When to use |
|-------|---------|---------|-------------|
| Memory | 4,082,874 | 245ns | Single server, no persistence needed |
| SQLite | 404,135 | 2.5μs | Single server, need persistence |
| MongoDB | 2,161 | 462.8μs | Multi-server / NoSQL infrastructure |
<!-- /BENCH:NODE_STORE_TABLE -->

> Redis, Valkey, DragonflyDB, Postgres, and MySQL are network-bound (~200–3,500 ops/sec). Benchmarks at [hitlimit.jointops.dev/docs/benchmarks](https://hitlimit.jointops.dev/docs/benchmarks).

### The pattern is always the same

```javascript
import { hitlimit } from '@joint-ops/hitlimit'
import { ______Store } from '@joint-ops/hitlimit/stores/______'

app.use(hitlimit({ store: ______Store({ /* connection config */ }) }))
```

<details>
<summary><b>Memory</b> — default, zero config</summary>

```javascript
app.use(hitlimit()) // that's it
```
</details>

<details>
<summary><b>SQLite</b> — survives restarts, single server</summary>

```javascript
import { sqliteStore } from '@joint-ops/hitlimit/stores/sqlite'
app.use(hitlimit({ store: sqliteStore({ path: './ratelimit.db' }) }))
```
Peer dep: `better-sqlite3`
</details>

<details>
<summary><b>Redis</b> — distributed, atomic Lua scripts</summary>

```javascript
import { redisStore } from '@joint-ops/hitlimit/stores/redis'
app.use(hitlimit({ store: redisStore({ url: 'redis://localhost:6379' }) }))
```
Peer dep: `ioredis`
</details>

<details>
<summary><b>Valkey</b> — open-source Redis fork, drop-in replacement</summary>

```javascript
import { valkeyStore } from '@joint-ops/hitlimit/stores/valkey'
app.use(hitlimit({ store: valkeyStore({ url: 'redis://localhost:6379' }) }))
```
Peer dep: `ioredis`
</details>

<details>
<summary><b>DragonflyDB</b> — Redis-compatible, higher throughput</summary>

```javascript
import { dragonflyStore } from '@joint-ops/hitlimit/stores/dragonfly'
app.use(hitlimit({ store: dragonflyStore({ url: 'redis://localhost:6379' }) }))
```
Peer dep: `ioredis`
</details>

<details>
<summary><b>PostgreSQL</b> — use your existing database</summary>

```javascript
import { postgresStore } from '@joint-ops/hitlimit/stores/postgres'
app.use(hitlimit({ store: postgresStore({ url: 'postgres://localhost:5432/mydb' }) }))
```
Peer dep: `pg`
</details>

<details>
<summary><b>MongoDB</b> — NoSQL, TTL indexes, MEAN/MERN stacks</summary>

```javascript
import { mongoStore } from '@joint-ops/hitlimit/stores/mongodb'
import { MongoClient } from 'mongodb'

const client = new MongoClient('mongodb://localhost:27017')
const db = client.db('myapp')
app.use(hitlimit({ store: mongoStore({ db }) }))
```
Peer dep: `mongodb`
</details>

<details>
<summary><b>MySQL</b> — SQL distributed, LAMP stacks</summary>

```javascript
import { mysqlStore } from '@joint-ops/hitlimit/stores/mysql'
import mysql from 'mysql2/promise'

const pool = mysql.createPool('mysql://root@localhost:3306/mydb')
app.use(hitlimit({ store: mysqlStore({ pool }) }))
```
Peer dep: `mysql2`
</details>

---

## Performance

### vs Competitors (Memory Store, 10K unique IPs)

<!-- BENCH:NODE_COMPETITOR_TABLE -->
| Library | Ops/sec | |
|---------|---------|---|
| **hitlimit** | **4,082,874** | ████████████████████ |
| rate-limiter-flexible | 1,261,659 | ██████ |
| express-rate-limit | 824,030 | ████ |
<!-- /BENCH:NODE_COMPETITOR_TABLE -->

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

- **[@joint-ops/hitlimit-bun](https://www.npmjs.com/package/@joint-ops/hitlimit-bun)** — Bun-native variant with native bun:sqlite

## License

MIT
