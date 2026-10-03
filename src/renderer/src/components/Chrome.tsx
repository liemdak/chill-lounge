import type { CSSProperties } from 'react'
import { motion } from 'motion/react'
import type { WallpaperState } from '../../../shared/types'
import { fmtTime } from '../lib/store'
import type { Player } from '../player/usePlayer'
import { BarScope } from './scopes'
import { BlockBar, Clock, PixelCover, TRange } from './ui'

export type Screen = 'now' | 'library' | 'youtube' | 'downloads' | 'wallpaper' | 'settings' | 'profile'

export const NAV: { id: Screen; label: string; glyph: string; key: string }[] = [
  { id: 'now', label: 'Phát', glyph: '▶', key: 'F1' },
  { id: 'library', label: 'Thư viện', glyph: '≡', key: 'F2' },
  { id: 'youtube', label: 'YouTube', glyph: '▣', key: 'F3' },
  { id: 'downloads', label: 'Tải về', glyph: '↓', key: 'F4' },
  { id: 'wallpaper', label: 'Hình nền', glyph: '▦', key: 'F5' }
]
export const NAV_BOTTOM: typeof NAV = [
  { id: 'settings', label: 'Cài đặt', glyph: '*', key: 'F6' },
  { id: 'profile', label: 'Hồ sơ', glyph: '@', key: 'F7' }
]

export function Header({ wallpaper }: { wallpaper: WallpaperState | null }) {
  const wpLive = wallpaper?.source && !wallpaper.paused
  return (
    <header className="flex h-9 shrink-0 items-center justify-between border-b border-crt-line bg-crt-panel px-3" style={{ WebkitAppRegion: 'drag' } as CSSProperties}>
      <div className="flex items-center gap-3">
        <span className="font-pixel text-[24px] leading-none text-ph-bright rgb-split">▓ CHILL_LOUNGE</span>
        <span className="text-[10.5px] text-ph-dim">v0.2 · lo-fi terminal</span>
        <span className="h-3.5 w-2 animate-blink bg-ph" />
      </div>
      <div className="flex items-center gap-4 text-[11px] text-ph-dim">
        <span className={`badge ${wpLive ? 'ok' : ''}`}>
          <span className="led" /> WP {wpLive ? 'ONLINE' : wallpaper?.source ? 'PAUSED' : 'OFF'}
        </span>
        <span className="font-pixel text-[20px] leading-none text-ph glow">
          <Clock />
        </span>
        <div className="flex" style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
          <button className="tbtn sm ghost" onClick={window.lounge.window.minimize} aria-label="Thu nhỏ">
            [_]
          </button>
          <button className="tbtn sm ghost" onClick={window.lounge.window.toggleMaximize} aria-label="Phóng to">
            [□]
          </button>
          <button className="tbtn sm ghost danger" onClick={window.lounge.window.close} aria-label="Ẩn xuống khay">
            [x]
          </button>
        </div>
      </div>
    </header>
  )
}

export function Sidebar({ screen, onNavigate }: { screen: Screen; onNavigate: (s: Screen) => void }) {
  const item = (n: (typeof NAV)[number]) => {
    const active = screen === n.id
    return (
      <button
        key={n.id}
        onClick={() => onNavigate(n.id)}
        className={`relative flex h-[58px] w-full flex-col items-center justify-center gap-0.5 ${active ? 'text-crt-bg' : 'text-ph-dim hover:text-ph-bright'}`}
        title={`${n.label} (${n.key})`}
      >
        {active && <motion.span layoutId="nav-active" className="absolute inset-x-1.5 inset-y-1 bg-ph shadow-[0_0_16px_rgba(201,168,255,0.55)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
        <span className="relative font-pixel text-[26px] leading-none" style={active ? { textShadow: 'none' } : undefined}>
          {n.glyph}
        </span>
        <span className="relative text-[10px] uppercase tracking-wider" style={active ? { textShadow: 'none' } : undefined}>
          {n.label}
        </span>
      </button>
    )
  }
  return (
    <nav className="flex w-[78px] shrink-0 flex-col justify-between border-r border-crt-line bg-crt-panel py-2">
      <div>{NAV.map(item)}</div>
      <div>{NAV_BOTTOM.map(item)}</div>
    </nav>
  )
}

export function PlayerBar({ p, onOpenQueue, onOpenWallpaperMode }: { p: Player; onOpenQueue: () => void; onOpenWallpaperMode: () => void }) {
  const t = p.current
  return (
    <footer className="flex h-[74px] shrink-0 items-center gap-5 border-t border-crt-line-strong bg-crt-panel px-4 shadow-[0_-8px_30px_rgba(113,66,207,0.18)]">
      <div className="flex w-[280px] min-w-0 items-center gap-3">
        <PixelCover src={t?.cover ?? null} seed={t?.title ?? 'chill'} res={24} className="h-12 w-12 shrink-0 border border-crt-line" />
        <div className="min-w-0">
          <div className="truncate text-ph-bright">{t?.title ?? '— chưa có bài —'}</div>
          <div className="truncate text-[11px] text-ph-dim">{t?.artist ?? 'thêm nhạc ở tab THƯ VIỆN'}</div>
        </div>
        <button className={`tbtn sm ghost ${p.isLiked ? 'text-magenta' : ''}`} onClick={p.toggleLike} aria-label="Yêu thích" disabled={!t}>
          {p.isLiked ? '♥' : '♡'}
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
        <div className="flex items-center gap-1.5">
          <button className={`tbtn sm ghost ${p.shuffle ? 'text-cyan' : ''}`} onClick={p.toggleShuffle} title="Ngẫu nhiên">
            SHUF
          </button>
          <button className="tbtn sm" onClick={p.prev} aria-label="Bài trước">
            |◀◀
          </button>
          <button className="tbtn primary w-[96px] justify-center" onClick={p.toggle} aria-label={p.playing ? 'Tạm dừng' : 'Phát'}>
            {p.playing ? '❚❚ DỪNG' : '▶ PHÁT'}
          </button>
          <button className="tbtn sm" onClick={p.next} aria-label="Bài tiếp">
            ▶▶|
          </button>
          <button className={`tbtn sm ghost ${p.repeat !== 'off' ? 'text-cyan' : ''}`} onClick={p.cycleRepeat} title="Lặp lại">
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
        <button className="tbtn sm ghost" onClick={onOpenWallpaperMode} title="Chế độ Wallpaper toàn màn hình (F)">
          [ ⛶ ]
        </button>
        <div className="flex items-center gap-2">
          <button className="tbtn sm ghost w-12" onClick={p.toggleMute} title="Tắt tiếng (M)">
            {p.muted ? 'MUTE' : 'VOL'}
          </button>
          <TRange label="Âm lượng" className="w-24" value={p.muted ? 0 : p.volume} onChange={p.setVolume} />
        </div>
        <button className="tbtn sm ghost" onClick={onOpenQueue} title="Hàng chờ">
          [≡]
        </button>
      </div>
    </footer>
  )
}
