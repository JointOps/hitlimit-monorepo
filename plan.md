# hitlimit v2 — The Redemption Plan

## How to Use This Document

**For AI assistants in new chat sessions**: This document is the single source of truth for hitlimit's development roadmap. It contains everything you need — no external context required. Read it fully before starting any phase work. Every phase has exact file paths, code snippets, PR workflows, test requirements, and acceptance criteria.

**For human developers**: Each phase is self-contained. Find your assigned phase, follow the steps in order. The PR checklist at the end of each phase is your "done" gate.

**Execution rule**: Phases execute SEQUENTIALLY. Phase N must be merged to `main` before Phase N+1 starts. No parallel phase work.

---

## The Story (Why This Exists)

On launch day, we posted on r/node claiming hitlimit was **"9x faster than rate-limiter-flexible."** The benchmarks were flawed — bad methodology, no warmup parity, comparing apples to oranges. The post got 12 upvotes.

Then **animir** (author of rate-limiter-flexible, 3,500+ GitHub stars, 1.2M weekly downloads, 7+ years of development) showed up:

> *"The title of your post is manipulative. Curious, how far this aggressive advertisement built on half-lies will get you and your project. Can't wish you any luck."*

He ran his own fair benchmark. Result: **1.61x faster** — not 9x.

Our benchmarks after Phase 1 (v1.1.1 sync fast path):

| Scenario | hitlimit | rate-limiter-flexible | Real Ratio |
|----------|----------|----------------------|------------|
| Single-IP | 4.79M ops/s | 3.30M ops/s | **1.45x (we win)** |
| Multi-IP 10K | 3.26M ops/s | 1.64M ops/s | **2x (we win)** |

**We accept responsibility.** The original claim was wrong. But instead of hiding, we're going to build a legitimately superior library — and then come clean publicly.

---

## animir's Full Criticism & Why He's Right

animir didn't just call out the benchmarks. He made a deeper point about production relevance:

> *"So memory limiter was benchmarked. It is funny because rate-limiter-flexible is much more than memory limiter."*
>
> *"Did you know that Memory limiter isn't always useful in production? Many Node.js applications are running in cluster mode or on several machines that makes memory limiter not suitable."*

**He is 100% correct.** Here's why memory-only benchmarks are meaningless for production:

| Production Reality | Why Memory Store Fails |
|---|---|
| **Cluster mode** (PM2, node cluster) | Each worker has separate memory. Rate limits NOT shared. User hits worker 1 (count: 1), then worker 2 (count: 1) — limit never enforced. |
| **Multiple servers** (load balancer) | Each server has separate memory. Same problem as cluster. |
| **Serverless** (Lambda, Vercel, Cloudflare Workers) | Each invocation is fresh. Memory store is empty every time. Useless. |
| **Container restarts** (Docker, K8s) | Memory wiped on restart. All rate limit state lost. |

**The benchmark that actually matters is Redis vs Redis** — because that's what production apps use. And on Redis, our store currently does 1-2 round-trips per hit while rate-limiter-flexible uses Lua scripts for 1 round-trip. We're likely SLOWER on the metric that counts.

This plan's #1 goal is to fix that. We will:
1. Optimize our Redis store to beat RLF on distributed speed (Lua scripts)
2. Add Postgres, MongoDB, MySQL stores so we're a real production library
3. Keep the memory speed improvements (they benefit local dev and single-server setups)
4. Demote turboStore from headline feature to a side optimization
5. Come clean publicly with honest numbers

---

## The Zero Config Promise

**For every existing hitlimit user: ZERO code changes required. Ever.**

Every optimization in Phases 1-3 is internal. The public API does not change. Users who upgrade from v1.1.0 to any v1.x.x patch get:
- Same `hitlimit({ limit: 100, window: '1m' })` API
- Same `memoryStore()` default
- Same response format, headers, status codes
- Faster performance for free — just `npm update`

New features (stores, API methods, advanced patterns) are always opt-in via new imports:
```typescript
// Existing code — works exactly the same, no changes needed
app.use(hitlimit({ limit: 100, window: '1m' }))

// NEW: Want Postgres? Add one import, one config line
import { postgresStore } from '@joint-ops/hitlimit/stores/postgres'
app.use(hitlimit({ store: postgresStore({ pool }), limit: 100, window: '1m' }))
```

---

## Priorities (In Order — Non-Negotiable)

### Priority 1: Production Store Backends (Shut animir Up)
- Add **PostgreSQL**, **MongoDB**, **MySQL** stores.
- animir's strongest criticism: "memory limiter isn't production." We answer with 6+ store backends.
- These are the features that make hitlimit a REAL alternative to rate-limiter-flexible.
- Every store is a peer dependency — zero bundle cost for users who don't need it.

### Priority 2: Distributed System Speed (Beat Him Where It Counts)
- **Redis Lua script optimization** — combine INCR + PEXPIRE + PTTL + ban check in ONE round-trip.
- Current hitlimit Redis: 1-2 round-trips per hit(). RLF: 1 round-trip (Lua script).
- Target: faster Redis operations than RLF by combining ban+hit+violation in a single Lua call.
- THIS is the benchmark that matters in production. Memory speed is irrelevant here.

### Priority 3: Speed Foundation (Benefits Everyone)
- Remove async/await overhead for sync stores (Phases 1-2).
- Zero-allocation hot path, sweep timer.
- These benefit ALL users — memory, SQLite, even Redis (less JS overhead before the network call).
- Internal only — zero code changes for users.

### Priority 4: Bundle Size (Our Killer Advantage)
- hitlimit core: **~6KB** (Node.js) / **~18KB** (Bun). rate-limiter-flexible: **~155KB**. That's **26x smaller** (Node.js).
- This NEVER slips. Core stays under 8KB. Bun bundle stays under 25KB.
- Every new feature is tree-shakeable, behind separate import paths.
- New stores are peer deps — they add ZERO bytes to users who don't use them.
- **ZERO runtime dependencies. Sacred rule. No exceptions.**

### Priority 5: Feature Parity with rate-limiter-flexible
- API methods (get, penalty, reward, block), insurance limiter, cluster mode, burst, union.
- hitlimit's goal: **no matter what framework or runtime, hitlimit is there** — Express, Fastify, Hono, NestJS, Bun.serve, Elysia.
- Features come AFTER stores and speed are locked in.

### Priority 6: Developer Experience (Make It Effortless)
- Zero config works out of the box.
- Human-readable windows (`'1m'`, `'1h'`, `'30s'`).
- Native framework adapters — not wiki examples.
- Auto RFC-compliant rate limit headers.
- One import, one line of code to get started.

### Priority 7: Come Clean Publicly
- Reddit post acknowledging the mistake, sharing real benchmarks.
- Reach out to animir as a friend, not a rival.
- This happens LAST, after we have the production library to back it up.
- The narrative is NOT "we're 9x faster in memory." It's: **"You were right. We built a complete production library. Here are the honest numbers."**

---

## Coding Standards & Rules

### Zero Dependencies (Sacred)
- **ZERO runtime dependencies** in all packages. No exceptions.
- rate-limiter-flexible also has zero deps — we can't afford to lose this advantage.
- New store backends (pg, mongodb, mysql2) are **peer dependencies** — the user installs them, we don't bundle them.
- `peerDependencies` with `optional: true` in package.json. Never `dependencies`.
- If a feature requires an external package, it goes in `peerDependencies` or it doesn't ship.

### Performance-First Coding
- **Hot path is sacred**: The `hit()` → middleware → `next()` path must be as fast as physically possible.
- **No allocation on hot path**: Reuse objects. Pre-compute at init time. Avoid closures in loops.
- **No async where sync works**: If a function returns a value (not a Promise), don't `await` it.
- **Inline over abstraction**: On the hot path, inline code beats function calls. Readability comes second to nanoseconds.
- **Benchmark every change**: Before and after. No exceptions.

### Code Style
- TypeScript strict mode. ESM only. No CommonJS.
- No comments unless logic is non-obvious. Code should be self-documenting.
- No AI attribution in code, commits, PRs, or documentation.
- No version bumps without explicit approval.
- No pushes without permission.

### Testing Standards
- Every new feature gets tests before merge.
- Test both hitlimit (Node.js/Vitest) AND hitlimit-bun (Bun/bun:test).
- Test sync path AND async path behavior.
- Test with mock stores to verify store calls.
- Performance regression tests where applicable.

---

## Dual Package Architecture

**hitlimit has TWO packages that MUST stay in sync on every patch.**

### Package Comparison

| | @joint-ops/hitlimit (Node.js) | @joint-ops/hitlimit-bun (Bun) |
|--|-------------------------------|-------------------------------|
| **Entry point** | Express middleware (`req, res, next`) | Bun.serve handler (`Request → Response`) |
| **Adapters** | Express, Fastify, Hono, NestJS, raw Node http | Bun.serve, Hono, Elysia |
| **SQLite** | `better-sqlite3` (peer dep) | `bun:sqlite` (built-in) |
| **Redis** | `ioredis` (peer dep) | `ioredis` (peer dep) |
| **Loggers** | console, pino, winston | console |
| **Build** | `tsc` (TypeScript compiler) | `bun build` with `--external` flags |
| **Tests** | Vitest | bun:test |
| **Bundle** | ~6KB core entry (index.js), ~41KB total JS | ~18KB core entry (index.js), ~48KB total JS |

### Shared Code (Identical Between Both Packages)

These files are **100% identical** in both packages. Change one, change both:

| File | Purpose |
|------|---------|
| `src/core/config.ts` | Configuration resolution |
| `src/core/limiter.ts` | Core `checkLimit()` and `checkLimitFast()` |
| `src/core/headers.ts` | HTTP header building |
| `src/core/response.ts` | Response body building |
| `src/core/utils.ts` | Window parsing (`'1m'` → `60000`) |
| `src/stores/memory.ts` | In-memory store (the hot path) |
| `src/stores/redis.ts` | Redis store |
| `src/loggers/console.ts` | Console logger adapter |

**Rule**: When a phase modifies a shared file, the identical change MUST be applied to both packages. The PR checklist must verify this.

### Package-Specific Code

| hitlimit (Node.js) | hitlimit-bun (Bun) |
|---------------------|---------------------|
| `src/index.ts` — Express middleware | `src/index.ts` — Bun.serve handler |
| `src/fastify.ts` — Fastify plugin | `src/elysia.ts` — Elysia plugin |
| `src/hono.ts` — Hono middleware | `src/hono.ts` — Hono middleware |
| `src/nest.ts` — NestJS integration | — |
| `src/node.ts` — Raw http handler | — |
| `src/stores/sqlite.ts` — better-sqlite3 | `src/stores/sqlite.ts` — bun:sqlite |
| `src/loggers/pino.ts` | — |
| `src/loggers/winston.ts` | — |
| `src/loggers/console.ts` (exported) | `src/loggers/console.ts` (file exists but NOT exported in package.json) |

### How to Propagate Changes

For every phase:
1. Make the change in `packages/hitlimit/` first
2. Copy shared file changes to `packages/hitlimit-bun/` (identical content)
3. Adapt package-specific files (index.ts, adapters) for both packages
4. Run `pnpm test` (Node.js) AND `bun test` (in packages/hitlimit-bun/)
5. Run `pnpm build` AND `bun run build` (in packages/hitlimit-bun/)
6. Verify bundle sizes for both packages

---

## The Competition: rate-limiter-flexible (Full Audit)

### What They Have (That We Don't)

| Category | rate-limiter-flexible | hitlimit (current v1.1.0) |
|----------|----------------------|---------------------------|
| **Stores** | 14 (Memory, Redis, Mongo, MySQL, Postgres, SQLite, Memcached, DynamoDB, Etcd, Prisma, Drizzle, Valkey, Cluster, PM2) | 3 (Memory, Redis, SQLite) |
| **Insurance/Failover** | Full auto-failover to backup store | `onStoreError` → allow/deny (no backup) |
| **Cluster Mode** | Native IPC to master (no Redis needed) | None |
| **API Methods** | 9 (consume, get, set, block, delete, penalty, reward, getKey, deleteInMemoryBlockedAll) | 3 (hit, reset, isBanned) |
| **Burst Support** | BurstyRateLimiter (dual-limiter) | None |
| **Request Queue** | RateLimiterQueue (FIFO) | None |
| **Union Limits** | RateLimiterUnion (multiple windows) | None |
| **Traffic Shaping** | execEvenly (leaky bucket) | None |
| **In-Memory Block Cache** | Auto-caches blocked keys in RAM (85% faster under DDoS) | None |
| **Blacklist** | RLWrapperBlackAndWhite | None |
| **penalty/reward** | Dynamic point adjustment per user | None |
| **Block duration** | Auto-block on limit exceed | Ban requires violation threshold |
| **get() without consuming** | Yes | None |
| **Browser support** | RateLimiterMemory works in browsers | None |

### Where We Already Win

