import { useEffect, useState, type CSSProperties } from 'react'
import { motion } from 'motion/react'
import type { WallpaperState } from '../../../shared/types'
import { useI18n, type TKey } from '../i18n'
import { fmtTime } from '../lib/store'
import type { Player } from '../player/usePlayer'
import { BarScope } from './scopes'
import { BlockBar, Clock, PixelCover, TRange } from './ui'

export type Screen = 'now' | 'library' | 'youtube' | 'downloads' | 'wallpaper' | 'settings' | 'profile'

export const NAV: { id: Screen; label: TKey; glyph: string; key: string }[] = [
  { id: 'now', label: 'nav.now', glyph: '▶', key: 'F1' },
  { id: 'library', label: 'nav.library', glyph: '≡', key: 'F2' },
  { id: 'youtube', label: 'nav.youtube', glyph: '▣', key: 'F3' },
  { id: 'downloads', label: 'nav.downloads', glyph: '↓', key: 'F4' },
  { id: 'wallpaper', label: 'nav.wallpaper', glyph: '▦', key: 'F5' }
]
export const NAV_BOTTOM: typeof NAV = [
  { id: 'settings', label: 'nav.settings', glyph: '*', key: 'F6' },
  { id: 'profile', label: 'nav.profile', glyph: '@', key: 'F7' }
]

const drag = { WebkitAppRegion: 'drag' } as CSSProperties
const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties

function UpdateBadge() {
  const { t } = useI18n()
  const [u, setU] = useState<{ status: 'downloading' | 'ready'; version?: string } | null>(null)
  useEffect(() => window.lounge.app.onUpdate(setU), [])
  if (!u) return null
  return u.status === 'ready' ? (
    <button className="tbtn sm on" style={noDrag} onClick={window.lounge.app.installUpdate}>
      ↑ {t('update.ready', { v: u.version ?? '' })} · {t('update.install')}
    </button>
  ) : (
    <span className="badge">{t('update.downloading', { v: u.version ?? '' })}</span>
  )
}

