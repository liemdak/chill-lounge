import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { motion } from 'motion/react'
import type { WallpaperState } from '../../../shared/types'
import { useI18n, type TKey } from '../i18n'
import { fmtTime } from '../lib/store'
import { useSkin } from '../lib/theme'
import type { Player } from '../player/usePlayer'
import { Icon, type IconName } from './icons'
import { BarScope } from './scopes'
import { BlockBar, Clock, PixelCover, TRange } from './ui'

export type Screen = 'now' | 'library' | 'youtube' | 'downloads' | 'wallpaper' | 'settings' | 'profile'

type NavItem = { id: Screen; label: TKey; glyph: string; icon: IconName; key: string }
export const NAV: NavItem[] = [
  { id: 'now', label: 'nav.now', glyph: '▶', icon: 'music', key: 'F1' },
  { id: 'library', label: 'nav.library', glyph: '≡', icon: 'library', key: 'F2' },
  { id: 'youtube', label: 'nav.youtube', glyph: '▣', icon: 'youtube', key: 'F3' },
  { id: 'downloads', label: 'nav.downloads', glyph: '↓', icon: 'download', key: 'F4' },
  { id: 'wallpaper', label: 'nav.wallpaper', glyph: '▦', icon: 'image', key: 'F5' }
]
export const NAV_BOTTOM: NavItem[] = [
  { id: 'settings', label: 'nav.settings', glyph: '*', icon: 'settings', key: 'F6' },
  { id: 'profile', label: 'nav.profile', glyph: '@', icon: 'user', key: 'F7' }
]

const drag = { WebkitAppRegion: 'drag' } as CSSProperties
const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties

/** Text glyph in the retro skin, an icon in the others. */
function Glyph({ retro, text, icon, size = 18 }: { retro: boolean; text: ReactNode; icon: IconName; size?: number }) {
  return retro ? <>{text}</> : <Icon name={icon} size={size} />
}

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

/** Minimise / maximise / hide, drawn the way each skin's OS would. */
function WindowButtons() {
  const { t } = useI18n()
  const skin = useSkin()
  const buttons = [
    { cls: 'min', label: t('win.minimize'), onClick: window.lounge.window.minimize, retro: '[_]', fluent: '', icon: 'minimize' as const },
    { cls: 'max', label: t('win.maximize'), onClick: window.lounge.window.toggleMaximize, retro: '[□]', fluent: '', icon: 'maximize' as const },
    { cls: 'close', label: t('win.hide'), onClick: window.lounge.window.close, retro: '[x]', fluent: '', icon: 'close' as const }
  ]
  return (
    <div className="winbtns flex" style={noDrag}>
      {buttons.map((b) => (
        <button key={b.cls} className={skin === 'retro' ? `tbtn sm ghost ${b.cls === 'close' ? 'danger' : ''}` : `winbtn ${b.cls}`} onClick={b.onClick} aria-label={b.label} title={b.label}>
          {skin === 'retro' ? b.retro : skin === 'win11' ? b.fluent : skin === 'glass' ? null : <Icon name={b.icon} size={skin === 'win98' ? 10 : 13} />}
        </button>
      ))}
    </div>
  )
}

export function Header({ wallpaper }: { wallpaper: WallpaperState | null }) {
  const { t, lang, setLang } = useI18n()
  const skin = useSkin()
  const retro = skin === 'retro'
  const desk = wallpaper?.desktop
  return (
    <header className="app-header flex h-9 shrink-0 items-center justify-between border-b border-crt-line bg-crt-panel px-3" style={drag}>
      <div className="flex items-center gap-3">
        {/* macOS puts the window buttons on the left */}
        {skin === 'glass' && <WindowButtons />}
        {retro ? (
          <>
            <span className="font-pixel text-[24px] leading-none text-ph-bright rgb-split">▓ CHILL_LOUNGE</span>
            <span className="text-[10.5px] text-ph-dim">v{__APP_VERSION__} · lo-fi terminal</span>
            <span className="h-3.5 w-2 animate-blink bg-ph" />
          </>
        ) : (
          <>
            {skin !== 'glass' && <Icon name="music" size={15} className="app-logo" />}
            <span className="app-brand">Chill Lounge</span>
            <span className="text-[10.5px] text-ph-dim">v{__APP_VERSION__}</span>
          </>
        )}
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
        <span className={retro ? 'font-pixel text-[20px] leading-none text-ph glow' : 'app-clock text-[12px] text-ph'}>
          <Clock />
        </span>
        {skin !== 'glass' && <WindowButtons />}
      </div>
    </header>
  )
}