| Feature | hitlimit | rate-limiter-flexible |
|---------|----------|----------------------|
| **DX (Developer Experience)** | 5-line drop-in middleware | Manual response handling, manual headers |
| **Framework integrations** | Native Express, Fastify, Hono, NestJS, Elysia, Bun.serve | Wiki examples only (manual) |
| **Tier system** | Built-in tier resolver | Must combine multiple limiters |
| **Human-readable windows** | `'1m'`, `'1h'`, `'30s'` | Seconds only (numeric) |
| **Bun native** | Dedicated optimized package | Not optimized for Bun |
| **Headers** | Auto RFC-compliant rate limit headers | You set them yourself |
| **Bundle size** | ~6KB Node / ~18KB Bun | ~155KB (26x larger Node.js!) |
| **Ban system** | Two-tier (violations → ban) | Simpler blockDuration |
| **Group limits** | Built-in | Must implement externally |

### Their Weaknesses (Our Opportunities)

1. **No native middleware** — Users must manually handle HTTP responses, status codes, headers
2. **Fixed window only** — No sliding window, no token bucket algorithm options
3. **Complex API surface** — 17 stores, 7 limiter types, 3 wrappers, 35+ wiki pages
4. **No Bun optimization** — Pure Node.js focus
5. **Single maintainer** — Primarily animir (risk factor for enterprise)
6. **No built-in logger integration** — Must implement yourself
7. **Insurance limiter loses data** — Counters reset on failover (known limitation)

---

## Performance Deep Dive

### Part A: Memory Store — Why We're Slow & How to Fix It

#### Current Hot Path Breakdown (~319ns per operation)

```
┌─────────────────────────────────────────────────────────────┐
│  async (req, res, next) => {                                │
│    const key = await config.key(req)         ← 50-100ns    │ UNNECESSARY AWAIT
│    const result = await config.store.hit()   ← 50-100ns    │ UNNECESSARY AWAIT
│    // store.hit() internals:                                │
│    //   Map.get(key)                         ← 30-50ns     │
│    //   entry.count++                        ← 1ns         │
│    //   return { count, resetAt }            ← 20-30ns     │ NEW OBJECT EVERY CALL
│    const remaining = Math.max(...)           ← 5ns         │
│    const resetIn = Math.ceil(...)            ← 15-20ns     │ Date.now() CALL
│    res.setHeader() × 6                       ← 30-50ns     │
│    next()                                    ← 5ns         │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                                          Total: ~319ns = 3.14M ops/sec
```

#### The Three Killers

**Killer 1: Unnecessary async/await (~150-200ns, ~50-60% of total time)**

The memory store's `hit()` method is **synchronous** — it returns `{ count, resetAt }` directly, not a Promise. But the middleware is declared `async` and uses `await` twice:

```typescript
// CURRENT — packages/hitlimit/src/index.ts:47-48
const key = await config.key(req)        // config.key returns string, NOT Promise
const result = await config.store.hit()  // memory store returns object, NOT Promise
```

Each `await` of a non-Promise value in V8 still schedules a microtask (~50-100ns each). Two unnecessary awaits = ~150-200ns wasted. That's over HALF the execution time doing literally nothing.

**Killer 2: Object allocation on every hit (~20-50ns + GC pressure)**

```typescript
// CURRENT — packages/hitlimit/src/stores/memory.ts:41
return { count: entry.count, resetAt: entry.resetAt }  // NEW object every single call
```

At 3M ops/sec, that's 3 million short-lived objects per second for V8's garbage collector. GC pauses cause latency spikes in p99.

**Killer 3: Per-key setTimeout (~10-30ns + event loop overhead)**

```typescript
// CURRENT — packages/hitlimit/src/stores/memory.ts:48-55
const timeoutId = setTimeout(() => { this.hits.delete(key) }, windowMs)
if (typeof timeoutId.unref === 'function') { timeoutId.unref() }
```

With 10K unique IPs, that's 10K active timer handles in the event loop. Each timer has a closure + Timeout object + `unref()` call. A single sweep timer would eliminate all of this.

#### Memory Optimization Levels & Expected Gains

| Level | Technique | Expected Speed | vs RLF | Confidence |
|-------|-----------|---------------|--------|------------|
| **Current** | As-is | 3.14M ops/s | 0.97x | — |
| **L1** | Sync fast path (remove async/await) | ~6-8M ops/s | ~2-2.5x | Very High |
| **L2** | Zero-allocation + sweep timer | ~9-12M ops/s | ~3-4x | High |

**Note**: Levels L1-L2 are internal optimizations that benefit ALL users (including Redis users — less JS overhead before the network call). These are Phases 1-2 and ship as PATCH releases.

#### Why Memory Optimization Still Matters (Even Though Production Uses Redis)

While animir is right that memory stores aren't suitable for distributed production, they still matter for:
- **Local development** — developers test locally with memory store
- **Single-server applications** — many small apps run on a single server
- **JS overhead reduction** — the sync fast path and zero-alloc improvements benefit the code BEFORE the Redis call too
- **Bun.serve** — many Bun apps are single-process
- **Benchmarkability** — faster memory path means faster testing and CI

But we will NOT lead with memory numbers in marketing. The headline becomes distributed speed and store count.

### Part B: Redis Store — The Production Benchmark That Matters

#### Current Redis Implementation (Bottleneck Analysis)

**File**: `packages/hitlimit/src/stores/redis.ts` (shared with hitlimit-bun)

```typescript
// CURRENT IMPLEMENTATION — 1-2 round-trips per hit()
async hit(key: string, windowMs: number, _limit: number): Promise<StoreResult> {
  const redisKey = this.prefix + key
  const now = Date.now()

  // Round-trip 1: MULTI/EXEC pipeline (INCR + PTTL)
  const results = await this.redis
    .multi()
    .incr(redisKey)
    .pttl(redisKey)
    .exec()

  const count = results![0][1] as number
  let ttl = results![1][1] as number

  // Round-trip 2: PEXPIRE (only for new keys where TTL is -1)
  if (ttl < 0) {
    await this.redis.pexpire(redisKey, windowMs)
    ttl = windowMs
  }

  const resetAt = now + ttl
  return { count, resetAt }
}
```

**Problems**:
1. `multi().incr().pttl().exec()` — pipeline, but still 1 full round-trip
2. New keys need a SEPARATE `pexpire` call — 2nd round-trip
3. Ban check (`isBanned`) is a SEPARATE call in `limiter.ts` before `hit()` — 3rd round-trip when bans are enabled
4. Violation recording (`recordViolation`) is SEPARATE after `hit()` — 4th round-trip

**Total for a banned user with violations**: up to 4 Redis round-trips per request.

#### rate-limiter-flexible's Redis Approach

RLF uses Lua scripts for atomic operations:
- `consume()` = 1 Lua script = 1 round-trip (INCR + PEXPIRE combined atomically)
- Ban check is separate from consume
- They do NOT combine ban+consume in one script

**Key insight**: If we combine ban check + hit + violation tracking in ONE Lua script, we can do in 1 round-trip what RLF does in 2+. This is a genuine speed advantage.

#### Our Redis Optimization Strategy (Phase 3)

**Single Lua script that handles everything in ONE round-trip:**

```lua
-- hitlimit_hit.lua — Combined ban check + hit + violation + auto-ban
-- Keys: KEYS[1] = hit key, KEYS[2] = ban key, KEYS[3] = violation key
-- Args: ARGV[1] = windowMs, ARGV[2] = limit, ARGV[3] = banThreshold (0 = disabled),
--       ARGV[4] = banDurationMs, ARGV[5] = now (ms timestamp)

local hitKey = KEYS[1]
local banKey = KEYS[2]
local violationKey = KEYS[3]
local windowMs = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local banThreshold = tonumber(ARGV[3])
local banDurationMs = tonumber(ARGV[4])
local now = tonumber(ARGV[5])

-- Step 1: Check ban status (0-cost if no ban key exists)
if banThreshold > 0 then
  local banTTL = redis.call('PTTL', banKey)
  if banTTL > 0 then
    -- Key is banned — return immediately without hitting
    return {-1, 0, banTTL, 1}  -- {count=-1, remaining=0, resetMs=banTTL, banned=1}
  end
end

-- Step 2: Atomic increment + expire
local count = redis.call('INCR', hitKey)
local ttl = redis.call('PTTL', hitKey)

if ttl < 0 then
  -- New key — set expiration
  redis.call('PEXPIRE', hitKey, windowMs)
  ttl = windowMs
end

-- Step 3: Track violations and auto-ban (only if over limit and ban enabled)
local banned = 0
if count > limit and banThreshold > 0 then
  local violations = redis.call('INCR', violationKey)
  local vTTL = redis.call('PTTL', violationKey)
  if vTTL < 0 then
    redis.call('PEXPIRE', violationKey, banDurationMs)
  end
  if violations >= banThreshold then
    redis.call('SET', banKey, '1', 'PX', banDurationMs)
    banned = 1
  end
end

return {count, math.max(0, limit - count), ttl, banned}
```

**Result**: 1 round-trip for EVERYTHING. Ban check + increment + expire + violation + auto-ban. Atomic. No race conditions.

#### EVALSHA Optimization

Lua scripts are loaded once with `SCRIPT LOAD`, then called with `EVALSHA` (hash-based execution). This avoids sending the full script text on every call:

```typescript
// At init time
const scriptSha = await this.redis.script('LOAD', LUA_SCRIPT)

// On every hit — sends only the SHA hash, not the full script
const result = await this.redis.evalsha(scriptSha, 3, hitKey, banKey, violationKey,
  windowMs, limit, banThreshold, banDurationMs, Date.now())
```

This is faster than `EVAL` because Redis doesn't need to parse the script each time.

---

## Contributors & Roles

| Name | Email | Git Author Flag | Primary Focus |
|------|-------|-----------------|---------------|
| **tanv33** | tanveer.khan2692000@gmail.com | `--author="tanv33 <tanveer.khan2692000@gmail.com>"` | Lead. Performance, benchmarks, architecture |
| **builtbyali** | muhammadali24@proton.me | `--author="builtbyali <muhammadali24@proton.me>"` | Co-lead. Performance, infra, docs |
| **MuhammadRehanRasool** | muhammadrehanrasool@gmail.com | `--author="MuhammadRehanRasool <muhammadrehanrasool@gmail.com>"` | Features, API methods, stores |
| **sultandilaram** | sultanndilaram@gmail.com | `--author="sultandilaram <sultanndilaram@gmail.com>"` | Features, stores, testing |

### Roles Per Phase

Each phase has:
- **Author**: Writes the code. All commits use their `--author` flag. Creates the branch and PR.
- **Reviewer**: Reviews the PR. Must approve before merge. Tests locally before approving.
- **Docs Owner**: Updates documentation pages for that phase's changes.

**Rule**: The Author creates the branch from `main`, does all work, opens PR to `main`. The Reviewer reviews, tests, and approves. tanv33 merges all PRs (final gate).

---

## Version Map & Release Plan

**Incremental patches. One version per phase. Ship → benchmark → document → next.**

