# @joint-ops/hitlimit-bun

> Rate limiting built for Bun. Not ported — built.

<!-- BENCH:BUN_HERO -->
**7.73M ops/sec** on memory. **5.57M at 10K IPs**. Native bun:sqlite. Atomic Redis Lua. Postgres. Zero dependencies.
<!-- /BENCH:BUN_HERO -->

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

## Pick Your Store

Every store is built in. Swap one line — your rate limiting code stays the same.

```
               Single Server                          Multi-Server
          ┌──────────────────────┐          ┌──────────────────────────┐
          │  Memory  │  SQLite   │          │  Redis   │  Postgres    │
          │  (default) (bun:sqlite)         │  Valkey  │  MongoDB     │
          │                      │          │  Dragonfly  MySQL       │
          └──────────────────────┘          └──────────────────────────┘
             No dependencies at all            Your existing infra, zero lock-in
```

<!-- BENCH:BUN_STORE_TABLE -->
| Store | Ops/sec | Latency | When to use |
|-------|---------|---------|-------------|
| Memory | 5,574,103 | 179ns | Single server, maximum speed |
| bun:sqlite | 372,247 | 2.7μs | Single server, need persistence |
| MongoDB | 2,132 | 469μs | Multi-server / NoSQL infrastructure |
<!-- /BENCH:BUN_STORE_TABLE -->

> Redis, Valkey, DragonflyDB, Postgres, and MySQL are network-bound (~200–3,500 ops/sec). Benchmarks at [hitlimit.jointops.dev/docs/benchmarks](https://hitlimit.jointops.dev/docs/benchmarks).

### The pattern is always the same

```typescript
import { hitlimit } from '@joint-ops/hitlimit-bun'
import { ______Store } from '@joint-ops/hitlimit-bun/stores/______'

Bun.serve({ fetch: hitlimit({ store: ______Store({ /* config */ }) }, handler) })
```

<details>
<summary><b>Memory</b> — default, zero config</summary>

```typescript
Bun.serve({ fetch: hitlimit({}, handler) }) // that's it
```
</details>

<details>
<summary><b>bun:sqlite</b> — native, no N-API, no FFI, survives restarts</summary>

```typescript
import { sqliteStore } from '@joint-ops/hitlimit-bun'
Bun.serve({ fetch: hitlimit({ store: sqliteStore({ path: './ratelimit.db' }) }, handler) })
```
No peer dependency — `bun:sqlite` is built into Bun.
</details>

<details>
<summary><b>Redis</b> — distributed, atomic Lua scripts</summary>

```typescript
import { redisStore } from '@joint-ops/hitlimit-bun/stores/redis'
Bun.serve({ fetch: hitlimit({ store: redisStore({ url: 'redis://localhost:6379' }) }, handler) })
```
Peer dep: `ioredis`
</details>

<details>
<summary><b>Valkey</b> — open-source Redis fork, drop-in replacement</summary>

```typescript
import { valkeyStore } from '@joint-ops/hitlimit-bun/stores/valkey'
Bun.serve({ fetch: hitlimit({ store: valkeyStore({ url: 'redis://localhost:6379' }) }, handler) })
```
Peer dep: `ioredis`
</details>

<details>
<summary><b>DragonflyDB</b> — Redis-compatible, higher throughput</summary>

```typescript
import { dragonflyStore } from '@joint-ops/hitlimit-bun/stores/dragonfly'
Bun.serve({ fetch: hitlimit({ store: dragonflyStore({ url: 'redis://localhost:6379' }) }, handler) })
```
Peer dep: `ioredis`
</details>

<details>
<summary><b>PostgreSQL</b> — Bun native SQL, no extra dependencies</summary>

**Connection string (recommended):**
```typescript
import { postgresStore } from '@joint-ops/hitlimit-bun/stores/postgres'
Bun.serve({ fetch: hitlimit({ store: postgresStore({ url: process.env.DATABASE_URL }) }, handler) })
```

**Caller-owned Bun SQL client:**
```typescript
import { SQL } from 'bun'
import { postgresStore } from '@joint-ops/hitlimit-bun/stores/postgres'
const client = new SQL(process.env.DATABASE_URL)
Bun.serve({ fetch: hitlimit({ store: postgresStore({ client }) }, handler) })
```

**Legacy pg.Pool (deprecated — use `url` or `client` instead):**
```typescript
import pg from 'pg'
import { postgresStore } from '@joint-ops/hitlimit-bun/stores/postgres'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
Bun.serve({ fetch: hitlimit({ store: postgresStore({ pool }) }, handler) }) // deprecated
```

Optional peer dep: `pg` — only required if you use the deprecated `{ pool }` option.
</details>

<details>
<summary><b>MongoDB</b> — NoSQL, TTL indexes, MEAN/MERN stacks</summary>

```typescript
import { mongoStore } from '@joint-ops/hitlimit-bun/stores/mongodb'
import { MongoClient } from 'mongodb'

const client = new MongoClient('mongodb://localhost:27017')
const db = client.db('myapp')
Bun.serve({ fetch: hitlimit({ store: mongoStore({ db }) }, handler) })
```
Peer dep: `mongodb`
</details>

<details>
<summary><b>MySQL</b> — SQL distributed, LAMP stacks</summary>

```typescript
import { mysqlStore } from '@joint-ops/hitlimit-bun/stores/mysql'
import mysql from 'mysql2/promise'

const pool = mysql.createPool('mysql://root@localhost:3306/mydb')
Bun.serve({ fetch: hitlimit({ store: mysqlStore({ pool }) }, handler) })
```
Peer dep: `mysql2`
</details>

---

## Performance

### Bun vs Node.js — Memory Store, 10K unique IPs

<!-- BENCH:BUN_VS_NODE_TABLE -->
| Runtime | Ops/sec | |
|---------|---------|---|
| **Bun** | **5,574,103** | ████████████████████ |
| Node.js | 4,082,874 | ███████████████ |
<!-- /BENCH:BUN_VS_NODE_TABLE -->

<!-- BENCH:BUN_VS_NODE_TEXT -->
Bun leads at 10K IPs (5.57M vs 4.08M) and single-IP (7.73M vs 5.96M). Same library, same algorithm, **memory store**. For Redis, Postgres, and cross-store breakdowns, see the [full benchmark results](https://github.com/JointOps/hitlimit-monorepo/tree/main/benchmarks). Controlled-environment microbenchmarks with transparent methodology. Run them yourself.
<!-- /BENCH:BUN_VS_NODE_TEXT -->

### Why bun:sqlite doesn't need bindings

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
