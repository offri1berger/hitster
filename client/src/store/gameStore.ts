import { create } from 'zustand'
import type { GamePhase, Player, Song, RoomSettings, StealResultPayload } from '@backspin-maestro/shared'

const SESSION_KEY = 'backspin_maestro_session'
const MUTED_KEY = 'backspin_maestro_muted'

export const persistSession = (roomCode: string, playerId: string) =>
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerId }))

export const clearSession = () => sessionStorage.removeItem(SESSION_KEY)

const loadMuted = (): boolean => {
  try { return localStorage.getItem(MUTED_KEY) === '1' } catch { return false }
}

export const loadSession = (): { roomCode: string; playerId: string } | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// ── Slice interfaces ──────────────────────────────────────────────────────────
// Three distinct lifecycles. Adding state to the wrong slice is a type error.

interface SessionSlice {
  // Persists across reconnects; cleared only on leaveRoom.
  roomCode: string | null
  playerId: string | null
  settings: RoomSettings | null
  players: Player[]
  disconnectedPlayerIds: string[]
  setRoom: (roomCode: string, playerId: string) => void
  setSettings: (settings: RoomSettings) => void
  restoreSession: (data: {
    roomCode: string; playerId: string; players: Player[]; settings: RoomSettings
    phase?: GamePhase; currentPlayerId?: string; currentSong?: Song | null; roundNumber?: number
  }) => void
  setPlayers: (players: Player[]) => void
  addPlayer: (player: Player) => void
  removePlayer: (playerId: string) => void
  setPlayerDisconnected: (id: string) => void
  setPlayerReconnected: (id: string) => void
  transferHost: (newHostId: string) => void
  leaveRoom: () => void
}

interface GameSlice {
  // Active-game state; cleared on resetGame AND leaveRoom.
  phase: GamePhase | null
  currentPlayerId: string | null
  currentSong: Song | null
  roundNumber: number
  winnerId: string | null
  pendingPosition: number | null
  placementResult: { correct: boolean; message?: string; song?: Song } | null
  isWaitingForNextTurn: boolean
  hasGuessed: boolean
  remoteDragSlot: number | null
  stealResult: StealResultPayload | null
  isStealWindowOpen: boolean
  stealInitiatorId: string | null
  stealTargetId: string | null
  stealOriginalPosition: number | null
  setGameStarted: (players: Player[], phase: GamePhase, currentPlayerId: string) => void
  setCurrentSong: (song: Song) => void
  setPhase: (phase: GamePhase) => void
  setCurrentPlayerId: (id: string) => void
  setPendingPosition: (position: number | null) => void
  setPlacementResult: (result: { correct: boolean; message?: string; song?: Song } | null) => void
  setIsWaitingForNextTurn: (val: boolean) => void
  setHasGuessed: (val: boolean) => void
  setGameOver: (winnerId: string) => void
  setRemoteDragSlot: (slot: number | null) => void
  setStealResult: (result: StealResultPayload | null) => void
  setIsStealWindowOpen: (val: boolean) => void
  setStealInitiatorId: (id: string | null) => void
  setStealTargetId: (id: string | null) => void
  setStealOriginalPosition: (pos: number | null) => void
  resetGame: (players: Player[]) => void
}

interface AppSlice {
  // Global app state; never reset by room or game lifecycle.
  connectionStatus: 'connecting' | 'connected' | 'reconnecting' | 'expired'
  kickNotice: { message: string } | null
  muted: boolean
  setConnectionStatus: (status: 'connecting' | 'connected' | 'reconnecting' | 'expired') => void
  setKickNotice: (notice: { message: string } | null) => void
  setMuted: (val: boolean) => void
}

export type GameStore = SessionSlice & GameSlice & AppSlice

// ── Initial state per slice ───────────────────────────────────────────────────

const INITIAL_SESSION_STATE = {
  roomCode: null as string | null,
  playerId: null as string | null,
  settings: null as RoomSettings | null,
  players: [] as Player[],
  disconnectedPlayerIds: [] as string[],
}

