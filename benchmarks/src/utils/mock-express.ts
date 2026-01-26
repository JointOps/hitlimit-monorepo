/**
 * Mock Express request/response for benchmarking middleware
 */

export interface MockRequest {
  ip: string
  socket: { remoteAddress: string }
  headers: Record<string, string>
  path: string
  method: string
  url: string
  app: { get: (setting: string) => any }
  user?: { plan?: string }  // For tiered limit testing
}

export interface MockResponse {
  statusCode: number
  headers: Record<string, string>
  body: any
  writableEnded: boolean

  setHeader(key: string, value: string): void
  getHeader(key: string): string | undefined
  status(code: number): MockResponse
  json(body: any): MockResponse
  send(body: any): MockResponse
  set(key: string, value: string): void
}

export function createMockRequest(ip: string, overrides?: Partial<MockRequest>): MockRequest {
  return {
    ip,
    socket: { remoteAddress: ip },
    headers: {},
    path: '/api/test',
    method: 'GET',
    url: '/api/test',
    app: {
      get: (setting: string) => {
        if (setting === 'trust proxy') return false
        return undefined
      }
    },
    ...overrides
  }
}

export function createMockResponse(): MockResponse {
  const headers: Record<string, string> = {}
  const res: MockResponse = {
    statusCode: 200,
    headers,
    body: null,
    writableEnded: false,

    setHeader(key, value) { headers[key] = value },
    getHeader(key) { return headers[key] },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
    send(body) { this.body = body; return this },
    set(key, value) { headers[key] = value }
  }
  return res
}

/**
 * Generate a unique IP address based on iteration number
 */
export function generateIP(iteration: number, poolSize: number): string {
  const index = iteration % poolSize
  const b1 = Math.floor(index / 65536) % 256
  const b2 = Math.floor(index / 256) % 256
  const b3 = index % 256
  return `10.${b1}.${b2}.${b3}`
}
