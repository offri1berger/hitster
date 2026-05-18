import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Player, DecadeFilter, RoomSettings, UpdateRoomSettingsResult } from '@backspin-maestro/shared'
import { MIN_SONGS_PER_PLAYER, MAX_SONGS_PER_PLAYER } from '@backspin-maestro/shared'
import { useGameStore } from '../../store/gameStore'
import { Logo } from '../ui/Logo'
import MuteToggle from '../ui/MuteToggle'
import HowToPlayModal from '../ui/HowToPlayModal'
import { DecadePicker } from './DecadePicker'
import socket from '../../socket'
import Sticker from '../boombox/Sticker'
import LedDisplay from '../boombox/LedDisplay'
import PolaroidAvatar from '../boombox/PolaroidAvatar'
import PlasticButton from '../boombox/PlasticButton'

const POLAROID_ROTATIONS = [-6, 4, -3, 5, -4, 6]

function PlayerPolaroid({
  player,
  index,
  offline,
  canKick,
  isNew,
}: {
  player: Player
  index: number
  offline: boolean
  canKick: boolean
  isNew: boolean
}) {
  const handleKick = () => {
    if (!window.confirm(`Remove ${player.name} from the room?`)) return
    socket.emit('conductor:kick', { playerId: player.id }, (result) => {
      if ('error' in result) console.error('kick error:', result.error)
    })
  }

  const rot = POLAROID_ROTATIONS[index % POLAROID_ROTATIONS.length]

  return (
    <div
      className={`relative ${isNew ? 'player-joined-glow' : ''} ${offline ? 'opacity-40' : 'opacity-100'} transition-opacity duration-[150ms]`}
    >
      <PolaroidAvatar
        src={player.avatar}
        fallback={player.name.charAt(0)}
        size={86}
        rotate={rot}
        active={isNew}
        name={player.name.toUpperCase()}
      />
      {player.isHost && (
        <Sticker
          color="yellow"
          rotate={index % 2 ? -8 : 8}
          size="sm"
          className="absolute top-[-10px] right-[-10px]"
        >
          HOST
        </Sticker>
      )}
      {isNew && (
        <Sticker
          color="cyan"
          rotate={-6}
          size="sm"
          className="absolute bottom-[-2px] left-[-8px]"
        >
          JOINED
        </Sticker>
      )}
      {!isNew && offline && (
        <Sticker
          color="red"
          rotate={3}
          size="sm"
          className="absolute bottom-1 left-[-8px]"
        >
          OFFLINE
        </Sticker>
      )}
      {canKick && (
        <button
          onClick={handleKick}
          aria-label={`Remove ${player.name}`}
          className="absolute -top-2 -right-2 w-7 h-7 rounded-full cursor-pointer flex items-center justify-center bg-[#0a0a0a] text-bad border-2 border-bad [box-shadow:0_2px_0_#000] text-sm leading-none font-bold"
        >
          ✕
        </button>
      )}
    </div>
  )
}

interface Props {
  roomCode: string
  players: Player[]
  onStart: () => void
  onLeave: () => void
}

const SettingsPanel = ({
  settings,
  editable,
}: {
  settings: RoomSettings
  editable: boolean
}) => {
  const setSettings = useGameStore((s) => s.setSettings)

  const emitChange = (next: RoomSettings) => {
    setSettings(next)
    socket.emit('room:updateSettings', next, (result: UpdateRoomSettingsResult) => {
      if ('error' in result) {
        console.warn('room:updateSettings rejected:', result.error)
      }
    })
  }

  const handleDecade = (decadeFilter: DecadeFilter) => {
    if (!editable) return
    emitChange({ ...settings, decadeFilter })
  }

  const handleSongs = (delta: number) => {
    if (!editable) return
    const next = Math.min(MAX_SONGS_PER_PLAYER, Math.max(MIN_SONGS_PER_PLAYER, settings.songsPerPlayer + delta))
    if (next === settings.songsPerPlayer) return
    emitChange({ ...settings, songsPerPlayer: next })
  }

  return (
    <div className="relative panel-hardware brushed-dark p-4 lg:p-5 flex flex-col gap-3.5">
      <span className="screw top-1.5 left-1.5" />
      <span className="screw top-1.5 right-1.5" />
      <span className="screw bottom-1.5 left-1.5" />
      <span className="screw bottom-1.5 right-1.5" />

      <div className="flex items-center justify-between">
        <Sticker color="yellow" rotate={-3} size="sm">MIX RULES</Sticker>
        <span className="font-display text-[9px] tracking-[0.1em] text-[var(--color-muted)]">
          {editable ? 'YOU CONTROL THE DECK' : 'CONDUCTOR CONTROLS'}
        </span>
      </div>

      <DecadePicker
        decadeFilter={settings.decadeFilter}
        onChange={handleDecade}
        disabled={!editable}
      />

      <div>
        <div className="font-display text-[10px] tracking-[0.1em] mb-1.5 text-cyan">
          FIRST TO {settings.songsPerPlayer}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSongs(-1)}
            disabled={!editable || settings.songsPerPlayer <= MIN_SONGS_PER_PLAYER}
            aria-label="Fewer songs"
            className="knob-btn shrink-0 disabled:opacity-40 disabled:cursor-not-allowed w-9 h-9 bg-[radial-gradient(circle_at_30%_25%,var(--color-bad),color-mix(in_srgb,var(--color-bad)_50%,#000))] [box-shadow:inset_0_-3px_6px_rgba(0,0,0,.4),inset_0_2px_4px_rgba(255,255,255,.4),0_3px_0_color-mix(in_srgb,var(--color-bad)_40%,#000)] text-white text-base"
          >−</button>
          <LedDisplay
            color="yellow"
            className="flex-1 text-center text-sm py-1.5 px-[10px]"
          >
            {settings.songsPerPlayer}·{Math.round(settings.songsPerPlayer * 2.5)}M
          </LedDisplay>
          <button
            type="button"
            onClick={() => handleSongs(1)}
            disabled={!editable || settings.songsPerPlayer >= MAX_SONGS_PER_PLAYER}
            aria-label="More songs"
            className="knob-btn shrink-0 disabled:opacity-40 disabled:cursor-not-allowed w-9 h-9 bg-[radial-gradient(circle_at_30%_25%,var(--color-good),color-mix(in_srgb,var(--color-good)_50%,#000))] [box-shadow:inset_0_-3px_6px_rgba(0,0,0,.4),inset_0_2px_4px_rgba(255,255,255,.4),0_3px_0_color-mix(in_srgb,var(--color-good)_40%,#000)] text-accent-ink text-base"
          >+</button>
        </div>
      </div>
    </div>
  )
}

