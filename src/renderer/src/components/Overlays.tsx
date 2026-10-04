import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { WallpaperState } from '../../../shared/types'
import type { AmbientKey } from '../audio/engine'
import { useI18n, type TKey } from '../i18n'
import { fmtTime } from '../lib/store'
import { EQ_PRESETS, type Player } from '../player/usePlayer'
import { hasVfx, NO_VFX } from '../lib/vfx'
import { VideoViewer } from './Media'
import { BlockBar, Clock, Modal, PixelCover, TRange, VfxCanvas } from './ui'

const AMBIENT: { key: AmbientKey; label: TKey; glyph: string; color: string }[] = [
  { key: 'rain', label: 'amb.rain', glyph: '⁞', color: 'text-cyan' },
  { key: 'vinyl', label: 'amb.vinyl', glyph: '◎', color: 'text-magenta' },
  { key: 'fire', label: 'amb.fire', glyph: '▲', color: 'text-[#ffb4ab]' },
  { key: 'cafe', label: 'amb.cafe', glyph: '♨', color: 'text-ph' }
]

const AMBIENT_PRESETS: { label: TKey; values: Record<AmbientKey, number> }[] = [
  { label: 'amb.p.rain', values: { rain: 60, vinyl: 25, fire: 0, cafe: 0 } },
  { label: 'amb.p.cafe', values: { rain: 20, vinyl: 15, fire: 0, cafe: 55 } },
  { label: 'amb.p.fire', values: { rain: 15, vinyl: 30, fire: 60, cafe: 0 } },
  { label: 'amb.p.off', values: { rain: 0, vinyl: 0, fire: 0, cafe: 0 } }
]

