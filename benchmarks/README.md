# hitlimit Benchmarks

Reproducible benchmarks for hitlimit rate limiting library.

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

- **Node.js**: v24 (primary), v18/v20/v22 also supported
- **Bun**: v1.3+
- **Redis**: 7.x via Docker (optional — Redis benchmarks skip gracefully if unavailable)
- **PostgreSQL**: 16.x via Docker (optional — Postgres benchmarks skip gracefully if unavailable)
- **Machine**: Apple M2 (ARM64)

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

- **No cherry-picking** — We report all scenarios, including ones where competitors beat us. RLF wins all Postgres scenarios. We say so.
- **No artificial limits on competitors** — Each library is configured the way its docs recommend. express-rate-limit uses its default key generator. rate-limiter-flexible uses `consume()` as documented.
- **No preheating advantage** — Every competitor gets the same warmup. No library runs "first" consistently (store order is fixed, but competitor order within each store is consistent across runs).

## Latest Results

### Node.js (hitlimit)

| Store | Scenario | Ops/sec | Avg Latency |
|-------|----------|---------|-------------|
| **Memory** | single-ip | 2.77M | 361ns |
| **Memory** | 1k IPs | 2.06M | 486ns |
| **Memory** | 10k IPs | 1.85M | 542ns |
| **SQLite** | single-ip | 413K | 2.42μs |
| **SQLite** | 10k IPs | 352K | 2.84μs |
| **Redis** | single-ip | 6.1K | 164μs |
| **Redis** | 10k IPs | 6.8K | 148μs |
| **Postgres** | single-ip | 2.7K | 376μs |
| **Postgres** | 10k IPs | 2.5K | 393μs |

### Bun (hitlimit-bun)

| Store | Scenario | Ops/sec | Avg Latency |
|-------|----------|---------|-------------|
| **Memory** | single-ip | 5.09M | 196ns |
| **Memory** | 10k IPs | 2.86M | 350ns |
| **bun:sqlite** | single-ip | 428K | 2.34μs |
| **bun:sqlite** | 10k IPs | 317K | 3.16μs |
| **Redis** | single-ip | 6.6K | 151μs |
| **Redis** | 10k IPs | 6.8K | 147μs |
| **Postgres** | single-ip | 2.9K | 350μs |
| **Postgres** | 10k IPs | 2.6K | 392μs |

### Comparison with Competitors (Memory Store, 10K IPs)

| Library | Ops/sec | vs Fastest |
|---------|---------|------------|
| **hitlimit** | **1.85M** | **fastest** |
| rate-limiter-flexible | 1.21M | 66% |
| express-rate-limit | 892K | 48% |

> hitlimit is the fastest in ALL memory scenarios — 1.5x on single-IP (2.77M vs 2.29M) and 1.5x on 10K IPs (1.85M vs 1.21M).

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

## Results

Results are saved to `benchmarks/results/`:
- `node-latest.json` / `node-latest.md` — Node.js results
- `bun-latest.json` / `bun-latest.md` — Bun results
- `v{version}/` — Versioned snapshots for each release

## Key Insights

1. **Memory Store**: hitlimit is 1.5x faster than rate-limiter-flexible with many unique IPs (zero-allocation hot path + sweep timer)
2. **SQLite Store**: Only hitlimit offers built-in SQLite — 350-430K ops/sec with zero config
3. **Redis Store**: Network-bound (~150μs latency). Both hitlimit and RLF use atomic Lua scripts. hitlimit wins most Redis scenarios (6.1-6.8K vs RLF 3.2-6.3K), RLF edges out on multi-1k (6.3K vs 6.2K — within margin of error)
4. **Postgres Store**: Network-bound (~350-400μs latency). RLF wins all Postgres scenarios (3.0-3.2K vs hitlimit 2.5-2.7K). We report this honestly
5. **Bun Runtime**: 1.5-1.8x faster than Node.js for memory operations (5.09M vs 2.77M single-ip)
6. **4 Store Backends**: hitlimit supports Memory, SQLite, Redis, and Postgres — all built in, zero runtime dependencies

## Think We Can Do Better?

These benchmarks aren't perfect — no benchmark suite is. If you spot something unfair, have a better methodology idea, or think we're measuring the wrong thing, we genuinely want to hear from you:

- **[Open an issue](https://github.com/JointOps/hitlimit-monorepo/issues)** — describe what you'd change and why
- **Submit a PR** — the benchmark runners are in `benchmarks/src/scripts/` and we welcome improvements
- **Run them yourself** — clone this repo, tweak the parameters, and share your results

We'd rather have honest benchmarks where we lose some scenarios than inflated numbers that don't reflect reality.
