import { useState } from 'react'
import type { GamePageProps } from './useGamePage'
import { GameStage } from '../../components/game/GameStage'
import { Logo } from '../../components/ui/Logo'
import MobilePlayerBar from './MobilePlayerBar'
import MobileBottomSheet from './MobileBottomSheet'
import LedDisplay from '../../components/boombox/LedDisplay'
import HowToPlayModal from '../../components/ui/HowToPlayModal'
import { useGameStore } from '../../store/gameStore'

const GamePageMobile = (p: GamePageProps) => {
  const [pendingState, setPendingState] = useState<{ forSongId: string | undefined; slot: number | null }>({ forSongId: undefined, slot: null })
  const [confirmedSongId, setConfirmedSongId] = useState<string | undefined>(undefined)
  const [sheetHeight, setSheetHeight] = useState(320)
  const [showRules, setShowRules] = useState(false)
  const isWaitingForNextTurn = useGameStore((s) => s.isWaitingForNextTurn)
  const currentSongId = useGameStore((s) => s.currentSong?.id)

  // Derived — automatically resets to null/false when currentSongId changes
  const mobilePending = pendingState.forSongId === currentSongId ? pendingState.slot : null
  const mobileConfirmed = confirmedSongId === currentSongId

  const setMobilePending = (val: number | null) => {
    setPendingState({ forSongId: currentSongId, slot: val })
    if (val === null) setConfirmedSongId(undefined)
  }

  const showGuessBar = p.isMyTurn && !isWaitingForNextTurn && !mobileConfirmed

  return (
    <div className="flex flex-col lg:hidden min-h-dvh boombox-bg">
      <div
        className="px-4 py-2.5 flex items-center justify-between shrink-0 bg-[linear-gradient(180deg,#1a1a1c,#0a0a0a)] border-b-2 border-[#000]"
      >
        <Logo variant="compact" />
        <div className="flex items-center gap-2">
          <LedDisplay color="green" className="text-xs px-2 py-[3px]">
            {p.roomCode}
          </LedDisplay>
          <button
            onClick={() => setShowRules(true)}
            aria-label="How to play"
            className="w-9 h-9 flex items-center justify-center bg-transparent border-0 cursor-pointer text-cream"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.6" />
              <path d="M9 13v-.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M9 10c0-1.5 2-2 2-3.5a2 2 0 00-4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={p.handleLeave}
            aria-label="Leave room"
            className="w-9 h-9 flex items-center justify-center bg-transparent border-0 cursor-pointer text-cream"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M10 5l3 3-3 3M13 8H6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <MobilePlayerBar songsToWin={p.songsToWin} />

      {showGuessBar && (
        <div
          className="px-3 py-2 flex gap-2 shrink-0 bg-[#111113] border-b-2 border-[#000]"
        >
          {(['artist', 'title'] as const).map((field) => (
            <input
              key={field}
              placeholder={field === 'artist' ? 'Artist guess…' : 'Title guess…'}
              value={p.guess[field]}
              onChange={(e) => p.onGuessChange(field, e.target.value)}
              className="flex-1 min-w-0 h-[38px] bg-cream text-accent-ink border-2 border-[#000] rounded-[6px] px-[10px] py-0 font-code text-[13px] outline-none [box-shadow:inset_0_2px_4px_rgba(0,0,0,.2)]"
            />
          ))}
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto px-4 pt-4"
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${sheetHeight + 16}px)` }}
      >
        <GameStage
          onPlace={p.handlePlace}
          onSkip={p.handleSkip}
          showAudioPlayer={false}
          showSkipButton={false}
          vertical={true}
          pendingPosition={mobilePending}
          onPendingChange={setMobilePending}
          showPlaceButton={false}
        />
      </div>

      <MobileBottomSheet
        isMyTurn={p.isMyTurn}
        canSteal={p.canSteal}
        mobilePending={mobilePending}
        mobileConfirmed={mobileConfirmed}
        guess={p.guess}
        myPlayer={p.myPlayer}
        stealerName={p.stealerName}
        countdown={p.countdown}
        onStealInitiate={p.handleStealInitiate}
        onSkip={p.handleSkip}
        onGuessChange={p.onGuessChange}
        onConfirm={() => {
          setConfirmedSongId(currentSongId)
          p.handlePlace(mobilePending!, () => setConfirmedSongId(undefined))
        }}
        onHeightChange={setSheetHeight}
      />

      {showRules && <HowToPlayModal onClose={() => setShowRules(false)} />}
    </div>
  )
}

export default GamePageMobile
