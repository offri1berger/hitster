import { db } from '../db/database.js'
import { getGameState } from '../lib/gameCache.js'
import { getPlayerBySocketId, updatePlayerTokens } from '../lib/session.js'
import { distance } from 'fastest-levenshtein'

export const normalize = (str: string) =>
  str.toLowerCase()
    .normalize('NFD')                          
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0590-\u05ff\s]/g, '') 
    .trim()

export const isFuzzyMatch = (input: string, target: string): boolean => {
  const a = normalize(input)
  const b = normalize(target)
  if (!a || !b) return false
  if (b.includes(a) || a.includes(b)) return true
  const maxDistance = b.length <= 4 ? 1 : b.length <= 8 ? 2 : 3
  return distance(a, b) <= maxDistance
}

export const handleGuessService = async (
  roomCode: string,
  socketId: string,
  artist: string,
  title: string
): Promise<{ correct: boolean; tokens: number; playerId: string } | { error: string }> => {
  const gameState = await getGameState(roomCode)
  if (!gameState) return { error: 'game_not_found' }
if (!gameState.currentSongId) return { error: 'no_current_song' }

  const player = await getPlayerBySocketId(socketId)
  if (!player) return { error: 'player_not_found' }
  if (player.id !== gameState.currentPlayerId) return { error: 'not_your_turn' }

  const song = await db
    .selectFrom('songs')
    .selectAll()
    .where('id', '=', gameState.currentSongId)
    .executeTakeFirstOrThrow()

  const artistMatch = isFuzzyMatch(artist, song.artist)
  const titleMatch = isFuzzyMatch(title, song.title)
  const correct = artistMatch && titleMatch

  if (!correct) return { correct: false, tokens: player.tokens, playerId: player.id }

  const newTokens = player.tokens + 1
  await updatePlayerTokens(player.id, newTokens)

  return { correct: true, tokens: newTokens, playerId: player.id }
}
