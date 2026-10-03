import { useEffect, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { WallpaperState } from '../../../shared/types'
import type { AmbientKey } from '../audio/engine'
import { fmtTime } from '../lib/store'
import { EQ_PRESETS, type Player } from '../player/usePlayer'
import { Clock, Modal, PixelCover, RainCanvas, TRange } from './ui'

const AMBIENT: { key: AmbientKey; label: string; glyph: string; color: string }[] = [
  { key: 'rain', label: 'Mưa rơi trên kính', glyph: '⁞', color: 'text-cyan' },
  { key: 'vinyl', label: 'Đĩa than & băng từ', glyph: '◎', color: 'text-magenta' },
  { key: 'fire', label: 'Lò sưởi tí tách', glyph: '▲', color: 'text-[#ffb4ab]' },
  { key: 'cafe', label: 'Quán cà phê đêm', glyph: '♨', color: 'text-ph' }
]

const AMBIENT_PRESETS: { label: string; values: Record<AmbientKey, number> }[] = [
  { label: 'Mưa đêm', values: { rain: 60, vinyl: 25, fire: 0, cafe: 0 } },
  { label: 'Góc cà phê', values: { rain: 20, vinyl: 15, fire: 0, cafe: 55 } },
  { label: 'Lò sưởi', values: { rain: 15, vinyl: 30, fire: 60, cafe: 0 } },
  { label: 'Tắt hết', values: { rain: 0, vinyl: 0, fire: 0, cafe: 0 } }
]

export function AmbientModal({ open, onClose, p }: { open: boolean; onClose: () => void; p: Player }) {
  return (
    <Modal open={open} onClose={onClose} title="ambient mixer">
      <p className="mb-4 text-[12px] text-ph-dim">Các lớp âm nền chạy song song với nhạc — tạo trực tiếp bằng Web Audio, không cần file.</p>
      <div className="space-y-3">
        {AMBIENT.map((a) => (
          <div key={a.key} className="border border-crt-line p-2.5">
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span>
                <span className={`mr-2 ${a.color}`}>{a.glyph}</span>
                {a.label}
              </span>
              <span className={a.color}>{p.soundscape[a.key]}%</span>
            </div>
            <TRange label={a.label} min={0} max={100} step={1} className="w-full" value={p.soundscape[a.key]} onChange={(v) => p.setAmbient(a.key, v)} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {AMBIENT_PRESETS.map((pr) => (
          <button key={pr.label} className="tbtn sm" onClick={() => (Object.keys(pr.values) as AmbientKey[]).forEach((k) => p.setAmbient(k, pr.values[k]))}>
            {pr.label}
          </button>
        ))}
      </div>
    </Modal>
  )
}

export function EQModal({ open, onClose, p }: { open: boolean; onClose: () => void; p: Player }) {
  const bands: { key: 'low' | 'mid' | 'high'; label: string }[] = [
    { key: 'low', label: 'BASS · 250Hz' },
    { key: 'mid', label: 'MID · 1.2kHz' },
    { key: 'high', label: 'TREBLE · 4.5kHz' }
  ]
  return (
    <Modal open={open} onClose={onClose} title="lo-fi equalizer">
      <div className="mb-4 grid grid-cols-4 gap-1.5">
        {(Object.keys(EQ_PRESETS) as (keyof typeof EQ_PRESETS)[]).map((k) => (
          <button key={k} className={`tbtn sm justify-center ${p.eq.preset === k ? 'on' : ''}`} onClick={() => p.applyPreset(k)}>
            {EQ_PRESETS[k].label}
          </button>
        ))}
      </div>
      <div className="space-y-3 border border-crt-line p-3">
        {bands.map((b) => (
          <label key={b.key} className="block text-[12px]">
            <span className="flex justify-between text-ph-dim">
              {b.label}
              <span className="text-ph-bright">
                {p.eq[b.key] > 0 ? '+' : ''}
                {p.eq[b.key]} dB
              </span>
            </span>
            <TRange label={b.label} min={-10} max={10} step={1} className="w-full" value={p.eq[b.key]} onChange={(v) => p.setEQ({ [b.key]: v })} />
          </label>
        ))}
        <label className="block text-[12px]">
          <span className="flex justify-between text-ph-dim">
            ĐỘ ẤM BĂNG TỪ (saturation) <span className="text-cyan">{p.eq.warmth}%</span>
          </span>
          <TRange label="Độ ấm" min={0} max={100} step={1} className="w-full" value={p.eq.warmth} onChange={(v) => p.setEQ({ warmth: v })} />
        </label>
      </div>
    </Modal>
  )
}

export function SleepModal({ open, onClose, p }: { open: boolean; onClose: () => void; p: Player }) {
  const opts: { label: string; val: number | 'track' | null }[] = [
    { label: 'Tắt hẹn giờ', val: null },
    { label: '15 phút', val: 15 },
    { label: '30 phút', val: 30 },
    { label: '45 phút', val: 45 },
    { label: '60 phút', val: 60 },
    { label: '90 phút', val: 90 },
    { label: 'Hết bài này', val: 'track' }
  ]
  return (
    <Modal open={open} onClose={onClose} title="sleep timer" width={360}>
      <p className="mb-3 text-[12px] text-ph-dim">
        Nhạc và âm nền nhỏ dần rồi tự dừng.
        {p.sleepLeft !== null && <span className="text-cyan"> Còn {p.sleepLeft} phút.</span>}
      </p>
      <div className="flex flex-col gap-1">
        {opts.map((o) => {
          const active = o.val === null ? p.sleep === null : o.val === 'track' ? p.sleep === 'track' : false
          return (
            <button
              key={o.label}
              className={`flex justify-between px-3 py-2 text-left text-[13px] ${active ? 'row-active' : 'row-hover'}`}
              onClick={() => {
                p.setSleepMinutes(o.val)
                onClose()
              }}
            >
              <span>
                <span className="mr-2 text-ph-dim">&gt;</span>
                {o.label}
              </span>
              {active && <span className="text-cyan">●</span>}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

export function QueueModal({ open, onClose, p }: { open: boolean; onClose: () => void; p: Player }) {
  return (
    <Modal open={open} onClose={onClose} title={`hàng chờ (${p.queue.length})`} width={460}>
      <div className="max-h-[60vh] overflow-y-auto">
        {p.queue.length === 0 && <div className="py-6 text-center text-ph-dim">&gt; trống</div>}
        {p.queue.map((t, i) => (
          <div
            key={t.path}
            className={`flex cursor-pointer items-center gap-3 px-2 py-1.5 ${i === p.index ? 'row-active' : 'row-hover'}`}
            onClick={() => {
              p.playAt(i)
              onClose()
            }}
          >
            <PixelCover src={t.cover} seed={t.title} res={16} className="h-8 w-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate">{t.title}</div>
              <div className="truncate text-[11px] text-ph-dim">{t.artist}</div>
            </div>
            <span className="text-[11px] text-ph-dim">{fmtTime(t.duration)}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/** In-app fullscreen "screensaver": current wallpaper + pixel rain + big clock + mini player. */
export function WallpaperMode({ open, onClose, p, wallpaper }: { open: boolean; onClose: () => void; p: Player; wallpaper: WallpaperState | null }) {
  const [date, setDate] = useState('')
  useEffect(() => {
    if (!open) return
    document.documentElement.requestFullscreen?.().catch(() => {})
    setDate(new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }))
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [open, onClose])

  const src = wallpaper?.source
  const url = src ? window.lounge.mediaUrl(src.path) : null
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[180] flex flex-col justify-between overflow-hidden bg-crt-bg p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {url && src?.kind === 'video' && <video src={url} className="absolute inset-0 h-full w-full object-cover opacity-80" autoPlay loop muted />}
          {url && src?.kind === 'image' && <img src={url} className="absolute inset-0 h-full w-full object-cover opacity-80" />}
          {!url && <PixelCover src={p.current?.cover ?? null} seed={p.current?.title ?? 'chill'} res={48} className="absolute inset-0 h-full w-full object-cover opacity-50" />}
          <RainCanvas density={Math.max(35, wallpaper?.effects.rain ?? 0)} className="absolute inset-0 h-full w-full" />
          <div className="scanlines absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />

          <div className="relative flex justify-between">
            <span className="badge live bg-crt-bg/70">
              <span className="led animate-blink" /> SCREENSAVER MODE
            </span>
            <button className="tbtn bg-crt-bg/70" onClick={onClose}>
              [esc] thoát
            </button>
          </div>

          <div className="relative text-center">
            <div className="font-pixel text-[150px] leading-none text-ph-bright rgb-split">
              <Clock />
            </div>
            <div className="mt-2 text-[18px] text-ph capitalize">{date}</div>
          </div>

          <div className="relative mx-auto flex w-full max-w-[620px] items-center gap-4 border border-crt-line-strong bg-crt-bg/80 p-3">
            <PixelCover src={p.current?.cover ?? null} seed={p.current?.title ?? 'chill'} res={24} className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-ph-bright">{p.current?.title ?? '— chưa có bài —'}</div>
              <div className="truncate text-[11px] text-ph-dim">{p.current?.artist ?? ''}</div>
            </div>
            <button className="tbtn sm" onClick={p.prev}>
              |◀◀
            </button>
            <button className="tbtn primary" onClick={p.toggle}>
              {p.playing ? '❚❚' : '▶'}
            </button>
            <button className="tbtn sm" onClick={p.next}>
              ▶▶|
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const BOOT_LINES = [
  'CHILL_LOUNGE BIOS v0.2 (c) 2026',
  'Phosphor display ............ OK',
  'Audio engine (Web Audio) ..... OK',
  'Desktop compositor hook ...... OK',
  'Loading lo-fi modules ........ OK',
  '> welcome back. stay chill.'
]

/** Short typed boot log; any key or click skips it. */
export function BootScreen({ enabled }: { enabled: boolean }) {
  const [shown, setShown] = useState(enabled && !matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [lines, setLines] = useState(0)
  useEffect(() => {
    if (!shown) return
    const id = setInterval(() => setLines((n) => n + 1), 170)
    const done = setTimeout(() => setShown(false), 170 * BOOT_LINES.length + 500)
    const skip = (): void => setShown(false)
    window.addEventListener('keydown', skip)
    window.addEventListener('pointerdown', skip)
    return () => {
      clearInterval(id)
      clearTimeout(done)
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
    }
  }, [shown])

  return (
    <AnimatePresence>
      {shown && (
        <motion.div className="fixed inset-0 z-[190] bg-crt-bg p-10 font-mono text-[14px]" exit={{ opacity: 0, scaleY: 0.005, transition: { duration: 0.25 } }}>
          {BOOT_LINES.slice(0, lines).map((l) => (
            <div key={l} className={l.startsWith('>') ? 'mt-3 text-cyan glow' : 'text-ph'}>
              {l}
            </div>
          ))}
          <span className="mt-1 inline-block h-4 w-2.5 animate-blink bg-ph" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function CrtOverlay({ strength }: { strength: number }) {
  if (strength <= 0) return null
  return (
    <div className="crt-overlay" style={{ '--crt-strength': strength } as CSSProperties}>
      <div className="lines scanlines" />
      <div className="roll" />
      <div className="vignette" />
    </div>
  )
}
