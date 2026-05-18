import type { Socket, Server } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents, PlacementResultPayload } from '@backspin-maestro/shared'
import {
  PlacePayloadSchema,
  StealPayloadSchema,
  GuessPayloadSchema,
  DragMovePayloadSchema,
} from '@backspin-maestro/shared'
import { validatePlacement } from '../services/placementService.js'
import { attemptSteal } from '../services/stealService.js'
import { handleGuessService } from '../services/guessService.js'
import { getRandomSong, markSongAsUsed, getFreshPreviewUrl } from '../services/songService.js'
import { getGameState, setGameState } from '../lib/gameCache.js'
import {
  getPlayerBySocketId,
  updatePlayerTokens,
  getSessionRoom,
} from '../lib/session.js'
import { placeLimiter, stealLimiter, skipLimiter, guessLimiter } from '../lib/rateLimit.js'
import {
  openStealWindow, getPending, isResolved,
} from '../lib/roomTimeouts.js'
import {
  scheduleStealFire, scheduleCardReveal,
} from '../lib/jobs.js'
import { config } from '../lib/config.js'
import { parsePayload } from '../lib/validate.js'
import { logger } from '../lib/logger.js'
import { getSocketRoomCode } from '../lib/socketRoom.js'
import { toSong } from '../services/mappers.js'
import { makeWrapper } from '../lib/handlerWrapper.js'

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents>


export const registerGameHandlers = (io: IoServer, socket: IoSocket) => {
  const { onPayload, onAck } = makeWrapper(socket.id)

  socket.on('card:place', onPayload('card:place', placeLimiter, PlacePayloadSchema, async (data, cb) => {
    const roomCode = getSocketRoomCode(socket)
    if (!roomCode) { cb({ success: false, error: 'not_in_room' }); return }

    const player = await getPlayerBySocketId(socket.id)
    if (!player) { cb({ success: false, error: 'player_not_found' }); return }

    const result = await validatePlacement(roomCode, player.id, data.position)
    if ('error' in result) { cb({ success: false, error: result.error }); return }

    const placementPayload: PlacementResultPayload = {
      playerId: player.id,
      correct: result.correct,
      song: result.song,
      correctPosition: result.correctPosition,
    }

    await openStealWindow(roomCode, placementPayload)
    await scheduleStealFire({ roomCode, payload: placementPayload }, config.stealWindowMs)

    io.to(roomCode).emit('steal:open', player.id, data.position)
    cb({ success: true })
  }) as Parameters<typeof socket.on<'card:place'>>[1])

  socket.on('steal:attempt', onPayload('steal:attempt', stealLimiter, StealPayloadSchema, async (data, cb) => {
    const roomCode = getSocketRoomCode(socket)
    if (!roomCode) { cb({ success: false, error: 'not_in_room' }); return }

    const outcome = await attemptSteal(roomCode, socket.id, data.targetPlayerId, data.position)
    if (!outcome.ok) { cb({ success: false, error: outcome.error }); return }

    io.to(roomCode).emit('tokens:updated', outcome.stealerId, outcome.newStealerTokens)
    io.to(roomCode).emit('steal:result', {
      success: true,
      stealerId: outcome.stealerId,
      targetPlayerId: outcome.targetPlayerId,
      correct: outcome.stealCorrect,
      targetWasCorrect: outcome.pending.correct,
      song: outcome.pending.song,
    })
    io.to(roomCode).emit('placement:result', outcome.pending)

    cb({ success: true })

    await scheduleCardReveal({
      roomCode,
      candidateWinnerId: outcome.stealCorrect ? outcome.stealerId : undefined,
    }, config.cardRevealMs)
  }) as Parameters<typeof socket.on<'steal:attempt'>>[1])

  socket.on('steal:initiated', async () => {
    if (!stealLimiter.allow(socket.id)) return
    const stealer = await getPlayerBySocketId(socket.id)
    if (!stealer) return
    const stealerId = stealer.id
    const roomCode = stealer.roomCode
    if (!roomCode) return

    if (await isResolved(roomCode)) return

    const pending = await getPending(roomCode)
    if (!pending) return
    if (pending.playerId === stealerId) return
    if (stealer.tokens < 1) return

    // Replace the in-flight steal-fire job with the extended-delay version.
    await scheduleStealFire({ roomCode, payload: pending }, config.stealExtendedMs)

    io.to(roomCode).emit('steal:extended', stealerId)
  })

  socket.on('song:skip', onAck('song:skip', skipLimiter, async (cb) => {
    const roomCode = getSocketRoomCode(socket)
    if (!roomCode) { cb({ success: false, error: 'not_in_room' }); return }

    const [gameState, room] = await Promise.all([getGameState(roomCode), getSessionRoom(roomCode)])
    if (!gameState || !room) { cb({ success: false, error: 'game_not_found' }); return }
    if (gameState.phase !== 'song_phase') { cb({ success: false, error: 'wrong_phase' }); return }

    const player = await getPlayerBySocketId(socket.id)
    if (!player) { cb({ success: false, error: 'player_not_found' }); return }
    if (player.id !== gameState.currentPlayerId) { cb({ success: false, error: 'not_your_turn' }); return }
    if (player.tokens < 1) { cb({ success: false, error: 'insufficient_tokens' }); return }

    const song = await getRandomSong(roomCode, room.decadeFilter)
    if (!song) { cb({ success: false, error: 'no_songs_left' }); return }

    await updatePlayerTokens(player.id, player.tokens - 1)
    io.to(roomCode).emit('tokens:updated', player.id, player.tokens - 1)

    await markSongAsUsed(roomCode, song.id)
    const freshPreviewUrl = await getFreshPreviewUrl(song.deezer_id)
    await setGameState(roomCode, { ...gameState, currentSongId: song.id, phase: 'song_phase', phaseStartedAt: new Date().toISOString() })

    io.to(roomCode).emit('song:new', toSong(song, freshPreviewUrl))

    cb({ success: true })
  }) as Parameters<typeof socket.on<'song:skip'>>[1])

  socket.on('song:guess', async (payload) => {
    try {
      if (!guessLimiter.allow(socket.id)) return
      const data = parsePayload(GuessPayloadSchema, payload)
      if (!data) return
      const roomCode = getSocketRoomCode(socket)
      if (!roomCode) return

      const result = await handleGuessService(roomCode, socket.id, data.artist, data.title)
      if ('error' in result) { logger.warn({ err: result.error }, 'song:guess service returned error'); return }

      if (result.correct) {
        io.to(roomCode).emit('token:earned', result.playerId, result.tokens)
      }
    } catch (err) {
      logger.error({ err }, 'song:guess handler threw')
    }
  })

  socket.on('audio:play', (payload) => {
    const roomCode = getSocketRoomCode(socket)
    if (roomCode) socket.to(roomCode).emit('audio:play', { currentTime: payload?.currentTime ?? 0, serverTime: Date.now() })
  })

  socket.on('audio:pause', () => {
    const roomCode = getSocketRoomCode(socket)
    if (roomCode) socket.to(roomCode).emit('audio:pause')
  })

  socket.on('drag:move', (payload) => {
    const data = parsePayload(DragMovePayloadSchema, payload)
    if (!data) return
    const roomCode = getSocketRoomCode(socket)
    if (roomCode) socket.to(roomCode).emit('drag:update', data.slot)
  })
}