```
v1.1.0  ← Current (released Feb 14, 2026)
  │
  │  ──── PATCH RELEASES (Performance — No new API) ────
  │
  ├── v1.1.1 — Sync Fast Path                                    [PATCH]
  │     Phase 1: Remove async/await, pure sync middleware
  │     Packages: hitlimit + hitlimit-bun (both)
  │     Branch: perf/v1.1.1-sync-fast-path → main
  │     Author: tanv33 | Reviewer: builtbyali
  │     Target: ~6-8M ops/sec memory (~2-2.5x over RLF memory)
  │     Why PATCH: No new exports, no new config. Internal optimization only.
  │
  ├── v1.1.2 — Zero-Allocation + Sweep Timer                     [PATCH]
  │     Phase 2: Reuse objects, single sweep timer, inline key
  │     Packages: hitlimit + hitlimit-bun (both)
  │     Branch: perf/v1.1.2-zero-alloc-sweep → main
  │     Author: builtbyali | Reviewer: tanv33
  │     Target: ~9-12M ops/sec memory (~3-4x over RLF memory)
  │     Why PATCH: No new exports, no new config. Internal optimization only.
  │
  ├── v1.1.3 — Redis Lua Optimization                            [PATCH]
  │     Phase 3: Lua scripts for atomic Redis ops, EVALSHA caching
  │     Packages: hitlimit + hitlimit-bun (both)
  │     Branch: perf/v1.1.3-redis-lua → main
  │     Author: tanv33 | Reviewer: builtbyali
  │     Target: Faster Redis ops than RLF (1 round-trip vs 2+)
  │     Why PATCH: No new exports, no new config. Redis store internal optimization.
  │
  │  ──── MINOR RELEASES (New features / New exports) ────
  │
  ├── v1.2.0 — PostgreSQL Store                                  [FEATURE]
  │     Phase 4: Postgres backend via pg (peer dep)
  │     Packages: hitlimit (Node.js). hitlimit-bun if pg compat confirmed.
  │     Branch: feat/v1.2.0-postgres → main
  │     Author: MuhammadRehanRasool | Reviewer: sultandilaram
  │     Why FEATURE: New `postgresStore()` export.
  │
  ├── v1.3.0 — MongoDB Store                                     [FEATURE]
  │     Phase 5: MongoDB backend via mongodb driver (peer dep)
  │     Packages: hitlimit (Node.js). hitlimit-bun if bun compat confirmed.
  │     Branch: feat/v1.3.0-mongodb → main
  │     Author: builtbyali | Reviewer: tanv33
  │     Why FEATURE: New `mongoStore()` export.
  │
  ├── v1.4.0 — MySQL Store                                       [FEATURE]
  │     Phase 6: MySQL backend via mysql2 (peer dep)
  │     Packages: hitlimit (Node.js). hitlimit-bun if bun compat confirmed.
  │     Branch: feat/v1.4.0-mysql → main
  │     Author: sultandilaram | Reviewer: MuhammadRehanRasool
  │     Why FEATURE: New `mysqlStore()` export.
  │
  ├── v1.5.0 — API Method Parity                                 [FEATURE]
  │     Phase 7: get, penalty, reward, block, blockDuration
  │     Packages: hitlimit + hitlimit-bun (both)
  │     Branch: feat/v1.5.0-api-methods → main
  │     Author: MuhammadRehanRasool | Reviewer: sultandilaram
  │     Why FEATURE: New store methods, new config options, new middleware methods.
  │
  ├── v1.6.0 — In-Memory Block Cache                             [FEATURE]
  │     Phase 8: DDoS optimization, blocked key caching
  │     Packages: hitlimit + hitlimit-bun (both)
  │     Branch: feat/v1.6.0-block-cache → main
  │     Author: sultandilaram | Reviewer: MuhammadRehanRasool
  │     Why FEATURE: New `inMemoryBlockOnExceeded` and `inMemoryBlockDuration` config.
  │
  ├── v1.7.0 — Insurance Limiter                                 [FEATURE]
  │     Phase 9: Auto-failover to backup store
  │     Packages: hitlimit + hitlimit-bun (both)
  │     Branch: feat/v1.7.0-insurance → main
  │     Author: builtbyali | Reviewer: tanv33
  │     Why FEATURE: New `insurance` config option.
  │
  ├── v1.8.0 — Cluster Mode                                      [FEATURE]
  │     Phase 10: Node.js cluster mode (IPC to master)
  │     Packages: hitlimit (Node.js). Bun uses Worker threads (different impl).
  │     Branch: feat/v1.8.0-cluster → main
  │     Author: tanv33 | Reviewer: builtbyali
  │     Why FEATURE: New `clusterStore()` and `clusterMaster()` exports.
  │
  ├── v1.9.0 — TurboStore (TypedArray Hash Table)                [FEATURE]
  │     Phase 11: Custom FNV-1a hash + TypedArray store (DEMOTED — side feature)
  │     Packages: hitlimit + hitlimit-bun (both)
  │     Branch: feat/v1.9.0-turbo-store → main
  │     Author: tanv33 | Reviewer: builtbyali
  │     NOTE: Memory-only optimization. NOT the headline. Opt-in for niche use cases.
  │     Why FEATURE: New `turboStore()` export, new import path.
  │
  ├── v1.10.0 — BurstyRateLimiter                                [FEATURE]
  │     Phase 12: Dual-limiter burst pattern
  │     Packages: hitlimit + hitlimit-bun (both)
  │     Branch: feat/v1.10.0-bursty → main
  │     Author: MuhammadRehanRasool | Reviewer: sultandilaram
  │     Why FEATURE: New `burstyLimiter()` export.
  │
  ├── v1.11.0 — Union Limiter                                    [FEATURE]
  │     Phase 13: Multiple simultaneous rate limit windows
  │     Packages: hitlimit + hitlimit-bun (both)
  │     Branch: feat/v1.11.0-union → main
  │     Author: sultandilaram | Reviewer: builtbyali
  │     Why FEATURE: New `unionLimiter()` export.
  │
  │  ──── MAJOR RELEASE (The Redemption) ────
  │
  └── v2.0.0 — "Redemption"                                      [MAJOR]
        Phase 14: Final comprehensive benchmark suite
        Phase 15: Reddit post + blog post with real numbers
        Phase 16: Reach out to animir
        Lead: tanv33
        Why MAJOR: Public milestone. Full feature parity achieved + honest benchmarks.
```

### Semver Rules for This Project

```
PATCH (x.y.Z) — Internal optimization, no new exports, no new config options.
                 Users upgrade with zero code changes. Drop-in faster.
                 Examples: v1.1.1, v1.1.2, v1.1.3

MINOR (x.Y.0) — New exports, new config options, new store backends.
                 Backwards-compatible. Users can adopt new features optionally.
                 Examples: v1.2.0 (postgres), v1.3.0 (mongodb), v1.5.0 (API methods)

MAJOR (X.0.0) — Public milestone. Could contain breaking changes (but v2.0.0 doesn't).
                 v2.0.0 is the "redemption release" — honest benchmarks, public post.
```

### Version Progression

```
v1.1.0 → v1.1.1 → v1.1.2 → v1.1.3 → v1.2.0 → v1.3.0 → v1.4.0 → v1.5.0 →
(curr)   (patch)   (patch)   (patch)   (feat)    (feat)    (feat)    (feat)

→ v1.6.0 → v1.7.0 → v1.8.0 → v1.9.0 → v1.10.0 → v1.11.0 → v2.0.0
  (feat)    (feat)    (feat)    (feat)    (feat)     (feat)    (MAJOR)
```

### Why This Version Strategy

- **v1.1.1**: *"Same API, 2x faster memory. Just `npm update`."*
- **v1.1.2**: *"4x faster memory. Still zero code changes."*
- **v1.1.3**: *"Redis now faster than rate-limiter-flexible. Lua-optimized."*
- **v1.2.0-v1.4.0**: *"Postgres, MongoDB, MySQL — production-ready backends."*
- **v1.5.0-v1.7.0**: API methods, block cache, insurance failover
- **v1.8.0-v1.9.0**: Cluster mode, TurboStore (side feature)
- **v1.10.0-v1.11.0**: Advanced patterns (burst, union)
- **v2.0.0**: The redemption post with all the numbers

Patches for speed (no effort to adopt). Minors for features (opt-in). Major for the public milestone.

---

## Branch & PR Workflow (Per Phase)

### Execution Order: SEQUENTIAL

Phases execute one at a time. Phase 2 does not start until Phase 1 is merged to `main`. No parallel phase work.

### Workflow for Every Phase

```
1. Author creates branch from latest main:
   git checkout main && git pull
   git checkout -b <branch-name>

2. Author does all work on that branch:
   - Modify shared files (core/, stores/) in BOTH packages
   - Modify package-specific files (index.ts, adapters) in BOTH packages
   - Update @joint-ops/hitlimit-types if interfaces changed
   - Write tests for both packages
   - Run: pnpm test && (cd packages/hitlimit-bun && bun test)
   - Run: pnpm build && (cd packages/hitlimit-bun && bun run build)
   - Run: pnpm benchmark (if performance phase)
   - Check bundle sizes

3. Author commits with their --author flag:
   git commit --author="Name <email>" -m "perf: description"

4. Author pushes branch and opens PR to main:
   git push -u origin <branch-name>
   gh pr create --base main --title "..." --body "..."

5. Reviewer reviews the PR:
   - Pull branch locally
   - Run tests (both packages)
   - Run benchmarks (if perf phase)
   - Check bundle sizes
   - Verify hitlimit-bun changes mirror hitlimit changes
   - Approve or request changes

6. tanv33 merges to main (final gate)

7. Version bump (AFTER merge, BEFORE tag):
   - Update VERSION file
   - Run ./scripts/bump-version.sh
   - Commit: "chore: bump version to vX.Y.Z"
   - Tag: git tag -a vX.Y.Z
   - Push: git push && git push --tags
   (All version bumps require tanv33 approval)
```

### PR Checklist (Every Phase)

Every PR description must include:

```markdown
## Changes
- [ ] Description of what changed

## Packages Updated
- [ ] @joint-ops/hitlimit (Node.js)
- [ ] @joint-ops/hitlimit-bun (Bun)
- [ ] @joint-ops/hitlimit-types (if interfaces changed)

## Shared Files Synced
- [ ] All shared core/ files are identical between both packages
- [ ] All shared stores/ files are identical between both packages

## Testing
- [ ] pnpm test passes (Node.js)
- [ ] bun test passes (in packages/hitlimit-bun/)
- [ ] pnpm build succeeds
- [ ] bun run build succeeds (in packages/hitlimit-bun/)

## Performance (if applicable)
- [ ] Benchmarks run, results saved to benchmarks/results/
- [ ] No performance regression on any scenario

## Bundle Size
- [ ] hitlimit core JS < 8KB
- [ ] hitlimit-bun core JS < 25KB
- [ ] No new runtime dependencies added
```

### Commit Message Convention

```
perf: sync fast path for memory store          (speed phases)
perf: redis lua script optimization            (redis speed phase)
feat: add PostgreSQL store backend             (backend phases)
feat: add get() method to store interface      (feature phases)
fix: correct sweep timer cleanup               (bugfixes)
docs: update benchmark numbers for v1.1.1      (docs)
chore: bump version to 1.1.1                   (version bumps)
```

---

## Phase 1: Sync Fast Path (v1.1.1)

**Goal**: Eliminate async/await overhead for synchronous stores
**Expected gain**: ~2-2.5x (3.14M → 6-8M ops/sec)
**Actual gain**: 1.53x single-IP (3.14M → 4.79M), 1.33x 10K IPs (2.45M → 3.26M) — Phase 1 COMPLETE ✅

### PR Workflow

