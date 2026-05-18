import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ServerToClientEvents } from '@backspin-maestro/shared'
import socket from '../socket'
import { useGameStore, loadSession, clearSession } from '../store/gameStore'
import { sfx, setMutedAccessor } from '../lib/sfx'
import { capture } from '../lib/analytics'

export const useSocket = () => {
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  useEffect(() => { navigateRef.current = navigate }, [navigate])

  useEffect(() => {
    setMutedAccessor(() => useGameStore.getState().muted)
  }, [])

  useEffect(() => {
    const navigate = (to: string) => navigateRef.current(to)
    let placementResultTimer: ReturnType<typeof setTimeout> | null = null

    // ── Built-in socket.io lifecycle events (not in ServerToClientEvents) ─────
    socket.on('connect', () => {
      const store = useGameStore.getState()
      const saved = loadSession()
      if (!saved) {
        store.setConnectionStatus('connected')
        return
      }
      socket.emit('room:rejoin', saved, (result) => {
        if (!result.success || result.roomStatus === 'finished') {
          clearSession()
          const s = useGameStore.getState()
          if (s.roomCode === saved.roomCode) {
            s.leaveRoom()
            s.setConnectionStatus('expired')
            navigate('/')
          } else {
            s.setConnectionStatus('connected')
          }
          return
        }
        const s = useGameStore.getState()
        if (s.roomCode && s.roomCode !== saved.roomCode) {
          s.setConnectionStatus('connected')
          return
        }
        if (result.roomStatus === 'playing' && result.gameState) {
          s.restoreSession({
            roomCode: saved.roomCode,
            playerId: saved.playerId,
            players: result.players,
            settings: result.settings,
            phase: result.gameState.phase,
            currentPlayerId: result.gameState.currentPlayerId,
            currentSong: result.gameState.currentSong,
            roundNumber: result.gameState.roundNumber,
          })
          navigate('/game')
        } else {
          s.restoreSession({
            roomCode: saved.roomCode,
            playerId: saved.playerId,
            players: result.players,
            settings: result.settings,
          })
          navigate('/lobby')
        }
        s.setConnectionStatus('connected')
      })
    })

    socket.on('disconnect', () => {
      const s = useGameStore.getState()
      // Only show the banner when there's actually a session at risk —
      // a disconnect on the lobby (no room yet) is just noise.
      if (s.roomCode) s.setConnectionStatus('reconnecting')
    })

    socket.io.on('reconnect_attempt', () => {
      const s = useGameStore.getState()
      if (s.roomCode) s.setConnectionStatus('reconnecting')
    })

    socket.connect()

    // ── Server→client game events: register declaratively so the cleanup
    // list is auto-derived (forgetting to socket.off can't leak handlers). ───
    const handlers: Partial<ServerToClientEvents> = {
      'player:joined': (player) => {
        useGameStore.getState().addPlayer(player)
      },

      'player:left': (playerId) => {
        useGameStore.getState().removePlayer(playerId)
      },

      'game:starting': (state, players) => {
        const store = useGameStore.getState()
        store.setGameStarted(players, state.phase, state.currentPlayerId)
        capture('game_started', {
          player_count: players.length,
          decade_filter: store.settings?.decadeFilter,
          songs_per_player: store.settings?.songsPerPlayer,
        })
        navigate('/game')
      },

      'song:new': (song) => {
        const store = useGameStore.getState()
        store.setCurrentSong(song)
        store.setIsWaitingForNextTurn(false)
        store.setHasGuessed(false)
        store.setStealResult(null)
        store.setIsStealWindowOpen(false)
        store.setStealInitiatorId(null)
        store.setStealTargetId(null)
        store.setStealOriginalPosition(null)
      },

      'steal:open': (targetPlayerId, originalPosition) => {
        const store = useGameStore.getState()
        store.setIsWaitingForNextTurn(true)
        store.setIsStealWindowOpen(true)
        store.setStealTargetId(targetPlayerId)
        store.setStealOriginalPosition(originalPosition)
      },

      'steal:extended': (stealerId) => {
        useGameStore.getState().setStealInitiatorId(stealerId)
      },

      'phase:changed': (phase, _phaseStartedAt, currentPlayerId) => {
        const store = useGameStore.getState()
        store.setPhase(phase)
        if (currentPlayerId) store.setCurrentPlayerId(currentPlayerId)
      },

      'placement:result': (result) => {
        capture('card_placed', { correct: result.correct })
        const store = useGameStore.getState()

        if (result.correct) {
          const currentSong = store.currentSong
          if (currentSong) {
            const updatedPlayers = store.players.map((p) => {
              if (p.id !== result.playerId) return p
              const newEntry = { song: currentSong, position: result.correctPosition }
              const newTimeline = [...p.timeline, newEntry].sort((a, b) => a.song.year - b.song.year)
              return { ...p, timeline: newTimeline }
            })
            store.setPlayers(updatedPlayers)
          }
          sfx.place()
          setTimeout(() => sfx.correct(), 120)
        } else {
          sfx.wrong()
        }

        store.setRemoteDragSlot(null)
        store.setPendingPosition(null)
        store.setIsStealWindowOpen(false)
        store.setPlacementResult({
          correct: result.correct,
          song: result.correct ? undefined : result.song,
        })
        store.setIsWaitingForNextTurn(true)
        if (placementResultTimer) clearTimeout(placementResultTimer)
        placementResultTimer = setTimeout(() => store.setPlacementResult(null), result.correct ? 2000 : 3000)
      },

      'token:earned': (playerId, newTotal) => {
        const store = useGameStore.getState()
        const updatedPlayers = store.players.map((p) =>
          p.id === playerId ? { ...p, tokens: newTotal } : p
        )
        store.setPlayers(updatedPlayers)
        if (playerId === store.playerId) {
          if (placementResultTimer) clearTimeout(placementResultTimer)
          store.setPlacementResult({ correct: true, message: '🪙 Token earned!' })
          placementResultTimer = setTimeout(() => store.setPlacementResult(null), 2000)
        }
      },

      'steal:result': (result) => {
        capture('steal_attempted', {
          success: result.correct,
          target_was_correct: result.targetWasCorrect,
        })
        const store = useGameStore.getState()

        if (result.correct) {
          const updatedPlayers = store.players.map((p) => {
            if (p.id !== result.stealerId) return p
            const newTimeline = [...p.timeline, { song: result.song, position: 0 }]
              .sort((a, b) => a.song.year - b.song.year)
              .map((entry, idx) => ({ ...entry, position: idx }))
            return { ...p, timeline: newTimeline }
          })
          store.setPlayers(updatedPlayers)
        }

        store.setStealInitiatorId(null)
        store.setStealResult(result)
        setTimeout(() => store.setStealResult(null), 3000)
      },

      'tokens:updated': (playerId, newTotal) => {
        const store = useGameStore.getState()
        store.setPlayers(store.players.map((p) =>
          p.id === playerId ? { ...p, tokens: newTotal } : p
        ))
      },

      'game:over': (winnerId, players) => {
        const store = useGameStore.getState()
        capture('game_finished', {
          won: winnerId === store.playerId,
          player_count: players.length,
          timeline_length: players.find((p) => p.id === store.playerId)?.timeline.length ?? 0,
        })
        store.setPlayers(players)
        store.setGameOver(winnerId)
        sfx.win()
        navigate('/over')
      },

      'player:disconnected': (playerId) => {
        useGameStore.getState().setPlayerDisconnected(playerId)
      },

      'player:reconnected': (playerId) => {
        useGameStore.getState().setPlayerReconnected(playerId)
      },

      'host:transferred': (newHostId) => {
        const store = useGameStore.getState()
        const newHost = store.players.find((p) => p.id === newHostId)
        store.transferHost(newHostId)
        const message = newHostId === store.playerId
          ? 'The baton has passed to you.'
          : newHost
            ? `The baton has passed to ${newHost.name}.`
            : 'The baton has passed.'
        store.setKickNotice({ message })
      },

      'game:reset': (players) => {
        useGameStore.getState().resetGame(players)
        navigate('/lobby')
      },

      'player:kicked': (kickedId) => {
        const store = useGameStore.getState()
        if (kickedId === store.playerId) {
          // We just got kicked — surface a notice and route out before
          // wiping local state so the LobbyPage can read it on mount.
          store.setKickNotice({ message: 'You were removed by the Conductor.' })
          store.leaveRoom()
          navigate('/')
        } else {
          const kicked = store.players.find((p) => p.id === kickedId)
          store.removePlayer(kickedId)
          if (kicked) {
            store.setKickNotice({ message: `${kicked.name} was removed by the Conductor.` })
          }
        }
      },

      'room:settingsUpdated': (settings) => {
        useGameStore.getState().setSettings(settings)
      },
    }

    const eventNames = Object.keys(handlers) as Array<keyof ServerToClientEvents>
    for (const name of eventNames) {
      // socket.io's typed `on` resolves per-event; the loop erases that, so cast.
      socket.on(name, handlers[name] as never)
    }

    return () => {
      if (placementResultTimer) clearTimeout(placementResultTimer)
      socket.off('connect')
      socket.off('disconnect')
      socket.io.off('reconnect_attempt')
      for (const name of eventNames) socket.off(name)
      socket.disconnect()
    }
  }, [])
}
