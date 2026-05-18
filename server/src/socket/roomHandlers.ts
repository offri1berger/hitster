import type { Socket, Server } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@backspin-maestro/shared'
import {
  CreateRoomPayloadSchema,
  JoinRoomPayloadSchema,
  RejoinPayloadSchema,
  KickPayloadSchema,
  RoomSettingsSchema,
} from '@backspin-maestro/shared'
import { createRoomService, joinRoomService, rejoinRoomService, resetRoomService, updateRoomSettingsService } from '../services/roomService.js'
import { startGameService } from '../services/gameService.js'
import { cancelDisconnectTimer, finalizeDisconnect } from './disconnectHandler.js'
import {
  getPlayerBySocketId, getSessionPlayer, getSessionRoom, removeSessionPlayer,
} from '../lib/session.js'
import { roomLimiter } from '../lib/rateLimit.js'
import { requireConductor } from '../lib/authz.js'
import { getSocketRoomCode } from '../lib/socketRoom.js'
import { config } from '../lib/config.js'
import { makeWrapper } from '../lib/handlerWrapper.js'
import { gamesStarted, playersJoined, reconnects } from '../lib/metrics.js'

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents>

export const registerRoomHandlers = (io: IoServer, socket: IoSocket) => {
  const { onPayload, onAck } = makeWrapper(socket.id)

  socket.on('room:create', onPayload('room:create', roomLimiter, CreateRoomPayloadSchema, async (data, cb) => {
    const result = await createRoomService(data, socket.id)
    socket.join(result.roomCode)
    cb({ success: true, ...result })
  }) as Parameters<typeof socket.on<'room:create'>>[1])

  socket.on('room:join', onPayload('room:join', roomLimiter, JoinRoomPayloadSchema, async (data, cb) => {
    const result = await joinRoomService(data, socket.id)
    if (!result.success) { cb(result); return }

    playersJoined.inc()
    socket.join(data.roomCode)
    socket.to(data.roomCode).emit('player:joined', {
      id: result.playerId!,
      name: data.playerName,
      avatar: data.avatar,
      tokens: config.starterTokens,
      isHost: false,
      turnOrder: 0,
      timeline: result.timeline ?? [],
    })
    cb(result)
  }) as Parameters<typeof socket.on<'room:join'>>[1])

  socket.on('room:rejoin', onPayload('room:rejoin', null, RejoinPayloadSchema, async (data, cb) => {
    const { playerId, roomCode } = data
    cancelDisconnectTimer(playerId)
    const result = await rejoinRoomService(playerId, roomCode, socket.id)
    if (result.success) {
      reconnects.inc()
      socket.join(roomCode)
      socket.to(roomCode).emit('player:reconnected', playerId)
    }
    cb(result)
  }) as Parameters<typeof socket.on<'room:rejoin'>>[1])

  socket.on('game:start', onAck('game:start', roomLimiter, async (cb) => {
    const roomCode = getSocketRoomCode(socket)
    if (!roomCode) { cb({ success: false, error: 'not_in_room' }); return }

    const result = await startGameService(roomCode, socket.id)
    if ('error' in result) { cb({ success: false, error: result.error }); return }

    gamesStarted.inc()
    io.to(roomCode).emit('game:starting', result.gameState, result.players)
    if (result.song) io.to(roomCode).emit('song:new', result.song)
    cb({ success: true })
  }) as Parameters<typeof socket.on<'game:start'>>[1])

  socket.on('room:leave', async () => {
    const player = await getPlayerBySocketId(socket.id)
    if (!player) return
    cancelDisconnectTimer(player.id)
    await finalizeDisconnect(io, player.id, player.roomCode)
    socket.leave(player.roomCode)
  })

  socket.on('conductor:kick', onPayload('conductor:kick', roomLimiter, KickPayloadSchema, async (data, cb) => {
    const auth = await requireConductor(socket.id)
    if (!auth.ok) { cb({ success: false, error: auth.error }); return }
    if (data.playerId === auth.player.id) { cb({ success: false, error: 'cannot_kick_self' }); return }

    const room = await getSessionRoom(auth.roomCode)
    if (!room) { cb({ success: false, error: 'room_not_found' }); return }
    // Kicks are a lobby-only social signal. Once the game's started the
    // Conductor has no special powers (see Conductor spec).
    if (room.status !== 'lobby') { cb({ success: false, error: 'not_in_lobby' }); return }

    const target = await getSessionPlayer(data.playerId)
    if (!target || target.roomCode !== auth.roomCode) { cb({ success: false, error: 'target_not_found' }); return }

    // Emit BEFORE removing — the kicked socket needs the event to navigate
    // out cleanly, and they're still in the room broadcast group right now.
    io.to(auth.roomCode).emit('player:kicked', target.id)

    const targetSocket = io.sockets.sockets.get(target.socketId)
    if (targetSocket) targetSocket.leave(auth.roomCode)
    cancelDisconnectTimer(target.id)
    await removeSessionPlayer(target.id)

    cb({ success: true })
  }) as Parameters<typeof socket.on<'conductor:kick'>>[1])

  socket.on('room:updateSettings', onPayload('room:updateSettings', roomLimiter, RoomSettingsSchema, async (data, cb) => {
    const result = await updateRoomSettingsService(socket.id, data)
    if ('error' in result) { cb({ success: false, error: result.error }); return }

    io.to(result.roomCode).emit('room:settingsUpdated', data)
    cb({ success: true })
  }) as Parameters<typeof socket.on<'room:updateSettings'>>[1])

  socket.on('room:reset', onAck('room:reset', roomLimiter, async (cb) => {
    const roomCode = getSocketRoomCode(socket)
    if (!roomCode) { cb({ success: false, error: 'not_in_room' }); return }

    const result = await resetRoomService(roomCode, socket.id)
    if ('error' in result) { cb({ success: false, error: result.error }); return }

    io.to(roomCode).emit('game:reset', result.players)
    cb({ success: true })
  }) as Parameters<typeof socket.on<'room:reset'>>[1])
}
