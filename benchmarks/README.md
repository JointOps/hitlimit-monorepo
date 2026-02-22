# hitlimit Benchmarks

Performance benchmarks for hitlimit across every supported framework, store, and runtime.

## What Are These Benchmarks?

These benchmarks measure how fast rate limiting libraries process requests. Instead of sending real HTTP traffic over a network, we call the rate limiter's internal function directly — thousands of times per second — and measure how long each call takes.

Think of it like timing how fast a bouncer checks IDs at a club door. We're not measuring how long it takes someone to walk to the club (network latency) — we're measuring how fast the bouncer can look at an ID and say "you're in" or "you're out." That's what a rate limiter does: it checks if a request should be allowed or blocked.

### Why Not Use Real HTTP Requests?

Real HTTP benchmarks (like wrk, autocannon, or k6) measure the entire stack: TCP handshake, TLS negotiation, HTTP parsing, routing, middleware chain, response serialization, and network round-trip. The rate limiter is just one tiny piece of that pipeline. If the total request takes 5ms and the rate limiter takes 0.0002ms, you can't meaningfully measure the rate limiter's performance through HTTP.

By calling the rate limiter directly, we isolate its performance. This is how all serious library benchmarks work (V8 benchmarks don't measure Chrome's rendering pipeline).

### What Does Each Benchmark Test?

Each benchmark file tests ONE specific combination:
- **One library** (hitlimit, express-rate-limit, rate-limiter-flexible, etc.)
- **One store** (memory, SQLite, Redis, Postgres)
- **One framework** (Express, Fastify, Hono, NestJS, Bun.serve, Elysia)
- **One runtime** (Node.js or Bun)

For example, `node/fastify/hitlimit/redis.ts` tests hitlimit's Fastify plugin using a Redis store on Node.js.

Each benchmark runs 3 scenarios with different numbers of unique IP addresses (explained below).

## Understanding the Results

### Key Metrics

Every result file contains these numbers. Here's what each one means:

#### `opsPerSec` — Operations Per Second (Throughput)

How many rate limit checks the library can perform in one second. Higher is better.

**Real-world meaning:** If your API gets 10,000 requests per second, and your rate limiter can do 4,000,000 ops/sec, the rate limiter uses about 0.25% of your server's capacity. If it can only do 50,000 ops/sec, the rate limiter itself becomes a bottleneck using 20% of your capacity.

**Example values:**
- `4,830,798 ops/sec` — 4.8 million checks per second (memory store, very fast)
- `6,700 ops/sec` — 6.7 thousand checks per second (Redis store, network overhead)
- `3,000 ops/sec` — 3.0 thousand checks per second (Postgres store, database overhead)

#### `avgNs` — Average Latency (Nanoseconds)

The average time a single rate limit check takes, measured in nanoseconds. Lower is better.

**Scale reference:**
- 1 nanosecond (ns) = 0.000000001 seconds
- 1 microsecond (μs) = 1,000 ns
- 1 millisecond (ms) = 1,000,000 ns
- 1 second = 1,000,000,000 ns

**Real-world meaning:** If `avgNs` is 207, each rate limit check takes 0.000000207 seconds — essentially instant. If `avgNs` is 149,760 (Redis), each check takes 0.000150 seconds — still very fast, but ~700x slower than memory.

#### `p50Ns` — 50th Percentile Latency (Median)

If you sort all measured latencies from fastest to slowest, the p50 is the one right in the middle. 50% of requests were faster than this, 50% were slower.

**Why it matters:** The average (`avgNs`) can be skewed by a few extremely slow requests. The median (p50) tells you what a "typical" request actually experiences. If your average is 500ns but your p50 is 200ns, most requests are fast but a few outliers are pulling the average up.

#### `p95Ns` — 95th Percentile Latency

95% of requests were faster than this value. Only 5% were slower.

**Real-world meaning:** This is what matters for user experience. If your p95 is 250ns, 95 out of 100 users experience latency of 250ns or less. The remaining 5 might see something worse, but the vast majority are fine.

**Example:** A web app with 1,000 concurrent users — at p95 = 250ns, 950 users see ≤250ns latency. Only 50 users see something higher.

#### `p99Ns` — 99th Percentile Latency

99% of requests were faster than this. Only 1% were slower. This is the "tail latency" — the worst-case experience for almost everyone.

**Why track p99?** At scale (millions of requests), even 1% being slow means thousands of users per second hitting that tail. p99 tells you how bad that tail is. If p99 is 10x worse than p50, you have a latency spike problem.

#### `minNs` and `maxNs` — Minimum and Maximum Latency

