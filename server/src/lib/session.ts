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

export const updateRoomStatus = async (code: string, status: SessionRoom['status']) => {
  const room = await getSessionRoom(code)
  if (!room) return
  await redis.set(roomKey(code), JSON.stringify({ ...room, status }), 'EX', config.sessionTtlSeconds)
}

export const updateRoomSettings = async (
  code: string,
  settings: Pick<SessionRoom, 'songsPerPlayer' | 'decadeFilter'>,
) => {
  const room = await getSessionRoom(code)
  if (!room) return
  await redis.set(roomKey(code), JSON.stringify({ ...room, ...settings }), 'EX', config.sessionTtlSeconds)
}

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

export const updatePlayerTokens = async (id: string, tokens: number) => {
  const player = await getSessionPlayer(id)
  if (!player) return
  await savePlayer({ ...player, tokens: Math.max(0, tokens) })
}

export const updatePlayerTurnOrder = async (id: string, turnOrder: number) => {
  const player = await getSessionPlayer(id)
  if (!player) return
  await savePlayer({ ...player, turnOrder })
}

export const updatePlayerSocketId = async (id: string, newSocketId: string) => {
  const player = await getSessionPlayer(id)
  if (!player) return
  if (player.socketId) await redis.del(socketPlayerKey(player.socketId))
  await savePlayer({ ...player, socketId: newSocketId })
  await redis.set(socketPlayerKey(newSocketId), id, 'EX', config.sessionTtlSeconds)
}

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

export const resetSessionPlayer = async (playerId: string) => {
  const player = await getSessionPlayer(playerId)
  if (!player) return
  await redis.del(timelineKey(playerId))
  await redis.set(playerKey(playerId), JSON.stringify({ ...player, tokens: config.starterTokens, turnOrder: 0 }), 'EX', config.sessionTtlSeconds)
}

export const removeSessionPlayer = async (playerId: string) => {
  const player = await getSessionPlayer(playerId)
  if (!player) return
  if (player.socketId) await redis.del(socketPlayerKey(player.socketId))
  await redis.srem(roomPlayersKey(player.roomCode), playerId)
  await redis.del(playerKey(playerId))
  await redis.del(timelineKey(playerId))
}

export const transferHost = async (roomCode: string, oldHostId: string, newHostId: string) => {
  const room = await getSessionRoom(roomCode)
  if (room) {
    await redis.set(roomKey(roomCode), JSON.stringify({ ...room, hostId: newHostId }), 'EX', config.sessionTtlSeconds)
  }
  const oldHost = await getSessionPlayer(oldHostId)
  if (oldHost) await redis.set(playerKey(oldHostId), JSON.stringify({ ...oldHost, isHost: false }), 'EX', config.sessionTtlSeconds)
  const newHost = await getSessionPlayer(newHostId)
  if (newHost) await redis.set(playerKey(newHostId), JSON.stringify({ ...newHost, isHost: true }), 'EX', config.sessionTtlSeconds)
}

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
