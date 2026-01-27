# Node.js Benchmark Results

**Generated:** 2026-01-27T00:25:00.646Z
**Node.js:** v24.4.1
**Platform:** darwin arm64

## Store Support Matrix

| Library | Memory | SQLite | Redis |
|---------|--------|--------|-------|
| hitlimit | ✓ | ✓ | ✓ |
| express-rate-limit | ✓ | ✗ | ✗ |
| rate-limiter-flexible | ✓ | ✗ | ✓ |

## Memory Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 3.33M | 300ns | 291ns | 334ns | 458ns | **fastest** |
| hitlimit | 3.05M | 328ns | 333ns | 375ns | 500ns | 92% |
| express-rate-limit | 1.30M | 767ns | 667ns | 792ns | 1.29us | 39% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 2.58M | 387ns | 375ns | 458ns | 500ns | **fastest** |
| rate-limiter-flexible | 2.55M | 392ns | 375ns | 541ns | 750ns | 99% |
| express-rate-limit | 1.20M | 832ns | 750ns | 917ns | 1.71us | 47% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 2.46M | 406ns | 375ns | 583ns | 792ns | **fastest** |
| rate-limiter-flexible | 1.44M | 693ns | 542ns | 917ns | 1.37us | 59% |
| express-rate-limit | 1.22M | 822ns | 750ns | 1.08us | 1.37us | 49% |


## Sqlite Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 410.8K | 2.43us | 2.04us | 2.29us | 2.79us | **fastest** |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 408.3K | 2.45us | 2.38us | 2.58us | 2.83us | **fastest** |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 398.9K | 2.51us | 2.46us | 2.67us | 3.08us | **fastest** |


## Redis Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 6.7K | 150.02us | 147.08us | 173.29us | 214.04us | **fastest** |
| hitlimit | 6.5K | 153.16us | 147.12us | 180.08us | 241.25us | 98% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 6.8K | 146.51us | 143.75us | 165.96us | 197.25us | **fastest** |
| rate-limiter-flexible | 6.5K | 153.28us | 147.83us | 181.83us | 270.67us | 96% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 6.7K | 149.32us | 146.96us | 169.96us | 197.17us | **fastest** |
| hitlimit | 6.7K | 149.92us | 144.63us | 171.21us | 294.00us | 100% |