The absolute fastest and slowest individual request in the entire benchmark run.

`minNs` shows the best-case scenario (everything in cache, no GC, no contention).
`maxNs` shows the worst-case scenario (GC pause, cache miss, OS scheduler interruption).

The `maxNs` is often 10-100x worse than `p99Ns` because it captures one-off extreme events. Don't optimize for `maxNs` — it's noise.

#### `stdDev` — Standard Deviation

Measures how much the latencies vary from the average. Lower means more consistent performance.

**Real-world analogy:** Two restaurants both serve food in 10 minutes on average. Restaurant A always takes 9-11 minutes (low stdDev). Restaurant B takes 2 minutes sometimes and 18 minutes other times (high stdDev). Same average, very different experience. Low stdDev = predictable. High stdDev = unpredictable.

**What's "good"?** If `stdDev` is less than 50% of `avgNs`, performance is consistent. If it's larger than `avgNs`, there's high variance — investigate GC, cache eviction, or contention.

#### `marginOfError` — 95% Confidence Interval

A statistical measure of how much you can trust the average. Calculated as `1.96 × stdDev / sqrt(sampleSize)`.

**What it means:** The true average latency is `avgNs ± marginOfError` with 95% probability. If `avgNs = 207` and `marginOfError = 0.54`, the real average is somewhere between 206.46 and 207.54 — very precise. If `marginOfError` is large relative to `avgNs`, the benchmark needs more iterations.

**Rule of thumb:** If `marginOfError / avgNs < 0.01` (less than 1%), the measurement is solid.

#### `memoryMB` — Memory Usage (Megabytes)

How much heap memory the rate limiter uses during the benchmark, in megabytes. Measured as `heapUsed` after the benchmark minus `heapUsed` before.

**Real-world meaning:** A rate limiter that uses 2MB for 1,000 IPs is fine. One that uses 200MB for 1,000 IPs will eat into your server's available memory. Memory matters most when you're tracking millions of unique keys (high-traffic APIs, DDoS mitigation).

### Scenarios

Every benchmark runs 3 scenarios to test different access patterns:

| Scenario | Unique IPs | What It Tests |
|----------|-----------|---------------|
| `single-ip` | 1 | Best case. One key, always in cache. Tests the library's raw speed without any key lookup overhead. |
| `multi-ip-1k` | 1,000 | Typical API. Simulates a normal application with 1,000 different clients. Tests hash map performance and memory usage. |
| `multi-ip-10k` | 10,000 | High traffic. Simulates a busy API with 10,000 different clients. Tests how the library scales with many keys. |

**Why these specific numbers?** Single-IP is the theoretical maximum (best cache locality). 1K IPs covers 99% of real APIs. 10K IPs stress-tests the data structures. Beyond 10K, the differences are proportional — a library that handles 10K well handles 100K well.

## What We Benchmark

### Frameworks × Stores × Runtimes

**Node.js (`@joint-ops/hitlimit`):**

| Framework | Memory | SQLite | Redis | Postgres |
|-----------|--------|--------|-------|----------|
| Express   | ✓      | ✓      | ✓     | ✓        |
| Fastify   | ✓      | ✓      | ✓     | ✓        |
| Hono      | ✓      | ✓      | ✓     | ✓        |
| NestJS    | ✓      | ✓      | ✓     | ✓        |
| Raw Store | ✓      | ✓      | ✓     | ✓        |

**Bun (`@joint-ops/hitlimit-bun`):**

| Framework | Memory | SQLite | Redis | Postgres |
|-----------|--------|--------|-------|----------|
| Bun.serve | ✓      | ✓      | ✓     | ✓        |
| Elysia    | ✓      | ✓      | ✓     | ✓        |
| Hono      | ✓      | ✓      | ✓     | ✓        |
| Raw Store | ✓      | ✓      | ✓     | ✓        |

### Competitors

Each framework also benchmarks its native rate limiting competitor:

| Framework | Competitor | Stores |
|-----------|-----------|--------|
| Express   | express-rate-limit | Memory |
| Express   | rate-limiter-flexible | Memory, Redis, Postgres |
| Fastify   | @fastify/rate-limit | Memory, Redis |
| Hono      | hono-rate-limiter | Memory, Redis |
| NestJS    | @nestjs/throttler | Memory |
| Elysia    | elysia-rate-limit | Memory |
| Raw Store | rate-limiter-flexible | Memory, Redis, Postgres |

## How to Run

### Prerequisites