export function Sidebar({ screen, onNavigate }: { screen: Screen; onNavigate: (s: Screen) => void }) {
  const { t } = useI18n()
  const retro = useSkin() === 'retro'
  const item = (n: NavItem) => {
    const active = screen === n.id
    const plain = active ? { textShadow: 'none' } : undefined
    return (
      <button
        key={n.id}
        onClick={() => onNavigate(n.id)}
        className={`nav-item relative flex h-[58px] w-full flex-col items-center justify-center gap-0.5 ${active ? 'active text-crt-bg' : 'text-ph-dim hover:text-ph-bright'}`}
        title={`${t(n.label)} (${n.key})`}
      >
        {active && <motion.span layoutId="nav-active" className="nav-active absolute inset-x-1.5 inset-y-1 bg-ph shadow-[0_0_16px_color-mix(in_srgb,_var(--color-ph)_55%,_transparent)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
        <span className={`relative leading-none ${retro ? 'font-pixel text-[26px]' : ''}`} style={plain}>
          <Glyph retro={retro} text={n.glyph} icon={n.icon} size={20} />
        </span>
        <span className="nav-label relative text-[10px] uppercase tracking-wider" style={plain}>
          {t(n.label)}
        </span>
      </button>
    )
  }
  return (
    <nav className="app-sidebar relative z-10 flex w-[78px] shrink-0 flex-col justify-between border-r border-crt-line bg-crt-panel py-2">
      <div>{NAV.map(item)}</div>
      <div>{NAV_BOTTOM.map(item)}</div>
    </nav>
  )
}

export function PlayerBar({ p, onOpenQueue, onOpenWallpaperMode }: { p: Player; onOpenQueue: () => void; onOpenWallpaperMode: () => void }) {
  const { t } = useI18n()
  const retro = useSkin() === 'retro'
  const tr = p.current
  return (
    <footer className="app-player relative z-10 flex h-[74px] shrink-0 items-center gap-5 border-t border-crt-line-strong bg-crt-panel px-4 shadow-[0_-8px_30px_color-mix(in_srgb,_var(--color-purple)_18%,_transparent)]">
      <div className="flex w-[280px] min-w-0 items-center gap-3">
        <PixelCover src={tr?.cover ?? null} seed={tr?.title ?? 'chill'} res={24} className="h-12 w-12 shrink-0 border border-crt-line" />
        <div className="min-w-0">
          <div className="truncate text-ph-bright">{tr?.title ?? t('player.noTrack')}</div>
          <div className="truncate text-[11px] text-ph-dim">{tr ? tr.artist || t('player.unknownArtist') : t('player.addHint')}</div>
        </div>
        <button className={`tbtn sm ghost ${p.isLiked ? 'text-magenta' : ''}`} onClick={p.toggleLike} aria-label={t('player.like')} disabled={!tr}>
          {retro ? (p.isLiked ? '♥' : '♡') : <Icon name="heart" size={16} filled={p.isLiked} />}
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
        <div className="flex items-center gap-1.5">
          <button className={`tbtn sm ghost ${p.shuffle ? 'text-cyan' : ''}`} onClick={p.toggleShuffle} title={t('player.shuffle')}>
            <Glyph retro={retro} text="SHUF" icon="shuffle" size={16} />
          </button>
          <button className="tbtn sm" onClick={p.prev} aria-label={t('player.prev')}>
            <Glyph retro={retro} text="|◀◀" icon="prev" size={15} />
          </button>
          <button className="tbtn primary play-btn w-[104px] justify-center" onClick={p.toggle} aria-label={p.playing ? t('player.pause') : t('player.play')}>
            {retro ? (p.playing ? t('player.pause') : t('player.play')) : <Icon name={p.playing ? 'pause' : 'play'} size={18} />}
          </button>
          <button className="tbtn sm" onClick={p.next} aria-label={t('player.next')}>
            <Glyph retro={retro} text="▶▶|" icon="next" size={15} />
          </button>
          <button className={`tbtn sm ghost ${p.repeat !== 'off' ? 'text-cyan' : ''}`} onClick={p.cycleRepeat} title={t('player.repeat')}>
            {retro ? (
              <>LOOP:{p.repeat === 'one' ? '1' : p.repeat === 'all' ? 'ALL' : 'OFF'}</>
            ) : (
              <span className="relative">
                <Icon name="repeat" size={16} />
                {p.repeat === 'one' && <span className="absolute -top-1.5 -right-2 text-[9px] font-bold">1</span>}
              </span>
            )}
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
          <Glyph retro={retro} text="[ ⛶ ]" icon="expand" size={16} />
        </button>
        <div className="flex items-center gap-2">
          <button className="tbtn sm ghost w-12 justify-center" onClick={p.toggleMute} title={t('player.mute')}>
            <Glyph retro={retro} text={p.muted ? 'MUTE' : 'VOL'} icon={p.muted ? 'mute' : 'volume'} size={16} />
          </button>
          <TRange label={t('player.volume')} className="w-24" value={p.muted ? 0 : p.volume} onChange={p.setVolume} />
        </div>
        <button className="tbtn sm ghost" onClick={onOpenQueue} title={t('player.queue')}>
          <Glyph retro={retro} text="[≡]" icon="list" size={16} />
        </button>
      </div>
    </footer>
  )
}
