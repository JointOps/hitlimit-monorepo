# hitlimit Benchmarks

Controlled-environment microbenchmarks for the hitlimit rate limiting library. These measure the raw throughput and latency of the rate limiting logic itself — not HTTP servers, not real network traffic, not production load. The goal is an apples-to-apples comparison of the core algorithms under identical, reproducible conditions.

We believe benchmarks should be transparent, reproducible, and honest. This document explains exactly how we run them and why we made each decision. If you think something is unfair or could be improved, [open an issue](https://github.com/JointOps/hitlimit-monorepo/issues) — we want to get this right.

## Quick Start

```bash
# From monorepo root
pnpm install
pnpm build

# Node.js (--expose-gc enables GC between runs)
node --expose-gc node_modules/.bin/tsx benchmarks/src/scripts/run-node.ts

# Bun
bun benchmarks/src/scripts/run-bun.ts
```

> **Note:** `--expose-gc` is required for Node.js to enable garbage collection between runs. Without it, benchmarks still work but memory pressure can compound across runs.

## Test Environment

### Hardware

All published results were measured on this exact machine:

- **Machine**: MacBook Air (M1, 2020)
- **Chip**: Apple M1 — 8 cores (4 performance + 4 efficiency)
- **Memory**: 8 GB unified
- **OS**: macOS (Darwin, ARM64)

Your numbers will differ based on your hardware. A desktop i9 or Ryzen 9 will likely produce higher throughput. A smaller cloud VM will produce lower numbers. The relative comparisons (hitlimit vs competitors) should stay roughly similar on any hardware since all libraries run under identical conditions.

### Software

- **Node.js**: v24 (primary), v18/v20/v22 also supported
- **Bun**: v1.3+
- **Redis**: 7.x via Docker (local container on port 6379)
- **PostgreSQL**: 16.x via Docker (local container on port 5433)

### Docker Overhead (Redis & Postgres)

Redis and Postgres benchmarks run against **local Docker containers** — not remote servers. This means network latency is minimal (loopback), but Docker still adds overhead compared to bare-metal installs. We mitigate this by:

- Running Docker containers **before** starting benchmarks (no cold-start penalty)
- Using the same Docker setup for all competitors (same overhead for everyone)
- Reporting Redis/Postgres numbers separately from Memory/SQLite (no mixing in-process and networked stores)
- Adding **500ms cooldown between competitors** so one library's Docker cleanup doesn't bleed into the next

If you're running benchmarks on bare-metal Redis/Postgres (no Docker), expect slightly higher numbers across the board — but the relative comparison between libraries should hold.

## Methodology

### How Each Benchmark Runs

1. **Warmup** — 5,000 iterations are run and discarded. This lets the JS engine JIT-compile hot paths and stabilize internal caches so the first measured run isn't unfairly slow.

2. **Measurement** — 50,000 iterations × 5 runs = 250,000 total measured operations. Each individual operation is timed independently (see timing below). We report aggregate stats across all 250K samples.

3. **Three scenarios per store:**
   - `single-ip` — One IP hammering the limiter (worst case for that key, best case for cache locality)
   - `multi-ip-1k` — 1,000 unique IPs cycling round-robin (typical small-medium API)
   - `multi-ip-10k` — 10,000 unique IPs cycling round-robin (high-traffic API, stresses map/hash lookups)

4. **Reported stats** — ops/sec, avg/p50/p95/p99 latency, 95% confidence interval, memory delta.

### Why We Made These Choices

**Timing: `process.hrtime.bigint()` (Node.js) / `Bun.nanoseconds()` (Bun)**
`performance.now()` returns milliseconds with microsecond precision — converting to nanoseconds creates false precision. `hrtime.bigint()` gives true nanosecond resolution from the monotonic clock. Bun's `Bun.nanoseconds()` is the native equivalent.

**GC between runs: `global.gc()` / `Bun.gc(true)` before each run**
Without explicit GC, memory pressure compounds across runs. The first competitor to run gets a clean heap while later competitors pay for accumulated garbage. Running GC before each measured run normalizes the starting conditions for everyone.

**200ms cooldown between runs, 500ms between competitors**
Back-to-back CPU-intensive work can trigger thermal throttling on laptops. Short cooldowns let the CPU recover. The 500ms gap between competitors prevents one library's cleanup from bleeding into the next library's measurement.

**250K samples (50K × 5 runs)**
Enough samples to produce stable percentiles and tight confidence intervals. We tried 10K × 3 = 30K and found the variance too high for meaningful comparisons.

**Mock objects, not HTTP servers**
We benchmark the rate limiting logic directly — not HTTP parsing, routing, or response serialization. This isolates what we're actually measuring. Each library gets the same mock request object with the same IP extraction path.

**Same store configuration for all competitors**
When comparing Redis or Postgres stores, all competitors connect to the same local instance with the same connection settings. Each competitor gets its own table/keyspace to avoid interference.

### What We Don't Do

- **No cherry-picking** — We report all scenarios, including ones where competitors beat us. RLF wins 2 of 3 Redis scenarios and 2 of 3 Postgres scenarios by small margins. We say so.
- **No artificial limits on competitors** — Each library is configured the way its docs recommend. express-rate-limit uses its default key generator. rate-limiter-flexible uses `consume()` as documented.
- **No preheating advantage** — Every competitor gets the same warmup. No library runs "first" consistently (store order is fixed, but competitor order within each store is consistent across runs).

## Latest Results

### Node.js (hitlimit)

| Store | Scenario | Ops/sec | Avg Latency |
|-------|----------|---------|-------------|
| **Memory** | single-ip | 4.71M | 212ns |
| **Memory** | 1k IPs | 1.90M | 528ns |
| **Memory** | 10k IPs | 2.90M | 345ns |
| **SQLite** | single-ip | 452K | 2.21μs |
| **SQLite** | 10k IPs | 376K | 2.66μs |
| **Redis** | single-ip | 6.1K | 165μs |
| **Redis** | 1k IPs | 6.5K | 154μs |
| **Redis** | 10k IPs | 5.9K | 169μs |
| **Postgres** | single-ip | 3.5K | 286μs |
| **Postgres** | 1k IPs | 3.3K | 299μs |
| **Postgres** | 10k IPs | 3.3K | 304μs |

### Bun (hitlimit-bun)

| Store | Scenario | Ops/sec | Avg Latency |
|-------|----------|---------|-------------|
| **Memory** | single-ip | 5.57M | 179ns |
| **Memory** | 1k IPs | 3.04M | 329ns |
| **Memory** | 10k IPs | 2.90M | 345ns |
| **bun:sqlite** | single-ip | 429K | 2.33μs |
| **bun:sqlite** | 10k IPs | 331K | 3.02μs |
| **Redis** | single-ip | 6.7K | 148μs |
| **Redis** | 10k IPs | 6.7K | 149μs |
| **Postgres** | single-ip | 3.6K | 275μs |
| **Postgres** | 1k IPs | 3.6K | 279μs |
| **Postgres** | 10k IPs | 3.7K | 273μs |

### Comparison with Competitors (Node.js, 10K IPs)

**Memory Store**

| Library | Ops/sec | vs Fastest |
|---------|---------|------------|
| **hitlimit** | **2.90M** | **fastest** |
| rate-limiter-flexible | 1.08M | 37% |
| express-rate-limit | 1.04M | 36% |

**Redis Store**

| Library | Scenario | Ops/sec | vs Fastest |
|---------|----------|---------|------------|
| **rate-limiter-flexible** | single-ip | **6.2K** | **fastest** |
| hitlimit | single-ip | 6.1K | 98% |
| **hitlimit** | multi-1k | **6.5K** | **fastest** |
| rate-limiter-flexible | multi-1k | 6.3K | 97% |
| **rate-limiter-flexible** | multi-10k | **6.5K** | **fastest** |
| hitlimit | multi-10k | 5.9K | 92% |

> Redis is network-bound (~150μs latency). Both libraries use atomic Lua scripts. Results are within margin of error — hitlimit wins multi-1k, RLF wins single-ip and multi-10k. hitlimit has lower p50 latency in all 3 scenarios (148μs vs 150μs).

**Postgres Store**

| Library | Scenario | Ops/sec | vs Fastest |
|---------|----------|---------|------------|
| **hitlimit** | single-ip | **3.5K** | **fastest** |
| rate-limiter-flexible | single-ip | 3.5K | 99% |
| **rate-limiter-flexible** | multi-1k | **3.4K** | **fastest** |
| hitlimit | multi-1k | 3.3K | 97% |
| **rate-limiter-flexible** | multi-10k | **3.3K** | **fastest** |
| hitlimit | multi-10k | 3.3K | 99% |

> Postgres is essentially tied between hitlimit and RLF across all scenarios. hitlimit wins single-ip, RLF wins multi-1k by 3%, multi-10k is a virtual tie (99%). hitlimit uses named prepared statements for server-side query plan caching.

> **Fair play:** These are our benchmarks and we've done our best to keep them fair and reproducible. We encourage you to clone this repo and run them yourself. They're not set in stone — there's always room for improvement. If you spot issues or have suggestions, please open an issue or PR.

## Docker Setup (Redis & Postgres)

Redis and Postgres benchmarks require Docker. If they're not running, those benchmarks skip gracefully — memory and SQLite results are unaffected.

```bash
# From monorepo root — start both
docker compose up -d

# Or individually
docker compose up -d redis     # Redis on port 6379
docker compose up -d postgres  # Postgres on port 5433
```

> **Why port 5433?** Our docker-compose maps Postgres to external port 5433 (not 5432) to avoid conflicts with any local Postgres installation. The benchmark runners default to this port.

### Running Benchmarks in Isolation

For the most accurate memory/SQLite numbers, stop Docker containers first so they don't compete for CPU:

```bash
docker compose down

# Memory + SQLite only (no Docker overhead)
node --expose-gc node_modules/.bin/tsx benchmarks/src/scripts/run-node.ts
bun benchmarks/src/scripts/run-bun.ts

# Then bring up Redis/Postgres for network store benchmarks
docker compose up -d
node --expose-gc node_modules/.bin/tsx benchmarks/src/scripts/run-node.ts
bun benchmarks/src/scripts/run-bun.ts
```

## Results Structure

Every benchmark run writes to `benchmarks/results/latest/` and automatically snapshots to `benchmarks/results/v{version}/` by reading the `VERSION` file in the repo root. No manual copying needed — just make sure `VERSION` is set before running benchmarks.

```
benchmarks/results/
├── latest/              ← runners always write here
│   ├── node.json        ← raw data (ops/sec, latencies, memory, CI)
│   ├── node.md          ← human-readable report
│   ├── bun.json
│   └── bun.md
├── v1.2.0/              ← snapshot from v1.2.0 release
│   ├── node.json
│   ├── node.md
│   ├── bun.json
│   └── bun.md
├── v1.1.3/              ← snapshot from v1.1.3 release
│   └── ...
├── v1.1.2/
│   └── ...
└── v1.1.1/
    └── ...
```

**Why this structure?**
- `latest/` is always the most recent run — overwritten every time you run benchmarks. No confusion about which file is "current."
- Versioned folders (`v1.2.0/`, `v1.1.3/`, etc.) are immutable snapshots. They let you compare performance across releases and catch regressions.
- Four files per folder, consistent naming: `node.json`, `node.md`, `bun.json`, `bun.md`. The folder name tells you the version, the filename tells you the runtime. That's it.

## Key Insights

1. **Memory Store**: hitlimit is 2.7x faster than rate-limiter-flexible at 10K unique IPs (2.90M vs 1.08M — zero-allocation sync hot path + sweep timer)
2. **SQLite Store**: Only hitlimit offers built-in SQLite — 376-452K ops/sec with zero config
3. **Redis Store**: Network-bound (~150μs latency). Both hitlimit and RLF use atomic Lua scripts via `defineCommand()`. Essentially tied — hitlimit wins multi-1k (6.5K vs 6.3K), RLF wins single-ip and multi-10k by small margins. hitlimit has lower p50 latency in all scenarios
4. **Postgres Store**: Network-bound (~280-300μs latency). Essentially tied — hitlimit wins single-ip (3.5K), RLF wins multi-1k by 3%, multi-10k is 99% tied. hitlimit uses named prepared statements for server-side query plan caching
5. **Bun Runtime**: 1.6-1.9x faster than Node.js for memory operations (5.57M vs 4.71M single-ip, 2.90M vs 2.90M at 10K IPs)
6. **4 Store Backends**: hitlimit supports Memory, SQLite, Redis, and Postgres — all built in, zero runtime dependencies

## Think We Can Do Better?

These benchmarks aren't perfect — no benchmark suite is. If you spot something unfair, have a better methodology idea, or think we're measuring the wrong thing, we genuinely want to hear from you.

**How to discuss benchmark methodology:**

- **[Open an issue](https://github.com/JointOps/hitlimit-monorepo/issues)** — describe what you'd change and why. Include your hardware, runtime version, and what numbers you're seeing. Methodology discussions are welcome — we take them seriously.
- **Submit a PR** — the benchmark runners are in `benchmarks/src/scripts/` (`run-node.ts` and `run-bun.ts`). If you have a concrete improvement, send a PR and we'll review it.
- **Run them yourself** — clone this repo, run the benchmarks on your hardware, and share your results. Different CPUs, OSes, and Docker setups produce different absolute numbers. We want to know how hitlimit performs outside our test machine.

**Things we'd especially love feedback on:**
- Is the warmup count (5K) sufficient for your runtime/hardware?
- Are the cooldowns (200ms between runs, 500ms between competitors) appropriate?
- Should we add more scenarios (e.g., burst patterns, mixed read/write)?
- Is there a competitor we should include that we're missing?
- Are the Docker-based Redis/Postgres benchmarks representative of your production setup?

We'd rather have honest benchmarks where we lose some scenarios than inflated numbers that don't reflect reality.
