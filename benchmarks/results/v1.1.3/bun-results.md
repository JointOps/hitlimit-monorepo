# Bun Benchmark Results

**Generated:** 2026-02-18T01:29:15.859Z
**Bun:** 1.3.7
**Platform:** darwin arm64

## Store Support Matrix

| Library | Memory | SQLite | Redis |
|---------|--------|--------|-------|
| hitlimit-bun | ✓ | ✓ | ✓ |

## Memory Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.62M | 151ns | 125ns | 208ns | 416ns |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.36M | 157ns | 125ns | 209ns | 291ns |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 5.62M | 178ns | 167ns | 250ns | 333ns |


## Sqlite Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 494.7K | 2.02us | 1.96us | 2.38us | 2.63us |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 395.2K | 2.53us | 2.46us | 2.88us | 4.17us |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 377.5K | 2.65us | 2.50us | 3.13us | 5.33us |


## Redis Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.7K | 148.52us | 141.96us | 175.75us | 375.13us |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.9K | 145.38us | 140.71us | 167.58us | 361.88us |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.7K | 148.57us | 142.71us | 173.33us | 368.63us |

