import Redis from 'ioredis'
import { logger } from './logger.js'

const attachHandlers = (client: Redis, name: string) => {
  client.on('error', (err) => logger.error({ err, client: name }, 'redis error'))
  client.on('reconnecting', () => logger.warn({ client: name }, 'redis reconnecting'))
}

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
attachHandlers(redis, 'main')

export const pubClient = redis.duplicate()
attachHandlers(pubClient, 'pub')

export const subClient = redis.duplicate()
attachHandlers(subClient, 'sub')