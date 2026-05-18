import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { MiniYearCard } from '../components/game/Timeline'
import { Logo } from '../components/ui/Logo'
import socket from '../socket'
import Sticker from '../components/boombox/Sticker'
import LedDisplay from '../components/boombox/LedDisplay'
import PolaroidAvatar from '../components/boombox/PolaroidAvatar'
import PlasticButton from '../components/boombox/PlasticButton'

const CONFETTI = [
  { c: 'var(--color-accent)', x: '6%',  y: '12%', r: -15, t: '★', size: 56 },
  { c: 'var(--color-cyan)',   x: '90%', y: '8%',  r: 12,  t: '♪', size: 64 },
  { c: 'var(--color-hot)',    x: '12%', y: '82%', r: 8,   t: '♬', size: 56 },
  { c: 'var(--color-good)',   x: '88%', y: '76%', r: -10, t: '★', size: 60 },
  { c: 'var(--color-orange)', x: '50%', y: '4%',  r: 4,   t: '+1', size: 36 },
]

const GameOverPage = () => {
  const navigate = useNavigate()
  const { players, winnerId, playerId, settings, leaveRoom } = useGameStore()
  const songsToWin = settings?.songsPerPlayer ?? 10
  const ranked = [...players].sort((a, b) => b.timeline.length - a.timeline.length)
  const winner = ranked[0]
  const isWinner = winnerId === playerId
  const isHost = players.find((p) => p.id === playerId)?.isHost ?? false

  const handleRematch = () => {
    if (!window.confirm('Start a rematch with the same players and settings?')) return
    socket.emit('room:reset', (result) => {
      if ('error' in result) console.error('rematch error:', result.error)
    })
  }

  return (
    <div className="min-h-dvh boombox-bg-soft text-on-bg relative overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {CONFETTI.map((s, i) => (
          <div
            key={i}
            className="absolute pop-in font-display [text-shadow:4px_4px_0_var(--color-accent-ink)]"
            style={{
              left: s.x, top: s.y,
              fontSize: s.size, color: s.c,
              transform: `rotate(${s.r}deg)`,
              animationDelay: `${i * 120}ms`,
            }}
          >
            {s.t}
          </div>
        ))}
      </div>

      <div className="relative z-[1] max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10 py-5 lg:py-8 flex flex-col gap-5">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Logo />
          <span
            className="font-display text-[11px] text-[var(--color-muted)] tracking-[.1em]"
          >
            SET LIST FINI ◆ {useGameStore.getState().roomCode ?? '------'}
          </span>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4 lg:gap-10 items-start lg:items-center">
          {/* Winner column */}
          <div>
            {/* Mobile: compact horizontal row */}
            <div className="flex items-center gap-4 lg:hidden">
              <div className="relative shrink-0">
                <PolaroidAvatar
                  src={winner?.avatar}
                  fallback={winner?.name?.charAt(0)}
                  size={80}
                  rotate={-4}
                  active
                  name={winner?.name?.toUpperCase()}
                />
                <Sticker
                  color="yellow"
                  rotate={15}
                  size="sm"
                  className="absolute top-[-10px] right-[-14px]"
                >
                  WINNER ★
                </Sticker>
              </div>
              <div className="min-w-0 flex-1">
                <Sticker color="cyan" rotate={-4} size="sm">1ST PLACE</Sticker>
                <h1 className="boombox-title boombox-title-yellow text-[clamp(28px,7vw,56px)] mt-1 mb-1 truncate">
                  {winner?.name?.toUpperCase()}!
                </h1>
                <p className="text-xs leading-snug text-[var(--color-muted)]">
                  {winner?.timeline.length} cards · {winner?.tokens}★ ·
                  {isWinner ? ' You crushed it!' : ' The gold standard.'}
                </p>
              </div>
            </div>

            {/* Desktop: big centered display */}
            <div className="hidden lg:block text-left">
              <Sticker color="cyan" rotate={-6} size="lg">1ST PLACE</Sticker>
              <h1 className="boombox-title boombox-title-yellow text-[clamp(56px,12vw,132px)] mt-[14px] mb-[18px]">
                {winner?.name?.toUpperCase()}!
              </h1>
              <div className="inline-block relative">
                <PolaroidAvatar
                  src={winner?.avatar}
                  fallback={winner?.name?.charAt(0)}
                  size={140}
                  rotate={-4}
                  active
                  name={winner?.name?.toUpperCase()}
                />
                <Sticker color="yellow" rotate={15} size="md" className="absolute top-[-16px] right-[-22px]">
                  WINNER ★
                </Sticker>
                <Sticker color="hot" rotate={-12} size="sm" className="absolute bottom-[-4px] left-[-16px]">
                  {winner?.timeline.length}/{songsToWin}
                </Sticker>
              </div>
              <p className="mt-5 max-w-[480px] text-sm leading-[1.55] text-[var(--color-muted)]">
                {winner?.timeline.length} correct placements · {winner?.tokens} bonus ★ ·
                {isWinner ? ' Crushed it.' : ' Their shelf is the new gold standard.'}
              </p>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="brushed-darker panel-hardware p-3 lg:p-5">
            <Sticker color="hot" rotate={-4} size="sm" className="mb-4 block">CHART</Sticker>
            <div className="flex flex-col gap-3">
              {ranked.map((p, i) => {
                const filledPct = Math.min(1, p.timeline.length / songsToWin)
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 pb-3 ${i < ranked.length - 1 ? 'border-b-2 border-dashed border-white/[.08]' : ''}`}
                  >
                    <div
                      className={`font-display shrink-0 flex items-center justify-center w-[30px] h-[30px] rounded-[6px] text-sm ${i === 0 ? 'bg-[linear-gradient(135deg,var(--color-accent),var(--color-orange))] text-accent-ink [box-shadow:0_3px_0_color-mix(in_srgb,var(--color-accent)_55%,#000)]' : 'bg-[#2a2a2c] text-[var(--color-muted)] [box-shadow:0_2px_0_#000]'}`}
                    >
                      {i + 1}
                    </div>
                    <div className="shrink-0">
                      <PolaroidAvatar
                        src={p.avatar}
                        fallback={p.name.charAt(0)}
                        size={32}
                        rotate={i % 2 ? -3 : 3}
                        active={i === 0}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-sm text-cream truncate">
                        {p.name}
                      </div>
                      <div className="font-mono mt-0.5 text-[11px] text-[var(--color-muted)] tracking-[.04em]">
                        {p.timeline.length} CARDS · {p.tokens} ★
                      </div>
                      {/* mini progress */}
                      <div className="mt-1 h-1 rounded relative overflow-hidden bg-[#0a0a0a]">
                        <div
                          className={`absolute inset-0 ${i === 0 ? 'bg-[linear-gradient(90deg,var(--color-accent),var(--color-hot))] [box-shadow:0_0_6px_var(--color-accent)]' : 'bg-[var(--color-muted-2)]'}`}
                          style={{ width: `${filledPct * 100}%` }}
                        />
                      </div>
                    </div>
                    <LedDisplay
                      color={i === 0 ? 'yellow' : 'muted'}
                      className="text-base py-1 px-[8px] min-w-[46px] text-center shrink-0"
                    >
                      {String(p.timeline.length).padStart(2, '0')}
                    </LedDisplay>
                  </div>
                )
              })}
            </div>

            {ranked[0] && ranked[0].timeline.length > 0 && (
              <div className="mt-4 min-w-0">
                <Sticker color="yellow" rotate={-3} size="sm">WINNER'S SHELF</Sticker>
                <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {ranked[0].timeline.map((entry, j) => (
                    <MiniYearCard key={j} entry={entry} index={j} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          {isHost ? (
            <PlasticButton
              onClick={handleRematch}
              color="green"
              className="flex-1 h-[60px] text-[16px] flex items-center justify-center"
            >
              ▶ ENCORE · NEW MIX
            </PlasticButton>
          ) : (
            <div
              className="flex-1 h-[60px] flex items-center justify-center font-display text-xs tracking-[0.1em] rounded-[10px] bg-[#0a0a0a] border-2 border-[var(--color-muted-2)] text-[var(--color-muted)]"
            >
              WAITING FOR THE CONDUCTOR…
            </div>
          )}
          <PlasticButton
            onClick={() => { socket.emit('room:leave'); leaveRoom(); navigate('/') }}
            color="dark"
            className="h-[60px] px-6 text-[12px] flex items-center justify-center"
          >
            EXIT
          </PlasticButton>
        </div>
      </div>
    </div>
  )
}

export default GameOverPage
