import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import express, { type Application } from 'express'
import http from 'http'
import { hitlimit } from '../../src/index.js'
import { memoryStore } from '../../src/stores/memory.js'
import { redisStore } from '../../src/stores/redis.js'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

interface FetchResponse {
  status: number
  body: string
}

async function fetchWithTimeout(url: string, timeout = 5000): Promise<FetchResponse> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy()
      reject(new Error('Request timeout'))
    }, timeout)

    const req = http.get(url, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        clearTimeout(timer)
        resolve({ status: res.statusCode!, body })
      })
    })

    req.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

async function runBatchedLoad(baseUrl: string, totalRequests: number, batchSize: number) {
  const batches = Math.ceil(totalRequests / batchSize)
  const results: FetchResponse[] = []
  const latencies: number[] = []
  let errors = 0

  for (let i = 0; i < batches; i++) {
    const currentBatchSize = Math.min(batchSize, totalRequests - i * batchSize)

    const promises = Array.from({ length: currentBatchSize }, async () => {
      try {
        const reqStart = performance.now()
        const res = await fetchWithTimeout(baseUrl)
        latencies.push(performance.now() - reqStart)
        return res
      } catch (err) {
        errors++
        return null
      }
    })

    const batchResults = await Promise.all(promises)
    results.push(...batchResults.filter((r): r is FetchResponse => r !== null))
  }

  const avgLatency = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0

  return { results, errors, avgLatency, latencies }
}

