/**
 * Benchmark scenarios representing real-world usage patterns
 */

import { createMockRequest, createMockResponse, generateIP } from '../utils/mock-express.js'

export interface Scenario {
  name: string
  description: string
  generateRequest: (iteration: number) => {
    req: any
    res: any
    next: () => void
  }
}

export const scenarios: Scenario[] = [
  {
    name: 'single-ip',
    description: 'Single IP hammering the API (worst case for that IP)',
    generateRequest: () => ({
      req: createMockRequest('192.168.1.1'),
      res: createMockResponse(),
      next: () => {}
    })
  },

  {
    name: 'multi-ip-100',
    description: '100 unique IPs (small API)',
    generateRequest: (i) => ({
      req: createMockRequest(generateIP(i, 100)),
      res: createMockResponse(),
      next: () => {}
    })
  },

  {
    name: 'multi-ip-1k',
    description: '1,000 unique IPs (typical small-medium API)',
    generateRequest: (i) => ({
      req: createMockRequest(generateIP(i, 1000)),
      res: createMockResponse(),
      next: () => {}
    })
  },

  {
    name: 'multi-ip-10k',
    description: '10,000 unique IPs (high-traffic API)',
    generateRequest: (i) => ({
      req: createMockRequest(generateIP(i, 10000)),
      res: createMockResponse(),
      next: () => {}
    })
  },

  {
    name: 'tiered-limits',
    description: 'Different user tiers (tests tier resolution overhead)',
    generateRequest: (i) => {
      const tiers = ['free', 'pro', 'enterprise']
      const tier = tiers[i % 3]
      return {
        req: createMockRequest(generateIP(i, 1000), { user: { plan: tier } }),
        res: createMockResponse(),
        next: () => {}
      }
    }
  },

  {
    name: 'burst-100',
    description: '100 IPs each making 100 rapid requests (10k total)',
    generateRequest: (i) => ({
      req: createMockRequest(`192.168.1.${Math.floor(i / 100) % 256}`),
      res: createMockResponse(),
      next: () => {}
    })
  },

  {
    name: 'rate-limited',
    description: 'Requests that hit the rate limit (tests rejection path)',
    generateRequest: () => ({
      req: createMockRequest('192.168.1.1'),  // Same IP to trigger limits
      res: createMockResponse(),
      next: () => {}
    })
  }
]

export function getScenario(name: string): Scenario | undefined {
  return scenarios.find(s => s.name === name)
}

export function listScenarios(): string[] {
  return scenarios.map(s => s.name)
}
