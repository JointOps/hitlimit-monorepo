# Bun Benchmark Results

**Generated:** 2026-02-19T02:31:30.224Z
**Bun:** 1.3.7
**Platform:** darwin arm64

## Store Support Matrix

| Library | Memory | SQLite | Redis | Postgres |
|---------|--------|--------|-------|----------|
| hitlimit-bun | ✓ | ✓ | ✓ | ✓ |

## Memory Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 5.09M | 196ns | 167ns | 292ns | 375ns |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 3.41M | 293ns | 291ns | 417ns | 542ns |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 2.86M | 350ns | 333ns | 541ns | 834ns |


## Sqlite Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 427.7K | 2.34us | 2.04us | 3.54us | 5.67us |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 349.0K | 2.87us | 2.46us | 4.88us | 7.17us |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 316.5K | 3.16us | 2.63us | 5.67us | 8.04us |


## Redis Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.6K | 150.92us | 141.04us | 188.25us | 412.63us |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.4K | 156.54us | 143.13us | 201.04us | 451.96us |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.8K | 147.01us | 139.92us | 179.71us | 384.33us |


## Postgres Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 2.9K | 349.73us | 322.96us | 455.17us | 980.58us |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 2.7K | 368.34us | 330.92us | 507.54us | 1.09ms |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 2.6K | 392.05us | 337.92us | 558.33us | 1.43ms |

