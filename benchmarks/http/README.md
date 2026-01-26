# HTTP Throughput Benchmarks

Measure the overhead of hitlimit on HTTP servers.

## Prerequisites

Install autocannon globally for HTTP benchmarking:

```bash
npm install -g autocannon
```

## Running Benchmarks

### Express (Node.js)

```bash
# Terminal 1: Start server without limiter (baseline)
WITH_LIMITER=false npx tsx benchmarks/http/express.bench.ts

# Terminal 2: Run benchmark
autocannon -c 100 -d 10 http://localhost:3000

# Then restart server with limiter
npx tsx benchmarks/http/express.bench.ts

# Run benchmark again and compare
autocannon -c 100 -d 10 http://localhost:3000
```

### Bun.serve

```bash
# Terminal 1: Start server without limiter (baseline)
WITH_LIMITER=false bun benchmarks/http/bun-serve.bench.ts

# Terminal 2: Run benchmark
autocannon -c 100 -d 10 http://localhost:3001

# Then restart server with limiter
bun benchmarks/http/bun-serve.bench.ts

# Run benchmark again and compare
autocannon -c 100 -d 10 http://localhost:3001
```

### Elysia

```bash
# Terminal 1: Start server without limiter (baseline)
WITH_LIMITER=false bun benchmarks/http/elysia.bench.ts

# Terminal 2: Run benchmark
autocannon -c 100 -d 10 http://localhost:3002

# Then restart server with limiter
bun benchmarks/http/elysia.bench.ts

# Run benchmark again and compare
autocannon -c 100 -d 10 http://localhost:3002
```

## Expected Results

| Framework | Without Limiter | With hitlimit | Overhead |
|-----------|-----------------|---------------|----------|
| Express | ~45,000 req/s | ~42,000 req/s | ~7% |
| Bun.serve | ~120,000 req/s | ~105,000 req/s | ~12% |
| Elysia | ~130,000 req/s | ~115,000 req/s | ~11% |

## Notes

- All benchmarks use **Memory store** for Express and **bun:sqlite** for Bun
- The limit is set very high (1,000,000/min) to measure middleware overhead, not rate limiting behavior
- Results vary based on hardware - these numbers are from MacBook Pro M2
- Network overhead is minimal since everything runs locally
