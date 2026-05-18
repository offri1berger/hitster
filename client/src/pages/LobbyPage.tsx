import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { DecadeFilter } from '@backspin-maestro/shared'
import socket from '../socket'
import { useGameStore } from '../store/gameStore'
import { identify, capture, avatarFilename } from '../lib/analytics'
import  HeroPanel  from '../components/lobby/HeroPanel'
import  SetupForm  from '../components/lobby/SetupForm'
import { Logo } from '../components/ui/Logo'
import HowToPlayModal from '../components/ui/HowToPlayModal'

const ERROR_MESSAGES: Record<string, string> = {
  room_not_found: 'Room not found — check the code.',
  room_full: 'Room is full (max 6 players).',
  game_already_started: 'That game has already started.',
  invalid_payload: 'Something looks off — try again.',
  rate_limited: 'Slow down — try again in a moment.',
  server_error: 'Server error. Try again.',
}

const LobbyPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState(() => searchParams.get('join')?.toUpperCase() ?? '')
  const [tab, setTab] = useState<'create' | 'join'>(() => searchParams.get('join') ? 'join' : 'create')
  const [decadeFilter, setDecadeFilter] = useState<DecadeFilter>('all')
  const [songsPerPlayer, setSongsPerPlayer] = useState(10)
  const [avatar, setAvatar] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showRules, setShowRules] = useState(false)

  const { setRoom, setPlayers, setSettings, roomCode: storeRoomCode, phase, leaveRoom } = useGameStore()

  useEffect(() => {
    if (!storeRoomCode) return
    if (phase === 'game_over') navigate('/over', { replace: true })
    else if (phase) navigate('/game', { replace: true })
    else navigate('/lobby', { replace: true })
  }, [storeRoomCode, phase, navigate])

  useEffect(() => {
    const t = setTimeout(() => setError(null), 0)
    return () => clearTimeout(t)
  }, [tab, name, roomCode])

  const handleCreate = () => {
    if (!name.trim() || submitting) return
    setError(null)
    setSubmitting(true)
    leaveRoom()
    socket.connect()
    socket.emit('room:create', {
      hostName: name,
      avatar,
      settings: { songsPerPlayer, decadeFilter },
    }, (result) => {
      setSubmitting(false)
      if ('error' in result) {
        setError(ERROR_MESSAGES[result.error] ?? 'Could not create room.')
        return
      }
      identify(result.playerId)
      capture('room_created', {
        avatar: avatarFilename(avatar),
        decade_filter: decadeFilter,
        songs_per_player: songsPerPlayer,
      })
      setRoom(result.roomCode, result.playerId)
      setPlayers([{ id: result.playerId, name, avatar, tokens: 2, isHost: true, turnOrder: 0, timeline: result.timeline }])
      setSettings({ songsPerPlayer, decadeFilter })
      navigate('/lobby')
    })
  }

  const handleJoin = () => {
    if (!name.trim() || !roomCode.trim() || submitting) return
    setError(null)
    setSubmitting(true)
    leaveRoom()
    socket.connect()
    socket.emit('room:join', { roomCode: roomCode.toUpperCase(), playerName: name, avatar }, (result) => {
      setSubmitting(false)
      if ('error' in result) {
        setError(ERROR_MESSAGES[result.error] ?? 'Could not join room.')
        return
      }
      identify(result.playerId)
      capture('room_joined', { avatar: avatarFilename(avatar) })
      setRoom(result.roomCode, result.playerId)
      setPlayers([
        ...result.players,
        { id: result.playerId, name, avatar, tokens: 2, isHost: false, turnOrder: 0, timeline: result.timeline },
      ])
      setSettings(result.settings)
      navigate('/lobby')
    })
  }

  return (
    <div className="min-h-dvh boombox-bg-soft text-on-bg lg:h-dvh lg:overflow-hidden lg:grid lg:grid-rows-[auto_1fr] lg:grid-cols-[1.1fr_minmax(380px,_440px)]">
      {/* Top nav — mobile only */}
      <div className="lg:hidden px-4 py-3 flex items-center justify-between border-b-2 border-line bg-surface">
        <Logo />
        <button onClick={() => setShowRules(true)} className="plastic-btn plastic-btn-dark h-8 px-3 text-[10px]">
          ? RULES
        </button>
      </div>

      {/* Top nav — desktop only */}
      <div className="hidden lg:flex col-span-2 px-12 py-5 items-center justify-between border-b-2 border-line bg-surface">
        <Logo />
        <div className="flex items-center gap-4">
          <button onClick={() => setShowRules(true)} className="plastic-btn plastic-btn-dark h-8 px-3 text-[10px]">
            ? RULES
          </button>
          <span className="font-display text-[11px] tracking-[0.2em] text-cyan">
            ◆ SIDE A · INSERT TAPE
          </span>
        </div>
      </div>

      {/* Two-column content */}
      <div className="hidden lg:block min-h-0 overflow-y-auto">
        <HeroPanel />
      </div>
      <SetupForm
        tab={tab}                     onTabChange={setTab}
        name={name}                   onNameChange={setName}
        roomCode={roomCode}           onRoomCodeChange={setRoomCode}
        decadeFilter={decadeFilter}   onDecadeChange={setDecadeFilter}
        songsPerPlayer={songsPerPlayer} onSongsPerPlayerChange={setSongsPerPlayer}
        avatar={avatar}               onAvatarChange={setAvatar}
        onSubmit={tab === 'create' ? handleCreate : handleJoin}
        error={error}
        submitting={submitting}
      />

      {showRules && <HowToPlayModal onClose={() => setShowRules(false)} />}
    </div>
  )
}

export default LobbyPage
