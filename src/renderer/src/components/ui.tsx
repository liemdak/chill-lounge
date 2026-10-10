import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ditherCover, usePaletteKey } from '../lib/dither'
import { useI18n } from '../i18n'
import { getBeat } from '../lib/beat'
import { startVfx, type VfxLayers } from '../lib/vfx'
import { useSkin } from '../lib/theme'
import { Icon } from './icons'

export function Panel({ title, right, className = '', children }: { title?: string; right?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`panel ${className}`}>
      {title && <span className="panel-title">{title}</span>}
      {right && <div className="panel-right absolute -top-3 right-3 bg-crt-bg px-1">{right}</div>}
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
      <span className={`check ${checked ? 'on text-cyan' : 'text-ph-dim'}`}>{checked ? '[x]' : '[ ]'}</span>
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

/** Cover art: dithered pixel art in the retro skin, the real image in the others. */
export function PixelCover(props: { src: string | null; seed: string; res?: number; className?: string }) {
  return useSkin() === 'retro' ? <DitheredCover {...props} /> : <CoverImage src={props.src} className={props.className} />
}

/** The cover as is, or a soft gradient with a note when there is none. */
export function CoverImage({ src, className = '' }: { src: string | null; className?: string }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [src])
  if (!src || broken)
    return (
      <div className={`cover-art flex items-center justify-center bg-gradient-to-br from-violet to-magenta text-white/85 ${className}`}>
        <Icon name="music" size={20} className="h-[42%] w-[42%]" />
      </div>
    )
  return <img src={src} alt="" draggable={false} loading="lazy" onError={() => setBroken(true)} className={`cover-art object-cover ${className}`} />
}

function DitheredCover({ src, seed, res = 32, className = '' }: { src: string | null; seed: string; res?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const theme = usePaletteKey()
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
  }, [src, seed, res, theme])
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
