import Sticker from '../boombox/Sticker'
import Speaker from '../boombox/Speaker'
import { LedDisplay } from '../boombox/LedDisplay'

const STATS = [
  { val: '200K',  label: 'TRACKS',  color: 'var(--color-accent)' },
  { val: '8',     label: 'DECADES', color: 'var(--color-cyan)' },
  { val: '2-6',   label: 'PLAYERS', color: 'var(--color-hot)' },
] as const

const HeroPanel = () => {
  return (
    <div className="relative h-full min-h-0 px-8 xl:px-14 py-6 xl:py-10 flex flex-col gap-4 xl:gap-6 boombox-bg overflow-y-auto">
      {/* Boombox hardware visualization */}
      <div className="flex justify-center shrink-0">
        <div
          className="relative panel-hardware brushed-dark w-full max-w-[400px] xl:max-w-[460px] aspect-[7/4] p-3 xl:p-5"
        >
          {/* handle */}
          <div
            className="absolute left-1/2 -top-2 -translate-x-1/2 w-32 xl:w-40 h-3.5 rounded-[10px] bg-[linear-gradient(180deg,#5a5a60,#2a2a2c)] [box-shadow:0_3px_6px_rgba(0,0,0,.5)]"
          />
          {/* speakers — scale with viewport */}
          <div className="absolute left-3 top-3 xl:left-4 xl:top-4">
            <Speaker size={92} color="hot" />
          </div>
          <div className="absolute right-3 top-3 xl:right-4 xl:top-4">
            <Speaker size={92} color="cyan" />
          </div>

          {/* center deck */}
          <div
            className="absolute left-[32%] right-[32%] top-4 rounded-lg p-2 h-16 bg-[#0a0a0a] border-2 border-[#1a1a1a] [box-shadow:inset_0_2px_6px_rgba(0,0,0,.8)]"
          >
            <div className="font-mono text-xs tracking-[0.1em] text-good [text-shadow:0_0_6px_var(--color-good)]">
              ● REC ▸ 30s
            </div>
            <div className="mt-1.5 flex items-end gap-[3px] h-[28px]">
              {Array.from({ length: 14 }).map((_, i) => (
                <span
                  key={i}
                  className="wave-bar bg-accent [box-shadow:0_0_6px_var(--color-accent)]"
                  style={{
                    height: `${30 + (i % 4) * 18}%`,
                    animationDelay: `${i * 70}ms`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* tuner knobs */}
          <div className="absolute left-[32%] bottom-2 flex gap-1.5">
            {(['hot','cyan','yellow'] as const).map((col, i) => {
              const c = col === 'hot' ? 'var(--color-hot)' : col === 'cyan' ? 'var(--color-cyan)' : 'var(--color-accent)'
              return (
                <div
                  key={i}
                  className="relative w-[22px] h-[22px] rounded-full [box-shadow:inset_0_-2px_4px_rgba(0,0,0,.4),0_2px_4px_rgba(0,0,0,.5)]"
                  style={{
                    background: `conic-gradient(${c}, color-mix(in srgb, ${c} 60%, #000))`,
                  }}
                >
                  <div className="absolute left-1/2 -translate-x-1/2 top-0.5 w-0.5 h-1.5 bg-white" />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Big title with stickers */}
      <div className="relative shrink-0">
        <Sticker color="cyan" rotate={-5} className="absolute -top-3 left-0">SIDE A</Sticker>
        <h1 className="boombox-title text-[clamp(48px,6vw,80px)]">
          CRANK IT,<br />
          <span className="boombox-title-yellow">NAME IT.</span>
        </h1>
        <Sticker color="hot" rotate={4} className="absolute -bottom-1 right-4 xl:left-72 xl:right-auto">★ HOT ★</Sticker>
        <p className="mt-5 max-w-[440px] text-[13px] leading-[1.5] text-[var(--color-muted)]">
          Hear a hit. Drop the cassette on the right year. Steal your friends' picks. Loudest deck wins.
        </p>
      </div>

      {/* Stats row */}
      <div className="flex items-end gap-5 xl:gap-7 flex-wrap shrink-0">
        {STATS.map(({ val, label, color }) => (
          <div key={label}>
            <div
              className="font-display text-2xl leading-none [text-shadow:2px_2px_0_var(--color-accent-ink)]"
              style={{ color }}
            >
              {val}
            </div>
            <div className="font-display text-[9px] tracking-[0.2em] mt-1 text-[var(--color-muted)]">
              {label}
            </div>
          </div>
        ))}
        <div className="ml-auto">
          <LedDisplay color="green" className="text-[13px] py-[5px] px-[9px]">● ONLINE</LedDisplay>
        </div>
      </div>
    </div>
  )
}

export default HeroPanel;