import { randomUUID } from 'crypto'
import { redis } from './redis.js'
import { safeJsonParse } from './safeJson.js'
import { config } from './config.js'
import type { Song, TimelineEntry, DecadeFilter } from '@backspin-maestro/shared'

const roomKey = (code: string) => `room:${code}`
const roomPlayersKey = (code: string) => `room:${code}:players`
const playerKey = (id: string) => `player:${id}`
const timelineKey = (playerId: string) => `timeline:${playerId}`
const socketPlayerKey = (socketId: string) => `socket:${socketId}`


/**
 *  A simple distributed lock implementation using Redis SET with NX and expiration.
 *  Not reentrant. Intended for short critical sections (under 5 seconds) to prevent race conditions when modifying session data. In case of lock contention, it retries once after a short delay before failing.
 *  For operations that require multiple locks, acquire them in a consistent sorted order to prevent deadlocks.
 * @param key A unique identifier for the lock, e.g. "room:ABC123" or "player:xyz789"   
 * @param fn The critical section to execute once the lock is acquired. Should be a short operation that interacts with Redis to read/modify session data. The lock will automatically expire after 5 seconds to prevent deadlock in case of crashes, but should be released as soon as possible. 
 * @returns The result of the critical section function, or throws an error if the lock could not be acquired after one retry.
 * @throws Error if lock contention occurs and the lock cannot be acquired after one retry. 
 */
const withLock = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  const lockKey = `lock:${key}`
  const token = randomUUID()
  let acquired = await redis.set(lockKey, token, 'EX', 5, 'NX')
  if (!acquired) {
    await new Promise((r) => setTimeout(r, 50))
    acquired = await redis.set(lockKey, token, 'EX', 5, 'NX')
  }
  if (!acquired) throw new Error(`Lock contention: ${key}`)
  try {
    return await fn()
  } finally {
    const current = await redis.get(lockKey)
    if (current === token) await redis.del(lockKey)
  }
}

/**
 * A utility function to acquire locks on multiple keys in a consistent sorted order to prevent deadlocks, execute a critical section, and release the locks. Intended for operations that need to modify multiple related pieces of session data atomically, e.g. transferring host from one player to another requires locking both player records and the room record. The function will attempt to acquire locks on all specified keys, retrying once if there is contention, and will throw an error if it cannot acquire all locks after one retry.
 * @param keys An array of unique identifiers for the locks to acquire, e.g. ["room:ABC123", "player:xyz789", "player:abc123"]. The function will sort and deduplicate the keys before attempting to acquire locks to ensure a consistent locking order and prevent deadlocks.
 * @param fn The critical section to execute once all locks are acquired. Should be a short operation that interacts with Redis to read/modify session data. All specified locks will automatically expire after 5 seconds to prevent deadlock in case of crashes, but should be released as soon as possible.
 * @returns The result of the critical section function, or throws an error if the locks could not be acquired after one retry.
 * @throws Error if lock contention occurs and the locks cannot be acquired after one retry. The error message will indicate which key caused the contention. 
 */
const withLocks = async <T>(keys: string[], fn: () => Promise<T>): Promise<T> => {
  const sorted = [...new Set(keys)].sort()
  const acquired: Array<{ lockKey: string; token: string }> = []
  try {
    for (const key of sorted) {
      const lockKey = `lock:${key}`
      const token = randomUUID()
      let result = await redis.set(lockKey, token, 'EX', 5, 'NX')
      if (!result) {
        await new Promise((r) => setTimeout(r, 50))
        result = await redis.set(lockKey, token, 'EX', 5, 'NX')
      }
      if (!result) throw new Error(`Lock contention: ${key}`)
      acquired.push({ lockKey, token })
    }
    return await fn()
  } finally {
    await Promise.allSettled(
      acquired.map(async ({ lockKey, token }) => {
        const current = await redis.get(lockKey)
        if (current === token) await redis.del(lockKey)
      }),
    )
  }
}