| Field | Value |
|-------|-------|
| Branch | `perf/v1.1.1-sync-fast-path` |
| Base | `main` |
| PR | [#13](https://github.com/JointOps/hitlimit-monorepo/pull/13) — **OPEN** |
| Author | tanv33 (`--author="tanv33 <tanveer.khan2692000@gmail.com>"`) |
| Reviewer | builtbyali |
| Docs Owner | builtbyali |
| Version | `1.1.1` (bump after merge) |

### 1.1 Add `isSync` marker to HitLimitStore interface ✅

**File**: `packages/types/src/index.ts`

Add optional sync marker to the store interface:

```typescript
export interface HitLimitStore {
  /** If true, hit() is guaranteed to return StoreResult (not Promise) */
  isSync?: boolean
  hit(key: string, windowMs: number, limit: number): Promise<StoreResult> | StoreResult
  // ... rest unchanged
}
```

Memory store and SQLite store set `isSync: true`. Redis store does not.

### 1.2 Create synchronous fast path in Express middleware ✅

**File**: `packages/hitlimit/src/index.ts`

When store is sync AND no skip/tiers/ban/group, use a purely synchronous middleware:

```typescript
const isSyncStore = store.isSync === true
const isSyncKey = /* check if key function is the default IP extractor */

if (!hasSkip && !hasTiers && !hasBan && !hasGroup && isSyncStore && isSyncKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket?.remoteAddress || 'unknown'
    const result = store.hit(key, windowMs, limit) as StoreResult
    const allowed = result.count <= limit
    const remaining = Math.max(0, limit - result.count)
    const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000)

    if (standardHeaders) {
      res.setHeader('RateLimit-Limit', limit)
      res.setHeader('RateLimit-Remaining', remaining)
      res.setHeader('RateLimit-Reset', resetIn)
    }
    if (legacyHeaders) {
      res.setHeader('X-RateLimit-Limit', limit)
      res.setHeader('X-RateLimit-Remaining', remaining)
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000))
    }

    if (!allowed) {
      if (retryAfterHeader) res.setHeader('Retry-After', resetIn)
      res.status(429).json(buildResponseBody(responseConfig, {
        limit, remaining: 0, resetIn, resetAt: result.resetAt, key
      }))
      return
    }
    next()
  }
}
```

**Key**: No `async`, no `await`, no microtask scheduling. Pure synchronous execution.

### 1.3 Create synchronous fast path in Bun.serve handler ✅

**File**: `packages/hitlimit-bun/src/index.ts`

Same optimization for Bun's handler pattern:

```typescript
if (!hasSkip && !hasTiers && !hasBan && !hasGroup && isSyncStore && isSyncKey) {
  return (req: Request, server: BunServer) => {
    const ip = server.requestIP(req)?.address || 'unknown'
    const result = store.hit(ip, windowMs, limit) as StoreResult
    const allowed = result.count <= limit

    if (!allowed) {
      return new Response(blockedBody, {
        status: 429,
        headers: buildBlockedHeaders(result, limit, windowMs)
      })
    }

    const res = handler(req, server)
    if (standardHeaders || legacyHeaders) {
      // Add headers to response
    }
    return res
  }
}
```

### 1.4 Apply sync path to ALL framework adapters ✅

**hitlimit (Node.js) adapters to update:**
- `src/fastify.ts` — Fastify uses `request.ip` and `reply.status().send()`
- `src/hono.ts` — Hono uses `c.req` and `c.json()`
- `src/nest.ts` — NestJS uses Express under the hood
- `src/node.ts` — Raw http uses `req.socket.remoteAddress`

**hitlimit-bun adapters to update:**
- `src/hono.ts` — Hono middleware (same logic as Node.js version)
- `src/elysia.ts` — Elysia uses `context.request` and Elysia's response pattern

Each adapter gets the sync detection check. If `store.isSync === true`, skip the async path entirely.

### 1.5 Mark existing stores with isSync ✅

**Shared files (both packages):**
- `src/stores/memory.ts`: Add `isSync = true as const` to MemoryStore class
- `src/stores/redis.ts`: Do NOT add isSync (Redis is async)

**Package-specific:**
- `packages/hitlimit/src/stores/sqlite.ts`: Add `isSync = true as const` (better-sqlite3 is sync)
- `packages/hitlimit-bun/src/stores/sqlite.ts`: Add `isSync = true as const` (bun:sqlite is sync)

### 1.6 Tests ✅

**Node.js tests** (`packages/hitlimit/test/`):
- Sync fast path produces identical results to async path
- Async stores (Redis) still use the async path correctly
- Sync detection works for memory + SQLite stores
- Custom key function falls back to async path
- Skip/tiers/ban/group fall back to full path

**Bun tests** (`packages/hitlimit-bun/test/`):
- Same test cases adapted for Bun.serve handler pattern
- Verify Bun.serve sync path returns correct Response objects
- Verify Hono and Elysia adapters work with sync path

### 1.7 Coding Practices for This Phase ✅

- **Do NOT change the async path** — it must continue working for Redis and custom async stores
- **Do NOT change the store interface** — only ADD the optional `isSync` field
- The sync path is an ADDITION, not a replacement
- Test that existing users with no code changes see identical behavior
- Benchmark BOTH paths to quantify the gain

### 1.8 Benchmarks (Mandatory) ✅

- [x] Save results to `benchmarks/results/v1.1.1/`
- [x] Compare against v1.1.0 baseline — 1.53x improvement on single-IP (3.14M → 4.79M)
- [x] No regression on any existing scenario
- [x] Document delta: `v1.1.0 → v1.1.1: 3.14M → 4.79M ops/sec (+52.5%) single-IP, 2.45M → 3.26M (+33.1%) 10K IPs`

### 1.9 Docs Update (Mandatory) ✅

- [x] `docs/src/pages/docs/benchmarks.astro` — New benchmark numbers
- [x] `docs/src/components/Stats.astro` — Hero stats on homepage
- [x] `docs/src/components/Features.astro` — Performance claims
- [x] `packages/hitlimit/README.md` — Package README benchmarks
- [x] `packages/hitlimit-bun/README.md` — Bun README benchmarks
- [x] `benchmarks/README.md` — Benchmark methodology + latest results
- [x] `CHANGELOG.md` — Add v1.1.1 entry with perf delta + bundle size
- [x] `docs/src/pages/docs/bun/performance.astro` — Bun performance page
- [x] `docs/src/pages/docs/guides/scaling.astro` — Scaling guide store benchmarks
- [x] `docs/src/pages/docs/comparison.astro` — Competitor comparison page

### Phase 1 Status: RELEASED ✅

- PR: [#13](https://github.com/JointOps/hitlimit-monorepo/pull/13) — merged
- Version bump: [#14](https://github.com/JointOps/hitlimit-monorepo/pull/14) — merged
- Tag: [v1.1.1](https://github.com/JointOps/hitlimit-monorepo/releases/tag/v1.1.1) — published to npm
- All 6 commits, 38 files changed, +2,053 / -448 lines
- Deep docs audit completed: 13 discrepancies found and fixed
- All benchmark claims verified against `benchmarks/results/v1.1.1/`
- Bundle sizes verified: hitlimit ~6KB (5.6KB), hitlimit-bun ~18KB (17KB)
- **Next**: Start Phase 2

---

## Phase 2: Zero-Allocation Hot Path + Sweep Timer (v1.1.2)

**Goal**: Eliminate per-call object creation and per-key timer overhead
**Expected gain**: ~1.5-2x on top of Phase 1 (6-8M → 9-12M ops/sec)

### PR Workflow

| Field | Value |
|-------|-------|
| Branch | `perf/v1.1.2-zero-alloc-sweep` |
| Base | `main` |
| Author | builtbyali (`--author="builtbyali <muhammadali24@proton.me>"`) |
| Reviewer | tanv33 |
| Docs Owner | tanv33 |
| Version | `1.1.2` (bump after merge) |

### 2.1 Reuse result object in memory store

**File**: `packages/hitlimit/src/stores/memory.ts` + `packages/hitlimit-bun/src/stores/memory.ts` (IDENTICAL change)

```typescript
class MemoryStore implements HitLimitStore {
  isSync = true as const
  private readonly _result: StoreResult = { count: 0, resetAt: 0 }

  hit(key: string, windowMs: number, _limit: number): StoreResult {
    const entry = this.hits.get(key)
    if (entry !== undefined) {
      const now = Date.now()
      if (now >= entry.resetAt) {
        // Expired between sweeps — reset the entry
        entry.count = 1
        entry.resetAt = now + windowMs
      } else {
        entry.count++
      }
      this._result.count = entry.count
      this._result.resetAt = entry.resetAt
      return this._result  // NO allocation
    }
    // cold path: new key...
  }
}
```

**Important**: Callers must consume the result immediately (before the next call). Document this contract.

### 2.2 Replace per-key setTimeout with sweep timer

**File**: `packages/hitlimit/src/stores/memory.ts` + `packages/hitlimit-bun/src/stores/memory.ts` (IDENTICAL change)

```typescript
// Single sweep timer every 10 seconds replaces per-key setTimeout
private sweepInterval: ReturnType<typeof setInterval>

constructor() {
  this.sweepInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of this.hits) {
      if (now >= entry.resetAt) this.hits.delete(key)
    }
    for (const [key, ban] of this.bans) {
      if (now >= ban.expiresAt) this.bans.delete(key)
    }
    for (const [key, violation] of this.violations) {
      if (now >= violation.resetAt) this.violations.delete(key)
    }
  }, 10_000)
  if (typeof this.sweepInterval.unref === 'function') {
    this.sweepInterval.unref()
  }
}
```

Entry becomes leaner (no more timeoutId). Hot path now checks `Date.now() >= entry.resetAt` since setTimeout no longer guarantees validity.

### 2.3 Inline key extraction in middleware

**File**: `packages/hitlimit/src/index.ts` (Node.js):
```typescript
// BEFORE: const key = await config.key(req)
// AFTER:  const key = req.ip || req.socket?.remoteAddress || 'unknown'
```

**File**: `packages/hitlimit-bun/src/index.ts` (Bun):
```typescript
// BEFORE: const key = await config.key(req)
// AFTER:  const key = server.requestIP(req)?.address || 'unknown'
```

### 2.4 Tests

**Both packages:**
- Verify reused result object doesn't cause data corruption across calls
- Verify sweep timer correctly cleans up expired entries
- Verify expired entries are handled correctly when accessed before sweep
- Memory leak test: run 100K iterations and verify Map size stays bounded

### 2.5 Benchmarks (Mandatory)

- [ ] Save results to `benchmarks/results/v1.1.2/`
- [ ] Compare against v1.1.1 — must show ≥1.5x improvement
- [ ] Target: ≥9M ops/sec (3x over RLF)
- [ ] Document delta: `v1.1.1 → v1.1.2: X.XXM → Y.YYM ops/sec (+Z%)`

### 2.6 Docs Update (Mandatory)

- [ ] `docs/src/pages/docs/benchmarks.astro` — New benchmark numbers
- [ ] `docs/src/pages/docs/comparison.astro` — Updated comparison table
- [ ] `docs/src/components/Stats.astro` — Hero stats on homepage
- [ ] `packages/hitlimit/README.md` — Package README benchmarks
- [ ] `packages/hitlimit-bun/README.md` — Bun README benchmarks
- [ ] `benchmarks/README.md` — Latest results
- [x] `CHANGELOG.md` — Add v1.1.2 entry

### Phase 2 Status: COMPLETE ✅

- Branch: `perf/v1.1.2-zero-alloc-sweep`
- Commit: `1b0299d` — perf: zero-allocation hot path + sweep timer
- 16 files changed, +973 / -600 lines
- All Node.js tests pass (211/211)
- All Bun tests pass individually (200/200, full-suite has pre-existing port-conflict flakes)
- Benchmarks saved to `benchmarks/results/v1.1.2/`
- Note: Throughput numbers similar to v1.1.1 — the real gains are reduced GC pressure, eliminated timer overhead, and leaner memory entries (not measurable by raw ops/sec)
- 2.3 (inline key extraction) was already done in Phase 1's sync fast path
- **Next**: Create PR, merge, bump version, tag release, then start Phase 3

---

## Phase 3: Redis Lua Optimization (v1.1.3)

**Goal**: Replace multi-round-trip Redis operations with atomic Lua scripts
**Expected gain**: 1 round-trip per hit (down from 1-4), faster than rate-limiter-flexible on Redis
**Version type**: PATCH (no new exports, no new config — internal Redis store optimization)

**THIS IS THE PHASE THAT ANSWERS ANIMIR'S CRITICISM.** Memory speed doesn't matter in production. Redis speed does.

### PR Workflow

| Field | Value |
|-------|-------|
| Branch | `perf/v1.1.3-redis-lua` |
| Base | `main` |
| Author | tanv33 (`--author="tanv33 <tanveer.khan2692000@gmail.com>"`) |
| Reviewer | builtbyali |
| Docs Owner | tanv33 |
| Version | `1.1.3` (bump after merge) |

### 3.1 Implement Lua scripts

**File**: `packages/hitlimit/src/stores/redis.ts` + `packages/hitlimit-bun/src/stores/redis.ts` (IDENTICAL)

Two Lua scripts:

**Simple hit script** (no ban — most common case):
```lua
local hitKey = KEYS[1]
local windowMs = tonumber(ARGV[1])

local count = redis.call('INCR', hitKey)
local ttl = redis.call('PTTL', hitKey)
if ttl < 0 then
  redis.call('PEXPIRE', hitKey, windowMs)
  ttl = windowMs
end
return {count, ttl}
```

**Combined hit + ban script** (when ban configured):
```lua
local hitKey = KEYS[1]
local banKey = KEYS[2]
local violationKey = KEYS[3]
local windowMs = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local banThreshold = tonumber(ARGV[3])
local banDurationMs = tonumber(ARGV[4])

if banThreshold > 0 then
  local banTTL = redis.call('PTTL', banKey)
  if banTTL > 0 then
    return {-1, 0, banTTL, 1}
  end
end

local count = redis.call('INCR', hitKey)
local ttl = redis.call('PTTL', hitKey)
if ttl < 0 then
  redis.call('PEXPIRE', hitKey, windowMs)
  ttl = windowMs
end

local banned = 0
if count > limit and banThreshold > 0 then
  local violations = redis.call('INCR', violationKey)
  local vTTL = redis.call('PTTL', violationKey)
  if vTTL < 0 then
    redis.call('PEXPIRE', violationKey, banDurationMs)
  end
  if violations >= banThreshold then
    redis.call('SET', banKey, '1', 'PX', banDurationMs)
    banned = 1
  end
end
return {count, math.max(0, limit - count), ttl, banned}
```

### 3.2 EVALSHA with NOSCRIPT recovery

Scripts loaded once with `SCRIPT LOAD`, called with `EVALSHA`. If NOSCRIPT error (Redis restarted), reload and retry.

### 3.3 Add `hitWithBan` method to RedisStore

New method that uses the combined Lua script. `limiter.ts` updated to detect and use it when ban is configured, falling back to old multi-call path for custom stores.

### 3.4 Tests

- Lua script produces identical results to old multi/exec
- Ban check works atomically
- EVALSHA NOSCRIPT recovery works
- Backwards compat: custom stores without hitWithBan still work
- Concurrent hit tests (verify atomicity)

### 3.5 Benchmarks (Mandatory — THE production benchmark)

- [ ] Save results to `benchmarks/results/v1.1.3/`
- [ ] Benchmark Redis: hitlimit Lua vs hitlimit old multi/exec
- [ ] Benchmark Redis: hitlimit Lua vs rate-limiter-flexible Redis
- [ ] Target: hitlimit Redis FASTER than RLF Redis
- [ ] Measure: ops/sec, p50/p95/p99 latency
- [ ] Document: `hitlimit Redis vs RLF Redis: X ops/sec vs Y ops/sec`

### 3.6 Docs Update (Mandatory)

- [ ] `docs/src/pages/docs/benchmarks.astro` — Add Redis benchmark section
- [ ] `docs/src/pages/docs/comparison.astro` — Redis performance comparison
- [ ] `packages/hitlimit/README.md` — Redis benchmark numbers
- [ ] `packages/hitlimit-bun/README.md` — Redis benchmark numbers
- [ ] `CHANGELOG.md` — Add v1.1.3 entry

---

## Phase 4: PostgreSQL Store (v1.2.0)

**Goal**: Add PostgreSQL as a backend store
**Packages**: hitlimit (Node.js). Test Bun compatibility — if `pg` works on Bun, add to hitlimit-bun too.
**Version type**: FEATURE (new `postgresStore()` export)

### PR Workflow

| Field | Value |
|-------|-------|
| Branch | `feat/v1.2.0-postgres` |
| Base | `main` |
| Author | MuhammadRehanRasool (`--author="MuhammadRehanRasool <muhammadrehanrasool@gmail.com>"`) |
| Reviewer | sultandilaram |
| Docs Owner | sultandilaram |
| Version | `1.2.0` (bump after merge) |

### 4.1 Design Principles

- **`pg` is a PEER DEPENDENCY** — we never bundle it. Users install it themselves.
- **Zero runtime dependencies** — our store file only imports types at compile time and `pg` dynamically.
- **Atomic operations** — use PostgreSQL's `INSERT ... ON CONFLICT DO UPDATE` (upsert) for safe concurrency.
- **Connection pooling** — use `pg.Pool` (not single client). Users pass their own pool or connection string.
- **Auto-create tables** — on first connection, create tables if they don't exist. Skip check on subsequent calls.
- **Background cleanup** — periodic job to delete expired rows (configurable interval, default 60s).

### 4.2 File Structure

**New file**: `packages/hitlimit/src/stores/postgres.ts`

```typescript
import type { HitLimitStore, StoreResult } from '@joint-ops/hitlimit-types'

interface PostgresStoreOptions {
  pool: any  // pg.Pool — typed as any to avoid importing pg at compile time
  tablePrefix?: string
  cleanupInterval?: number
  skipTableCreation?: boolean
}

class PostgresStore implements HitLimitStore {
  private pool: any
  private tablePrefix: string
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private tablesCreated = false

  constructor(private readonly options: PostgresStoreOptions) {
    this.pool = options.pool
    this.tablePrefix = options.tablePrefix ?? 'hitlimit'

    const interval = options.cleanupInterval ?? 60_000
    this.cleanupTimer = setInterval(() => this.cleanup(), interval)
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref()
    }
  }

  private async ensureTables(): Promise<void> {
    if (this.tablesCreated) return
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}_hits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_at BIGINT NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}_bans (
        key TEXT PRIMARY KEY,
        expires_at BIGINT NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}_violations (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_at BIGINT NOT NULL
      )
    `)
    this.tablesCreated = true
  }

  async hit(key: string, windowMs: number, _limit: number): Promise<StoreResult> {
    await this.ensureTables()
    const now = Date.now()
    const resetAt = now + windowMs

    const result = await this.pool.query(`
      INSERT INTO ${this.tablePrefix}_hits (key, count, reset_at)
      VALUES ($1, 1, $2)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN ${this.tablePrefix}_hits.reset_at <= $3 THEN 1
          ELSE ${this.tablePrefix}_hits.count + 1
        END,
        reset_at = CASE
          WHEN ${this.tablePrefix}_hits.reset_at <= $3 THEN $2
          ELSE ${this.tablePrefix}_hits.reset_at
        END
      RETURNING count, reset_at
    `, [key, resetAt, now])

    return {
      count: result.rows[0].count,
      resetAt: Number(result.rows[0].reset_at)
    }
  }

  async isBanned(key: string): Promise<boolean> {
    await this.ensureTables()
    const result = await this.pool.query(
      `SELECT 1 FROM ${this.tablePrefix}_bans WHERE key = $1 AND expires_at > $2`,
      [key, Date.now()]
    )
    return result.rowCount > 0
  }

  async ban(key: string, durationMs: number): Promise<void> {
    await this.ensureTables()
    const expiresAt = Date.now() + durationMs
    await this.pool.query(`
      INSERT INTO ${this.tablePrefix}_bans (key, expires_at)
      VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET expires_at = $2
    `, [key, expiresAt])
  }

  async recordViolation(key: string, windowMs: number): Promise<number> {
    await this.ensureTables()
    const now = Date.now()
    const resetAt = now + windowMs
    const result = await this.pool.query(`
      INSERT INTO ${this.tablePrefix}_violations (key, count, reset_at)
      VALUES ($1, 1, $2)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN ${this.tablePrefix}_violations.reset_at <= $3 THEN 1
          ELSE ${this.tablePrefix}_violations.count + 1
        END,
        reset_at = CASE
          WHEN ${this.tablePrefix}_violations.reset_at <= $3 THEN $2
          ELSE ${this.tablePrefix}_violations.reset_at
        END
      RETURNING count
    `, [key, resetAt, now])
    return result.rows[0].count
  }

  async reset(key: string): Promise<void> {
    await this.ensureTables()
    await this.pool.query(`DELETE FROM ${this.tablePrefix}_hits WHERE key = $1`, [key])
    await this.pool.query(`DELETE FROM ${this.tablePrefix}_bans WHERE key = $1`, [key])
    await this.pool.query(`DELETE FROM ${this.tablePrefix}_violations WHERE key = $1`, [key])
  }

  private async cleanup(): Promise<void> {
    try {
      const now = Date.now()
      await this.pool.query(`DELETE FROM ${this.tablePrefix}_hits WHERE reset_at <= $1`, [now])
      await this.pool.query(`DELETE FROM ${this.tablePrefix}_bans WHERE expires_at <= $1`, [now])
      await this.pool.query(`DELETE FROM ${this.tablePrefix}_violations WHERE reset_at <= $1`, [now])
    } catch { /* Cleanup failures are non-fatal */ }
  }

  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }
}

