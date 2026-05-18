import { useEffect, useRef, useState } from 'react'
import type { Song } from '@backspin-maestro/shared'
import socket from '../../socket'
import { useGameStore } from '../../store/gameStore'
import LedDisplay from '../boombox/LedDisplay'
import Sticker from '../boombox/Sticker'

interface Props {
  song: Song
  isMyTurn: boolean
  compact?: boolean
}

const Reel = ({ size, spinning }: { size: number; spinning: boolean }) => (
  <div
    className={`relative rounded-full bg-[radial-gradient(circle_at_50%_50%,#1a1414_0_18%,#3a2818_18.5%_70%,#2a1f15_71%_100%)] [box-shadow:inset_0_0_0_1px_rgba(255,255,255,.08),0_4px_12px_rgba(0,0,0,.5)]${spinning ? ' [animation:vinyl-rotate_1.2s_linear_infinite]' : ''}`}
    style={{ width: size, height: size }}
  >
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        className="absolute left-1/2 top-1/2 bg-white/[.18] [transform-origin:50%_100%]"
        style={{
          width: 2, height: size * 0.34,
          transform: `translate(-50%, -100%) rotate(${(i / 6) * 360}deg)`,
        }}
      />
    ))}
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0a0808] [box-shadow:inset_0_0_0_2px_rgba(255,255,255,.25)]"
      style={{ width: size * 0.18, height: size * 0.18 }}
    />
  </div>
)

