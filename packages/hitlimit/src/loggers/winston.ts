import type { Logger as WinstonLogger } from 'winston'
import type { HitLimitLogger } from '@joint-ops/hitlimit-types'

export function winstonLogger(winston: WinstonLogger): HitLimitLogger {
  return {
    debug: (msg, meta) => winston.debug(msg, { ...meta, component: 'hitlimit' }),
    info: (msg, meta) => winston.info(msg, { ...meta, component: 'hitlimit' }),
    warn: (msg, meta) => winston.warn(msg, { ...meta, component: 'hitlimit' }),
    error: (msg, meta) => winston.error(msg, { ...meta, component: 'hitlimit' })
  }
}
