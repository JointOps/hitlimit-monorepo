# Node.js Benchmark Results

**Generated:** 2026-01-27T01:04:21.692Z
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
| rate-limiter-flexible | 3.34M | 300ns | 292ns | 334ns | 417ns | **fastest** |
| hitlimit | 3.13M | 319ns | 292ns | 375ns | 459ns | 94% |
| express-rate-limit | 1.26M | 795ns | 667ns | 833ns | 1.33us | 38% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 2.53M | 396ns | 375ns | 500ns | 667ns | **fastest** |
| hitlimit | 2.07M | 483ns | 375ns | 584ns | 1.33us | 82% |
| express-rate-limit | 1.20M | 834ns | 750ns | 917ns | 1.38us | 47% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 2.32M | 431ns | 375ns | 625ns | 875ns | **fastest** |
| rate-limiter-flexible | 1.63M | 614ns | 542ns | 875ns | 1.21us | 70% |
| express-rate-limit | 1.22M | 818ns | 750ns | 1.12us | 1.37us | 53% |


## Sqlite Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 471.9K | 2.12us | 2.08us | 2.21us | 2.38us | **fastest** |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 402.4K | 2.49us | 2.42us | 2.63us | 2.88us | **fastest** |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 393.4K | 2.54us | 2.50us | 2.71us | 3.13us | **fastest** |


## Redis Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 6.7K | 149.22us | 145.33us | 173.96us | 219.92us | **fastest** |
| rate-limiter-flexible | 6.6K | 151.24us | 147.92us | 176.75us | 218.71us | 99% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 6.6K | 150.89us | 147.21us | 176.17us | 221.37us | **fastest** |
| hitlimit | 6.6K | 152.27us | 146.62us | 177.75us | 251.00us | 99% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 6.6K | 151.90us | 148.71us | 177.37us | 220.46us | **fastest** |
| hitlimit | 6.5K | 153.41us | 146.79us | 183.21us | 293.62us | 99% |

