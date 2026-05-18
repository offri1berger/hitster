import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DecadeFilter } from '@backspin-maestro/shared'
import ImagePicker from '../ui/ImagePicker'
import { AVATARS } from '../../lib/avatars'
import { Logo } from '../ui/Logo'
import { DecadePicker } from './DecadePicker'
import LedDisplay from '../boombox/LedDisplay'
import PlasticButton from '../boombox/PlasticButton'

export interface SetupFormProps {
  tab: 'create' | 'join'
  onTabChange: (t: 'create' | 'join') => void
  name: string
  onNameChange: (v: string) => void
  roomCode: string
  onRoomCodeChange: (v: string) => void
  decadeFilter: DecadeFilter
  onDecadeChange: (d: DecadeFilter) => void
  songsPerPlayer: number
  onSongsPerPlayerChange: (n: number) => void
  avatar: string | undefined
  onAvatarChange: (v: string | undefined) => void
  onSubmit: () => void
  error?: string | null
  submitting?: boolean
}

export const SetupForm = ({
  tab, onTabChange,
  name, onNameChange,
  roomCode, onRoomCodeChange,
  decadeFilter, onDecadeChange,
  songsPerPlayer, onSongsPerPlayerChange,
  avatar, onAvatarChange,
  onSubmit,
  error,
  submitting = false,
}: SetupFormProps) => {
  const isCreate = tab === 'create'
  const disabled = (isCreate ? !name.trim() : !name.trim() || !roomCode.trim()) || submitting

  const [slideDir, setSlideDir] = useState<1 | -1>(1)
  const handleTabChange = (t: 'create' | 'join') => {
    setSlideDir(t === 'join' ? 1 : -1)
    onTabChange(t)
  }

  return (
    <motion.div
      initial={{ x: 56, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 36, delay: 0.06 }}
      className="relative min-h-dvh lg:min-h-0 lg:h-full flex flex-col lg:overflow-hidden p-5 lg:p-7"
    >
      {/* Mobile-only logo */}
      <div className="lg:hidden mb-4">
        <Logo />
      </div>

      <div
        className="relative panel-hardware brushed-dark flex-1 lg:overflow-y-auto p-5 lg:p-6 flex flex-col gap-3.5 lg:gap-4"
      >
        {/* Corner screws */}
        <span className="screw top-2 left-2" />
        <span className="screw top-2 right-2" />
        <span className="screw bottom-2 left-2" />
        <span className="screw bottom-2 right-2" />

        <LedDisplay color="green" className="text-[18px] lg:text-[22px]">
          {tab === 'create' ? '▶ NEW MIX' : '◀ JOIN MIX'}
        </LedDisplay>

        {/* Avatar + name */}
        <div className="flex items-start gap-3.5">
          <ImagePicker
            options={AVATARS}
            value={avatar}
            onChange={onAvatarChange}
            fallback={name.trim() ? name.trim().charAt(0).toUpperCase() : '?'}
            label="avatar"
          />
          <div className="flex-1 min-w-0">
            <div className="font-display text-[10px] tracking-[0.1em] mb-1.5 text-accent">
              YOUR DJ NAME
            </div>
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="DJ_BOOMBAP"
              className="block w-full h-[48px] lg:h-[52px] rounded-[8px] border-2 border-[#0a0a0a] px-3.5 outline-none box-border text-base font-code font-bold"
            />
            <style>{`input { background: var(--color-cream); color: var(--color-accent-ink); box-shadow: inset 0 2px 4px rgba(0,0,0,.2); }`}</style>
          </div>
        </div>

        {/* Tab toggle — segmented plastic */}
        <div
          className="flex gap-0 rounded-[8px] p-1 bg-[#0a0a0a] [box-shadow:inset_0_2px_4px_rgba(0,0,0,.8)]"
        >
          {(['create', 'join'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTabChange(t)}
              className={`flex-1 px-3 py-2.5 rounded-[6px] border-0 cursor-pointer font-display text-[12px] tracking-[0.05em] ${tab === t
                ? 'bg-[linear-gradient(180deg,var(--color-accent),color-mix(in_srgb,var(--color-accent)_75%,#000))] text-accent-ink [box-shadow:inset_0_-2px_0_rgba(0,0,0,.2),inset_0_1px_0_rgba(255,255,255,.4)]'
                : 'bg-transparent text-cream'}`}
            >
              {t === 'create' ? 'CREATE' : 'JOIN CODE'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: slideDir * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideDir * -28 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-col gap-3.5 lg:gap-4"
          >
            {!isCreate && (
              <div>
                <div className="font-display text-[10px] tracking-[0.1em] mb-1.5 text-cyan">
                  TUNE IN ▸ ROOM CODE
                </div>
                <div className="relative">
                  <LedDisplay color="cyan" className="text-center text-[28px] tracking-[0.35em] py-3 px-4">
                    {(roomCode || '______').padEnd(6, '_')}
                  </LedDisplay>
                  <input
                    value={roomCode}
                    onChange={(e) => onRoomCodeChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder=""
                    maxLength={6}
                    aria-label="Room code"
                    className="absolute inset-0 w-full opacity-0 cursor-text text-base"
                  />
                </div>
              </div>
            )}

            {isCreate && (
              <>
                <DecadePicker decadeFilter={decadeFilter} onChange={onDecadeChange} />

                <div>
                  <div className="font-display text-[10px] tracking-[0.1em] mb-1.5 text-cyan">
                    FIRST TO {songsPerPlayer} SONGS
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSongsPerPlayerChange(Math.max(3, songsPerPlayer - 1))}
                      aria-label="Fewer songs"
                      className="knob-btn shrink-0 w-10 h-10 bg-[radial-gradient(circle_at_30%_25%,var(--color-bad),color-mix(in_srgb,var(--color-bad)_50%,#000))] [box-shadow:inset_0_-3px_6px_rgba(0,0,0,.4),inset_0_2px_4px_rgba(255,255,255,.4),0_3px_0_color-mix(in_srgb,var(--color-bad)_40%,#000)] text-white text-lg"
                    >−</button>
                    <LedDisplay color="yellow" className="flex-1 text-center text-base py-2 px-3">
                      {songsPerPlayer}·{Math.round(songsPerPlayer * 2.5)}M
                    </LedDisplay>
                    <button
                      type="button"
                      onClick={() => onSongsPerPlayerChange(Math.min(20, songsPerPlayer + 1))}
                      aria-label="More songs"
                      className="knob-btn shrink-0 w-10 h-10 bg-[radial-gradient(circle_at_30%_25%,var(--color-good),color-mix(in_srgb,var(--color-good)_50%,#000))] [box-shadow:inset_0_-3px_6px_rgba(0,0,0,.4),inset_0_2px_4px_rgba(255,255,255,.4),0_3px_0_color-mix(in_srgb,var(--color-good)_40%,#000)] text-accent-ink text-lg"
                    >+</button>
                  </div>
                </div>

                <div className="rounded-[8px] flex gap-3 items-start p-3.5 bg-[#0a0a0a] border-2 border-[color-mix(in_srgb,var(--color-accent)_40%,transparent)] [box-shadow:inset_0_2px_4px_rgba(0,0,0,.8)]">
                  <div className="font-display text-[22px] leading-none text-accent [text-shadow:2px_2px_0_#000]">★</div>
                  <div className="text-[11px] leading-snug text-cream">
                    <div className="font-display text-[11px] mb-0.5 text-accent">READY THE BOOTH</div>
                    Decade dial, win count, and steal rules wait in the waiting room.
                    Get a name + face down first.
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex-1 min-h-2" />

        {error && (
          <p
            role="alert"
            aria-live="polite"
            className="font-display text-center text-[11px] tracking-[0.1em] text-bad"
          >
            {error}
          </p>
        )}

        <PlasticButton
          onClick={onSubmit}
          disabled={disabled}
          title={disabled && !submitting ? (isCreate ? 'Enter a name first' : 'Enter a name and room code') : undefined}
          color="yellow"
          className="w-full h-[60px] text-[16px] flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <span
                className="inline-block w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"
                aria-hidden
              />
              {isCreate ? 'CREATING…' : 'JOINING…'}
            </>
          ) : (
            <>{isCreate ? 'PRESS RECORD ★' : 'PLUG IN ★'}</>
          )}
        </PlasticButton>
      </div>
    </motion.div>
  )
}