- Node.js v20+ (for Node.js benchmarks)
- Bun v1.3+ (for Bun benchmarks)
- pnpm (package manager)
- Docker (optional, for Redis and Postgres benchmarks)

### Build First

Benchmarks import from `packages/hitlimit/dist/` and `packages/hitlimit-bun/dist/`, so you must build before running:

```bash
# From monorepo root
pnpm build
```

### Run Everything

```bash
cd benchmarks
pnpm bench:all          # All benchmarks (Node.js + Bun)
```

### Run by Runtime

```bash
pnpm bench:node          # All Node.js benchmarks
pnpm bench:bun           # All Bun benchmarks
```

### Run by Framework

```bash
pnpm bench:node:express   # All Express benchmarks (hitlimit + competitors, all stores)
pnpm bench:node:fastify   # All Fastify benchmarks
pnpm bench:node:hono      # All Hono benchmarks
pnpm bench:node:nestjs    # All NestJS benchmarks
pnpm bench:node:store     # Raw store.hit() benchmarks (no framework overhead)

pnpm bench:bun:bun-serve  # All Bun.serve benchmarks
pnpm bench:bun:elysia     # All Elysia benchmarks
pnpm bench:bun:hono       # All Bun Hono benchmarks
pnpm bench:bun:store      # Raw store benchmarks on Bun
```

### Run by Store

```bash
pnpm bench:node:store:memory    # Memory store only (Node.js)
pnpm bench:node:express:memory  # Express + memory store only
pnpm bench:node:express:redis   # Express + Redis store only
pnpm bench:bun:store:memory     # Memory store only (Bun)
```

### Run a Single Benchmark

```bash
# Node.js (requires --expose-gc for accurate memory measurement)
node --expose-gc ./node_modules/.bin/tsx node/express/hitlimit/memory.ts

# Bun (GC exposed by default)
bun bun/elysia/hitlimit/memory.ts
```

### Redis and Postgres Benchmarks

Redis and Postgres benchmarks need running servers. Use Docker:

```bash
# Start Redis
docker run -d --name bench-redis -p 6379:6379 redis:7-alpine

# Start Postgres
docker run -d --name bench-postgres -p 5433:5432 \
  -e POSTGRES_USER=hitlimit \
  -e POSTGRES_PASSWORD=hitlimit \
  -e POSTGRES_DB=hitlimit_test \
  postgres:16-alpine

# Run Redis benchmarks
pnpm bench:node:express:redis

# Run Postgres benchmarks
pnpm bench:node:express:postgres
```

If Redis/Postgres isn't available, those benchmarks skip automatically with a "not available" message.

## Results

### Where Results Live

Results are saved to `results/v{VERSION}/` where `{VERSION}` comes from the `VERSION` file at the monorepo root.

```
results/
└── v1.2.0/
    ├── node-express-hitlimit-memory.json
    ├── node-express-hitlimit-redis.json
    ├── node-express-express-rate-limit-memory.json
    ├── node-fastify-hitlimit-memory.json
    ├── bun-elysia-hitlimit-memory.json
    └── ... (~55 JSON files)
```

### File Naming

`{runtime}-{framework}-{library}-{store}.json`

Examples:
- `node-express-hitlimit-memory.json` — hitlimit on Express with memory store on Node.js
- `bun-elysia-hitlimit-redis.json` — hitlimit on Elysia with Redis store on Bun
- `node-store-rate-limiter-flexible-memory.json` — rate-limiter-flexible raw store on Node.js

### Finding Results

```bash
# All Redis benchmarks
ls results/v1.2.0/*redis*

# All Express benchmarks
ls results/v1.2.0/node-express-*

# All hitlimit benchmarks
ls results/v1.2.0/*hitlimit*

# Compare hitlimit vs express-rate-limit on Express
cat results/v1.2.0/node-express-hitlimit-memory.json
cat results/v1.2.0/node-express-express-rate-limit-memory.json
```

### Reading a Result File

Each JSON file is self-contained — everything you need to understand and reproduce the result:

```json
{
  "benchmark": {
    "framework": "express",
    "library": "hitlimit",
    "store": "memory",
    "runtime": "node"
  },
  "environment": {
    "runtimeVersion": "v24.4.1",
    "os": "macOS 15.3.1",
    "arch": "arm64",
    "cpu": "Apple M2 Pro",
    "cpuCores": 12,
    "memoryGB": 32,
    "docker": false
  },
  "versions": {
    "hitlimit": "1.2.0"
  },
  "config": {
    "warmupIterations": 5000,
    "measuredIterations": 50000,
    "runs": 5,
    "totalMeasured": 250000
  },
  "date": "2026-02-22T14:30:00.000Z",
  "scenarios": {
    "single-ip": {
      "description": "Single IP, best cache locality",
      "keys": 1,
      "opsPerSec": 4830798,
      "latency": {
        "avgNs": 207,
        "p50Ns": 204,
        "p95Ns": 245,
        "p99Ns": 370,
        "minNs": 160,
        "maxNs": 12500
      },
      "stdDev": 43.8,
      "marginOfError": 0.54,
      "memoryMB": 1.2
    }
  }
}
```

