import { db } from '../db/database.js'
import { addUsedSong, getUsedSongIds } from '../lib/gameCache.js'
import { getSessionRoom } from '../lib/session.js'
import { deezerFetches } from '../lib/metrics.js'
import { logger } from '../lib/logger.js'
import { config } from '../lib/config.js'
import type { DecadeFilter } from '@backspin-maestro/shared'

/**
 *  Fetches a random song from the database that hasn't been used in the specified room yet, optionally filtered by decade. It first retrieves the list of used song IDs for the room and the decade filter from the session data. Then it counts how many songs are available that match the criteria and selects a random one using an offset. If no songs are available, it returns null. This function is used to assign new songs to players during game setup and throughout the game as needed.
 * @param roomCode  the code of the room for which to fetch a random song, used to determine which songs have already been used in that room
 * @param overrideDecadeFilter  an optional decade filter that can override the room's default decade filter, allowing for more flexible song selection based on specific game settings or player preferences
 * @returns   a random song from the database that hasn't been used in the specified room yet, optionally filtered by decade. If no songs are available that match the criteria, it returns null. This allows the game to provide a unique and relevant song selection for each player while avoiding repeats within the same game session.
 */
export const getRandomSong = async (roomCode: string, overrideDecadeFilter?: DecadeFilter) => {
  const usedIds = await getUsedSongIds(roomCode)
  const decadeFilter = overrideDecadeFilter ?? (await getSessionRoom(roomCode))?.decadeFilter ?? 'all'
  logger.debug({ roomCode, decadeFilter, caller: new Error().stack?.split('\n')[2]?.trim() }, 'getRandomSong')
  const decadesIn: string[] | null = decadeFilter === 'all'
    ? null
    : Array.isArray(decadeFilter) ? decadeFilter : [decadeFilter]

  let countQuery = db.selectFrom('songs').select((eb) => eb.fn.countAll<number>().as('count'))
  if (usedIds.length > 0) countQuery = countQuery.where('id', 'not in', usedIds)
  if (decadesIn) countQuery = countQuery.where('decade', 'in', decadesIn)

  const { count } = await countQuery.executeTakeFirstOrThrow()
  const total = Number(count)
  if (total === 0) return null

  let songQuery = db.selectFrom('songs').selectAll().limit(1).offset(Math.floor(Math.random() * total))
  if (usedIds.length > 0) songQuery = songQuery.where('id', 'not in', usedIds)
  if (decadesIn) songQuery = songQuery.where('decade', 'in', decadesIn)

  return (await songQuery.executeTakeFirst()) ?? null
}

/**
 *  Marks a song as used in the specified room by adding its ID to the list of used songs in the game cache. This function is called whenever a song is assigned to a player or played during the game, ensuring that the same song won't be selected again for that room. By keeping track of used songs, it helps maintain variety and prevents repeats within the same game session, enhancing the overall gaming experience for players.
 * @param roomCode  the code of the room for which to mark the song as used, used to associate the song with the correct game session and ensure it won't be selected again for that room
 * @param songId  the unique identifier of the song to be marked as used, which will be added to the list of used songs for the specified room in the game cache
 * @returns   a promise that resolves when the song has been successfully marked as used in the game cache. This allows the game to maintain an accurate record of which songs have been played in each room, preventing duplicates and ensuring a fresh selection of songs for players throughout the game session.  
 */
export const markSongAsUsed = async (roomCode: string, songId: string) => {
  await addUsedSong(roomCode, songId)
}

/**
 * Fetches a fresh preview URL for a song from the Deezer API using its Deezer ID. It makes an HTTP request to the Deezer API endpoint for the specific track, with a timeout to prevent hanging requests. If the request is successful and a preview URL is available, it returns the URL. If the request fails, times out, or if no preview is available, it logs the error and returns null. This function is used to ensure that players receive a valid and up-to-date preview URL for each song during the game, enhancing their gaming experience by allowing them to listen to the correct audio snippet for guessing.
 * @param deezerId  the unique identifier of the song on Deezer, used to fetch the specific track information and preview URL from the Deezer API
 * @returns a fresh preview URL for the specified song from the Deezer API. If the request fails, times out, or if no preview is available, it returns null. This allows the game to provide players with a valid audio snippet for each song, enhancing their ability to guess the song correctly and enjoy the game.
 */
export const getFreshPreviewUrl = async (deezerId: string): Promise<string | null> => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.deezerTimeoutMs)
    const res = await fetch(`https://api.deezer.com/track/${deezerId}`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) {
      deezerFetches.inc({ result: 'fail' })
      logger.warn({ deezerId, status: res.status }, 'deezer preview fetch non-2xx')
      return null
    }
    const data = (await res.json()) as { preview?: string | null }
    deezerFetches.inc({ result: 'ok' })
    return data.preview ?? null
  } catch (err) {
    deezerFetches.inc({ result: 'fail' })
    logger.warn({ err, deezerId }, 'deezer preview fetch threw')
    return null
  }
}