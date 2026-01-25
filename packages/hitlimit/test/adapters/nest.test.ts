import 'reflect-metadata'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common'
import request from 'supertest'
import { HitLimitModule, HitLimitGuard, HitLimit } from '../../src/nest.js'
import { memoryStore } from '../../src/stores/memory.js'

@Controller()
class TestController {
  @Get('/')
  index() {
    return { message: 'OK' }
  }

  @Get('/limited')
  @HitLimit({ limit: 2, window: '1m' })
  @UseGuards(HitLimitGuard)
  limited() {
    return { message: 'OK' }
  }

  @Get('/custom-key')
  @HitLimit({
    limit: 2,
    window: '1m',
    key: (req) => req.headers['x-user-id'] as string || 'anonymous'
  })
  @UseGuards(HitLimitGuard)
  customKey() {
    return { message: 'OK' }
  }
}

describe('NestJS Adapter', () => {
  let app: INestApplication
  let module: TestingModule

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        HitLimitModule.register({
          limit: 100,
          window: '1m',
          store: memoryStore()
        })
      ],
      controllers: [TestController]
    }).compile()

    app = module.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('allows requests to unguarded routes', async () => {
    const res = await request(app.getHttpServer()).get('/')
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('OK')
  })

  it('applies route-level limits with decorator', async () => {
    await request(app.getHttpServer()).get('/limited')
    await request(app.getHttpServer()).get('/limited')
    const res = await request(app.getHttpServer()).get('/limited')

    expect(res.status).toBe(429)
    expect(res.body.hitlimit).toBe(true)
  })

  it('includes rate limit headers', async () => {
    const res = await request(app.getHttpServer()).get('/limited')

    expect(res.headers['ratelimit-limit']).toBe('2')
    expect(res.headers['ratelimit-remaining']).toBe('1')
  })

  it('supports custom key in decorator', async () => {
    await request(app.getHttpServer())
      .get('/custom-key')
      .set('X-User-Id', 'user1')

    await request(app.getHttpServer())
      .get('/custom-key')
      .set('X-User-Id', 'user1')

    const res1 = await request(app.getHttpServer())
      .get('/custom-key')
      .set('X-User-Id', 'user1')
    expect(res1.status).toBe(429)

    const res2 = await request(app.getHttpServer())
      .get('/custom-key')
      .set('X-User-Id', 'user2')
    expect(res2.status).toBe(200)
  })
})

describe('NestJS Module registerAsync', () => {
  let app: INestApplication

  afterEach(async () => {
    if (app) await app.close()
  })

  it('supports async registration', async () => {
    @Controller()
    class AsyncTestController {
      @Get('/')
      @UseGuards(HitLimitGuard)
      index() {
        return { message: 'OK' }
      }
    }

    const module = await Test.createTestingModule({
      imports: [
        HitLimitModule.registerAsync({
          useFactory: () => ({
            limit: 5,
            window: '1m',
            store: memoryStore()
          })
        })
      ],
      controllers: [AsyncTestController]
    }).compile()

    app = module.createNestApplication()
    await app.init()

    const res = await request(app.getHttpServer()).get('/')
    expect(res.status).toBe(200)
    expect(res.headers['ratelimit-limit']).toBe('5')
  })
})
