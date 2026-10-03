import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ditherCover } from '../lib/dither'
import { useI18n } from '../i18n'
import { getBeat } from '../lib/beat'
import { startVfx, type VfxLayers } from '../lib/vfx'

export function Panel({ title, right, className = '', children }: { title?: string; right?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`panel ${className}`}>
      {title && <span className="panel-title">{title}</span>}
      {right && <div className="absolute -top-3 right-3 bg-crt-bg px-1">{right}</div>}
      {children}
    </section>
  )
}

/** Range input that paints its own fill via --pct. */
export function TRange({ value, min = 0, max = 1, step = 0.01, onChange, label, className = '' }: {
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
  label: string
  className?: string
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <input
      type="range"
      aria-label={label}
      className={`trange ${className}`}
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ '--pct': `${pct}%` } as CSSProperties}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

/** [x] / [ ] checkbox row. */
export function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" className="flex w-full items-start gap-3 py-1 text-left row-hover" onClick={() => onChange(!checked)}>
      <span className={checked ? 'text-cyan' : 'text-ph-dim'}>{checked ? '[x]' : '[ ]'}</span>
      <span className="flex-1">
        <span className="block text-ph-bright">{label}</span>
        {hint && <span className="block text-[11px] text-ph-dim">{hint}</span>}
      </span>
    </button>
  )
}

/** Block progress bar you can click to seek. */
export function BlockBar({ value, max, onSeek, className = '' }: { value: number; max: number; onSeek?: (v: number) => void; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div
      className={`blockbar ${className}`}
      role="slider"
      aria-valuenow={Math.round(pct)}
      onClick={(e) => {
        if (!onSeek || max <= 0) return
        const r = e.currentTarget.getBoundingClientRect()
        onSeek(((e.clientX - r.left) / r.width) * max)
      }}
    >
      <div className="fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Terminal-window modal. */
export function Modal({ open, title, onClose, children, width = 440 }: { open: boolean; title: string; onClose: () => void; children: ReactNode; width?: number }) {
  const { t } = useI18n()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="panel p-0"
            style={{ width }}
            initial={{ scaleY: 0.02, scaleX: 0.6 }}
            animate={{ scaleY: 1, scaleX: 1 }}
            exit={{ scaleY: 0.02, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-crt-line bg-crt-panel-2 px-3 py-1.5">
              <span className="text-[12px] tracking-[0.14em] text-ph-bright uppercase">▌{title}</span>
              <button className="tbtn sm ghost" onClick={onClose} aria-label={t('close')}>
                [x]
              </button>
            </div>
            <div className="p-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Cover art rendered as dithered pixel art. */
export function PixelCover({ src, seed, res = 32, className = '' }: { src: string | null; seed: string; res?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let alive = true
    ditherCover(src, res, seed).then((art) => {
      const c = ref.current
      if (!alive || !c) return
      c.width = c.height = res
      c.getContext('2d')!.drawImage(art, 0, 0)
    })
    return () => {
      alive = false
    }
  }, [src, seed, res])
  return <canvas ref={ref} className={`pixelated ${className}`} aria-hidden />
}

/** All pixel VFX layers on one canvas. `reactive` makes them pulse with the music. */
export function VfxCanvas({ layers, reactive = false, paused = false, className = '' }: { layers: VfxLayers; reactive?: boolean; paused?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef({ layers, reactive, paused })
  live.current = { layers, reactive, paused }
  useEffect(
    () =>
      startVfx(ref.current!, {
        layers: () => live.current.layers,
        paused: () => live.current.paused,
        beat: () => (live.current.reactive ? getBeat() : 0)
      }),
    []
  )
  return <canvas ref={ref} className={`pixelated pointer-events-none ${className}`} aria-hidden />
}

/** Types text out character by character whenever `text` changes. */
export function useTypewriter(text: string, speed = 22): string {
  const [out, setOut] = useState(text)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setOut(text)
    let i = 0
    setOut('')
    const id = setInterval(() => {
      i++
      setOut(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text, speed])
  return out
}

export function Clock({ seconds = true }: { seconds?: boolean }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const p = (n: number): string => String(n).padStart(2, '0')
  return <>{`${p(now.getHours())}:${p(now.getMinutes())}${seconds ? `:${p(now.getSeconds())}` : ''}`}</>
}
