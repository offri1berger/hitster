import { Queue, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'
import type { Server } from 'socket.io'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  PlacementResultPayload,
} from '@backspin-maestro/shared'
import {
  tryClaimResolution,
  clearPending,
  cleanupRoomState,
} from './roomTimeouts.js'
import {
  getSessionRoom,
  updateRoomStatus,
  getPlayersByRoomCode,
} from './session.js'
import { checkWinCondition, nextTurnService } from '../services/gameService.js'
import { toPlayerWithTimeline } from '../services/mappers.js'
import { deleteUsedSongs } from './gameCache.js'
import { logger } from './logger.js'
import { jobDuration, jobsCompleted, jobsFailed, jobsStalled } from './metrics.js'
import { config } from './config.js'
import { posthog } from './posthog.js'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const QUEUE_NAME = 'room-jobs'

export interface StealFireData {
  roomCode: string
  payload: PlacementResultPayload
}

export interface CardRevealData {
  roomCode: string
  candidateWinnerId?: string
}

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>

let bullConnection: IORedis | null = null
let queue: Queue | null = null
let worker: Worker | null = null

const getConnection = (): IORedis => {
  if (!bullConnection) {
    // BullMQ requires `maxRetriesPerRequest: null` for the blocking connection
    // used by Worker. Use a dedicated client distinct from the app's main redis.
    bullConnection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null })
  }
  return bullConnection
}

const getQueue = (): Queue => {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: getConnection() })
  }
  return queue
}

export const getRoomQueue = (): Queue => getQueue()

// BullMQ disallows `:` in custom job IDs.
const stealFireJobId = (roomCode: string) => `steal-fire_${roomCode}`
const cardRevealJobId = (roomCode: string) => `card-reveal_${roomCode}`

const replaceDelayed = async (
  q: Queue,
  jobId: string,
  name: 'steal:fire' | 'card-reveal',
  data: StealFireData | CardRevealData,
  delayMs: number,
) => {
  const existing = await q.getJob(jobId)
  if (existing) {
    await existing.remove().catch(() => undefined)
  }
  await q.add(name, data, {
    delay: delayMs,
    jobId,
    removeOnComplete: true,
    removeOnFail: 100,
  })
}

export const scheduleStealFire = async (data: StealFireData, delayMs: number): Promise<void> => {
  await replaceDelayed(getQueue(), stealFireJobId(data.roomCode), 'steal:fire', data, delayMs)
}

export const cancelStealFire = async (roomCode: string): Promise<void> => {
  const job = await getQueue().getJob(stealFireJobId(roomCode))
  if (job) await job.remove().catch(() => undefined)
}

export const scheduleCardReveal = async (data: CardRevealData, delayMs: number): Promise<void> => {
  await replaceDelayed(getQueue(), cardRevealJobId(data.roomCode), 'card-reveal', data, delayMs)
}

export const cancelCardReveal = async (roomCode: string): Promise<void> => {
  const job = await getQueue().getJob(cardRevealJobId(roomCode))
  if (job) await job.remove().catch(() => undefined)
}

// Cancel any in-flight steal/reveal jobs for a room and mark the room resolved
// so any worker that already picked up a job bails before mutating state.
export const cancelRoomTimers = async (roomCode: string): Promise<void> => {
  await Promise.all([cancelStealFire(roomCode), cancelCardReveal(roomCode)])
  await tryClaimResolution(roomCode)
}

const buildGameOverPlayers = async (roomCode: string) => {
  const players = await getPlayersByRoomCode(roomCode)
  return Promise.all(players.map(toPlayerWithTimeline))
}

const finishGame = async (io: IoServer, roomCode: string, winnerId: string) => {
  await updateRoomStatus(roomCode, 'finished')
  await deleteUsedSongs(roomCode)
  await cleanupRoomState(roomCode)
  const players = await buildGameOverPlayers(roomCode)
  posthog.capture({
    distinctId: winnerId,
    event: 'game_completed',
    properties: {
      room_code: roomCode,
      player_count: players.length,
      winner_timeline_length: players.find((p) => p.id === winnerId)?.timeline.length ?? 0,
    },
  })
  io.to(roomCode).emit('game:over', winnerId, players)
}

