export interface HitLimitOptions<TRequest = any> {
  limit?: number
  window?: string | number
  key?: KeyGenerator<TRequest>
  tiers?: Record<string, TierConfig>
  tier?: TierResolver<TRequest>
  response?: ResponseConfig | ResponseFormatter
  headers?: HeadersConfig
  store?: HitLimitStore
  onStoreError?: StoreErrorHandler<TRequest>
  skip?: SkipFunction<TRequest>
  logger?: HitLimitLogger
}

export interface TierConfig {
  limit: number
  window?: string | number
}

export interface HitLimitInfo {
  limit: number
  remaining: number
  resetIn: number
  resetAt: number
  key: string
  tier?: string
}

export interface HitLimitResult {
  allowed: boolean
  info: HitLimitInfo
  headers: Record<string, string>
  body: Record<string, any>
}

export interface HitLimitStore {
  hit(key: string, windowMs: number, limit: number): Promise<StoreResult> | StoreResult
  reset(key: string): Promise<void> | void
  shutdown?(): Promise<void> | void
}

export interface StoreResult {
  count: number
  resetAt: number
}

export interface HitLimitLogger {
  debug(message: string, meta?: Record<string, any>): void
  info(message: string, meta?: Record<string, any>): void
  warn(message: string, meta?: Record<string, any>): void
  error(message: string, meta?: Record<string, any>): void
}

export class HitLimitError extends Error {
  constructor(message: string, public readonly code: ErrorCode) {
    super(message)
    this.name = 'HitLimitError'
  }
}

export class StoreError extends HitLimitError {
  constructor(message: string, public readonly cause?: Error) {
    super(message, 'STORE_ERROR')
    this.name = 'StoreError'
  }
}

export class ConfigError extends HitLimitError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR')
    this.name = 'ConfigError'
  }
}

export type ErrorCode =
  | 'STORE_ERROR'
  | 'STORE_TIMEOUT'
  | 'CONFIG_ERROR'
  | 'KEY_ERROR'
  | 'TIER_ERROR'

export interface HeadersConfig {
  standard?: boolean
  legacy?: boolean
  retryAfter?: boolean
}

export interface ResolvedConfig<TRequest = any> {
  limit: number
  windowMs: number
  key: KeyGenerator<TRequest>
  tiers?: Record<string, TierConfig>
  tier?: TierResolver<TRequest>
  response: ResponseConfig | ResponseFormatter
  headers: Required<HeadersConfig>
  store: HitLimitStore
  onStoreError: StoreErrorHandler<TRequest>
  skip?: SkipFunction<TRequest>
  logger?: HitLimitLogger
}

export type KeyGenerator<TRequest = any> = (req: TRequest) => string | Promise<string>
export type TierResolver<TRequest = any> = (req: TRequest) => string | Promise<string>
export type SkipFunction<TRequest = any> = (req: TRequest) => boolean | Promise<boolean>
export type StoreErrorHandler<TRequest = any> = (error: Error, req: TRequest) => 'allow' | 'deny' | Promise<'allow' | 'deny'>
export type ResponseFormatter = (info: HitLimitInfo) => Record<string, any>
export type ResponseConfig = Record<string, any>

export const DEFAULT_LIMIT = 100
export const DEFAULT_WINDOW = '1m'
export const DEFAULT_WINDOW_MS = 60000
export const DEFAULT_MESSAGE = 'Whoa there! Rate limit exceeded.'
