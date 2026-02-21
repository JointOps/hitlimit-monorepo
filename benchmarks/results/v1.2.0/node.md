# Node.js Benchmark Results

**Generated:** 2026-02-21T14:18:54.651Z
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
| hitlimit | 4.71M | 212ns | 208ns | 333ns | 458ns | **fastest** |
| rate-limiter-flexible | 2.31M | 433ns | 333ns | 1.00us | 1.54us | 49% |
| express-rate-limit | 1.43M | 698ns | 583ns | 1.00us | 1.42us | 30% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 1.90M | 528ns | 250ns | 833ns | 1.50us | **fastest** |
| rate-limiter-flexible | 1.51M | 664ns | 500ns | 1.29us | 2.04us | 79% |
| express-rate-limit | 1.24M | 804ns | 625ns | 1.42us | 2.71us | 66% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 2.90M | 345ns | 291ns | 667ns | 1.00us | **fastest** |
| rate-limiter-flexible | 1.08M | 926ns | 584ns | 1.67us | 2.63us | 37% |
| express-rate-limit | 1.04M | 960ns | 750ns | 1.96us | 3.08us | 36% |


## Sqlite Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 451.6K | 2.21us | 1.92us | 3.50us | 4.71us | **fastest** |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 398.9K | 2.51us | 2.29us | 3.63us | 6.42us | **fastest** |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 375.8K | 2.66us | 2.33us | 4.29us | 6.63us | **fastest** |


## Redis Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 6.2K | 160.97us | 150.46us | 195.58us | 414.38us | **fastest** |
| hitlimit | 6.1K | 164.73us | 148.25us | 224.54us | 484.00us | 98% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 6.5K | 154.06us | 147.79us | 182.58us | 313.46us | **fastest** |
| rate-limiter-flexible | 6.3K | 158.31us | 151.38us | 185.42us | 296.21us | 97% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 6.5K | 155.00us | 150.08us | 180.08us | 265.75us | **fastest** |
| hitlimit | 5.9K | 168.89us | 148.83us | 236.79us | 536.46us | 92% |


## Postgres Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 3.5K | 285.94us | 281.38us | 343.13us | 629.88us | **fastest** |
| rate-limiter-flexible | 3.5K | 288.61us | 285.96us | 338.79us | 498.42us | 99% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 3.4K | 291.11us | 289.13us | 359.92us | 491.67us | **fastest** |
| hitlimit | 3.3K | 299.08us | 290.42us | 370.50us | 545.42us | 97% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 3.3K | 300.07us | 288.13us | 381.83us | 674.08us | **fastest** |
| hitlimit | 3.3K | 304.15us | 290.33us | 386.75us | 634.42us | 99% |