const processStealFire = async (io: IoServer, data: StealFireData): Promise<void> => {
  const { roomCode, payload } = data
  if (!(await tryClaimResolution(roomCode))) return

  io.to(roomCode).emit('placement:result', payload)
  await clearPending(roomCode)

  if (payload.correct) {
    const room = await getSessionRoom(roomCode)
    if (!room) {
      logger.error({ roomCode }, 'processStealFire: room missing, cannot check win')
      return
    }
    const won = await checkWinCondition(payload.playerId, room.songsPerPlayer)
    if (won) {
      await finishGame(io, roomCode, payload.playerId)
      return
    }
  }

  await scheduleCardReveal({ roomCode }, config.cardRevealMs)
}

const processCardReveal = async (io: IoServer, data: CardRevealData): Promise<void> => {
  const { roomCode, candidateWinnerId } = data
  if (candidateWinnerId) {
    const room = await getSessionRoom(roomCode)
    if (room) {
      const won = await checkWinCondition(candidateWinnerId, room.songsPerPlayer)
      if (won) {
        await finishGame(io, roomCode, candidateWinnerId)
        return
      }
    }
  }
  await clearPending(roomCode)
  const next = await nextTurnService(roomCode)
  if ('error' in next) {
    // Any failure (no songs, expired game state, etc.) ends the game gracefully
    // rather than leaving clients stuck on the placement-result toast.
    logger.error({ roomCode, err: next.error }, 'processCardReveal: nextTurnService failed, ending game')
    const players = await buildGameOverPlayers(roomCode)
    if (players.length === 0) return
    const leader = [...players].sort((a, b) =>
      b.timeline.length - a.timeline.length
      || b.tokens - a.tokens
      || a.turnOrder - b.turnOrder
    )[0]
    await updateRoomStatus(roomCode, 'finished')
    await deleteUsedSongs(roomCode)
    await cleanupRoomState(roomCode)
    io.to(roomCode).emit('game:over', leader.id, players)
    return
  }
  io.to(roomCode).emit('phase:changed', 'song_phase', new Date().toISOString(), next.nextPlayerId)
  io.to(roomCode).emit('song:new', next.song)
}

/**
 *  Starts the room worker that processes delayed jobs for game actions like steal resolution and card reveal.
 * @param io  The Socket.IO server instance, used to emit events to clients when processing jobs.
 * @returns   The started Worker instance. If the worker is already running, returns the existing instance.
 */
export const startRoomWorker = (io: IoServer): Worker => {
  if (worker) return worker

  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      if (job.name === 'steal:fire') {
        await processStealFire(io, job.data as StealFireData)
      } else if (job.name === 'card-reveal') {
        await processCardReveal(io, job.data as CardRevealData)
      }
    },
    { connection: getConnection() },
  )

  worker.on('completed', (job) => {
    const name = job.name
    jobsCompleted.inc({ job_name: name })
    if (job.processedOn && job.finishedOn) {
      jobDuration.observe({ job_name: name }, (job.finishedOn - job.processedOn) / 1000)
    }
    logger.debug({ jobName: name, jobId: job.id, roomCode: (job.data as { roomCode?: string })?.roomCode }, 'job completed')
  })

  worker.on('failed', (job, err) => {
    jobsFailed.inc({ job_name: job?.name ?? 'unknown' })
    logger.error({ err, jobName: job?.name, jobId: job?.id, roomCode: (job?.data as { roomCode?: string })?.roomCode }, 'job failed')
  })

  worker.on('stalled', (jobId) => {
    jobsStalled.inc()
    logger.warn({ jobId }, 'job stalled')
  })

  return worker
}

export const closeRoomQueue = async (): Promise<void> => {
  await Promise.allSettled([worker?.close(), queue?.close()])
  worker = null
  queue = null
  if (bullConnection) {
    await bullConnection.quit().catch(() => undefined)
    bullConnection = null
  }
}