const INITIAL_GAME_STATE = {
  phase: null as GamePhase | null,
  currentPlayerId: null as string | null,
  currentSong: null as Song | null,
  roundNumber: 1,
  winnerId: null as string | null,
  pendingPosition: null as number | null,
  placementResult: null as { correct: boolean; message?: string; song?: Song } | null,
  isWaitingForNextTurn: false,
  hasGuessed: false,
  remoteDragSlot: null as number | null,
  stealResult: null as StealResultPayload | null,
  isStealWindowOpen: false,
  stealInitiatorId: null as string | null,
  stealTargetId: null as string | null,
  stealOriginalPosition: null as number | null,
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>()((set, get) => ({

  // ── Session slice ───────────────────────────────────────────────────────────
  ...INITIAL_SESSION_STATE,

  setRoom: (roomCode, playerId) => {
    persistSession(roomCode, playerId)
    set({ roomCode, playerId, connectionStatus: 'connected' })
  },
  setSettings: (settings) => set({ settings }),
  restoreSession: ({ roomCode, playerId, players, settings, phase, currentPlayerId, currentSong, roundNumber }) =>
    set({ roomCode, playerId, players, settings, phase: phase ?? null, currentPlayerId: currentPlayerId ?? null, currentSong: currentSong ?? null, roundNumber: roundNumber ?? 1 }),
  setPlayers: (players) => set({ players }),
  addPlayer: (player) => set((s) => ({ players: [...s.players, player] })),
  removePlayer: (playerId) =>
    set((s) => ({
      players: s.players.filter((p) => p.id !== playerId),
      disconnectedPlayerIds: s.disconnectedPlayerIds.filter((id) => id !== playerId),
    })),
  setPlayerDisconnected: (id) =>
    set((s) => ({ disconnectedPlayerIds: s.disconnectedPlayerIds.includes(id) ? s.disconnectedPlayerIds : [...s.disconnectedPlayerIds, id] })),
  setPlayerReconnected: (id) =>
    set((s) => ({ disconnectedPlayerIds: s.disconnectedPlayerIds.filter((x) => x !== id) })),
  transferHost: (newHostId) =>
    set((s) => ({ players: s.players.map((p) => ({ ...p, isHost: p.id === newHostId })) })),
  leaveRoom: () => {
    clearSession()
    set({ ...INITIAL_SESSION_STATE, ...INITIAL_GAME_STATE })
  },

  // ── Game slice ──────────────────────────────────────────────────────────────
  ...INITIAL_GAME_STATE,

  setGameStarted: (players, phase, currentPlayerId) => set({ players, phase, currentPlayerId }),
  setCurrentSong: (song) => set({ currentSong: song }),
  setPhase: (phase) => set({ phase }),
  setCurrentPlayerId: (id) => set({ currentPlayerId: id }),
  setPendingPosition: (position) => set({ pendingPosition: position }),
  setPlacementResult: (result) => set({ placementResult: result }),
  setIsWaitingForNextTurn: (val) => set({ isWaitingForNextTurn: val }),
  setHasGuessed: (val) => set({ hasGuessed: val }),
  setGameOver: (winnerId) => { clearSession(); set({ winnerId, phase: 'game_over' }) },
  setRemoteDragSlot: (slot) => set({ remoteDragSlot: slot }),
  setStealResult: (result) => set({ stealResult: result }),
  setIsStealWindowOpen: (val) => set({ isStealWindowOpen: val }),
  setStealInitiatorId: (id) => set({ stealInitiatorId: id }),
  setStealTargetId: (id) => set({ stealTargetId: id }),
  setStealOriginalPosition: (pos) => set({ stealOriginalPosition: pos }),
  resetGame: (players) => {
    const { roomCode, playerId } = get()
    if (roomCode && playerId) persistSession(roomCode, playerId)
    set({ ...INITIAL_GAME_STATE, players, disconnectedPlayerIds: [] })
  },

  // ── App slice ───────────────────────────────────────────────────────────────
  connectionStatus: 'connecting',
  kickNotice: null,
  muted: loadMuted(),

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setKickNotice: (notice) => set({ kickNotice: notice }),
  setMuted: (val) => {
    try { localStorage.setItem(MUTED_KEY, val ? '1' : '0') } catch { /* ignore */ }
    set({ muted: val })
  },
}))
