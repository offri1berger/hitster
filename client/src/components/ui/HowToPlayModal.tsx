import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface Props {
  onClose: () => void
}

const STEPS: [string, string][] = [
  ['Hear it', '30-second preview plays. Everyone listens — the active player sees only "????"'],
  ['Place it', 'Drag the mystery cassette onto your shelf — between two cards you already have, or at the start / end.'],
  ['Steal window', 'Others get a few seconds to challenge a bad placement (next section).'],
  ['Reveal', 'The card flips. If your year-slot was right, the card stays. Score +1.'],
  ['Next up', 'Turn passes left. Play until someone hits the target.'],
]

const HowToPlayModal = ({ onClose }: Props) => {
  const [section, setSection] = useState(0)
  const [direction, setDirection] = useState(1)
  const trapRef = useFocusTrap<HTMLDivElement>(true)

  const goTo = (next: number) => {
    setDirection(next > section ? 1 : -1)
    setSection(next)
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const sections = [
    {
      tag: '01 · OVERVIEW',
      title: 'Name that tune.',
      icon: '◆',
      content: (
        <div className="flex flex-col gap-3">
          <p>2–6 players. Each player has a personal <strong className="text-cream">timeline</strong> — a shelf of songs sorted by year.</p>
          <p>Every turn, one player hears a 30-second mystery clip and drops it onto their timeline at the year they think it came out.</p>
          <p>Get to <strong className="text-cream">the target number of correctly-placed tracks</strong> first and you win the night.</p>
          <div className="grid grid-cols-3 gap-2.5 mt-1.5">
            {[
              { v: '2–6', l: 'PLAYERS', accent: true },
              { v: '~25', l: 'MINUTES', accent: false },
              { v: 'N', l: 'TO WIN', accent: true },
            ].map((s) => (
              <div
                key={s.l}
                className="p-2.5 rounded-lg text-center"
                style={{
                  background: 'rgba(255,255,255,.04)',
                  border: `1px solid ${s.accent ? 'rgba(255,212,0,.25)' : 'rgba(255,43,142,.25)'}`,
                }}
              >
                <div className={`font-display text-[22px] ${s.accent ? 'text-accent' : 'text-hot'}`}>{s.v}</div>
                <div className="text-[9px] tracking-[.2em] text-[var(--color-muted)] mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      tag: '02 · THE TURN',
      title: 'How a round plays.',
      icon: '▶',
      content: (
        <ol className="flex flex-col gap-3 list-none p-0 m-0">
          {STEPS.map(([t, b], i) => (
            <li key={t} className="flex gap-3">
              <div
                className="shrink-0 w-8 h-8 rounded-lg font-display text-[14px] flex items-center justify-center text-[#1a1a1c]"
                style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-hot))' }}
              >
                {i + 1}
              </div>
              <div>
                <div className="font-display text-[16px] text-cream mb-0.5">{t}</div>
                <div className="text-[13px] text-[var(--color-muted)] leading-relaxed">{b}</div>
              </div>
            </li>
          ))}
        </ol>
      ),
    },
    {
      tag: '03 · STEALING',
      title: 'Spend a ★, snatch a card.',
      icon: '★',
      content: (
        <div className="flex flex-col gap-3">
          <p>You start with <strong className="text-accent">★ tokens</strong>. When another player places a card, you have ~5 seconds to spend one and steal it.</p>
          <div
            className="p-3.5 rounded-[10px]"
            style={{
              background: 'linear-gradient(135deg, rgba(255,212,0,.08), transparent)',
              border: '1px solid rgba(255,212,0,.31)',
            }}
          >
            <div className="font-display text-[13px] text-accent mb-2 tracking-[.15em]">HOW IT WORKS</div>
            <ol className="pl-4 m-0 text-[13px] leading-relaxed text-cream space-y-1">
              <li>Click <em>Steal</em>. You pick the slot you think is correct.</li>
              <li>If the active player placed correctly, no one can steal.</li>
              <li>If you were also wrong, you lose the ★ for nothing.</li>
              <li>If you nailed it, you take the card onto your shelf.</li>
              <li>Only the first correct steal wins it.</li>
            </ol>
          </div>
          <p className="text-[12px] text-[var(--color-muted)] leading-relaxed">
            ◇ You can earn ★ back by correctly guessing the artist or song title during the preview.
          </p>
        </div>
      ),
    },
    {
      tag: '04 · WINNING',
      title: 'First shelf full wins.',
      icon: '♛',
      content: (
        <div className="flex flex-col gap-3">
          <p>The first player to fill their timeline with <strong className="text-cream">the target number of correctly-placed cards</strong> ends the round.</p>
          <div
            className="p-3.5 rounded-[10px]"
            style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(154,154,160,.25)' }}
          >
            <div className="font-display text-[13px] text-hot mb-2 tracking-[.15em]">TIE BREAKERS</div>
            <ul className="pl-4 m-0 text-[13px] leading-relaxed text-[var(--color-muted)] space-y-1">
              <li>More cards placed = wins outright.</li>
              <li>Tied on cards? Most ★ tokens remaining.</li>
              <li>Still tied? One sudden-death round.</li>
            </ul>
          </div>
          <div
            className="p-3.5 rounded-[10px] text-[13px] text-cream leading-relaxed"
            style={{
              background: 'linear-gradient(135deg, rgba(255,212,0,.12), rgba(255,43,142,.06))',
              border: '1px dashed var(--color-accent)',
            }}
          >
            <strong className="text-accent">Host tip:</strong> raise win count to 12–15 for longer games, drop to 6 for quick rounds. Settings live in your Waiting Room.
          </div>
        </div>
      ),
    },
  ]

  const s = sections[section]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5 font-mono"
      style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)', animation: 'rules-fade .18s ease-out' }}
      onClick={onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[760px] max-h-[92vh] brushed-darker panel-hardware flex flex-col overflow-hidden"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,43,142,.18)' }}
      >
        {/* header */}
        <div className="px-6 py-5 flex items-center justify-between gap-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,212,0,.2)' }}>
          <div>
            <div className="text-[10px] tracking-[.3em] text-accent uppercase">HOUSE RULES</div>
            <div className="font-display text-[26px] mt-1 text-cream leading-none">How to play Backspin.</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-cream text-[18px] cursor-pointer border-0 transition-colors"
            style={{ background: 'rgba(255,255,255,.06)' }}
          >
            ✕
          </button>
        </div>

        {/* tab strip */}
        <div className="px-6 py-3 flex gap-1.5 flex-wrap shrink-0" style={{ borderBottom: '1px solid rgba(255,212,0,.1)' }}>
          {sections.map((sec, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="px-3.5 py-2 rounded-lg border-0 cursor-pointer font-mono text-[10px] tracking-[.18em] uppercase font-bold transition-all duration-150"
              style={
                section === i
                  ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-hot))', color: '#1a1a1c' }
                  : { background: 'rgba(255,255,255,.04)', color: '#f5ecd6' }
              }
            >
              {sec.tag}
            </button>
          ))}
        </div>

        {/* content */}
        <div
          className="flex-1 overflow-hidden text-[var(--color-muted)] text-[14px] leading-relaxed"
          style={{ background: 'rgba(26,26,28,.6)' }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={section}
              initial={{ opacity: 0, x: direction * 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -32 }}
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
              className="h-full overflow-y-auto px-6 py-5"
            >
              <div className="flex items-baseline gap-3.5 mb-4">
                <div className="font-display text-[40px] text-accent leading-none">{s.icon}</div>
                <div className="font-display text-[26px] text-cream leading-tight">{s.title}</div>
              </div>
              {s.content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* footer nav */}
        <div className="px-6 py-3.5 flex items-center justify-between gap-3 shrink-0" style={{ borderTop: '1px solid rgba(255,212,0,.1)' }}>
          <button
            onClick={() => goTo(Math.max(0, section - 1))}
            disabled={section === 0}
            className="px-3.5 py-2 rounded-lg border-0 font-mono text-[11px] tracking-[.18em] uppercase cursor-pointer transition-all"
            style={{
              background: 'rgba(255,255,255,.04)',
              color: section === 0 ? 'var(--color-muted)' : '#f5ecd6',
              opacity: section === 0 ? 0.5 : 1,
            }}
          >
            ◂ BACK
          </button>

          <div className="flex gap-1.5">
            {sections.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Section ${i + 1}`}
                className="h-2 rounded-full border-0 cursor-pointer transition-all duration-200 p-0"
                style={{
                  width: i === section ? 22 : 8,
                  background: i === section ? 'var(--color-accent)' : 'rgba(255,255,255,.15)',
                }}
              />
            ))}
          </div>

          {section < sections.length - 1 ? (
            <button
              onClick={() => goTo(section + 1)}
              className="px-4 py-2 rounded-lg border-0 cursor-pointer font-mono text-[11px] tracking-[.18em] uppercase font-bold text-[#1a1a1c]"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-hot))' }}
            >
              NEXT ▸
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border-0 cursor-pointer font-mono text-[11px] tracking-[.18em] uppercase font-bold text-[#1a1a1c]"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-hot))' }}
            >
              ★ GOT IT
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes rules-fade { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  )
}

export default HowToPlayModal
