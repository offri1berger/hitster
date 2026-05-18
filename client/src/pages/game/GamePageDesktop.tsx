import { useState } from 'react'
import type { GamePageProps } from './useGamePage'
import { PlayerRail } from '../../components/game/PlayerRail'
import { GuessRail } from '../../components/game/GuessRail'
import { GameStage } from '../../components/game/GameStage'
import { Logo } from '../../components/ui/Logo'
import StealPill from './StealPill'
import LedDisplay from '../../components/boombox/LedDisplay'
import HowToPlayModal from '../../components/ui/HowToPlayModal'

const GamePageDesktop = (p: GamePageProps) => {
  const [showRules, setShowRules] = useState(false)
  return (
  <div className="hidden lg:flex flex-col flex-1 min-h-0 boombox-bg">
    {/* Top bar */}
    <div className="px-6 py-3 flex items-center justify-between shrink-0 bg-[linear-gradient(180deg,#1a1a1c,#0a0a0a)] border-b-2 border-[#000] [box-shadow:0_2px_8px_rgba(0,0,0,.5)]">
      <div className="flex items-center gap-4">
        <Logo />
        <LedDisplay color="green" className="text-sm px-[10px] py-1">
          {p.roomCode} · {p.players.length} PLAYERS
        </LedDisplay>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-bad [box-shadow:0_0_8px_var(--color-bad)]" />
          <span className="font-display text-[10px] tracking-[0.1em] text-bad">REC</span>
        </div>
        <span className="font-display text-[10px] tracking-[0.1em] text-cream">
          FIRST TO {p.songsToWin}
        </span>
        <button
          onClick={() => setShowRules(true)}
          className="plastic-btn plastic-btn-dark h-9 px-3.5 text-[10px]"
        >
          ? RULES
        </button>
        <button
          onClick={p.handleLeave}
          className="plastic-btn plastic-btn-dark h-9 px-3.5 text-[10px]"
        >
          EJECT
        </button>
      </div>
    </div>

    <div className="flex-1 grid min-h-0 grid-cols-[260px_1fr_300px]">
      <PlayerRail />
      <GameStage onPlace={p.handlePlace} onSkip={p.handleSkip} />
      <GuessRail
        guess={p.guess}
        onGuessChange={p.onGuessChange}
        isMyTurn={p.isMyTurn}
        isWaiting={p.isWaitingForNextTurn}
      />
    </div>

    {p.isStealWindowOpen && <StealPill stealerName={p.stealerName} countdown={p.countdown} />}

    {p.canSteal && (
      <button
        onClick={p.handleStealInitiate}
        className="plastic-btn plastic-btn-pink fixed bottom-6 right-6 z-30 h-12 px-5 text-[14px]"
      >
        ★ STEAL · 1 ★
      </button>
    )}

    {showRules && <HowToPlayModal onClose={() => setShowRules(false)} />}
  </div>
  )
}

export default GamePageDesktop
