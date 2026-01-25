import type { Logger as PinoLogger } from 'pino'
import type { HitLimitLogger } from '@hitlimit/types'

export function pinoLogger(pino: PinoLogger): HitLimitLogger {
  const child = pino.child({ component: 'hitlimit' })
  return {
    debug: (msg, meta) => child.debug(meta, msg),
    info: (msg, meta) => child.info(meta, msg),
    warn: (msg, meta) => child.warn(meta, msg),
    error: (msg, meta) => child.error(meta, msg)
  }
}
