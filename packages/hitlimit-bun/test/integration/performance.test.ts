import { describe, it, expect, afterEach } from 'bun:test'
import { hitlimit } from '../../src/index'
import { memoryStore } from '../../src/stores/memory'

describe('Performance', () => {
  let server: ReturnType<typeof Bun.serve>

  afterEach(() => {
    server?.stop()
  })

  it('handles high throughput with memory store', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit(
        { limit: 100000, window: '1m', store: memoryStore() },
        () => new Response('OK')
      )
    })

    const start = performance.now()
    const requests = 10000

    const promises = Array.from({ length: requests }, () =>
      fetch(`http://localhost:${server.port}`)
    )

    await Promise.all(promises)
    const duration = performance.now() - start
    const rps = requests / (duration / 1000)

    console.log(`Memory store: ${rps.toFixed(0)} req/sec`)
    expect(rps).toBeGreaterThan(5000)
  })

  it('handles high throughput with sqlite store', async () => {
    server = Bun.serve({
      port: 0,
      fetch: hitlimit(
        { limit: 100000, window: '1m' },
        () => new Response('OK')
      )
    })

    const start = performance.now()
    const requests = 10000

    const promises = Array.from({ length: requests }, () =>
      fetch(`http://localhost:${server.port}`)
    )

    await Promise.all(promises)
    const duration = performance.now() - start
    const rps = requests / (duration / 1000)

    console.log(`SQLite store: ${rps.toFixed(0)} req/sec`)
    expect(rps).toBeGreaterThan(3000)
  })
})
