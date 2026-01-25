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
import type { HitLimitOptions, HitLimitStore, ResolvedConfig } from '@hitlimit/types'
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

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
