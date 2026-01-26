import { describe, it, expect, spyOn } from 'bun:test'
import { consoleLogger, silentLogger } from '../../src/loggers/console'

describe('consoleLogger', () => {
  it('logs debug messages', () => {
    const logger = consoleLogger()
    const spy = spyOn(console, 'debug').mockImplementation(() => {})

    logger.debug('test message', { key: 'value' })

    expect(spy).toHaveBeenCalledWith('[hitlimit] test message', { key: 'value' })
    spy.mockRestore()
  })

  it('logs info messages', () => {
    const logger = consoleLogger()
    const spy = spyOn(console, 'info').mockImplementation(() => {})

    logger.info('test info', { count: 5 })

    expect(spy).toHaveBeenCalledWith('[hitlimit] test info', { count: 5 })
    spy.mockRestore()
  })

  it('logs warn messages', () => {
    const logger = consoleLogger()
    const spy = spyOn(console, 'warn').mockImplementation(() => {})

    logger.warn('test warning', { error: 'something' })

    expect(spy).toHaveBeenCalledWith('[hitlimit] test warning', { error: 'something' })
    spy.mockRestore()
  })

  it('logs error messages', () => {
    const logger = consoleLogger()
    const spy = spyOn(console, 'error').mockImplementation(() => {})

    logger.error('test error', { stack: 'trace' })

    expect(spy).toHaveBeenCalledWith('[hitlimit] test error', { stack: 'trace' })
    spy.mockRestore()
  })
})

describe('silentLogger', () => {
  it('does not log anything', () => {
    const logger = silentLogger()
    const debugSpy = spyOn(console, 'debug')
    const infoSpy = spyOn(console, 'info')
    const warnSpy = spyOn(console, 'warn')
    const errorSpy = spyOn(console, 'error')

    logger.debug('test')
    logger.info('test')
    logger.warn('test')
    logger.error('test')

    expect(debugSpy).not.toHaveBeenCalled()
    expect(infoSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()

    debugSpy.mockRestore()
    infoSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })
})
