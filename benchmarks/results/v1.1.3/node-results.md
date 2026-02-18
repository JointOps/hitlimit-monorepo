# Node.js Benchmark Results

**Generated:** 2026-02-18T01:28:34.718Z
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
| hitlimit | 4.11M | 243ns | 250ns | 292ns | 375ns | **fastest** |
| rate-limiter-flexible | 3.22M | 311ns | 292ns | 375ns | 542ns | 78% |
| express-rate-limit | 1.21M | 823ns | 708ns | 875ns | 1.46us | 30% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 3.48M | 287ns | 291ns | 334ns | 375ns | **fastest** |
| rate-limiter-flexible | 2.43M | 412ns | 375ns | 625ns | 834ns | 70% |
| express-rate-limit | 1.26M | 797ns | 750ns | 958ns | 1.87us | 36% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 3.25M | 308ns | 292ns | 458ns | 625ns | **fastest** |
| rate-limiter-flexible | 1.84M | 544ns | 500ns | 834ns | 1.12us | 57% |
| express-rate-limit | 957.2K | 1.04us | 916ns | 1.33us | 1.67us | 29% |


## Sqlite Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 490.4K | 2.04us | 2.00us | 2.12us | 2.29us | **fastest** |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 417.0K | 2.40us | 2.38us | 2.54us | 2.63us | **fastest** |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 401.2K | 2.49us | 2.46us | 2.67us | 3.08us | **fastest** |


## Redis Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 6.8K | 146.11us | 143.42us | 170.33us | 222.00us | **fastest** |
| rate-limiter-flexible | 6.7K | 150.20us | 146.08us | 173.46us | 219.25us | 97% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 6.9K | 144.34us | 142.62us | 165.75us | 191.75us | **fastest** |
| rate-limiter-flexible | 6.6K | 151.46us | 148.33us | 171.38us | 198.25us | 95% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 6.8K | 147.36us | 145.29us | 168.04us | 190.92us | **fastest** |
| rate-limiter-flexible | 6.6K | 151.89us | 148.67us | 172.33us | 201.29us | 97% |

