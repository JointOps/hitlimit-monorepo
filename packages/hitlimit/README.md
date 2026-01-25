# hitlimit

> The fastest way to say no - Node.js rate limiting

High-performance rate limiting middleware for Express, NestJS, and pure Node.js HTTP servers.

## Install

```bash
npm install hitlimit
# or
pnpm add hitlimit
# or
yarn add hitlimit
```

## Quick Start

### Express

```javascript
import express from 'express'
import { hitlimit } from 'hitlimit'

const app = express()

// Default: 100 requests per minute per IP
app.use(hitlimit())

app.get('/', (req, res) => res.send('Hello!'))

app.listen(3000)
```

### NestJS

```typescript
import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { HitLimitModule, HitLimitGuard } from 'hitlimit/nest'

@Module({
  imports: [
    HitLimitModule.register({
      limit: 100,
      window: '1m'
    })
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: HitLimitGuard
    }
  ]
})
export class AppModule {}
```

### Pure Node.js HTTP

```javascript
import http from 'node:http'
import { createHitLimit } from 'hitlimit/node'

const limiter = createHitLimit({ limit: 100, window: '1m' })

const server = http.createServer(async (req, res) => {
  const result = await limiter(req, res)
  if (!result.allowed) return

  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Hello!')
})

server.listen(3000)
```

## Configuration

```javascript
hitlimit({
  // Basic options
  limit: 100,              // requests per window (default: 100)
  window: '1m',            // time window: 30s, 15m, 1h, 1d (default: '1m')

  // Custom key extraction
  key: (req) => req.headers['x-api-key'] || req.ip,

  // Tiered rate limits
  tiers: {
    free: { limit: 100, window: '1h' },
    pro: { limit: 5000, window: '1h' },
    enterprise: { limit: Infinity }
  },
  tier: (req) => req.user?.plan || 'free',

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

  // Store (default: memory)
  store: memoryStore(),

  // Error handling
  onStoreError: (error, req) => {
    console.error('Store error:', error)
    return 'allow' // or 'deny'
  },

  // Skip rate limiting
  skip: (req) => req.path === '/health'
})
```

## Stores

### Memory Store (Default)

```javascript
import { hitlimit } from 'hitlimit'

app.use(hitlimit()) // uses memory store by default
```

### SQLite Store

```javascript
import { hitlimit } from 'hitlimit'
import { sqliteStore } from 'hitlimit/stores/sqlite'

app.use(hitlimit({
  store: sqliteStore({ path: './ratelimit.db' })
}))
```

### Redis Store

```javascript
import { hitlimit } from 'hitlimit'
import { redisStore } from 'hitlimit/stores/redis'

app.use(hitlimit({
  store: redisStore({ url: 'redis://localhost:6379' })
}))
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

## NestJS Decorator

Apply different limits to specific routes:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common'
import { HitLimitGuard, HitLimit } from 'hitlimit/nest'

@Controller()
@UseGuards(HitLimitGuard)
export class AppController {
  @Get()
  @HitLimit({ limit: 10, window: '1m' })
  strictEndpoint() {
    return 'Limited to 10/min'
  }

  @Get('relaxed')
  @HitLimit({ limit: 1000, window: '1m' })
  relaxedEndpoint() {
    return 'Limited to 1000/min'
  }
}
```

## License

MIT