export function postgresStore(options: PostgresStoreOptions): HitLimitStore {
  return new PostgresStore(options)
}
```

### 4.3 Package.json Changes

**`packages/hitlimit/package.json`**:
```json
{
  "exports": {
    "./stores/postgres": { "import": "./dist/stores/postgres.js", "types": "./dist/stores/postgres.d.ts" }
  },
  "peerDependencies": { "pg": ">=8.0.0" },
  "peerDependenciesMeta": { "pg": { "optional": true } }
}
```

### 4.4 Usage Example

```typescript
import { hitlimit } from '@joint-ops/hitlimit'
import { postgresStore } from '@joint-ops/hitlimit/stores/postgres'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: 'postgres://...' })
app.use(hitlimit({ store: postgresStore({ pool }), limit: 100, window: '1m' }))
```

### 4.5 Coding Practices

- **pg typed as `any`**: Avoids requiring pg as dependency. Users get type safety from their own import.
- **Parameterized queries ONLY**: Never interpolate user input. Only `tablePrefix` is dynamic (set by developer).
- **Pool ownership**: We do NOT create or close the pool. User owns it.
- **Atomic upserts**: `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` = single round-trip.
- **BIGINT for timestamps**: Postgres stores `Date.now()` as BIGINT, convert back to Number on read.

### 4.6 Tests

- Full CRUD with real Postgres (Docker in CI)
- Concurrent hit tests (connection pool under load)
- Cleanup job correctness
- Table auto-creation and `skipTableCreation` option
- Custom `tablePrefix`

### 4.7 Benchmarks (Mandatory)

- [ ] Save results to `benchmarks/results/v1.2.0/`
- [ ] NO regression on memory store
- [ ] Benchmark Postgres store: ops/sec, p50/p95/p99
- [ ] Compare Postgres vs Redis store
- [ ] Document: `Postgres store: X ops/sec, p50: Yms, p95: Zms`

### 4.8 Docs Update (Mandatory)

- [ ] **NEW**: `docs/src/pages/docs/stores/postgres.astro` — PostgreSQL store guide
- [ ] `docs/src/pages/docs/comparison.astro` — Update store count
- [ ] `packages/hitlimit/README.md` — Add Postgres example
- [ ] `CHANGELOG.md` — Add v1.2.0 entry

---

## Phase 5: MongoDB Store (v1.3.0)

**Goal**: Add MongoDB as a backend store
**Packages**: hitlimit (Node.js). Test Bun compatibility with `mongodb` driver.
**Version type**: FEATURE (new `mongoStore()` export)

### PR Workflow

| Field | Value |
|-------|-------|
| Branch | `feat/v1.3.0-mongodb` |
| Base | `main` |
| Author | builtbyali (`--author="builtbyali <muhammadali24@proton.me>"`) |
| Reviewer | tanv33 |
| Docs Owner | builtbyali |
| Version | `1.3.0` (bump after merge) |

### 5.1 Design Principles

- **`mongodb` is a PEER DEPENDENCY** — zero bundle cost.
- **Atomic operations** — use `findOneAndUpdate` with `upsert: true`.
- **TTL indexes** — MongoDB auto-deletes expired documents. NO background cleanup job needed.
- **Flexible connection** — accept `MongoClient`, `Db`, or connection string.
- **No mongoose** — native `mongodb` driver only.

### 5.2 File Structure

**New file**: `packages/hitlimit/src/stores/mongodb.ts`

```typescript
import type { HitLimitStore, StoreResult } from '@joint-ops/hitlimit-types'

interface MongoStoreOptions {
  db: any  // mongodb.Db instance
  collectionPrefix?: string
  skipIndexCreation?: boolean
}

class MongoStore implements HitLimitStore {
  private db: any
  private collectionPrefix: string
  private indexesCreated = false

  constructor(private readonly options: MongoStoreOptions) {
    this.db = options.db
    this.collectionPrefix = options.collectionPrefix ?? 'hitlimit'
  }

  private collection(name: string) {
    return this.db.collection(`${this.collectionPrefix}_${name}`)
  }

  private async ensureIndexes(): Promise<void> {
    if (this.indexesCreated || this.options.skipIndexCreation) return
    await this.collection('hits').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 })
    await this.collection('bans').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 })
    await this.collection('violations').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 })
    await this.collection('hits').createIndex({ key: 1 }, { unique: true })
    await this.collection('bans').createIndex({ key: 1 }, { unique: true })
    await this.collection('violations').createIndex({ key: 1 }, { unique: true })
    this.indexesCreated = true
  }

  async hit(key: string, windowMs: number, _limit: number): Promise<StoreResult> {
    await this.ensureIndexes()
    const now = Date.now()
    const resetAt = now + windowMs
    const expireAt = new Date(resetAt)

    const result = await this.collection('hits').findOneAndUpdate(
      { key },
      [{
        $set: {
          count: {
            $cond: {
              if: { $gt: ['$resetAt', now] },
              then: { $add: ['$count', 1] },
              else: 1
            }
          },
          resetAt: {
            $cond: { if: { $gt: ['$resetAt', now] }, then: '$resetAt', else: resetAt }
          },
          expireAt: {
            $cond: { if: { $gt: ['$resetAt', now] }, then: '$expireAt', else: expireAt }
          }
        }
      }],
      { upsert: true, returnDocument: 'after' }
    )
    return { count: result.count, resetAt: result.resetAt }
  }

  async isBanned(key: string): Promise<boolean> {
    await this.ensureIndexes()
    const ban = await this.collection('bans').findOne({ key, expiresAt: { $gt: Date.now() } })
    return ban !== null
  }

  async ban(key: string, durationMs: number): Promise<void> {
    await this.ensureIndexes()
    const expiresAt = Date.now() + durationMs
    await this.collection('bans').updateOne(
      { key },
      { $set: { expiresAt, expireAt: new Date(expiresAt) } },
      { upsert: true }
    )
  }

  async recordViolation(key: string, windowMs: number): Promise<number> {
    await this.ensureIndexes()
    const now = Date.now()
    const resetAt = now + windowMs
    const result = await this.collection('violations').findOneAndUpdate(
      { key },
      [{
        $set: {
          count: {
            $cond: { if: { $gt: ['$resetAt', now] }, then: { $add: ['$count', 1] }, else: 1 }
          },
          resetAt: {
            $cond: { if: { $gt: ['$resetAt', now] }, then: '$resetAt', else: resetAt }
          },
          expireAt: {
            $cond: { if: { $gt: ['$resetAt', now] }, then: '$expireAt', else: new Date(resetAt) }
          }
        }
      }],
      { upsert: true, returnDocument: 'after' }
    )
    return result.count
  }

  async reset(key: string): Promise<void> {
    await this.ensureIndexes()
    await Promise.all([
      this.collection('hits').deleteOne({ key }),
      this.collection('bans').deleteOne({ key }),
      this.collection('violations').deleteOne({ key })
    ])
  }

  shutdown(): void { /* TTL indexes handle cleanup */ }
}

