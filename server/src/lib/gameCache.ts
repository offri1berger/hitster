import { redis } from './redis.js'
import { safeJsonParse } from './safeJson.js'
import { config } from './config.js'
import type { GamePhase } from '@backspin-maestro/shared'

export interface CachedGameState {
  phase: GamePhase
  currentPlayerId: string
  currentSongId: string | null
  roundNumber: number
  phaseStartedAt: string
}

const gameKey = (roomCode: string) => `game:${roomCode}`
const usedSongsKey = (roomCode: string) => `used_songs:${roomCode}`

export const setGameState = async (roomCode: string, state: CachedGameState) =>
  redis.set(gameKey(roomCode), JSON.stringify(state), 'EX', config.gameTtlSeconds)

export const getGameState = async (roomCode: string): Promise<CachedGameState | null> => {
  const data = await redis.get(gameKey(roomCode))
  if (!data) return null
  const parsed = safeJsonParse<CachedGameState>(data, `gameState:${roomCode}`)
  if (!parsed) await redis.del(gameKey(roomCode))
  return parsed
}

export const deleteGameState = async (roomCode: string) =>
  redis.del(gameKey(roomCode))

export const addUsedSong = async (roomCode: string, songId: string) => {
  const key = usedSongsKey(roomCode)
  await redis.sadd(key, songId)
  await redis.expire(key, config.gameTtlSeconds)
}

export const getUsedSongIds = async (roomCode: string): Promise<string[]> =>
  redis.smembers(usedSongsKey(roomCode))

export const deleteUsedSongs = async (roomCode: string) =>
  redis.del(usedSongsKey(roomCode))