export interface SessionRoom {
  code: string
  status: 'lobby' | 'playing' | 'finished'
  hostId: string
  songsPerPlayer: number
  decadeFilter: DecadeFilter
}

export interface SessionPlayer {
  id: string
  roomCode: string
  name: string
  avatar: string
  socketId: string
  tokens: number
  isHost: boolean
  turnOrder: number
}

// ── Room ─────────────────────────────────────────────────────────────────────

export const createSessionRoom = async (code: string, data: Omit<SessionRoom, 'code'>): Promise<SessionRoom> => {
  const room: SessionRoom = { code, ...data }
  await redis.set(roomKey(code), JSON.stringify(room), 'EX', config.sessionTtlSeconds)
  return room
}

export const getSessionRoom = async (code: string): Promise<SessionRoom | null> => {
  const raw = await redis.get(roomKey(code))
  if (!raw) return null
  const parsed = safeJsonParse<SessionRoom>(raw, `room:${code}`)
  if (!parsed) await redis.del(roomKey(code))
  return parsed
}

export const updateRoomStatus = async (code: string, status: SessionRoom['status']) =>
  withLock(roomKey(code), async () => {
    const room = await getSessionRoom(code)
    if (!room) return
    await redis.set(roomKey(code), JSON.stringify({ ...room, status }), 'EX', config.sessionTtlSeconds)
  })

export const updateRoomSettings = async (
  code: string,
  settings: Pick<SessionRoom, 'songsPerPlayer' | 'decadeFilter'>,
) =>
  withLock(roomKey(code), async () => {
    const room = await getSessionRoom(code)
    if (!room) return
    await redis.set(roomKey(code), JSON.stringify({ ...room, ...settings }), 'EX', config.sessionTtlSeconds)
  })

// ── Player ───────────────────────────────────────────────────────────────────

export const createSessionPlayer = async (
  data: Omit<SessionPlayer, 'id'> & { id?: string }
): Promise<SessionPlayer> => {
  const player: SessionPlayer = { ...data, id: data.id ?? randomUUID() }
  await redis.set(playerKey(player.id), JSON.stringify(player), 'EX', config.sessionTtlSeconds)
  await redis.sadd(roomPlayersKey(player.roomCode), player.id)
  await redis.expire(roomPlayersKey(player.roomCode), config.sessionTtlSeconds)
  if (player.socketId) {
    await redis.set(socketPlayerKey(player.socketId), player.id, 'EX', config.sessionTtlSeconds)
  }
  return player
}

export const getSessionPlayer = async (id: string): Promise<SessionPlayer | null> => {
  const raw = await redis.get(playerKey(id))
  if (!raw) return null
  const parsed = safeJsonParse<SessionPlayer>(raw, `player:${id}`)
  if (!parsed) await redis.del(playerKey(id))
  return parsed
}

export const getPlayerBySocketId = async (socketId: string): Promise<SessionPlayer | null> => {
  const playerId = await redis.get(socketPlayerKey(socketId))
  if (!playerId) return null
  return getSessionPlayer(playerId)
}

export const getPlayersByRoomCode = async (roomCode: string): Promise<SessionPlayer[]> => {
  const ids = await redis.smembers(roomPlayersKey(roomCode))
  const players = await Promise.all(ids.map(getSessionPlayer))
  return players.filter((p): p is SessionPlayer => p !== null)
}

const savePlayer = async (player: SessionPlayer) => {
  await redis.set(playerKey(player.id), JSON.stringify(player), 'EX', config.sessionTtlSeconds)
}

export const updatePlayerTokens = async (id: string, tokens: number) =>
  withLock(playerKey(id), async () => {
    const player = await getSessionPlayer(id)
    if (!player) return
    await savePlayer({ ...player, tokens: Math.max(0, tokens) })
  })

