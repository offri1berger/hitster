import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

const spring = { type: 'spring', stiffness: 380, damping: 26 } as const

export const ResultToast = () => {
  const { stealResult, placementResult, players, playerId } = useGameStore()

  // ── Steal result ──────────────────────────────────────────────────────────
  const stealContent = (() => {
    if (!stealResult) return null
    const stealerName = players.find((p) => p.id === stealResult.stealerId)?.name ?? 'Someone'
    const targetName  = players.find((p) => p.id === stealResult.targetPlayerId)?.name ?? 'them'
    const iAmStealer  = stealResult.stealerId === playerId
    const iAmTarget   = stealResult.targetPlayerId === playerId
    const { correct: success, targetWasCorrect } = stealResult
    const isGoodForMe = iAmStealer ? success : iAmTarget ? targetWasCorrect : success

    let headline: string
    let subline: string
    if (success) {
      headline = iAmStealer ? 'YOU STOLE IT!'
        : iAmTarget ? `${stealerName} STOLE YOUR CARD!`
        : `${stealerName} STOLE THE CARD!`
      subline = iAmStealer ? 'Card added to your shelf.'
        : iAmTarget ? 'Your card goes to their shelf.'
        : ''
    } else if (targetWasCorrect) {
      headline = iAmStealer ? 'STEAL FAILED — THEY PLACED RIGHT'
        : iAmTarget ? `${stealerName} TRIED — AND FAILED!`
        : `${stealerName}'S STEAL FAILED`
      subline = iAmStealer ? `${targetName} was right all along. You lost 1 ★.`
        : iAmTarget ? `${stealerName} placed it wrong — your card is safe.`
        : `${targetName} placed correctly — nothing was stolen.`
    } else {
      headline = iAmStealer ? 'STEAL MISSED — WRONG SPOT'
        : iAmTarget ? `${stealerName} TRIED TO STEAL BUT MISSED!`
        : `${stealerName}'S STEAL MISSED`
      subline = iAmStealer ? 'Wrong position. You lost 1 ★.'
        : iAmTarget ? 'Wrong position — your card stays.'
        : 'Wrong position — steal attempt missed.'
    }

    const bgVar = isGoodForMe ? 'var(--color-good)' : 'var(--color-bad)'

    return { headline, subline, isGoodForMe, bgVar }
  })()

  // ── Placement result ──────────────────────────────────────────────────────
  const placementContent = (() => {
    if (!placementResult) return null
    const correct  = placementResult.correct
    const song     = placementResult.song
    const headline = correct ? (placementResult.message ?? 'CORRECT!') : 'WRONG PLACEMENT'
    const bgVar    = correct ? 'var(--color-good)' : 'var(--color-bad)'
    return { correct, song, headline, bgVar }
  })()

  return (
    <>
      {/* ── Steal modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {stealResult && stealContent && (
          <motion.div
            key="steal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4 [background:rgba(0,0,0,0.6)] [backdrop-filter:blur(8px)]"
            role="alert"
            aria-live="assertive"
          >
            <motion.div
              initial={{ scale: 0.78, rotateX: -40, opacity: 0 }}
              animate={{ scale: 1,    rotateX: 0,   opacity: 1 }}
              exit={{    scale: 0.78, rotateX: 40,  opacity: 0 }}
              transition={spring}
              style={{ perspective: 900 }}
              className="brushed-darker panel-hardware min-w-[320px] max-w-[420px] overflow-hidden rounded-2xl"
            >
              <div
                className="px-6 py-5 text-center"
                style={{ background: `linear-gradient(180deg, ${stealContent.bgVar}, color-mix(in srgb, ${stealContent.bgVar} 70%, #000))` }}
              >
                <div className="text-[36px] mb-1" aria-hidden>{stealContent.isGoodForMe ? '🎉' : '😬'}</div>
                <span className="sr-only">{stealContent.isGoodForMe ? 'Success: ' : 'Failure: '}</span>
                <div className="font-display text-lg text-white [text-shadow:3px_3px_0_rgba(0,0,0,.5)] tracking-[.02em]">
                  {stealContent.headline}
                </div>
                {stealContent.subline && (
                  <div className="text-[13px] mt-1.5 text-[rgba(255,255,255,0.9)]">{stealContent.subline}</div>
                )}
              </div>
              <div className="px-5 py-3 flex justify-between items-center bg-[#0a0a0a]">
                <div>
                  <div className="font-display text-[13px] text-cream">{stealResult.song.title}</div>
                  <div className="font-mono mt-0.5 text-[13px] text-[var(--color-muted)]">{stealResult.song.artist}</div>
                </div>
                <div className="font-display text-[32px] text-accent leading-none [text-shadow:2px_2px_0_var(--color-hot),4px_4px_0_var(--color-accent-ink)]">
                  {stealResult.song.year}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Placement banner ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {placementResult && placementContent && (
          <motion.div
            key="placement"
            initial={{ opacity: 0, y: -32 }}
            animate={{ opacity: 1,  y: 0   }}
            exit={{    opacity: 0,  y: -32 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className="fixed top-6 left-1/2 z-40 w-[320px] overflow-hidden -translate-x-1/2 rounded-xl border-2 border-[#0a0a0a] [box-shadow:0_8px_22px_rgba(0,0,0,.4)]"
            role={placementContent.correct ? 'status' : 'alert'}
            aria-live={placementContent.correct ? 'polite' : 'assertive'}
          >
            <div
              className="px-4 py-2 text-center font-display text-white text-sm tracking-[.05em] [text-shadow:2px_2px_0_rgba(0,0,0,.4)]"
              style={{ background: `linear-gradient(180deg, ${placementContent.bgVar}, color-mix(in srgb, ${placementContent.bgVar} 70%, #000))` }}
            >
              <span aria-hidden>{placementContent.correct ? '✓ ' : '✗ '}</span>
              {placementContent.headline.toUpperCase()}
            </div>
            {placementContent.song && (
              <div className="px-4 py-2.5 flex justify-between items-center gap-3 bg-[#0a0a0a]">
                <div className="min-w-0">
                  <div className="font-display truncate text-[13px] text-cream">{placementContent.song.title}</div>
                  <div className="font-mono mt-0.5 truncate text-[13px] text-[var(--color-muted)]">{placementContent.song.artist}</div>
                </div>
                <div className="font-display shrink-0 text-[28px] text-accent leading-none [text-shadow:2px_2px_0_var(--color-hot)]">
                  {placementContent.song.year}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