describe('Performance', () => {
  let app: Application
  let server: http.Server
  let port: number
  let isRedisAvailable = false

  beforeAll(async () => {
    try {
      const testStore = redisStore({ url: REDIS_URL })
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 2000)
      )
      await Promise.race([
        testStore.hit('perf-test', 1000, 1),
        timeout
      ])
      await testStore.reset('perf-test')
      await testStore.shutdown?.()
      isRedisAvailable = true
    } catch {
      isRedisAvailable = false
    }
  })

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => {
          // Wait longer for connections to close after heavy load
          setTimeout(resolve, 200)
        })
      })
    }
  })

  it('handles sustained load with memory store (no errors)', async () => {
    app = express()
    app.use(hitlimit({
      limit: 100000,
      window: '1m',
      store: memoryStore(),
      key: (req) => {
        // Distribute across multiple keys to simulate real traffic
        return req.query.id as string || 'default'
      }
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve())
    })
    port = (server.address() as { port: number }).port
    const url = `http://localhost:${port}/?id=user-1`

    // Warmup: ensure server is ready
    await fetchWithTimeout(url)
    await new Promise(resolve => setTimeout(resolve, 50))

    // Test: 10k requests in batches of 50 (200 batches)
    const { results, errors, avgLatency } = await runBatchedLoad(url, 10000, 50)

    // Assertions: zero errors, all successful
    expect(errors).toBe(0)
    expect(results.length).toBe(10000)
    expect(results.every(r => r.status === 200)).toBe(true)

    // Log performance metrics (informational only, not asserted)
    console.log(`Memory store - Avg latency: ${avgLatency.toFixed(2)}ms, Errors: ${errors}`)
  }, { timeout: 15000 })

  it('handles sustained load with sqlite store (no errors)', async () => {
    app = express()
    app.use(hitlimit({
      limit: 100000,
      window: '1m',
      key: (req) => {
        return req.query.id as string || 'default'
      }
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve())
    })
    port = (server.address() as { port: number }).port
    const url = `http://localhost:${port}/?id=user-2`

    // Warmup
    await fetchWithTimeout(url)
    await new Promise(resolve => setTimeout(resolve, 50))

    // Test: 10k requests in batches of 50
    const { results, errors, avgLatency } = await runBatchedLoad(url, 10000, 50)

    // Assertions
    expect(errors).toBe(0)
    expect(results.length).toBe(10000)
    expect(results.every(r => r.status === 200)).toBe(true)

    // Log performance metrics (informational only, not asserted)
    console.log(`SQLite store - Avg latency: ${avgLatency.toFixed(2)}ms, Errors: ${errors}`)
  }, { timeout: 20000 })

  it('handles sustained load with redis store (no errors)', async () => {
    if (!isRedisAvailable) {
      console.log('Redis not available - skipping Redis performance test')
      return
    }

    const store = redisStore({
      url: REDIS_URL,
      keyPrefix: `hitlimit:perf:${Date.now()}:`
    })

    app = express()
    app.use(hitlimit({
      limit: 100000,
      window: '1m',
      store,
      key: (req) => {
        return req.query.id as string || 'default'
      }
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve())
    })
    port = (server.address() as { port: number }).port
    const url = `http://localhost:${port}/?id=user-3`

    // Warmup
    await fetchWithTimeout(url)
    await new Promise(resolve => setTimeout(resolve, 50))

    // Test: 10k requests in batches of 50
    const { results, errors, avgLatency } = await runBatchedLoad(url, 10000, 50)

    // Assertions
    expect(errors).toBe(0)
    expect(results.length).toBe(10000)
    expect(results.every(r => r.status === 200)).toBe(true)

    // Cleanup Redis store
    await store.shutdown?.()

    // Log performance metrics (informational only, not asserted)
    console.log(`Redis store - Avg latency: ${avgLatency.toFixed(2)}ms, Errors: ${errors}`)
  }, { timeout: 30000 })

  it('correctly enforces rate limits under load', async () => {
    const limit = 100

    app = express()
    app.use(hitlimit({
      limit,
      window: '1m',
      store: memoryStore(),
      key: () => 'rate-limit-test'
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve())
    })
    port = (server.address() as { port: number }).port
    const url = `http://localhost:${port}`

    // Send limit + 50 requests rapidly (in batches of 25)
    const totalRequests = limit + 50
    const results: FetchResponse[] = []

    for (let i = 0; i < Math.ceil(totalRequests / 25); i++) {
      const batchSize = Math.min(25, totalRequests - i * 25)
      const batch = await Promise.all(
        Array.from({ length: batchSize }, () => fetchWithTimeout(url))
      )
      results.push(...batch)
    }

    const successful = results.filter(r => r.status === 200).length
    const blocked = results.filter(r => r.status === 429).length

    // First `limit` requests should succeed, rest should be blocked
    expect(successful).toBe(limit)
    expect(blocked).toBe(50)
    expect(successful + blocked).toBe(totalRequests)

    console.log(`Rate limit test - Allowed: ${successful}, Blocked: ${blocked}`)
  }, { timeout: 10000 })

  it('handles multi-key load distribution', async () => {
    const keysCount = 50
    const requestsPerKey = 40
    const keyBatchSize = 10 // Process 10 keys in parallel

    app = express()
    app.use(hitlimit({
      limit: 1000,
      window: '1m',
      store: memoryStore(),
      key: (req) => {
        return req.query.key as string || 'default'
      }
    }))
    app.get('/', (_req, res) => res.send('OK'))

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve())
    })
    port = (server.address() as { port: number }).port
    const baseUrl = `http://localhost:${port}`

    // Send requests distributed across keys, processing multiple keys in parallel
    const results: FetchResponse[] = []

    for (let batchStart = 0; batchStart < keysCount; batchStart += keyBatchSize) {
      const batchEnd = Math.min(batchStart + keyBatchSize, keysCount)
      const keyBatches = []

      for (let keyId = batchStart; keyId < batchEnd; keyId++) {
        const keyUrl = `${baseUrl}/?key=user-${keyId}`
        keyBatches.push(
          Promise.all(
            Array.from({ length: requestsPerKey }, () => fetchWithTimeout(keyUrl))
          )
        )
      }

      const batchResults = await Promise.all(keyBatches)
      results.push(...batchResults.flat())
    }

    const totalRequests = keysCount * requestsPerKey
    const successful = results.filter(r => r.status === 200).length

    // All requests should succeed (40 per key, limit is 1000)
    expect(successful).toBe(totalRequests)
    expect(results.length).toBe(totalRequests)

    console.log(`Multi-key test - ${keysCount} keys, ${requestsPerKey} req/key, ${successful} successful`)
  }, { timeout: 10000 })
})
