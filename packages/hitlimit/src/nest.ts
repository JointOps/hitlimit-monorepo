import {
  Module,
  DynamicModule,
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  SetMetadata,
  Optional,
  type Type
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request, Response } from 'express'
import type { HitLimitOptions, HitLimitStore, ResolvedConfig, StoreResult } from '@joint-ops/hitlimit-types'
import { resolveConfig } from './core/config.js'
import { checkLimit } from './core/limiter.js'
import { memoryStore } from './stores/memory.js'

export const HITLIMIT_OPTIONS = 'HITLIMIT_OPTIONS'
export const HITLIMIT_ROUTE_OPTIONS = 'HITLIMIT_ROUTE_OPTIONS'

export interface HitLimitModuleOptions extends HitLimitOptions<Request> {}

export interface HitLimitModuleAsyncOptions {
  imports?: Type<any>[]
  inject?: any[]
  useFactory: (...args: any[]) => Promise<HitLimitModuleOptions> | HitLimitModuleOptions
}

function getDefaultKey(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

@Injectable()
export class HitLimitGuard implements CanActivate {
  private config: ResolvedConfig<Request>
  private store: HitLimitStore
  private reflector: Reflector

  constructor(
    @Inject(HITLIMIT_OPTIONS) private options: HitLimitModuleOptions,
    @Optional() reflector?: Reflector
  ) {
    this.reflector = reflector || new Reflector()
    this.store = options.store ?? memoryStore()
    this.config = resolveConfig(options, this.store, getDefaultKey)
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const response = context.switchToHttp().getResponse<Response>()

    const routeOptions = this.reflector.get<HitLimitOptions<Request>>(
      HITLIMIT_ROUTE_OPTIONS,
      context.getHandler()
    )

    let config = this.config
    if (routeOptions) {
      config = resolveConfig(
        { ...this.options, ...routeOptions },
        routeOptions.store ?? this.store,
        routeOptions.key ?? getDefaultKey
      )
    }

    // Sync fast path: sync store + default key + no skip/tiers/ban/group + no route overrides
    const store = config.store
    if (
      store.isSync === true &&
      !config.skip &&
      !(config.tier && config.tiers) &&
      !config.ban &&
      !config.group &&
      !routeOptions?.key
    ) {
      return this.canActivateSync(request, response, config)
    }

    return this.canActivateAsync(request, response, config)
  }

  private canActivateSync(request: Request, response: Response, config: ResolvedConfig<Request>): boolean {
    const key = request.ip || request.socket?.remoteAddress || 'unknown'
    const result = config.store.hit(key, config.windowMs, config.limit) as StoreResult
    const allowed = result.count <= config.limit
    const remaining = Math.max(0, config.limit - result.count)
    const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000)

    if (config.headers.standard) {
      response.setHeader('RateLimit-Limit', config.limit)
      response.setHeader('RateLimit-Remaining', remaining)
      response.setHeader('RateLimit-Reset', resetIn)
    }
    if (config.headers.legacy) {
      response.setHeader('X-RateLimit-Limit', config.limit)
      response.setHeader('X-RateLimit-Remaining', remaining)
      response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000))
    }

    if (!allowed) {
      if (config.headers.retryAfter) {
        response.setHeader('Retry-After', resetIn)
      }
      const body = typeof config.response === 'function'
        ? config.response({ limit: config.limit, remaining: 0, resetIn, resetAt: result.resetAt, key })
        : { ...config.response, limit: config.limit, remaining: 0, resetIn }
      response.status(429).json(body)
      return false
    }

    return true
  }

  private async canActivateAsync(request: Request, response: Response, config: ResolvedConfig<Request>): Promise<boolean> {
    if (config.skip) {
      const shouldSkip = await config.skip(request)
      if (shouldSkip) {
        return true
      }
    }

    try {
      const result = await checkLimit(config, request)

      Object.entries(result.headers).forEach(([key, value]) => {
        response.setHeader(key, value)
      })

      if (!result.allowed) {
        response.status(429).json(result.body)
        return false
      }

      return true
    } catch (error) {
      const action = await config.onStoreError(error as Error, request)
      if (action === 'deny') {
        response.status(429).json({ hitlimit: true, message: 'Rate limit error' })
        return false
      }
      return true
    }
  }
}

export function HitLimit(options: HitLimitOptions<Request>): MethodDecorator {
  return SetMetadata(HITLIMIT_ROUTE_OPTIONS, options)
}

@Module({})
export class HitLimitModule {
  static register(options: HitLimitModuleOptions = {}): DynamicModule {
    return {
      module: HitLimitModule,
      providers: [
        {
          provide: HITLIMIT_OPTIONS,
          useValue: options
        },
        HitLimitGuard
      ],
      exports: [HITLIMIT_OPTIONS, HitLimitGuard]
    }
  }

  static registerAsync(options: HitLimitModuleAsyncOptions): DynamicModule {
    return {
      module: HitLimitModule,
      imports: options.imports || [],
      providers: [
        {
          provide: HITLIMIT_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || []
        },
        HitLimitGuard
      ],
      exports: [HITLIMIT_OPTIONS, HitLimitGuard]
    }
  }
}