export function WaitingRoom({ roomCode, players, onStart, onLeave }: Props) {
  const disconnectedPlayerIds = useGameStore((s) => s.disconnectedPlayerIds)
  const playerId = useGameStore((s) => s.playerId)
  const settings = useGameStore((s) => s.settings)
  const isHost = players.find((p) => p.id === playerId)?.isHost ?? false

  const seenIdsRef = useRef<Set<string>>(new Set(players.map((p) => p.id)))
  const [recentlyJoined, setRecentlyJoined] = useState<Set<string>>(new Set())
  const [showRules, setShowRules] = useState(false)

  useEffect(() => {
    const newcomers = players.filter((p) => !seenIdsRef.current.has(p.id))
    if (newcomers.length === 0) return
    newcomers.forEach((p) => seenIdsRef.current.add(p.id))
    setRecentlyJoined((prev) => {
      const next = new Set(prev)
      newcomers.forEach((p) => next.add(p.id))
      return next
    })
    const timers = newcomers.map((p) =>
      setTimeout(() => {
        setRecentlyJoined((prev) => {
          if (!prev.has(p.id)) return prev
          const next = new Set(prev)
          next.delete(p.id)
          return next
        })
      }, 2500),
    )
    return () => { timers.forEach(clearTimeout) }
  }, [players])
  const ready = players.length >= 2
  const [copied, setCopied] = useState(false)

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard API can fail in non-secure contexts; silently ignore
    }
  }

  const emptySlots = Math.max(0, 6 - players.length)
  const [showQR, setShowQR] = useState(false)
  const joinUrl = `${window.location.origin}?join=${roomCode}`

  return (
    <div className="min-h-dvh boombox-bg-soft text-on-bg flex flex-col">
      {/* Top bar */}
      <div className="px-4 sm:px-6 lg:px-10 py-4 border-b-2 border-line bg-surface flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onLeave}
            aria-label="Leave"
            className="font-display text-[10px] tracking-[0.1em] cursor-pointer bg-transparent border-0 p-0 hidden sm:flex items-center gap-1.5 text-cream"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            EJECT
          </button>
          <Logo />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-bad [box-shadow:0_0_10px_var(--color-bad)]" />
            <span className="font-display text-[10px] tracking-[0.1em] text-bad">REC</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-[#0a0a0a]" />
          <button
            onClick={() => setShowRules(true)}
            className="plastic-btn plastic-btn-dark h-8 px-3 text-[10px]"
          >
            ? RULES
          </button>
          <MuteToggle />
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 lg:px-10 py-5 lg:py-7 flex flex-col gap-4 max-w-[1200px] w-full mx-auto">
        {/* Room code + Settings — stacks on mobile */}
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          {/* Room code card */}
          <div className="relative panel-hardware brushed-dark p-4 lg:p-5 flex flex-col gap-4">
            <Sticker color="cyan" rotate={-4} size="sm" className="absolute -top-2 left-4">ROOM CODE</Sticker>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <LedDisplay color="cyan" className="text-center w-full sm:w-auto text-[52px] tracking-[.3em] py-[14px] px-[22px]">
                {roomCode}
              </LedDisplay>
              <div className="flex items-center gap-2 ml-auto">
                <PlasticButton
                  onClick={handleCopyCode}
                  color="dark"
                  className="h-11 px-4 text-[11px] flex items-center gap-2"
                  aria-label={copied ? 'Room code copied' : 'Copy room code'}
                >
                  <span>⎘ {copied ? 'COPIED!' : 'COPY'}</span>
                </PlasticButton>
                <PlasticButton
                  onClick={() => setShowQR(true)}
                  color="dark"
                  className="h-11 px-4 text-[11px] flex items-center gap-2"
                  aria-label="Show QR code"
                >
                  <span>▦ QR</span>
                </PlasticButton>
              </div>
            </div>
          </div>

          {settings ? (
            <SettingsPanel settings={settings} editable={isHost} />
          ) : (
            <div className="relative panel-hardware brushed-dark p-4 lg:p-5 flex items-center justify-center min-h-[120px]">
              <span className="font-display text-[11px] tracking-[0.1em] text-[var(--color-muted)]">
                LOADING SETTINGS…
              </span>
            </div>
          )}
        </div>

        {/* Player polaroid corkboard */}
        <div
          className="relative panel-hardware brushed-darker p-4 lg:p-6 min-h-[240px]"
        >
          {/* cork pin */}
          <div
            className="absolute top-2.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ff5050,#a01010)] [box-shadow:0_2px_3px_rgba(0,0,0,.5),inset_0_-2px_3px_rgba(0,0,0,.3)]"
          />
          <Sticker
            color="hot"
            rotate={-3}
            size="sm"
            className="absolute top-4 left-5"
          >
            ★ THE CREW · {players.length}/6
          </Sticker>

          <div className="mt-9 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 justify-items-center items-center">
            {players.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 18, scale: 0.88 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 480, damping: 36, delay: i * 0.05 }}
              >
                <PlayerPolaroid
                  player={p}
                  index={i}
                  offline={disconnectedPlayerIds.includes(p.id)}
                  canKick={isHost && p.id !== playerId}
                  isNew={recentlyJoined.has(p.id)}
                />
              </motion.div>
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center justify-center font-display text-[10px] tracking-[0.1em] w-[100px] h-[124px] p-[7px] bg-black/30 border-2 border-dashed border-[var(--color-muted)] rounded-sm text-[var(--color-muted)]"
                style={{ transform: `rotate(${i % 2 ? 4 : -4}deg)` }}
              >
                EMPTY SLOT
              </div>
            ))}
          </div>
        </div>

        {/* Start row */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {isHost ? (
            <>
              <motion.div
                key={String(ready)}
                initial={{ scale: 0.96, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="flex-1"
                whileHover={ready ? { scale: 1.015 } : undefined}
                whileTap={ready ? { scale: 0.97 } : undefined}
              >
                <PlasticButton
                  onClick={onStart}
                  disabled={!ready}
                  color="green"
                  className="w-full h-[60px] text-[16px] flex items-center justify-center gap-2"
                >
                  ▶ HIT PLAY · START THE SHOW
                </PlasticButton>
              </motion.div>
              <PlasticButton
                onClick={onLeave}
                color="dark"
                className="h-[60px] px-6 text-[11px]"
              >
                EJECT
              </PlasticButton>
            </>

          ) : (
            <div
              className="flex-1 h-[60px] flex items-center justify-center font-display text-xs tracking-[0.1em] rounded-[10px] bg-[#0a0a0a] border-2 border-[var(--color-muted-2)] text-[var(--color-muted)]"
            >
              {ready ? 'WAITING FOR THE CONDUCTOR…' : 'WAITING FOR MORE PLAYERS…'}
            </div>
          )}
        </div>

        {isHost && !ready && (
          <p className="text-center font-display text-[10px] tracking-[0.1em] text-[var(--color-muted)]">
            WAITING FOR MORE PLAYERS…
          </p>
        )}
      </div>

      {showRules && <HowToPlayModal onClose={() => setShowRules(false)} />}

      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ scale: 0.82, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.82, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="relative panel-hardware brushed-dark flex flex-col items-center gap-5 p-8 rounded-2xl [box-shadow:0_24px_60px_rgba(0,0,0,.8)] max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            >
              <Sticker color="cyan" rotate={-3} size="sm" className="absolute -top-3 left-5">SCAN TO JOIN</Sticker>
              <button
                onClick={() => setShowQR(false)}
                aria-label="Close QR code"
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full cursor-pointer flex items-center justify-center bg-[#0a0a0a] text-bad border-2 border-bad [box-shadow:0_2px_0_#000] text-sm font-bold leading-none"
              >
                ✕
              </button>
              <div className="p-4 bg-white rounded-xl [box-shadow:0_8px_24px_rgba(0,0,0,.6)]">
                <QRCodeSVG value={joinUrl} size={220} />
              </div>
              <LedDisplay color="cyan" className="text-[28px] tracking-[.3em] py-3 px-6">
                {roomCode}
              </LedDisplay>
              <span className="font-mono text-[10px] tracking-[0.08em] text-[var(--color-muted)] text-center max-w-[260px] break-all">
                {joinUrl}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