export function AmbientModal({ open, onClose, p }: { open: boolean; onClose: () => void; p: Player }) {
  const { t } = useI18n()
  return (
    <Modal open={open} onClose={onClose} title={t('amb.title')}>
      <p className="mb-4 text-[12px] text-ph-dim">{t('amb.intro')}</p>
      <div className="space-y-3">
        {AMBIENT.map((a) => (
          <div key={a.key} className="border border-crt-line p-2.5">
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span>
                <span className={`mr-2 ${a.color}`}>{a.glyph}</span>
                {t(a.label)}
              </span>
              <span className={a.color}>{p.soundscape[a.key]}%</span>
            </div>
            <TRange label={t(a.label)} min={0} max={100} step={1} className="w-full" value={p.soundscape[a.key]} onChange={(v) => p.setAmbient(a.key, v)} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {AMBIENT_PRESETS.map((pr) => (
          <button key={pr.label} className="tbtn sm" onClick={() => (Object.keys(pr.values) as AmbientKey[]).forEach((k) => p.setAmbient(k, pr.values[k]))}>
            {t(pr.label)}
          </button>
        ))}
      </div>
    </Modal>
  )
}

export function EQModal({ open, onClose, p }: { open: boolean; onClose: () => void; p: Player }) {
  const { t } = useI18n()
  const bands: { key: 'low' | 'mid' | 'high'; label: string }[] = [
    { key: 'low', label: 'BASS · 250Hz' },
    { key: 'mid', label: 'MID · 1.2kHz' },
    { key: 'high', label: 'TREBLE · 4.5kHz' }
  ]
  return (
    <Modal open={open} onClose={onClose} title={t('eq.title')}>
      <div className="mb-4 grid grid-cols-4 gap-1.5">
        {(Object.keys(EQ_PRESETS) as (keyof typeof EQ_PRESETS)[]).map((k) => (
          <button key={k} className={`tbtn sm justify-center ${p.eq.preset === k ? 'on' : ''}`} onClick={() => p.applyPreset(k)}>
            {t(EQ_PRESETS[k].label)}
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
            {t('eq.warmth')} <span className="text-cyan">{p.eq.warmth}%</span>
          </span>
          <TRange label={t('eq.warmth')} min={0} max={100} step={1} className="w-full" value={p.eq.warmth} onChange={(v) => p.setEQ({ warmth: v })} />
        </label>
      </div>
    </Modal>
  )
}

export function SleepModal({ open, onClose, p }: { open: boolean; onClose: () => void; p: Player }) {
  const { t } = useI18n()
  const opts: { label: string; val: number | 'track' | null }[] = [
    { label: t('sleep.off'), val: null },
    ...[15, 30, 45, 60, 90].map((n) => ({ label: t('sleep.min', { n }), val: n })),
    { label: t('sleep.track'), val: 'track' as const }
  ]
  return (
    <Modal open={open} onClose={onClose} title={t('sleep.title')} width={360}>
      <p className="mb-3 text-[12px] text-ph-dim">
        {t('sleep.intro')}
        {p.sleepLeft !== null && <span className="text-cyan">{t('sleep.left', { n: p.sleepLeft })}</span>}
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
  const { t } = useI18n()
  return (
    <Modal open={open} onClose={onClose} title={t('queue.title', { n: p.queue.length })} width={460}>
      <div className="max-h-[60vh] overflow-y-auto">
        {p.queue.length === 0 && <div className="py-6 text-center text-ph-dim">{t('queue.empty')}</div>}
        {p.queue.map((tr, i) => (
          <div
            key={tr.path}
            className={`flex cursor-pointer items-center gap-3 px-2 py-1.5 ${i === p.index ? 'row-active' : 'row-hover'}`}
            onClick={() => {
              p.playAt(i)
              onClose()
            }}
          >
            <PixelCover src={tr.cover} seed={tr.title} res={16} className="h-8 w-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate">{tr.title}</div>
              <div className="truncate text-[11px] text-ph-dim">{tr.artist || t('player.unknownArtist')}</div>
            </div>
            <span className="text-[11px] text-ph-dim">{fmtTime(tr.duration)}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/**
 * In-app fullscreen "screensaver": the chosen wallpaper + pixel rain + big clock + mini player.
 * The whole window goes fullscreen via Electron (not the DOM Fullscreen API), exactly once on
 * open and once on close — re-running this on every render is what made it flicker in and out.
 */
export function WallpaperMode({ open, onClose, p, wallpaper }: { open: boolean; onClose: () => void; p: Player; wallpaper: WallpaperState | null }) {
  const { t, lang } = useI18n()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    window.lounge.window.setFullScreen(true)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    // Esc in fullscreen is handled by the main process; any way of leaving fullscreen closes the mode.
    let entered = false
    const offFs = window.lounge.window.onFullScreen((on) => {
      if (on) entered = true
      else if (entered) closeRef.current()
    })
    return () => {
      window.removeEventListener('keydown', onKey)
      offFs()
      window.lounge.window.setFullScreen(false)
    }
  }, [open])

  const date = new Date().toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  const src = wallpaper?.source ?? wallpaper?.desktop ?? null
  const url = src ? window.lounge.mediaUrl(src.path) : null
  const style = { filter: `brightness(${(wallpaper?.effects.brightness ?? 100) / 100})`, objectFit: wallpaper?.fit ?? 'cover' } as const
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[180] flex flex-col justify-between overflow-hidden bg-crt-bg p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {url && src?.kind === 'video' && <video src={url} className="absolute inset-0 h-full w-full" style={style} autoPlay loop muted />}
          {url && src?.kind === 'image' && <img src={url} className="absolute inset-0 h-full w-full" style={style} />}
          {!url && <PixelCover src={p.current?.cover ?? null} seed={p.current?.title ?? 'chill'} res={48} className="absolute inset-0 h-full w-full object-cover opacity-50" />}
          <VfxCanvas layers={wallpaper && hasVfx(wallpaper.effects) ? wallpaper.effects : { ...NO_VFX, rain: 40 }} reactive={wallpaper?.effects.reactive} className="absolute inset-0 h-full w-full" />
          {(wallpaper?.effects.scanlines ?? true) && <div className="scanlines absolute inset-0" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/65" />

          <div className="relative flex justify-between">
            <span className="badge live bg-crt-bg/70">
              <span className="led animate-blink" /> {t('saver.badge')}
            </span>
            <button className="tbtn bg-crt-bg/70" onClick={onClose}>
              {t('saver.exit')}
            </button>
          </div>

          <div className="relative text-center">
            <div className="font-pixel text-[min(18vw,170px)] leading-none text-ph-bright rgb-split">
              <Clock />
            </div>
            <div className="mt-2 text-[18px] text-ph capitalize">{date}</div>
          </div>

          <div className="relative mx-auto flex w-full max-w-[620px] items-center gap-4 border border-crt-line-strong bg-crt-bg/80 p-3">
            <PixelCover src={p.current?.cover ?? null} seed={p.current?.title ?? 'chill'} res={24} className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-ph-bright">{p.current?.title ?? t('player.noTrack')}</div>
              <div className="truncate text-[11px] text-ph-dim">{p.current?.artist ?? ''}</div>
            </div>
            <button className="tbtn sm" onClick={p.prev} aria-label={t('player.prev')}>
              |◀◀
            </button>
            <button className="tbtn primary" onClick={p.toggle}>
              {p.playing ? '❚❚' : '▶'}
            </button>
            <button className="tbtn sm" onClick={p.next} aria-label={t('player.next')}>
              ▶▶|
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const BOOT_LINES = [
  `CHILL_LOUNGE BIOS v${__APP_VERSION__} (c) 2026`,
  'Phosphor display ............ OK',
  'Audio engine (Web Audio) ..... OK',
  'Desktop compositor hook ...... OK',
  'YouTube bridge (yt-dlp) ...... OK',
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

/** The media chosen in the Wallpaper tab, shown faintly behind the whole app. */
export function AppBackdrop({ wallpaper }: { wallpaper: WallpaperState | null }) {
  const src = wallpaper?.source
  if (!src) return null
  const url = window.lounge.mediaUrl(src.path)
  const style = { filter: `brightness(${(wallpaper!.effects.brightness ?? 100) / 100}) saturate(0.9)`, objectFit: wallpaper!.fit } as const
  return (
    <div className="pointer-events-none fixed inset-0 z-0 opacity-30" aria-hidden>
      {src.kind === 'video' ? <video key={url} src={url} className="h-full w-full" style={style} autoPlay loop muted /> : <img src={url} className="h-full w-full" style={style} />}
      <VfxCanvas layers={wallpaper!.effects} reactive={wallpaper!.effects.reactive} className="absolute inset-0 h-full w-full" />
    </div>
  )
}

/**
 * Fullscreen video ("cinema"): the playing video fills the screen with an auto-hiding control bar.
 * Like the wallpaper mode, the window goes fullscreen via Electron once on open / close, and any
 * way of leaving fullscreen (Esc is handled in the main process) closes it.
 */
export function CinemaMode({ open, onClose, p }: { open: boolean; onClose: () => void; p: Player }) {
  const { t } = useI18n()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const [barVisible, setBarVisible] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const poke = (): void => {
    setBarVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setBarVisible(false), 2500)
  }

  useEffect(() => {
    if (!open) return
    p.showVideo()
    window.lounge.window.setFullScreen(true)
    poke()
    let entered = false
    const offFs = window.lounge.window.onFullScreen((on) => {
      if (on) entered = true
      else if (entered) closeRef.current()
    })
    return () => {
      offFs()
      if (hideTimer.current) clearTimeout(hideTimer.current)
      window.lounge.window.setFullScreen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const cur = p.current
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 z-[180] bg-black ${barVisible ? '' : 'cursor-none'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseMove={poke}
          onDoubleClick={onClose}
        >
          <VideoViewer track={cur} show quality={p.videoQuality} className="absolute inset-0" />
          {!cur && <div className="absolute inset-0 flex items-center justify-center font-pixel text-[40px] text-ph-faint">NO SIGNAL</div>}

          <motion.div className="absolute inset-x-0 top-0 flex justify-between p-5" animate={{ opacity: barVisible ? 1 : 0 }}>
            <span className="badge live bg-crt-bg/70">
              <span className="led animate-blink" /> {t('cinema.badge')}
            </span>
            <button className="tbtn bg-crt-bg/70" onClick={onClose}>
              {t('saver.exit')}
            </button>
          </motion.div>

          <motion.div
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-8 pt-16 pb-6"
            animate={{ opacity: barVisible ? 1 : 0, y: barVisible ? 0 : 20 }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-end justify-between gap-6">
              <div className="min-w-0">
                <div className="truncate font-pixel text-[34px] leading-none text-ph-bright rgb-split">{cur?.title ?? '—'}</div>
                <div className="truncate text-[12px] text-ph-dim">{cur?.artist}</div>
              </div>
              {cur?.source === 'youtube' && (
                <div className="flex shrink-0 items-center gap-1">
                  <span className="mr-1 text-[11px] text-ph-dim">{t('yt.quality')}</span>
                  {([360, 480, 720] as const).map((q) => (
                    <button key={q} className={`tab ${p.videoQuality === q ? 'active' : ''}`} onClick={() => p.setVideoQuality(q)}>
                      {q}p
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button className="tbtn" onClick={p.prev} aria-label={t('player.prev')}>
                |◀◀
              </button>
              <button className="tbtn primary w-[120px] justify-center" onClick={p.toggle}>
                {p.playing ? t('player.pause') : t('player.play')}
              </button>
              <button className="tbtn" onClick={p.next} aria-label={t('player.next')}>
                ▶▶|
              </button>
              <span className="w-12 text-right text-[12px] text-ph-bright">{fmtTime(p.time)}</span>
              <BlockBar className="flex-1" value={p.time} max={p.duration} onSeek={p.seek} />
              <span className="w-12 text-[12px] text-ph-dim">{fmtTime(p.duration)}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
