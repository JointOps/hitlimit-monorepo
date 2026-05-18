# @joint-ops/hitlimit

> Rate limiting for Node.js. Serious one.

<!-- BENCH:NODE_HERO -->
**4.08M ops/sec** at 10K unique IPs. Zero dependencies. One line to protect any Node.js API.
<!-- /BENCH:NODE_HERO -->

```bash
npm install @joint-ops/hitlimit
```

```javascript
import { hitlimit } from '@joint-ops/hitlimit'

app.use(hitlimit()) // 100 req/min per IP. Done.
```

Works with **Express**, **Fastify**, **Hono**, **NestJS**, and raw **Node.js HTTP** — no framework-specific adapters to install, no wrappers, no boilerplate.

**[Full Docs](https://hitlimit.jointops.dev)** · **[GitHub](https://github.com/JointOps/hitlimit-monorepo)**

---

## Frameworks

### Express

```javascript
import { hitlimit } from '@joint-ops/hitlimit'

app.use(hitlimit({ limit: 100, window: '1m' }))

// Or per-route
app.post('/login', hitlimit({ limit: 5, window: '15m' }), handler)
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
import { HitLimitModule, HitLimitGuard, HitLimit } from '@joint-ops/hitlimit/nest'

// Global guard via module
@Module({
  imports: [HitLimitModule.register({ limit: 100, window: '1m' })],
  providers: [{ provide: APP_GUARD, useClass: HitLimitGuard }]
})
export class AppModule {}

// Per-route override with decorator
@HitLimit({ limit: 5, window: '15m' })
@Post('/login')
login() {}

// Async config (ConfigService, env, etc.)
HitLimitModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    limit: config.get('RATE_LIMIT'),
    window: '1m'
  })
})
```

### Raw Node.js HTTP

```javascript
import { createHitLimit } from '@joint-ops/hitlimit/node'

const limiter = createHitLimit({ limit: 100, window: '1m' })

const server = http.createServer(async (req, res) => {
  const result = await limiter.check(req)
  if (!result.allowed) return res.writeHead(429).end()
  // handle request
})
```

---

## 8 Storage Backends

One line to swap. Your rate limiting logic stays exactly the same.

```
          Single Server                      Multi-Server
    ┌──────────────────────┐        ┌──────────────────────────┐
    │  Memory  │  SQLite   │        │  Redis   │  Postgres    │
    │ (default)            │        │  Valkey  │  MongoDB     │
    │                      │        │ Dragonfly│  MySQL       │
    └──────────────────────┘        └──────────────────────────┘
```

<!-- BENCH:NODE_STORE_TABLE -->
| Store | Ops/sec | Latency | When to use |
|-------|---------|---------|-------------|
| Memory | 4,082,874 | 245ns | Single server, no persistence needed |
| SQLite | 404,135 | 2.5μs | Single server, need persistence |
| MongoDB | 2,161 | 462.8μs | Multi-server / NoSQL infrastructure |
<!-- /BENCH:NODE_STORE_TABLE -->

> Redis, Valkey, DragonflyDB, Postgres, and MySQL are network-bound. Full numbers at [hitlimit.jointops.dev/docs/benchmarks](https://hitlimit.jointops.dev/docs/benchmarks).

### Memory — default, zero config, zero dependencies

```javascript
app.use(hitlimit()) // memory store is the default
```

### SQLite — survives restarts, zero network

```javascript
import { sqliteStore } from '@joint-ops/hitlimit/stores/sqlite'

app.use(hitlimit({ store: sqliteStore({ path: './ratelimit.db' }) }))
```

Peer dep: `better-sqlite3`

### Redis — distributed, atomic Lua scripts, single round-trip

```javascript
import { redisStore } from '@joint-ops/hitlimit/stores/redis'

app.use(hitlimit({ store: redisStore({ url: 'redis://localhost:6379' }) }))
```

Peer dep: `ioredis`

### Valkey — open-source Redis fork (BSD-3), drop-in replacement

```javascript
import { valkeyStore } from '@joint-ops/hitlimit/stores/valkey'

app.use(hitlimit({ store: valkeyStore({ url: 'redis://localhost:6379' }) }))
```

Peer dep: `ioredis`

### DragonflyDB — Redis-compatible, handles more throughput

```javascript
import { dragonflyStore } from '@joint-ops/hitlimit/stores/dragonfly'

app.use(hitlimit({ store: dragonflyStore({ url: 'redis://localhost:6379' }) }))
```

Peer dep: `ioredis`

### PostgreSQL — use the database you already run

```javascript
import pg from 'pg'
import { postgresStore } from '@joint-ops/hitlimit/stores/postgres'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
app.use(hitlimit({ store: postgresStore({ pool }) }))
```

Peer dep: `pg`

### MongoDB — TTL indexes, MEAN/MERN stacks

```javascript
import { MongoClient } from 'mongodb'
import { mongoStore } from '@joint-ops/hitlimit/stores/mongodb'

const client = new MongoClient('mongodb://localhost:27017')
await client.connect()
app.use(hitlimit({ store: mongoStore({ db: client.db('myapp') }) }))
```

Peer dep: `mongodb`

### MySQL / MariaDB — LAMP stacks, PlanetScale, RDS

```javascript
import mysql from 'mysql2/promise'
import { mysqlStore } from '@joint-ops/hitlimit/stores/mysql'

const pool = mysql.createPool({ host: 'localhost', database: 'myapp', user: 'root', password: '' })
app.use(hitlimit({ store: mysqlStore({ pool }) }))
```

Peer dep: `mysql2`

---

## Features

### Tiered limits — Free, Pro, Enterprise in one config

```javascript
hitlimit({
  tiers: {
    free:       { limit: 100,   window: '1h' },
    pro:        { limit: 5000,  window: '1h' },
    enterprise: { limit: 50000, window: '1h' }
  },
  tier: (req) => req.user?.plan || 'free'
})
```

### Auto-ban — block repeat offenders automatically

```javascript
hitlimit({
  limit: 100,
  window: '1m',
  ban: {
    threshold: 5,    // ban after 5 violations
    duration: '1h'   // ban lasts 1 hour
  }
})
```

When a client is banned: response includes `X-RateLimit-Ban: true` and `X-RateLimit-Ban-Expires`, body includes `banned: true`.

### Group limits — shared quotas across clients

```javascript
// Everyone on the same team shares one limit
hitlimit({
  limit: 10000,
  window: '1h',
  group: (req) => req.user.teamId
})
```

### Custom rate limit key

```javascript
hitlimit({
  key: (req) => req.headers['x-api-key'] || req.ip
})
```

### Skip rules — whitelist whatever you want

```javascript
hitlimit({
  skip: (req) => req.path === '/health' || req.user?.role === 'admin'
})
```

### Custom response body

```javascript
hitlimit({
  response: (info) => ({
    error: 'RATE_LIMITED',
    message: `Slow down. Try again in ${info.resetIn}s.`,
    limit: info.limit,
    remaining: info.remaining
  })
})
```

### Rate limit headers

```javascript
hitlimit({
  headers: {
    standard: true,   // RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset (IETF)
    legacy: true,     // X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
    retryAfter: true  // Retry-After on 429 responses
  }
})
```

### Store error handling — allow or deny on failure

```javascript
hitlimit({
  onStoreError: (err, req) => {
    // Called when the store throws — decide per-request what to do
    if (req.path.startsWith('/admin')) return 'deny'
    return 'allow' // fail open for everything else
  }
})
```

### Built-in logger adapters

```javascript
import { pinoLogger }   from '@joint-ops/hitlimit/loggers/pino'
import { winstonLogger } from '@joint-ops/hitlimit/loggers/winston'
import { consoleLogger } from '@joint-ops/hitlimit/loggers/console'

hitlimit({ logger: pinoLogger(pino) })
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

```javascript
hitlimit({
  limit: 100,              // max requests per window (default: 100)
  window: '1m',            // time window: 's', 'm', 'h', 'd' or milliseconds (default: '1m')
  key: (req) => req.ip,    // what to rate limit by (default: IP)

  tiers: { free: { limit: 100, window: '1h' } },
  tier:  (req) => req.user?.plan || 'free',

  ban: { threshold: 5, duration: '1h' },

  group: (req) => req.user?.teamId,

  skip: (req) => req.path === '/health',

  response: (info) => ({ error: 'Too many requests', retryAfter: info.resetIn }),

  headers: { standard: true, legacy: false, retryAfter: true },

  store: redisStore({ url: 'redis://localhost:6379' }),

  onStoreError: (err, req) => 'allow',

  logger: consoleLogger()
})
```

---

## Related

- **[@joint-ops/hitlimit-bun](https://www.npmjs.com/package/@joint-ops/hitlimit-bun)** — same thing, built for Bun (native bun:sqlite, Elysia, Bun.serve)

**[Full Documentation](https://hitlimit.jointops.dev)** · **[GitHub](https://github.com/JointOps/hitlimit-monorepo)**

## License

MIT
