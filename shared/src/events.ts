import { z } from 'zod'
import { GamePhase } from './enums.js'
import type { RoomStatus } from './enums.js'
import type { Player, Song, RoomSettings, GameState, TimelineEntry } from './types.js'
import {
  CreateRoomPayloadSchema,
  JoinRoomPayloadSchema,
  RejoinPayloadSchema,
  PlacePayloadSchema,
  GuessPayloadSchema,
  StealPayloadSchema,
  DragMovePayloadSchema,
  KickPayloadSchema,
} from './schemas.js'

export type CreateRoomPayload = z.infer<typeof CreateRoomPayloadSchema>
export type JoinRoomPayload = z.infer<typeof JoinRoomPayloadSchema>
export type RejoinPayload = z.infer<typeof RejoinPayloadSchema>
export type PlacePayload = z.infer<typeof PlacePayloadSchema>
export type GuessPayload = z.infer<typeof GuessPayloadSchema>
export type StealPayload = z.infer<typeof StealPayloadSchema>
export type DragMovePayload = z.infer<typeof DragMovePayloadSchema>
export type KickPayload = z.infer<typeof KickPayloadSchema>

// Generic ack envelope for client→server commands. The error union narrows
// per-event so clients can exhaustively switch on `error`.
export type AckResult<E extends string = string> =
  | { success: true }
  | { success: false; error: E }

export type CreateRoomResult =
  | { success: true; roomCode: string; playerId: string; timeline: TimelineEntry[] }
  | { success: false; error: 'invalid_payload' | 'rate_limited' | 'server_error' }

export type JoinRoomResult =
  | {
      success: true
      roomCode: string
      playerId: string
      players: Player[]
      settings: RoomSettings
      timeline: TimelineEntry[]
    }
  | {
      success: false
      error: 'room_not_found' | 'room_full' | 'game_already_started' | 'invalid_payload' | 'rate_limited' | 'server_error'
    }

export type RoomResetResult = AckResult<
  | 'rate_limited' | 'not_in_room' | 'room_not_found' | 'not_host' | 'server_error'
>

export type GameStartResult = AckResult<
  | 'rate_limited' | 'not_in_room' | 'room_not_found' | 'game_already_started'
  | 'not_host' | 'not_enough_players' | 'server_error'
>

export type SongSkipResult = AckResult<
  | 'rate_limited' | 'not_in_room' | 'game_not_found' | 'wrong_phase'
  | 'player_not_found' | 'not_your_turn' | 'insufficient_tokens'
  | 'no_songs_left' | 'server_error'
>

export type CardPlaceResult = AckResult<
  | 'rate_limited' | 'invalid_payload' | 'not_in_room' | 'player_not_found'
  | 'game_not_found' | 'wrong_phase' | 'not_your_turn' | 'no_current_song'
  | 'invalid_position' | 'server_error'
>

export type StealAttemptResult = AckResult<
  | 'rate_limited' | 'invalid_payload' | 'not_in_room' | 'game_not_found'
  | 'no_current_song' | 'steal_window_closed' | 'no_pending_result'
  | 'player_not_found' | 'target_not_found' | 'cannot_steal_from_self'
  | 'insufficient_tokens' | 'server_error'
>

export type ConductorKickResult = AckResult<
  | 'rate_limited' | 'invalid_payload' | 'player_not_found' | 'not_in_room'
  | 'not_conductor' | 'cannot_kick_self' | 'room_not_found' | 'not_in_lobby'
  | 'target_not_found' | 'server_error'
>

export type UpdateRoomSettingsResult = AckResult<
  | 'rate_limited' | 'invalid_payload' | 'player_not_found' | 'not_in_room'
  | 'not_conductor' | 'room_not_found' | 'not_in_lobby' | 'server_error'
>

export interface PlacementResultPayload {
  playerId: string
  correct: boolean
  song: Song
  correctPosition: number
}

export type RejoinResult =
  | { success: false; error: 'room_not_found' | 'player_not_found' }
  | {
      success: true
      roomStatus: RoomStatus
      players: Player[]
      settings: RoomSettings
      gameState: GameState | null
    }

export interface StealResultPayload {
  success: boolean
  stealerId: string
  targetPlayerId: string
  correct: boolean
  targetWasCorrect: boolean  // true = active player placed correctly (steal was futile)
  song: Song
}

export interface ServerToClientEvents {
  'player:joined': (player: Player) => void
  'player:left': (playerId: string) => void
  'game:starting': (state: GameState, players: Player[]) => void
  'song:new': (song: Song) => void
  'phase:changed': (phase: GamePhase, phaseStartedAt: string, currentPlayerId?: string) => void
  'token:earned': (playerId: string, newTotal: number) => void
  'song:skipped': (newSong: Song) => void
  'placement:result': (result: PlacementResultPayload) => void
  'steal:result': (result: StealResultPayload) => void
  'game:over': (winnerId: string, players: Player[]) => void
  'error': (message: string) => void
  'audio:play': (payload: { currentTime: number; serverTime: number }) => void
  'audio:pause': () => void
  'drag:update': (slot: number | null) => void
  'tokens:updated': (playerId: string, newTotal: number) => void
  'steal:open': (targetPlayerId: string, originalPosition: number) => void
  'steal:extended': (stealerId: string) => void
  'player:disconnected': (playerId: string) => void
  'player:reconnected': (playerId: string) => void
  'host:transferred': (newHostId: string) => void
  'game:reset': (players: Player[]) => void
  'player:kicked': (playerId: string) => void
  'room:settingsUpdated': (settings: RoomSettings) => void
}

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, cb: (result: CreateRoomResult) => void) => void
  'room:join': (payload: JoinRoomPayload, cb: (result: JoinRoomResult) => void) => void
  'room:rejoin': (payload: RejoinPayload, cb: (result: RejoinResult) => void) => void
  'room:leave': () => void
  'room:reset': (cb: (result: RoomResetResult) => void) => void
  'game:start': (cb: (result: GameStartResult) => void) => void
  'song:guess': (payload: GuessPayload) => void
  'song:skip': (cb: (result: SongSkipResult) => void) => void
  'card:place': (payload: PlacePayload, cb: (result: CardPlaceResult) => void) => void
  'steal:attempt': (payload: StealPayload, cb: (result: StealAttemptResult) => void) => void
  'steal:initiated': () => void
  'audio:play': (payload: { currentTime: number }) => void
  'audio:pause': () => void
  'drag:move': (payload: DragMovePayload) => void
  'conductor:kick': (payload: KickPayload, cb: (result: ConductorKickResult) => void) => void
  'room:updateSettings': (payload: RoomSettings, cb: (result: UpdateRoomSettingsResult) => void) => void
}