## Regression Checking

Compare the latest results against a previous version:

```bash
pnpm check-regression
```

Flags any benchmark that got >10% slower as a regression. Exits with code 1 if regressions found (useful in CI).

Manual comparison of two specific files:

```bash
tsx check-regression.ts results/v1.1.0/node-express-hitlimit-memory.json results/v1.2.0/node-express-hitlimit-memory.json
```

## How to Add a Competitor

1. Create a directory: `node/{framework}/{competitor-name}/`
2. Create a file per store: `memory.ts`, `redis.ts`, etc.
3. Follow the same pattern as existing files — import runner, set up library, call `run()`
4. Add the file to `package.json` scripts
5. Run it and verify JSON output appears in `results/`

## How the Benchmarks Work (Under the Hood)

1. **Pre-allocation:** All IP addresses, mock request objects, and response objects are created BEFORE timing starts. Nothing is allocated during the timed loop — this ensures we're measuring the rate limiter, not JavaScript's garbage collector.

2. **Warmup:** 5,000 iterations run before timing starts. This lets the JavaScript engine's JIT compiler optimize the hot path. Without warmup, the first few thousand iterations would be artificially slow.

3. **Measurement:** 5 runs × 50,000 iterations = 250,000 measured operations per benchmark. Each individual operation is timed with nanosecond precision.

4. **GC between runs:** Garbage collection is forced between runs so one run's leftover objects don't affect the next run's measurements.

5. **Cooldowns:** 200ms pause between runs, 500ms between benchmarks. Prevents CPU thermal throttling from compounding (laptop CPUs slow down when hot).

6. **Sync vs Async:** Memory and SQLite stores are synchronous — the benchmark uses a tight `for` loop with no `await`. Redis and Postgres are async — the benchmark uses `await` in the loop. This matters because `await` on a synchronous value still has ~100-500ns overhead from the microtask queue.

### Why Some Libraries Are Faster (Sync vs Async)

You'll notice that hitlimit with memory or SQLite stores is significantly faster than competitors using the same store. A big reason for this is **synchronous vs asynchronous execution**.

When a rate limiter checks a request, it does something like: look up the IP in a store, increment a counter, and return "allowed" or "blocked." If the store is in-memory (a JavaScript Map), this entire operation takes nanoseconds and never needs to wait for anything — it's synchronous.

Some libraries (like `@nestjs/throttler` and `express-rate-limit`) wrap this result in a `Promise` even when the underlying store is synchronous. That means every single check goes through JavaScript's **microtask queue** — an internal scheduling mechanism that adds ~100-500 nanoseconds of overhead per call. At millions of operations per second, this adds up.

hitlimit detects whether the store is synchronous and skips the Promise entirely. The result comes back as a plain value — no microtask queue, no scheduling overhead, just the answer.

**How the benchmarks handle this fairly:**

Each benchmark file has an `isSync` flag that tells the runner how to call the function:

- `isSync: true` → tight `for` loop, no `await` (used when the library returns a plain value)
- `isSync: false` → `for` loop with `await` (used when the library returns a Promise)

This flag is set based on what the library **actually returns in production**, not what we want it to return. If a library wraps its result in a Promise, the benchmark respects that and uses `await`. If a library returns a plain value, the benchmark respects that too.

We don't force `await` on synchronous libraries (that would add fake overhead) and we don't skip `await` on asynchronous libraries (that would measure nothing). Each library is benchmarked the way it actually behaves in your app.

**Quick reference — what's sync and what's async:**

| Store | hitlimit | express-rate-limit | @nestjs/throttler | rate-limiter-flexible | @fastify/rate-limit |
|-------|----------|-------------------|-------------------|----------------------|-------------------|
| Memory | Sync | Async (Promise) | Async (Promise) | Async (Promise) | Async (Promise) |
| SQLite | Sync | — | — | — | — |
| Redis | Async | — | — | Async | Async |
| Postgres | Async | — | — | Async | — |

hitlimit is the only library that stays synchronous for synchronous stores. This is an architectural choice, not a benchmark trick.
