import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import cors from 'cors'
import helmet from 'helmet'
import type { ServerToClientEvents, ClientToServerEvents } from '@backspin-maestro/shared'
import { registerRoomHandlers } from './socket/roomHandlers.js'
import { registerGameHandlers } from './socket/gameHandlers.js'
import { handleDisconnect } from './socket/disconnectHandler.js'
import { clearAllLimits } from './lib/rateLimit.js'
import { db } from './db/database.js'
import { redis, pubClient, subClient } from './lib/redis.js'
import { startRoomWorker, closeRoomQueue, getRoomQueue } from './lib/jobs.js'
import { logger } from './lib/logger.js'
import { collectMetrics, setMetricsSources } from './lib/metrics.js'

const app = express()
const httpServer = createServer(app)

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: process.env.CLIENT_URL ?? 'http://localhost:5173' },
  adapter: createAdapter(pubClient, subClient),
})

app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173' }))
app.use(express.json({ limit: '100kb' }))

app.get('/health', async (_req, res) => {
  try {
    await db.selectFrom('songs').select('id').limit(1).execute()
    await redis.ping()
    res.json({ ok: true })
  } catch (err) {
    logger.error({ err }, 'health check failed')
    res.status(503).json({ ok: false })
  }
})

// Prometheus scrape endpoint. Fail-closed: if METRICS_TOKEN is unset the route
// returns 503, so an unconfigured deploy never accidentally exposes internals.
app.get('/metrics', async (req, res) => {
  const token = process.env.METRICS_TOKEN
  if (!token) { res.status(503).type('text/plain').send('metrics disabled'); return }
  const header = req.headers.authorization
  if (header !== `Bearer ${token}`) { res.status(401).type('text/plain').send('unauthorized'); return }
  const { contentType, body } = await collectMetrics()
  res.set('Content-Type', contentType).send(body)
})

startRoomWorker(io)
setMetricsSources({ io, queue: getRoomQueue() })

io.on('connection', (socket) => {
  logger.debug({ socketId: socket.id }, 'client connected')

  registerRoomHandlers(io, socket)
  registerGameHandlers(io, socket)

  socket.on('disconnect', async () => {
    logger.debug({ socketId: socket.id }, 'client disconnected')
    clearAllLimits(socket.id)
    try { await handleDisconnect(io, socket) } catch (err) { logger.error({ err, socketId: socket.id }, 'disconnect handler failed') }
  })
})

const PORT = process.env.PORT ?? 8080
const server = httpServer.listen(PORT, () => logger.info({ port: PORT }, 'server running'))

const shutdown = () => {
  server.close(async () => {
    await io.close()
    await closeRoomQueue()
    await db.destroy()
    await Promise.all([redis.quit(), pubClient.quit(), subClient.quit()])
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection')
})
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException')
  process.exit(1)
})