# Comparison Benchmarks

Compare hitlimit performance against other rate limiting libraries.

## vs express-rate-limit

```bash
# Install express-rate-limit first
npm install express-rate-limit

# Run benchmark
npx tsx benchmarks/comparison/vs-express-rate-limit.bench.ts
```

Expected result: hitlimit ~2.2x faster

## vs rate-limiter-flexible

```bash
# Install rate-limiter-flexible first
npm install rate-limiter-flexible

# Run benchmark
npx tsx benchmarks/comparison/vs-rate-limiter-flexible.bench.ts
```

Expected result: hitlimit ~1.6x faster

## Node.js vs Bun

Run the same benchmark on both runtimes:

```bash
# Node.js
node --expose-gc benchmarks/comparison/node-vs-bun.bench.ts

# Bun
bun benchmarks/comparison/node-vs-bun.bench.ts
```

Expected results:

| Store | Node.js 20 | Bun 1.0 | Speedup |
|-------|------------|---------|---------|
| Memory | ~400,000 ops/s | ~500,000 ops/s | +25% |
| SQLite | ~35,000 ops/s | ~95,000 ops/s | **+171%** |

The SQLite performance difference is due to bun:sqlite being native vs better-sqlite3 using N-API bindings.
