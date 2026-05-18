import { parsePayload } from './validate.js'
import { logger } from './logger.js'
import { handlerErrors, rateLimitHits, invalidPayloads } from './metrics.js'

type Limiter = { allow: (key: string) => boolean }
type SchemaLike<T> = { safeParse(input: unknown): { success: true; data: T } | { success: false } }
type AckCb = (res: { success: false; error: string } | ({ success: true } & Record<string, unknown>)) => void

/**
 * a utility function to create consistent socket event handlers with built-in payload validation, error handling, and optional rate limiting. It returns two functions:
 * - onPayload: for handlers that expect a payload, it validates the payload against a provided schema and handles errors gracefully.
 * - onAck: for handlers that don't expect a payload but still want consistent error handling and optional rate limiting.
 * @param socketId  the ID of the socket for which the handlers are being created, used for rate limiting
 * @returns   an object containing the onPayload and onAck functions that can be used as socket event handlers
 */
export const makeWrapper = (socketId: string) => {
  const onPayload = <T>(
    event: string,
    limiter: Limiter | null,
    schema: SchemaLike<T>,
    fn: (data: T, cb: AckCb) => Promise<void>
  ) => async (rawPayload: unknown, cb: AckCb) => {
    try {
      if (limiter && !limiter.allow(socketId)) { rateLimitHits.inc({ event }); cb({ success: false, error: 'rate_limited' }); return }
      const data = parsePayload(schema, rawPayload)
      if (!data) { invalidPayloads.inc({ event }); cb({ success: false, error: 'invalid_payload' }); return }
      await fn(data, cb)
    } catch (err) {
      logger.error({ err }, `${event} handler threw`)
      handlerErrors.inc({ event })
      cb({ success: false, error: 'server_error' })
    }
  }
/**
 *    a wrapper for socket handlers that provides consistent payload parsing, error handling, and optional rate limiting. It returns two functions:
 *    - onPayload: for handlers that expect a payload, it validates the payload against a provided schema and handles errors gracefully.
 *    - onAck: for handlers that don't expect a payload but still want consistent error handling and optional rate limiting.
 * @param event   a string representing the event name, used for logging errors
 * @param limiter   an optional rate limiter; if provided, the handler will check with the limiter before executing and return a 'rate_limited' error if not allowed
 * @param fn  the actual handler function that will be called if the payload is valid and the rate limiter allows it. It receives the parsed data and an acknowledgment callback.
 * @returns   an object containing the onPayload and onAck functions that can be used as socket event handlers
 */
  const onAck = (
    event: string,
    limiter: Limiter | null,
    fn: (cb: AckCb) => Promise<void>
  ) => async (cb: AckCb) => {
    try {
      if (limiter && !limiter.allow(socketId)) { rateLimitHits.inc({ event }); cb({ success: false, error: 'rate_limited' }); return }
      await fn(cb)
    } catch (err) {
      logger.error({ err }, `${event} handler threw`)
      handlerErrors.inc({ event })
      cb({ success: false, error: 'server_error' })
    }
  }

  return { onPayload, onAck }
}
