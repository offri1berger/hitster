import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useIsMobile } from '../../hooks/useMediaQuery'
import Timeline from './Timeline'
import Sticker from '../boombox/Sticker'
import LedDisplay from '../boombox/LedDisplay'

interface Props {
  countdown: number
  onStealAttempt: (position: number) => void
  onClose: () => void
}

export const StealOverlay = ({ countdown, onStealAttempt, onClose }: Props) => {
  const { currentSong, currentPlayerId, players, stealOriginalPosition } = useGameStore()
  const activePlayer = players.find((p) => p.id === currentPlayerId)
  const activeTimeline = activePlayer?.timeline ?? []

  const [pendingPosition, setPendingPosition] = useState<number | null>(stealOriginalPosition)
  const trapRef = useFocusTrap<HTMLDivElement>(true)
  const isMobile = useIsMobile()
  const totalRef = useRef(countdown)
  useEffect(() => {
    if (countdown > totalRef.current) totalRef.current = countdown
  }, [countdown])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!currentSong) return null

  const isDanger = countdown <= 3

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label="Steal attempt"
      className="fixed inset-0 z-50 flex items-start lg:items-center justify-center p-3 lg:p-6 overflow-y-auto bg-[rgba(0,0,0,0.78)] [backdrop-filter:blur(10px)]"
    >
      <div
        ref={null}
        className="w-full max-w-[620px] brushed-darker panel-hardware p-5 lg:p-7 relative my-auto"
      >
        <div className="flex items-start justify-between mb-4 lg:mb-6">
          <div>
            <Sticker color="red" rotate={-4} size="sm">★ STEAL ALERT</Sticker>
            <h2
              className="font-display mt-2 text-[28px] leading-none text-cream [text-shadow:3px_3px_0_var(--color-hot),6px_6px_0_var(--color-accent-ink)]"
            >
              SNATCH THE CARD!
            </h2>
          </div>
          <button
            onClick={onClose}
            className="plastic-btn plastic-btn-dark h-9 px-3.5 text-[10px]"
          >
            ESC
          </button>
        </div>

        <div className="flex justify-center mb-4">
          <LedDisplay
            color={isDanger ? 'red' : 'yellow'}
            className={`text-[44px] px-[22px] py-3 min-w-[100px] text-center ${isDanger ? '[animation:steal-pulse_0.9s_infinite]' : ''}`}
          >
            {countdown}s
          </LedDisplay>
        </div>

        <div className="h-2 rounded-full overflow-hidden bg-white/[.08] mb-5">
          <div
            className="h-full rounded-full"
            style={{
              width: `${(countdown / totalRef.current) * 100}%`,
              background: countdown > 6 ? 'var(--color-good)' : countdown > 3 ? 'var(--color-accent)' : 'var(--color-bad)',
              transition: 'width 1s linear, background-color 0.4s ease',
            }}
          />
        </div>

        <p className="text-center mb-5 text-sm text-[var(--color-muted)]">
          Place the song correctly in{' '}
          <strong className="text-cream">{activePlayer?.name}</strong>'s shelf.
          <span
            className="font-display mx-2 px-2 py-0.5 inline-block bg-accent text-accent-ink text-[11px] rounded-[4px]"
          >
            COST 1 ★
          </span>
        </p>

        <Timeline
          timeline={activeTimeline}
          currentSong={currentSong}
          onPlace={onStealAttempt}
          isMyTurn
          isWaiting={false}
          broadcastDrag={false}
          pendingPosition={pendingPosition}
          onPendingChange={setPendingPosition}
          vertical={isMobile}
        />

        <style>{`@keyframes steal-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }`}</style>
      </div>
    </div>
  )
}