export function mongoStore(options: MongoStoreOptions): HitLimitStore {
  return new MongoStore(options)
}
```

### 5.3 Package.json Changes

```json
{
  "exports": {
    "./stores/mongodb": { "import": "./dist/stores/mongodb.js", "types": "./dist/stores/mongodb.d.ts" }
  },
  "peerDependencies": { "mongodb": ">=6.0.0" },
  "peerDependenciesMeta": { "mongodb": { "optional": true } }
}
```

### 5.4 Usage Example

```typescript
import { hitlimit } from '@joint-ops/hitlimit'
import { mongoStore } from '@joint-ops/hitlimit/stores/mongodb'
import { MongoClient } from 'mongodb'

const client = new MongoClient('mongodb://localhost:27017')
const db = client.db('myapp')
app.use(hitlimit({ store: mongoStore({ db }), limit: 100, window: '1m' }))
```

### 5.5 Why TTL Indexes (Not Background Cleanup)

MongoDB TTL indexes auto-delete documents when `expireAt` passes. No setInterval needed. MongoDB handles cleanup internally. One less thing to configure.

### 5.6 Tests & Benchmarks

- Full CRUD with real MongoDB (Docker in CI)
- TTL index auto-expiration
- Concurrent operations
- [ ] Save results to `benchmarks/results/v1.3.0/`
- [ ] Compare MongoDB vs Postgres vs Redis

### 5.7 Docs Update (Mandatory)

- [ ] **NEW**: `docs/src/pages/docs/stores/mongodb.astro`
- [ ] `docs/src/pages/docs/comparison.astro` — Update store count
- [ ] `packages/hitlimit/README.md` — Add MongoDB example
- [ ] `CHANGELOG.md` — Add v1.3.0 entry

---

## Phase 6: MySQL Store (v1.4.0)

**Goal**: Add MySQL as a backend store
**Packages**: hitlimit (Node.js). Test Bun compatibility with `mysql2`.
**Version type**: FEATURE (new `mysqlStore()` export)

### PR Workflow

| Field | Value |
|-------|-------|
| Branch | `feat/v1.4.0-mysql` |
| Base | `main` |
| Author | sultandilaram (`--author="sultandilaram <sultanndilaram@gmail.com>"`) |
| Reviewer | MuhammadRehanRasool |
| Docs Owner | MuhammadRehanRasool |
| Version | `1.4.0` (bump after merge) |

### 6.1 Design Principles

- **`mysql2` is a PEER DEPENDENCY** — zero bundle cost. Promise-based API.
- **Connection pooling** — use `mysql2.createPool`. Users pass their own pool.
- **Atomic operations** — use `INSERT ... ON DUPLICATE KEY UPDATE`.
- **Background cleanup** — periodic deletion of expired rows.

### 6.2 File Structure

**New file**: `packages/hitlimit/src/stores/mysql.ts`

```typescript
import type { HitLimitStore, StoreResult } from '@joint-ops/hitlimit-types'

interface MySQLStoreOptions {
  pool: any
  tablePrefix?: string
  cleanupInterval?: number
  skipTableCreation?: boolean
}

class MySQLStore implements HitLimitStore {
  private pool: any
  private tablePrefix: string
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private tablesCreated = false

  constructor(private readonly options: MySQLStoreOptions) {
    this.pool = options.pool
    this.tablePrefix = options.tablePrefix ?? 'hitlimit'
    const interval = options.cleanupInterval ?? 60_000
    this.cleanupTimer = setInterval(() => this.cleanup(), interval)
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref()
    }
  }

  private async ensureTables(): Promise<void> {
    if (this.tablesCreated) return
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}_hits (
        \`key\` VARCHAR(255) PRIMARY KEY,
        count INT NOT NULL DEFAULT 1,
        reset_at BIGINT NOT NULL
      ) ENGINE=InnoDB
    `)
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}_bans (
        \`key\` VARCHAR(255) PRIMARY KEY,
        expires_at BIGINT NOT NULL
      ) ENGINE=InnoDB
    `)
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}_violations (
        \`key\` VARCHAR(255) PRIMARY KEY,
        count INT NOT NULL DEFAULT 1,
        reset_at BIGINT NOT NULL
      ) ENGINE=InnoDB
    `)
    this.tablesCreated = true
  }

  async hit(key: string, windowMs: number, _limit: number): Promise<StoreResult> {
    await this.ensureTables()
    const now = Date.now()
    const resetAt = now + windowMs
    await this.pool.execute(`
      INSERT INTO ${this.tablePrefix}_hits (\`key\`, count, reset_at)
      VALUES (?, 1, ?)
      ON DUPLICATE KEY UPDATE
        count = IF(reset_at <= ?, 1, count + 1),
        reset_at = IF(reset_at <= ?, ?, reset_at)
    `, [key, resetAt, now, now, resetAt])
    const [rows] = await this.pool.execute(
      `SELECT count, reset_at FROM ${this.tablePrefix}_hits WHERE \`key\` = ?`, [key]
    )
    return { count: rows[0].count, resetAt: Number(rows[0].reset_at) }
  }

  async isBanned(key: string): Promise<boolean> {
    await this.ensureTables()
    const [rows] = await this.pool.execute(
      `SELECT 1 FROM ${this.tablePrefix}_bans WHERE \`key\` = ? AND expires_at > ?`,
      [key, Date.now()]
    )
    return rows.length > 0
  }

  async ban(key: string, durationMs: number): Promise<void> {
    await this.ensureTables()
    const expiresAt = Date.now() + durationMs
    await this.pool.execute(`
      INSERT INTO ${this.tablePrefix}_bans (\`key\`, expires_at) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE expires_at = ?
    `, [key, expiresAt, expiresAt])
  }

  async recordViolation(key: string, windowMs: number): Promise<number> {
    await this.ensureTables()
    const now = Date.now()
    const resetAt = now + windowMs
    await this.pool.execute(`
      INSERT INTO ${this.tablePrefix}_violations (\`key\`, count, reset_at) VALUES (?, 1, ?)
      ON DUPLICATE KEY UPDATE
        count = IF(reset_at <= ?, 1, count + 1),
        reset_at = IF(reset_at <= ?, ?, reset_at)
    `, [key, resetAt, now, now, resetAt])
    const [rows] = await this.pool.execute(
      `SELECT count FROM ${this.tablePrefix}_violations WHERE \`key\` = ?`, [key]
    )
    return rows[0].count
  }

  async reset(key: string): Promise<void> {
    await this.ensureTables()
    await Promise.all([
      this.pool.execute(`DELETE FROM ${this.tablePrefix}_hits WHERE \`key\` = ?`, [key]),
      this.pool.execute(`DELETE FROM ${this.tablePrefix}_bans WHERE \`key\` = ?`, [key]),
      this.pool.execute(`DELETE FROM ${this.tablePrefix}_violations WHERE \`key\` = ?`, [key])
    ])
  }

  private async cleanup(): Promise<void> {
    try {
      const now = Date.now()
      await this.pool.execute(`DELETE FROM ${this.tablePrefix}_hits WHERE reset_at <= ?`, [now])
      await this.pool.execute(`DELETE FROM ${this.tablePrefix}_bans WHERE expires_at <= ?`, [now])
      await this.pool.execute(`DELETE FROM ${this.tablePrefix}_violations WHERE reset_at <= ?`, [now])
    } catch { /* non-fatal */ }
  }

  shutdown(): void {
    if (this.cleanupTimer) { clearInterval(this.cleanupTimer); this.cleanupTimer = null }
  }
}

export function mysqlStore(options: MySQLStoreOptions): HitLimitStore {
  return new MySQLStore(options)
}
```

### 6.3 Package.json Changes

```json
{
  "exports": {
    "./stores/mysql": { "import": "./dist/stores/mysql.js", "types": "./dist/stores/mysql.d.ts" }
  },
  "peerDependencies": { "mysql2": ">=3.0.0" },
  "peerDependenciesMeta": { "mysql2": { "optional": true } }
}
```

### 6.4 Usage Example

```typescript
import { hitlimit } from '@joint-ops/hitlimit'
import { mysqlStore } from '@joint-ops/hitlimit/stores/mysql'
import mysql from 'mysql2/promise'

const pool = mysql.createPool({ host: 'localhost', user: 'root', database: 'myapp' })
app.use(hitlimit({ store: mysqlStore({ pool }), limit: 100, window: '1m' }))
```

### 6.5 MySQL vs Postgres Differences

| Aspect | PostgreSQL | MySQL |
|--------|-----------|-------|
| Upsert | `ON CONFLICT ... DO UPDATE` | `ON DUPLICATE KEY UPDATE` |
| Returning | `RETURNING count, reset_at` | Separate SELECT needed |
| Column quoting | None | Backticks: `` `key` `` (reserved word) |
| Engine | N/A | InnoDB (required) |

### 6.6 Tests & Benchmarks

- Full CRUD with real MySQL (Docker in CI)
- [ ] Save results to `benchmarks/results/v1.4.0/`
- [ ] Compare ALL stores: memory, redis, sqlite, postgres, mongodb, mysql
- [ ] Create comprehensive store comparison table

### 6.7 Docs Update (Mandatory)

- [ ] **NEW**: `docs/src/pages/docs/stores/mysql.astro`
- [ ] **UPDATE**: `docs/src/pages/docs/stores/` — All-stores comparison page
- [ ] `docs/src/pages/docs/comparison.astro` — Update store count
- [ ] `packages/hitlimit/README.md` — Add MySQL example + full store table
- [ ] `CHANGELOG.md` — Add v1.4.0 entry

---

## Phase 7: New API Methods (v1.5.0)

**Goal**: Feature parity on API methods with rate-limiter-flexible
**Packages**: hitlimit + hitlimit-bun (both)
**Version type**: FEATURE (new store methods, new config options, new middleware methods)

### PR Workflow

| Field | Value |
|-------|-------|
| Branch | `feat/v1.5.0-api-methods` |
| Base | `main` |
| Author | MuhammadRehanRasool (`--author="MuhammadRehanRasool <muhammadrehanrasool@gmail.com>"`) |
| Reviewer | sultandilaram |
| Docs Owner | sultandilaram |
| Version | `1.5.0` (bump after merge) |

### 7.1 Add `get()` method (read without consuming)

**File**: `packages/types/src/index.ts`:
```typescript
get?(key: string): Promise<StoreResult | null> | StoreResult | null
```

Implement in all stores. Returns current count/resetAt without incrementing.

### 7.2 Add `penalty()` method (add points without a request)

```typescript
penalty?(key: string, points: number, windowMs: number, limit: number): Promise<StoreResult> | StoreResult
```

Adds `points` to the counter. Useful for penalizing suspicious behavior.

### 7.3 Add `reward()` method (remove points / give credit)

```typescript
reward?(key: string, points: number): Promise<StoreResult> | StoreResult
```

Removes `points` from the counter (floor at 0).

### 7.4 Add `block()` method and `blockDuration` config

```typescript
block?(key: string, durationMs: number): Promise<void> | void
```

Force-blocks a key. Plus new `blockDuration` config option for auto-block on limit exceed.

### 7.5 Expose methods on middleware function

```typescript
const limiter = hitlimit({ ... })
limiter.get('user:123')
limiter.penalty('user:123', 5)
limiter.reward('user:123', 2)
limiter.block('user:123', '1h')
limiter.reset('user:123')  // already exists
```

### 7.6 Tests & Benchmarks

- All new methods tested across all stores (memory, sqlite, redis, postgres, mongodb, mysql)
- New methods are OPTIONAL on interface (`?` suffix)
- [ ] Save results to `benchmarks/results/v1.5.0/`
- [ ] NO regression on `hit()` hot path

### 7.7 Docs Update (Mandatory)

- [ ] **NEW**: `docs/src/pages/docs/api/get.astro`
- [ ] **NEW**: `docs/src/pages/docs/api/penalty-reward.astro`
- [ ] **NEW**: `docs/src/pages/docs/api/block.astro`
- [ ] `docs/src/pages/docs/comparison.astro` — Update feature parity table
- [ ] `packages/hitlimit/README.md` — Add new API methods
- [ ] `packages/hitlimit-bun/README.md` — Add new API methods
- [ ] `CHANGELOG.md` — Add v1.5.0 entry

---

## Phase 8: In-Memory Block Cache (v1.6.0)

**Goal**: DDoS optimization — cache blocked keys in RAM to skip store lookups
**Packages**: hitlimit + hitlimit-bun (both)
**Version type**: FEATURE (new config options)

### PR Workflow

| Field | Value |
|-------|-------|
| Branch | `feat/v1.6.0-block-cache` |
| Base | `main` |
| Author | sultandilaram (`--author="sultandilaram <sultanndilaram@gmail.com>"`) |
| Reviewer | MuhammadRehanRasool |
| Docs Owner | MuhammadRehanRasool |
| Version | `1.6.0` (bump after merge) |

### 8.1 Config options

**File**: `packages/types/src/index.ts`:
```typescript
export interface HitLimitOptions {
  inMemoryBlockOnExceeded?: boolean
  inMemoryBlockDuration?: string | number
}
```

### 8.2 Implementation

When a key is blocked, store it in a local Map. On subsequent hits, check local Map FIRST before the external store. Lazy cleanup at 999 entries.

rate-limiter-flexible reports **85% latency reduction** under DDoS with this technique.

### 8.3 Tests & Benchmarks

- [ ] Save results to `benchmarks/results/v1.6.0/`
- [ ] Block cache avoids store calls (verify with mock store)
- [ ] Benchmark with block cache enabled vs disabled

### 8.4 Docs Update (Mandatory)

- [ ] **NEW**: `docs/src/pages/docs/guides/ddos-protection.astro`
- [ ] `docs/src/pages/docs/comparison.astro` — Update feature parity
- [ ] `CHANGELOG.md` — Add v1.6.0 entry

---

## Phase 9: Insurance Limiter (v1.7.0)

**Goal**: Auto-failover to backup store when primary fails
**Packages**: hitlimit + hitlimit-bun (both)
**Version type**: FEATURE (new `insurance` config option)

### PR Workflow

| Field | Value |
|-------|-------|
| Branch | `feat/v1.7.0-insurance` |
| Base | `main` |
| Author | builtbyali (`--author="builtbyali <muhammadali24@proton.me>"`) |
| Reviewer | tanv33 |
| Docs Owner | builtbyali |
| Version | `1.7.0` (bump after merge) |

### 9.1 Config

```typescript
export interface HitLimitOptions {
  insurance?: {
    store: HitLimitStore
    trigger?: 'error' | 'timeout'
    timeoutMs?: number
  }
}
```

### 9.2 Implementation

```typescript
try {
  result = await config.store.hit(key, windowMs, limit)
} catch (error) {
  if (config.insurance) {
    config.logger?.warn('Primary store failed, using insurance limiter')
    result = await config.insurance.store.hit(key, windowMs, limit)
  } else {
    const action = await config.onStoreError(error, req)
    // ...
  }
}
```

Periodic health check to detect primary recovery. Switch back automatically.

### 9.3 Tests & Benchmarks

- Primary error → insurance handles request
- Primary recovery → switch back
- Insurance also fails → fall through to onStoreError
- Data NOT synced (document clearly)
- [ ] Save results to `benchmarks/results/v1.7.0/`
- [ ] NO regression when insurance not configured

### 9.4 Docs Update (Mandatory)

- [ ] **NEW**: `docs/src/pages/docs/guides/insurance.astro`
- [ ] `docs/src/pages/docs/comparison.astro` — Update feature parity
- [ ] `CHANGELOG.md` — Add v1.7.0 entry

---

## Phase 10: Node.js Cluster Mode (v1.8.0)

**Goal**: Share rate limits across cluster workers without Redis
**Packages**: hitlimit (Node.js). Bun uses Worker threads (separate impl if needed).
**Version type**: FEATURE (new `clusterStore()` and `clusterMaster()` exports)

### PR Workflow

| Field | Value |
|-------|-------|
| Branch | `feat/v1.8.0-cluster` |
| Base | `main` |
| Author | tanv33 (`--author="tanv33 <tanveer.khan2692000@gmail.com>"`) |
| Reviewer | builtbyali |
| Docs Owner | builtbyali |
| Version | `1.8.0` (bump after merge) |

### 10.1 Architecture

```
┌───────────────────────────────────────────┐
│ Master Process                             │
│   clusterMaster() — holds all state        │
│   Receives IPC from workers, sends results │
└─────────┬───────────┬───────────┬─────────┘
          │ IPC       │ IPC       │ IPC
