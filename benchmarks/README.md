# hitlimit Benchmarks

Reproducible benchmarks for hitlimit rate limiting library.

## Quick Start

```bash
# From monorepo root
pnpm install
pnpm build

# Run all Node.js benchmarks
pnpm benchmark

# Run Bun benchmarks
pnpm benchmark:bun
```

## Test Environment

Benchmarks are designed to run on:
- **Node.js**: v18, v20, v22
- **Bun**: v1.0+
- **Redis**: 7.x (optional)

## Methodology

- Each benchmark runs 3 times, median reported
- Warmup: 1,000 requests before measurement
- Test: 100,000 requests (10,000 for Redis due to network)
- Single-threaded to measure raw library performance
- Memory measured before and after via `process.memoryUsage()`

## Expected Results

### Node.js (hitlimit)

| Store | Ops/sec | Avg Latency | Use Case |
|-------|---------|-------------|----------|
| Memory | 400,000+ | 0.002ms | Single server, no persistence |
| SQLite (:memory:) | 35,000+ | 0.025ms | Single server, persistence |
| SQLite (file) | 25,000+ | 0.035ms | Single server, disk persistence |
| Redis (local) | 12,000+ | 0.08ms | Multiple servers |

### Bun (hitlimit-bun)

| Store | Ops/sec | Avg Latency | Notes |
|-------|---------|-------------|-------|
| bun:sqlite | 95,000+ | 0.01ms | Native, no FFI overhead |
| Memory | 500,000+ | 0.001ms | Fastest option |

## Running Individual Benchmarks

```bash
# Memory store only
pnpm benchmark:memory

# SQLite store only
pnpm benchmark:sqlite

# Redis store only (requires Redis running)
docker run -p 6379:6379 redis:7-alpine
pnpm benchmark:redis

# Bun stores
pnpm benchmark:bun
```

## Results

Results are saved to `benchmarks/results/latest.json` after each run.

## HTTP Throughput Benchmarks

To measure full HTTP stack overhead:

```bash
# Install autocannon
npm install -g autocannon

# Start your server with hitlimit
node your-server.js

# Run HTTP benchmark
autocannon -c 100 -d 10 http://localhost:3000
```

Expected overhead with hitlimit:
- Express + Memory: ~7%
- Express + SQLite: ~16%
- Bun.serve + bun:sqlite: ~12%
