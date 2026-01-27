# hitlimit Benchmarks

Reproducible benchmarks for hitlimit rate limiting library.

## Quick Start

```bash
# From monorepo root
pnpm install
pnpm build

# Run Node.js benchmarks
cd benchmarks
npx tsx src/scripts/run-node.ts

# Run Bun benchmarks
bun src/scripts/run-bun.ts
```

## Test Environment

- **Node.js**: v18, v20, v22, v24
- **Bun**: v1.0+
- **Redis**: 7.x (optional)
- **Machine**: Apple M2 (ARM64)

## Methodology

- Each benchmark runs 5 times, median reported
- Warmup: 1,000 iterations before measurement
- Test: 50,000 iterations per run
- Three scenarios: single-ip, multi-ip-1k, multi-ip-10k
- Memory measured via `process.memoryUsage()`

## Latest Results

### Node.js (hitlimit)

| Store | Scenario | Ops/sec | Avg Latency |
|-------|----------|---------|-------------|
| **Memory** | single-ip | 3.13M | 319ns |
| **Memory** | 10k IPs | 2.32M | 431ns |
| **SQLite** | single-ip | 472K | 2.12μs |
| **SQLite** | 10k IPs | 393K | 2.54μs |
| **Redis** | single-ip | 6.7K | 149μs |
| **Redis** | 10k IPs | 6.5K | 153μs |

### Bun (hitlimit-bun)

| Store | Scenario | Ops/sec | Avg Latency |
|-------|----------|---------|-------------|
| **Memory** | single-ip | 7.21M | 139ns |
| **Memory** | 10k IPs | 6.10M | 164ns |
| **bun:sqlite** | single-ip | 520K | 1.92μs |
| **bun:sqlite** | 10k IPs | 387K | 2.59μs |
| **Redis** | single-ip | 6.9K | 146μs |
| **Redis** | 10k IPs | 5.4K | 187μs |

### Comparison with Competitors (Memory Store, 10K IPs)

| Library | Ops/sec | vs Fastest |
|---------|---------|------------|
| **hitlimit** | **2.32M** | **fastest** |
| rate-limiter-flexible | 1.63M | 70% |
| express-rate-limit | 1.22M | 53% |

> Note: For single-IP scenarios, rate-limiter-flexible is slightly faster (3.34M vs 3.13M).

## Redis Setup

```bash
# Start Redis for benchmarks
docker run -p 6379:6379 redis:7-alpine

# Or use docker-compose from monorepo root
docker compose up -d redis
```

## Results

Results are saved to `benchmarks/results/`:
- `node-latest.json` / `node-latest.md` - Node.js results
- `bun-latest.json` / `bun-latest.md` - Bun results

## Key Insights

1. **Memory Store**: hitlimit is 42% faster than rate-limiter-flexible with many unique IPs
2. **SQLite Store**: Only hitlimit offers built-in SQLite (400K+ ops/sec)
3. **Redis Store**: Network-bound (~150μs latency), all libraries perform similarly
4. **Bun Runtime**: 2-3x faster than Node.js for memory operations