const PlayBtn = ({
  playing, onClick, size,
}: { playing: boolean; onClick?: () => void; size: number }) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    aria-label={playing ? 'Pause' : 'Play'}
    className={`knob-btn border-0 ${playing ? 'bg-[radial-gradient(circle_at_30%_25%,var(--color-bad),color-mix(in_srgb,var(--color-bad)_50%,#000))] [box-shadow:inset_0_-3px_6px_rgba(0,0,0,.4),inset_0_2px_4px_rgba(255,255,255,.4),0_4px_0_color-mix(in_srgb,var(--color-bad)_40%,#000),0_0_16px_color-mix(in_srgb,var(--color-bad)_40%,transparent)] text-white' : 'bg-[radial-gradient(circle_at_30%_25%,var(--color-good),color-mix(in_srgb,var(--color-good)_50%,#000))] [box-shadow:inset_0_-3px_6px_rgba(0,0,0,.4),inset_0_2px_4px_rgba(255,255,255,.4),0_4px_0_color-mix(in_srgb,var(--color-good)_40%,#000),0_0_16px_color-mix(in_srgb,var(--color-good)_40%,transparent)] text-accent-ink'} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    style={{ width: size, height: size, fontSize: size * 0.4 }}
  >
    {playing ? '■' : '▶'}
  </button>
)

const AudioPlayer = ({ song, isMyTurn, compact = false }: Props) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const hasPreview = !!song.previewUrl

  const placementResult = useGameStore((s) => s.placementResult)
  const stealResult = useGameStore((s) => s.stealResult)
  const revealed = stealResult?.song ?? placementResult?.song ?? null

  useEffect(() => {
    if (audioRef.current) audioRef.current.load()
  }, [song.id])

  useEffect(() => {
    const onRemotePlay = ({ currentTime, serverTime }: { currentTime: number; serverTime: number }) => {
      if (!audioRef.current || !song.previewUrl) return
      const networkLatencyMs = Date.now() - serverTime
      audioRef.current.currentTime = Math.min(29.5, currentTime + networkLatencyMs / 1000)
      audioRef.current.play().catch(() => setPlaying(false))
      setPlaying(true)
    }
    const onRemotePause = () => { audioRef.current?.pause(); setPlaying(false) }
    socket.on('audio:play', onRemotePlay)
    socket.on('audio:pause', onRemotePause)
    return () => {
      socket.off('audio:play', onRemotePlay)
      socket.off('audio:pause', onRemotePause)
    }
  }, [song.previewUrl])

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
      socket.emit('audio:pause')
    } else {
      if (!song.previewUrl) return
      audioRef.current.play().catch(() => setPlaying(false))
      setPlaying(true)
      socket.emit('audio:play', { currentTime: audioRef.current.currentTime })
    }
  }

  const onTimeUpdate = () => {
    if (!audioRef.current) return
    const ct = audioRef.current.currentTime
    setCurrentTime(ct)
    setProgress((ct / 30) * 100)
  }

  const fmt = (s: number) => `0:${String(Math.floor(s)).padStart(2, '0')}`
  
  const canControlPlayback = hasPreview && isMyTurn

  if (compact) {
    return (
      <div
        className="relative brushed-darker p-3 flex items-center gap-3 rounded-xl border-2 border-[#0a0a0a] [box-shadow:0_8px_18px_rgba(0,0,0,.5),inset_0_-3px_8px_rgba(0,0,0,.4),inset_0_1px_0_rgba(255,255,255,.05)]"
      >
        <Reel size={44} spinning={playing} />

        {canControlPlayback ? (
          <PlayBtn playing={playing} onClick={toggle} size={40} />
        ) : (
          <PlayBtn playing={playing} size={40} />
        )}

        <div className="flex-1 min-w-0">
          <div className={`font-display text-[10px] tracking-[0.08em] ${revealed ? 'text-accent' : 'text-cyan'}`}>
            {revealed
              ? `▸ ${revealed.year} · REVEALED`
              : !hasPreview
                ? '· NO PREVIEW ·'
                : isMyTurn ? '▸ DROP ON SHELF' : '· WAITING ·'}
          </div>
          {revealed ? (
            <>
              <div className="font-display truncate text-[13px] text-cream mt-[2px]">
                {revealed.title}
              </div>
              <div className="font-mono truncate text-[13px] text-[var(--color-muted)]">
                {revealed.artist}
              </div>
            </>
          ) : null}
          <div className="mt-1.5 h-1 rounded-sm relative overflow-hidden bg-white/[.08]">
            <div
              className="absolute inset-0 bg-[linear-gradient(90deg,var(--color-hot),var(--color-accent))] [box-shadow:0_0_8px_var(--color-hot)] transition-[width] duration-500 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-xs tracking-[0.1em] text-[var(--color-muted)]">
            <span>{fmt(currentTime)}</span>
            <span>0:30</span>
          </div>
        </div>

        <audio
          ref={audioRef}
          src={song.previewUrl}
          onLoadStart={() => { setPlaying(false); setProgress(0); setCurrentTime(0) }}
          onTimeUpdate={onTimeUpdate}
          onEnded={() => { setPlaying(false); socket.emit('audio:pause') }}
        />
      </div>
    )
  }

  return (
    <div
      className="relative brushed-darker flex items-center gap-5 rounded-2xl border-2 border-[#0a0a0a] pt-[22px] px-[18px] pb-[18px] mt-3 min-h-[140px] [box-shadow:0_18px_40px_rgba(0,0,0,.55),inset_0_-4px_10px_rgba(0,0,0,.4),inset_0_2px_0_rgba(255,255,255,.06)]"
    >
      <Sticker
        color={revealed ? 'green' : 'red'}
        rotate={-5}
        size="sm"
        className="absolute top-[-12px] left-[18px] z-[1]"
      >
        {revealed ? '★ REVEALED' : '● NOW PLAYING'}
      </Sticker>

      <div className="flex items-center gap-3 shrink-0">
        <Reel size={68} spinning={playing} />
        {canControlPlayback ? (
          <PlayBtn playing={playing} onClick={toggle} size={62} />
        ) : (
          <PlayBtn playing={playing} size={62} />
        )}
        <Reel size={68} spinning={playing} />
      </div>

      <div className="flex-1 min-w-0">
        <div className={`font-display text-[10px] tracking-[0.1em] ${revealed ? 'text-accent' : 'text-cyan'}`}>
          {revealed
            ? `★ ${revealed.year} · ${revealed.artist.toUpperCase()}`
            : hasPreview ? `NOW PLAYING · MYSTERY HIT · ${fmt(currentTime)} / 0:30` : 'NO PREVIEW AVAILABLE'}
        </div>
        <h2
          className={`font-display mt-1.5 leading-none truncate text-cream [text-shadow:3px_3px_0_var(--color-hot),6px_6px_0_var(--color-accent-ink)] ${revealed ? 'text-[28px]' : 'text-[34px]'}`}
        >
          {revealed ? revealed.title.toUpperCase() : '?????'}
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <LedDisplay color="green" className="text-sm py-1 px-[10px]">{fmt(currentTime)}</LedDisplay>
          <div className="flex-1 h-1.5 rounded-sm relative overflow-hidden bg-white/[.08]">
            <div
              className="absolute inset-0 bg-[linear-gradient(90deg,var(--color-hot),var(--color-accent))] [box-shadow:0_0_10px_var(--color-hot)] transition-[width] duration-500 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <LedDisplay color="red" className="text-sm py-1 px-[10px]">0:30</LedDisplay>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={song.previewUrl}
        onTimeUpdate={onTimeUpdate}
        onEnded={() => { setPlaying(false); socket.emit('audio:pause') }}
      />
    </div>
  )
}

export default AudioPlayer
