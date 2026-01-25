import type { HitLimitLogger } from '@hitlimit/types'

export function consoleLogger(): HitLimitLogger {
  return {
    debug: (msg, meta) => console.debug(`[hitlimit] ${msg}`, meta),
    info: (msg, meta) => console.info(`[hitlimit] ${msg}`, meta),
    warn: (msg, meta) => console.warn(`[hitlimit] ${msg}`, meta),
    error: (msg, meta) => console.error(`[hitlimit] ${msg}`, meta)
  }
}

export function silentLogger(): HitLimitLogger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  }
}