export const updatePlayerTurnOrder = async (id: string, turnOrder: number) =>
  withLock(playerKey(id), async () => {
    const player = await getSessionPlayer(id)
    if (!player) return
    await savePlayer({ ...player, turnOrder })
  })

export const updatePlayerSocketId = async (id: string, newSocketId: string) =>
  withLock(playerKey(id), async () => {
    const player = await getSessionPlayer(id)
    if (!player) return
    const pipeline = redis.pipeline()
    if (player.socketId) pipeline.del(socketPlayerKey(player.socketId))
    pipeline.set(playerKey(id), JSON.stringify({ ...player, socketId: newSocketId }), 'EX', config.sessionTtlSeconds)
    pipeline.set(socketPlayerKey(newSocketId), id, 'EX', config.sessionTtlSeconds)
    await pipeline.exec()
  })

// ── Timeline ─────────────────────────────────────────────────────────────────

export const addToTimeline = async (playerId: string, song: Song) => {
  // score = year so ZRANGE returns entries in chronological order automatically
  await redis.zadd(timelineKey(playerId), song.year, JSON.stringify(song))
  await redis.expire(timelineKey(playerId), config.sessionTtlSeconds)
}

export const getTimeline = async (playerId: string): Promise<TimelineEntry[]> => {
  const members = await redis.zrange(timelineKey(playerId), 0, -1)
  return members
    .map((m) => safeJsonParse<Song>(m, `timeline:${playerId}`))
    .filter((song): song is Song => song !== null)
    .map((song, i) => ({ song, position: i }))
}

export const getTimelineCount = async (playerId: string): Promise<number> =>
  redis.zcard(timelineKey(playerId))

// ── Cleanup ──────────────────────────────────────────────────────────────────

export const resetSessionPlayer = async (playerId: string) =>
  withLock(playerKey(playerId), async () => {
    const player = await getSessionPlayer(playerId)
    if (!player) return
    const pipeline = redis.pipeline()
    pipeline.del(timelineKey(playerId))
    pipeline.set(playerKey(playerId), JSON.stringify({ ...player, tokens: config.starterTokens, turnOrder: 0 }), 'EX', config.sessionTtlSeconds)
    await pipeline.exec()
  })

export const removeSessionPlayer = async (playerId: string) => {
  const player = await getSessionPlayer(playerId)
  if (!player) return
  if (player.socketId) await redis.del(socketPlayerKey(player.socketId))
  await redis.srem(roomPlayersKey(player.roomCode), playerId)
  await redis.del(playerKey(playerId))
  await redis.del(timelineKey(playerId))
}

export const transferHost = async (roomCode: string, oldHostId: string, newHostId: string) =>
  withLocks([roomKey(roomCode), playerKey(oldHostId), playerKey(newHostId)], async () => {
    const [room, oldHost, newHost] = await Promise.all([
      getSessionRoom(roomCode),
      getSessionPlayer(oldHostId),
      getSessionPlayer(newHostId),
    ])
    const pipeline = redis.pipeline()
    if (room) pipeline.set(roomKey(roomCode), JSON.stringify({ ...room, hostId: newHostId }), 'EX', config.sessionTtlSeconds)
    if (oldHost) pipeline.set(playerKey(oldHostId), JSON.stringify({ ...oldHost, isHost: false }), 'EX', config.sessionTtlSeconds)
    if (newHost) pipeline.set(playerKey(newHostId), JSON.stringify({ ...newHost, isHost: true }), 'EX', config.sessionTtlSeconds)
    await pipeline.exec()
  })

export const deleteSessionRoom = async (roomCode: string) => {
  const ids = await redis.smembers(roomPlayersKey(roomCode))
  await Promise.all(ids.map(async (id) => {
    const player = await getSessionPlayer(id)
    if (player?.socketId) await redis.del(socketPlayerKey(player.socketId))
    await redis.del(playerKey(id))
    await redis.del(timelineKey(id))
  }))
  await redis.del(roomPlayersKey(roomCode))
  await redis.del(roomKey(roomCode))
}
