# Bun Benchmark Results

**Generated:** 2026-02-21T13:39:20.411Z
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
| hitlimit-bun | 5.57M | 179ns | 167ns | 292ns | 375ns |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 3.04M | 329ns | 292ns | 542ns | 750ns |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 2.90M | 345ns | 333ns | 542ns | 1.38us |


## Sqlite Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 428.6K | 2.33us | 2.04us | 3.67us | 6.00us |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 340.4K | 2.94us | 2.50us | 4.92us | 9.04us |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 331.1K | 3.02us | 2.58us | 5.38us | 8.88us |


## Redis Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.7K | 148.33us | 140.54us | 182.04us | 388.25us |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.5K | 153.82us | 140.63us | 207.29us | 451.71us |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.7K | 149.38us | 141.21us | 186.17us | 386.79us |


## Postgres Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 3.6K | 274.84us | 261.54us | 348.46us | 582.00us |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 3.6K | 279.10us | 263.00us | 350.58us | 652.58us |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 3.7K | 273.41us | 262.88us | 336.21us | 562.29us |

