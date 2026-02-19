# Node.js Benchmark Results

**Generated:** 2026-02-19T02:23:25.264Z
**Node.js:** v24.4.1
**Platform:** darwin arm64

## Store Support Matrix

| Library | Memory | SQLite | Redis | Postgres |
|---------|--------|--------|-------|----------|
| hitlimit | ✓ | ✓ | ✓ | ✓ |
| express-rate-limit | ✓ | ✗ | ✗ | ✗ |
| rate-limiter-flexible | ✓ | ✗ | ✓ | ✓ |

## Memory Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 2.77M | 361ns | 333ns | 583ns | 708ns | **fastest** |
| rate-limiter-flexible | 2.29M | 436ns | 375ns | 667ns | 917ns | 83% |
| express-rate-limit | 792.2K | 1.26us | 833ns | 1.83us | 2.75us | 29% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 2.06M | 486ns | 417ns | 916ns | 1.17us | **fastest** |
| rate-limiter-flexible | 1.63M | 612ns | 459ns | 1.21us | 1.79us | 79% |
| express-rate-limit | 987.1K | 1.01us | 875ns | 1.83us | 2.46us | 48% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 1.85M | 542ns | 458ns | 1.00us | 1.63us | **fastest** |
| rate-limiter-flexible | 1.21M | 824ns | 666ns | 1.63us | 2.63us | 66% |
| express-rate-limit | 891.9K | 1.12us | 916ns | 2.17us | 3.00us | 48% |


## Sqlite Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 413.4K | 2.42us | 2.04us | 4.17us | 6.00us | **fastest** |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 358.1K | 2.79us | 2.42us | 4.46us | 6.75us | **fastest** |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 351.9K | 2.84us | 2.50us | 4.54us | 7.00us | **fastest** |


## Redis Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 6.1K | 164.28us | 146.88us | 199.04us | 454.67us | **fastest** |
| rate-limiter-flexible | 3.2K | 313.67us | 157.50us | 739.50us | 2.41ms | 52% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 6.3K | 158.25us | 149.92us | 193.46us | 391.58us | **fastest** |
| hitlimit | 6.2K | 161.31us | 147.71us | 224.08us | 458.79us | 98% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 6.8K | 147.82us | 145.79us | 170.00us | 209.17us | **fastest** |
| rate-limiter-flexible | 6.3K | 159.32us | 148.54us | 188.88us | 419.13us | 93% |


## Postgres Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 3.2K | 314.39us | 301.00us | 407.50us | 584.04us | **fastest** |
| hitlimit | 2.7K | 375.59us | 345.25us | 465.54us | 790.38us | 84% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 3.0K | 331.61us | 308.04us | 441.88us | 799.88us | **fastest** |
| hitlimit | 2.6K | 388.51us | 349.67us | 488.83us | 1.09ms | 85% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 3.0K | 330.61us | 309.25us | 424.58us | 720.63us | **fastest** |
| hitlimit | 2.5K | 392.68us | 358.29us | 492.38us | 983.00us | 84% |