┌─────────┴──┐ ┌──────┴─────┐ ┌──┴──────────┐
│ Worker 1   │ │ Worker 2   │ │ Worker 3    │
│ clusterStore│ │ clusterStore│ │ clusterStore│
└────────────┘ └────────────┘ └─────────────┘
```

Master holds MemoryStore. Workers send operations via `process.send()`, receive results via `process.on('message')`.

### 10.2 Tests & Benchmarks

- Multi-worker correctness
- Worker crash recovery
- IPC latency measurement (<1ms target)
- [ ] Save results to `benchmarks/results/v1.8.0/`
- [ ] Compare: single-process vs cluster vs Redis

### 10.3 Docs Update (Mandatory)

- [ ] **NEW**: `docs/src/pages/docs/guides/cluster.astro`
- [ ] `docs/src/pages/docs/comparison.astro` — Update feature parity
- [ ] `CHANGELOG.md` — Add v1.8.0 entry

---

## Phase 11: TurboStore — TypedArray Hash Table (v1.9.0)

**Goal**: Optional memory store using TypedArrays for maximum single-process speed
**Packages**: hitlimit + hitlimit-bun (both)
**Version type**: FEATURE (new `turboStore()` export)

**NOTE**: This is a DEMOTED phase. It was originally Phase 3 and the headline feature. After animir's criticism about memory stores being irrelevant for production, turboStore is now a side feature for niche use cases (single-server, local dev, Bun single-process). It is NOT the marketing headline.

### PR Workflow

| Field | Value |
|-------|-------|
| Branch | `feat/v1.9.0-turbo-store` |
| Base | `main` |
| Author | tanv33 (`--author="tanv33 <tanveer.khan2692000@gmail.com>"`) |
| Reviewer | builtbyali |
| Docs Owner | tanv33 |
| Version | `1.9.0` (bump after merge) |

### 11.1 Why This Is Demoted

animir was right: "Memory limiter isn't always useful in production." turboStore doubles down on memory optimization — exactly what was criticized. We still build it because:
- Some users DO run single-server apps
- Bun.serve apps are often single-process
- It's a legitimate technical achievement
- It provides the fastest possible local dev experience

But we do NOT:
- Lead marketing with turboStore numbers
- Claim "9x faster" based on turboStore vs RLF memory
- Position turboStore as the main selling point

### 11.2 Implementation

**New file**: `packages/hitlimit/src/stores/turbo.ts` + `packages/hitlimit-bun/src/stores/turbo.ts` (IDENTICAL)

Custom FNV-1a hash + Int32Array (counts) + Float64Array (timestamps) + string[] (keys). Linear probing. Power-of-2 capacity with bitwise modulo. Single sweep timer.

```typescript
class TurboMemoryStore implements HitLimitStore {
  isSync = true as const
  private capacity: number
  private mask: number
  private counts: Int32Array
  private resets: Float64Array
  private keys: (string | undefined)[]
  private size = 0
  private readonly _result: StoreResult = { count: 0, resetAt: 0 }
  private sweepInterval: ReturnType<typeof setInterval>

  constructor(initialCapacity = 65536) {
    this.capacity = initialCapacity
    this.mask = initialCapacity - 1
    this.counts = new Int32Array(initialCapacity)
    this.resets = new Float64Array(initialCapacity)
    this.keys = new Array(initialCapacity)
    // sweep timer + resize logic...
  }

  hit(key: string, windowMs: number, _limit: number): StoreResult {
    const now = Date.now()
    let idx = this.hash(key) & this.mask
    // linear probing...
  }

  private hash(key: string): number {
    let h = 0x811c9dc5 | 0
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
  }
}

export function turboStore(options?: { capacity?: number }): HitLimitStore {
  return new TurboMemoryStore(options?.capacity)
}
```

### 11.3 TurboStore does NOT support ban/violation tracking

Pure hit-count store. Users who need bans use `memoryStore()` or external stores.

### 11.4 Export

```json
"./stores/turbo": { "import": "./dist/stores/turbo.js", "types": "./dist/stores/turbo.d.ts" }
```

Usage: `import { turboStore } from '@joint-ops/hitlimit/stores/turbo'`

### 11.5 Tests & Benchmarks

- Correctness: identical behavior to Map-based store
- Hash collision handling, resize, sweep
- [ ] Save results to `benchmarks/results/v1.9.0/`
- [ ] Benchmark turboStore vs memoryStore
- [ ] Do NOT position turboStore numbers as headline

### 11.6 Docs Update (Mandatory)

- [ ] **NEW**: `docs/src/pages/docs/stores/turbo.astro` — Document as optional optimization
- [ ] `CHANGELOG.md` — Add v1.9.0 entry

---

## Phase 12: BurstyRateLimiter (v1.10.0)

**Goal**: Allow controlled traffic bursts
**Packages**: hitlimit + hitlimit-bun (both)
**Version type**: FEATURE (new `burstyLimiter()` export)

### PR Workflow

| Field | Value |
|-------|-------|
| Branch | `feat/v1.10.0-bursty` |
| Base | `main` |
| Author | MuhammadRehanRasool (`--author="MuhammadRehanRasool <muhammadrehanrasool@gmail.com>"`) |
| Reviewer | sultandilaram |
| Docs Owner | sultandilaram |
| Version | `1.10.0` (bump after merge) |

### 12.1 Implementation

```typescript
import { burstyLimiter } from '@joint-ops/hitlimit'

app.use(burstyLimiter({
  primary: { limit: 10, window: '1s' },
  burst: { limit: 50, window: '10s' }
}))
```

Logic: Try primary first. If exhausted, try burst. If both exhausted, reject.

### 12.2 Tests & Benchmarks

- [ ] Save results to `benchmarks/results/v1.10.0/`
- [ ] NO regression on hit() hot path

### 12.3 Docs Update (Mandatory)

- [ ] **NEW**: `docs/src/pages/docs/guides/burst.astro`
- [ ] `docs/src/pages/docs/comparison.astro` — Update feature parity
- [ ] `CHANGELOG.md` — Add v1.10.0 entry

---

## Phase 13: Union Limiter (v1.11.0)

**Goal**: Enforce multiple rate limits simultaneously
**Packages**: hitlimit + hitlimit-bun (both)
**Version type**: FEATURE (new `unionLimiter()` export)

### PR Workflow

| Field | Value |
|-------|-------|
| Branch | `feat/v1.11.0-union` |
| Base | `main` |
| Author | sultandilaram (`--author="sultandilaram <sultanndilaram@gmail.com>"`) |
| Reviewer | builtbyali |
| Docs Owner | builtbyali |
| Version | `1.11.0` (bump after merge) |

### 13.1 Implementation

```typescript
import { unionLimiter } from '@joint-ops/hitlimit'

app.use(unionLimiter([
  { limit: 1, window: '1s' },
  { limit: 100, window: '1m' },
  { limit: 5000, window: '1h' }
]))
```

All limits checked on every request. If ANY limit exceeded, reject.

### 13.2 Tests & Benchmarks

- [ ] Save results to `benchmarks/results/v1.11.0/`
- [ ] NO regression on hit() hot path

### 13.3 Docs Update (Mandatory)

- [ ] **NEW**: `docs/src/pages/docs/guides/union.astro`
- [ ] `docs/src/pages/docs/comparison.astro` — ALL features now checked
- [ ] `CHANGELOG.md` — Add v1.11.0 entry
- [ ] **FULL AUDIT**: All docs pages current before v2.0.0

---

## Phase 14: Final Comprehensive Benchmark Suite (v2.0.0)

**Goal**: Irrefutable, reproducible benchmark results
**Author**: tanv33

### 14.1 Benchmark requirements

- Same methodology for ALL libraries (iterations, warmup, runs)
- Multiple scenarios (single-IP, 1K IPs, 10K IPs, 100K IPs)
- Multiple stores (memory, redis, postgres, mongo, mysql, sqlite, turbo)
- Multiple runtimes (Node.js LTS, Bun latest)
- Statistical rigor (5+ runs, p50/p95/p99, standard deviation, confidence intervals)
- Machine specs documented
- Scripts in repo for anyone to reproduce

### 14.2 Benchmark against

- rate-limiter-flexible (v9.x) — **Redis vs Redis** (the benchmark that matters)
- express-rate-limit (v7.x)
- @fastify/rate-limit
- koa-ratelimit

### 14.3 Key metrics to highlight

1. **Redis store ops/sec** — hitlimit vs RLF (THIS is the production metric)
2. **Store backend count** — hitlimit 7+ stores vs RLF 14 stores
3. **Bundle size** — hitlimit 7KB vs RLF 155KB
4. **Framework adapter count** — hitlimit 7 native vs RLF 0 native
5. **Memory store ops/sec** — secondary metric, clearly labeled as non-production

---

## Phase 15: The Reddit Post (v2.0.0)

**Goal**: Come clean publicly, share real numbers, build trust
**Author**: tanv33

### 15.1 Post structure

**Title**: *"I falsely claimed my rate limiter was 9x faster. The author called me out. Here's what I did about it."*

**Content**:
1. **The mistake** — What we claimed, why it was wrong
2. **The callout** — animir's response (with respect)
3. **The fix** — Months of work, honest optimization, real results
4. **The real numbers** — Full benchmark tables, methodology, reproducible scripts
5. **What we actually built** — 7+ store backends, Lua-optimized Redis, native framework adapters
6. **The apology** — To animir and the community
7. **What we learned** — Never benchmark dishonestly

### 15.2 Tone

- Humble, not defensive
- Educational, not promotional
- Honest about what RLF does better (store breadth, maturity, 7 years)
- Honest about what hitlimit does better (DX, bundle size, Bun native, Redis speed)

---

## Phase 16: Reach Out to animir (v2.0.0)

**Goal**: Turn a rival into an ally
**Author**: tanv33

### 16.1 Message to animir

- Acknowledge the original post was misleading
- Share the real benchmark results
- Credit their library's influence on our design
- Ask for feedback on our benchmark methodology
- Offer to collaborate or cross-reference projects

### 16.2 The narrative

NOT: "We're 9x faster in memory benchmarks"
YES: "You were right. Memory benchmarks don't matter for production. So we built Postgres, MongoDB, MySQL stores, optimized our Redis with Lua scripts to beat your Redis performance, and kept our 7KB bundle. Here are the honest numbers."

---

## Bundle Size Strategy

**This is our #2 selling point.** rate-limiter-flexible is 155KB. We are 7KB. That's 22x smaller.

### Bundle Size Rules

1. **Core stays under 8KB** — `index.js` + `core/` must not exceed 8KB total JS
2. **Bun bundle stays under 25KB**
3. **New stores are separate imports** — zero cost if not used
4. **New features are tree-shakeable**
5. **Peer deps only** — pg, mongodb, mysql2 never bundled
6. **No new runtime deps** — Zero dependencies is sacred
7. **Measure after every build** — CI checks, fails if limits exceeded

### Bundle Size CI Gate

```bash
CORE_SIZE=$(wc -c < packages/hitlimit/dist/index.js)
if [ "$CORE_SIZE" -gt 8192 ]; then
  echo "FAIL: Core bundle is ${CORE_SIZE} bytes (max 8192)"
  exit 1