export function Header({ wallpaper }: { wallpaper: WallpaperState | null }) {
  const { t, lang, setLang } = useI18n()
  const desk = wallpaper?.desktop
  return (
    <header className="flex h-9 shrink-0 items-center justify-between border-b border-crt-line bg-crt-panel px-3" style={drag}>
      <div className="flex items-center gap-3">
        <span className="font-pixel text-[24px] leading-none text-ph-bright rgb-split">▓ CHILL_LOUNGE</span>
        <span className="text-[10.5px] text-ph-dim">v{__APP_VERSION__} · lo-fi terminal</span>
        <span className="h-3.5 w-2 animate-blink bg-ph" />
      </div>
      <div className="flex items-center gap-3 text-[11px] text-ph-dim">
        <UpdateBadge />
        <span className={`badge ${desk && !wallpaper!.paused ? 'ok' : ''}`}>
          <span className="led" /> {!desk ? t('header.desktopOff') : wallpaper!.paused ? t('header.desktopPaused') : t('header.desktopOn')}
        </span>
        <div className="flex" style={noDrag}>
          {(['vi', 'en'] as const).map((l) => (
            <button key={l} className={`tab !px-1.5 !py-0 ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <span className="font-pixel text-[20px] leading-none text-ph glow">
          <Clock />
        </span>
        <div className="flex" style={noDrag}>
          <button className="tbtn sm ghost" onClick={window.lounge.window.minimize} aria-label={t('win.minimize')}>
            [_]
          </button>
          <button className="tbtn sm ghost" onClick={window.lounge.window.toggleMaximize} aria-label={t('win.maximize')}>
            [□]
          </button>
          <button className="tbtn sm ghost danger" onClick={window.lounge.window.close} aria-label={t('win.hide')}>
            [x]
          </button>
        </div>
      </div>
    </header>
  )
}

export function Sidebar({ screen, onNavigate }: { screen: Screen; onNavigate: (s: Screen) => void }) {
  const { t } = useI18n()
  const item = (n: (typeof NAV)[number]) => {
    const active = screen === n.id
    const plain = active ? { textShadow: 'none' } : undefined
    return (
      <button
        key={n.id}
        onClick={() => onNavigate(n.id)}
        className={`relative flex h-[58px] w-full flex-col items-center justify-center gap-0.5 ${active ? 'text-crt-bg' : 'text-ph-dim hover:text-ph-bright'}`}
        title={`${t(n.label)} (${n.key})`}
      >
        {active && <motion.span layoutId="nav-active" className="absolute inset-x-1.5 inset-y-1 bg-ph shadow-[0_0_16px_color-mix(in_srgb,_var(--color-ph)_55%,_transparent)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
        <span className="relative font-pixel text-[26px] leading-none" style={plain}>
          {n.glyph}
        </span>
        <span className="relative text-[10px] uppercase tracking-wider" style={plain}>
          {t(n.label)}
        </span>
      </button>
    )
  }
  return (
    <nav className="relative z-10 flex w-[78px] shrink-0 flex-col justify-between border-r border-crt-line bg-crt-panel py-2">
      <div>{NAV.map(item)}</div>
      <div>{NAV_BOTTOM.map(item)}</div>
    </nav>
  )
}

export function PlayerBar({ p, onOpenQueue, onOpenWallpaperMode }: { p: Player; onOpenQueue: () => void; onOpenWallpaperMode: () => void }) {
  const { t } = useI18n()
  const tr = p.current
  return (
    <footer className="relative z-10 flex h-[74px] shrink-0 items-center gap-5 border-t border-crt-line-strong bg-crt-panel px-4 shadow-[0_-8px_30px_color-mix(in_srgb,_var(--color-purple)_18%,_transparent)]">
      <div className="flex w-[280px] min-w-0 items-center gap-3">
        <PixelCover src={tr?.cover ?? null} seed={tr?.title ?? 'chill'} res={24} className="h-12 w-12 shrink-0 border border-crt-line" />
        <div className="min-w-0">
          <div className="truncate text-ph-bright">{tr?.title ?? t('player.noTrack')}</div>
          <div className="truncate text-[11px] text-ph-dim">{tr ? tr.artist || t('player.unknownArtist') : t('player.addHint')}</div>
        </div>
        <button className={`tbtn sm ghost ${p.isLiked ? 'text-magenta' : ''}`} onClick={p.toggleLike} aria-label={t('player.like')} disabled={!tr}>
          {p.isLiked ? '♥' : '♡'}
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
        <div className="flex items-center gap-1.5">
          <button className={`tbtn sm ghost ${p.shuffle ? 'text-cyan' : ''}`} onClick={p.toggleShuffle} title={t('player.shuffle')}>
            SHUF
          </button>
          <button className="tbtn sm" onClick={p.prev} aria-label={t('player.prev')}>
            |◀◀
          </button>
          <button className="tbtn primary w-[104px] justify-center" onClick={p.toggle}>
            {p.playing ? t('player.pause') : t('player.play')}
          </button>
          <button className="tbtn sm" onClick={p.next} aria-label={t('player.next')}>
            ▶▶|
          </button>
          <button className={`tbtn sm ghost ${p.repeat !== 'off' ? 'text-cyan' : ''}`} onClick={p.cycleRepeat} title={t('player.repeat')}>
            LOOP:{p.repeat === 'one' ? '1' : p.repeat === 'all' ? 'ALL' : 'OFF'}
          </button>
        </div>
        <div className="flex w-full max-w-[560px] items-center gap-2 text-[11px] text-ph-dim">
          <span className="w-10 text-right">{fmtTime(p.time)}</span>
          <BlockBar className="flex-1" value={p.time} max={p.duration} onSeek={p.seek} />
          <span className="w-10">{fmtTime(p.duration)}</span>
        </div>
      </div>

      <div className="flex w-[300px] items-center justify-end gap-3">
        <BarScope playing={p.playing} bands={12} rows={6} className="h-6 w-14" />
        <button className="tbtn sm ghost" onClick={onOpenWallpaperMode} title={t('player.wpMode')}>
          [ ⛶ ]
        </button>
        <div className="flex items-center gap-2">
          <button className="tbtn sm ghost w-12" onClick={p.toggleMute} title={t('player.mute')}>
            {p.muted ? 'MUTE' : 'VOL'}
          </button>
          <TRange label={t('player.volume')} className="w-24" value={p.muted ? 0 : p.volume} onChange={p.setVolume} />
        </div>
        <button className="tbtn sm ghost" onClick={onOpenQueue} title={t('player.queue')}>
          [≡]
        </button>
      </div>
    </footer>
  )
}