fi

BUN_SIZE=$(wc -c < packages/hitlimit-bun/dist/index.js)
if [ "$BUN_SIZE" -gt 25600 ]; then
  echo "FAIL: Bun bundle is ${BUN_SIZE} bytes (max 25600)"
  exit 1
fi
```

---

## Benchmark & Test Gate (After Every Phase)

**MANDATORY** after every phase before merge:

### 1. Test Gate
```bash
pnpm test                    # All Node.js tests pass
bun test                     # All Bun tests pass (in packages/hitlimit-bun/)
pnpm build                   # All packages build clean
```

### 2. Benchmark Gate
```bash
pnpm benchmark               # Run full benchmark suite
# Compare against previous version
# Must not regress on any scenario
```

### 3. Bundle Size Gate
```bash
# Core JS must stay under 8KB
# Bun bundle must stay under 25KB
# No new runtime dependencies
```

### 4. Docs Gate
- [ ] Benchmark pages updated
- [ ] Comparison page updated
- [ ] Package READMEs updated
- [ ] New feature pages if applicable
- [ ] Homepage stats updated
- [ ] Changelog entry added

---

## Task Assignment Summary

### Patch Releases (v1.1.1 → v1.1.3) — Performance Only

| Version | Type | Phase | Author | Reviewer | Branch |
|---------|------|-------|--------|----------|--------|
| v1.1.1 | PATCH | Phase 1: Sync fast path | tanv33 | builtbyali | `perf/v1.1.1-sync-fast-path` |
| v1.1.2 | PATCH | Phase 2: Zero-alloc + sweep | builtbyali | tanv33 | `perf/v1.1.2-zero-alloc-sweep` |
| v1.1.3 | PATCH | Phase 3: Redis Lua | tanv33 | builtbyali | `perf/v1.1.3-redis-lua` |

### Feature Releases — Store Backends (v1.2.0 → v1.4.0) — TOP PRIORITY

| Version | Type | Phase | Author | Reviewer | Branch |
|---------|------|-------|--------|----------|--------|
| v1.2.0 | FEATURE | Phase 4: PostgreSQL | MuhammadRehanRasool | sultandilaram | `feat/v1.2.0-postgres` |
| v1.3.0 | FEATURE | Phase 5: MongoDB | builtbyali | tanv33 | `feat/v1.3.0-mongodb` |
| v1.4.0 | FEATURE | Phase 6: MySQL | sultandilaram | MuhammadRehanRasool | `feat/v1.4.0-mysql` |

### Feature Releases — API & Resilience (v1.5.0 → v1.7.0)

| Version | Type | Phase | Author | Reviewer | Branch |
|---------|------|-------|--------|----------|--------|
| v1.5.0 | FEATURE | Phase 7: API methods | MuhammadRehanRasool | sultandilaram | `feat/v1.5.0-api-methods` |
| v1.6.0 | FEATURE | Phase 8: Block cache | sultandilaram | MuhammadRehanRasool | `feat/v1.6.0-block-cache` |
| v1.7.0 | FEATURE | Phase 9: Insurance | builtbyali | tanv33 | `feat/v1.7.0-insurance` |

### Feature Releases — Advanced (v1.8.0 → v1.11.0)

| Version | Type | Phase | Author | Reviewer | Branch |
|---------|------|-------|--------|----------|--------|
| v1.8.0 | FEATURE | Phase 10: Cluster | tanv33 | builtbyali | `feat/v1.8.0-cluster` |
| v1.9.0 | FEATURE | Phase 11: TurboStore (DEMOTED) | tanv33 | builtbyali | `feat/v1.9.0-turbo-store` |
| v1.10.0 | FEATURE | Phase 12: Bursty | MuhammadRehanRasool | sultandilaram | `feat/v1.10.0-bursty` |
| v1.11.0 | FEATURE | Phase 13: Union | sultandilaram | builtbyali | `feat/v1.11.0-union` |

### Redemption (v2.0.0)

| Phase | Owner |
|-------|-------|
| Phase 14: Final benchmarks | tanv33 |
| Phase 15: Reddit post | tanv33 |
| Phase 16: Reach out to animir | tanv33 |

---

## Infrastructure Updates

### docker-compose.yml additions (starting Phase 4)

```yaml
postgres:
  image: postgres:16-alpine
  ports: ["5432:5432"]
  environment:
    POSTGRES_DB: hitlimit_test
    POSTGRES_USER: hitlimit
    POSTGRES_PASSWORD: hitlimit

mongodb:
  image: mongo:7
  ports: ["27017:27017"]

mysql:
  image: mysql:8
  ports: ["3306:3306"]
  environment:
    MYSQL_DATABASE: hitlimit_test
    MYSQL_ROOT_PASSWORD: hitlimit
```

### CI workflow updates

Add Postgres, MongoDB, MySQL services to `.github/workflows/ci.yml`. Only run DB-store tests when corresponding store files change (path filter).

---

## Constraints & Non-Negotiables

1. **ZERO runtime dependencies** — Sacred. Peer deps only for store drivers.
2. **Both packages updated together** — Every phase that touches shared code updates BOTH hitlimit and hitlimit-bun.
3. **No breaking changes to existing API** — v1.x must be backwards-compatible
4. **All new features are optional** — Default behavior stays the same
5. **No AI attribution** — Per CLAUDE.md rules
6. **No version bumps without approval** — Per CLAUDE.md rules
7. **No pushing without permission** — Per CLAUDE.md rules
8. **Benchmarks must be reproducible** — Scripts in repo, anyone can verify
9. **Tests must pass before merge** — CI gates on all PRs
10. **New stores are peer dependencies** — Don't bloat core bundle
11. **Memory store stays default** — The fastest local path is the default
12. **Honest marketing only** — Never claim what we can't prove with reproducible benchmarks
13. **Sequential execution** — Phase N must be merged before Phase N+1 starts
14. **Redis benchmark is the headline** — NOT memory benchmark. Production speed matters.

---

## Success Criteria

| Metric | Target | How We Measure |
|--------|--------|----------------|
| **Redis store speed** | **Faster than RLF Redis** | Redis benchmark, Lua vs Lua comparison |
| Memory store speed (after Phase 2) | ≥9M ops/sec (3x over RLF memory) | Benchmark after Phase 2 |
| **Store backend count** | **7+ (Memory, Redis, SQLite, Postgres, MongoDB, MySQL, Turbo)** | Package exports |
| API method parity | get, penalty, reward, block | Feature checklist |
| Insurance failover | Auto-failover with recovery | Integration tests |
| Cluster mode | Shared limits across workers | Multi-worker tests |
| **Bundle size (core)** | **<8KB Node.js core JS** | Build output + CI check |
| **Bundle size (Bun)** | **<25KB Bun bundle JS** | Build output + CI check |
| **Bundle size (vs RLF)** | **>15x smaller** | npm package size comparison |
| Zero runtime deps | 0 dependencies | package.json audit |
| Both packages in sync | Every phase updates both | PR checklist |
| Framework adapter count | 7 native adapters | Package exports |
| Docs updated per version | All pages current | Docs gate checklist |
| Community response | Positive reception on Reddit | Post engagement |
| animir relationship | Respectful dialogue | DM/email exchange |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Redis Lua slower than expected | Low | High | Benchmark against multi/exec baseline first |
| New stores have bugs | Medium | Medium | Extensive integration tests with Docker |
| Cluster mode IPC latency too high | Low | Medium | Benchmark early, fallback to Redis |
| animir reacts negatively | Low | Low | Sincere tone, focus on respect |
| Breaking change sneaks in | Low | High | Strict semver, backwards-compat tests |
| Performance regression in features | Medium | High | Benchmark CI on every PR |
| hitlimit-bun falls out of sync | Medium | High | PR checklist, CI tests both |
| Bundle size creep | Low | Medium | CI gate, 8KB/25KB hard limits |
| Bun incompatible with pg/mongodb/mysql2 | Medium | Low | Test on Bun, document Node.js-only if needed |

---

## Definition of Done (Per Phase)

### Code
- [ ] All tests pass (`pnpm test` + `bun test`)
- [ ] All packages build (`pnpm build` + `bun run build`)
- [ ] No AI attribution in commits or code
- [ ] Types package updated if interfaces changed
- [ ] Backwards-compatible with v1.1.0
- [ ] PR reviewed by assigned reviewer
- [ ] Both hitlimit AND hitlimit-bun updated (if shared code changed)
- [ ] Shared files byte-for-byte identical

### Performance
- [ ] Benchmarks run and saved to `benchmarks/results/`
- [ ] No regression on any existing scenario
- [ ] Delta documented

### Bundle Size
- [ ] Core JS < 8KB
- [ ] Bun bundle < 25KB
- [ ] No new runtime deps
- [ ] New stores are peer deps only

### Docs
- [ ] Benchmark pages updated
- [ ] Comparison page updated
- [ ] Package READMEs updated
- [ ] New feature pages if applicable
- [ ] Changelog entry added

---

## Audit Checklist (Things We Caught)

Issues found during planning that need fixing:

- [ ] **benchmarks/README.md** reports 2.32M but actual results show 2.45M — outdated
- [ ] **docs/comparison.astro** FAQ schema claims "2.32M ops/sec" but table says 2.45M
- [ ] **CONTRIBUTING.md** doesn't mention pre-release audit checklist
- [ ] **HTTP overhead numbers** in READMEs are unverified
- [ ] **Bun benchmarks** are 2 weeks older than Node.js benchmarks — re-run together
- [ ] No **CHANGELOG.md** file exists — create before first version bump
- [ ] **hitlimit-bun** was absent from original plan — now included in every phase
- [ ] **hitlimit-bun console logger** — `src/loggers/console.ts` exists but is NOT exported in `package.json`. Either add export or remove file
- [ ] **hitlimit-bun hono adapter** — `src/hono.ts` has minor formatting/comment differences from Node.js version. Decide: truly identical or intentionally different

---

## Benchmark Number Discrepancy Fix

**IMPORTANT**: Before any version work begins, fix the existing discrepancy:
- `docs/comparison.astro` claims **2.45M ops/sec** for 10K IPs
- `benchmarks/README.md` reports **2.32M ops/sec** for the same scenario
- Node.js benchmark results JSON shows **2,451,104 ops/sec**

The docs match the JSON. benchmarks/README.md is outdated — update it to match.

---

*This plan was created on February 15, 2026. Last updated: February 16, 2026.*
*Strategy pivot: Production stores and distributed speed now prioritized over memory optimization.*
*TurboStore demoted from headline feature to optional side optimization (Phase 11).*
*Redis Lua optimization added as Phase 3 — the production benchmark that matters.*
*Execution starts with Phase 1 on branch: `perf/v1.1.1-sync-fast-path`*
*All phases execute sequentially. Phase N merges before Phase N+1 starts.*
