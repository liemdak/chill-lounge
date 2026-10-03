import { useEffect, useRef, useState } from 'react'
import type { WallpaperState } from '../../../shared/types'
import { BarScope, VinylScope } from '../components/scopes'
import { BlockBar, Panel, PixelCover, RainCanvas, TRange, useTypewriter } from '../components/ui'
import { fmtTime } from '../lib/store'
import { EQ_PRESETS, type Player } from '../player/usePlayer'

type Tab = 'queue' | 'lyrics' | 'info'

interface Props {
  p: Player
  wallpaper: WallpaperState | null
  onOpenAmbient: () => void
  onOpenEQ: () => void
  onOpenSleep: () => void
  onOpenWallpaperMode: () => void
  onGoWallpaper: () => void
}

export function NowPlaying({ p, wallpaper, onOpenAmbient, onOpenEQ, onOpenSleep, onOpenWallpaperMode, onGoWallpaper }: Props) {
  const t = p.current
  const title = useTypewriter(t?.title ?? 'NO SIGNAL')
  const [glitch, setGlitch] = useState(false)
  useEffect(() => {
    setGlitch(true)
    const id = setTimeout(() => setGlitch(false), 750)
    return () => clearTimeout(id)
  }, [t?.path])

  const ambientTotal = Object.values(p.soundscape).reduce((a, b) => a + b, 0)
  const eqLabel = p.eq.preset === 'custom' ? 'TÙY CHỈNH' : EQ_PRESETS[p.eq.preset].label.toUpperCase()

  return (
    <div className="grid h-full min-h-[560px] grid-cols-12 gap-5 p-5 pt-6">
      {/* ── Stage ─────────────────────────────────────────── */}
      <div className="col-span-8 flex min-h-0 min-w-0 flex-col gap-5">
        <Panel title="đang phát" className="flex min-h-0 flex-1 flex-col items-center px-6 pt-5 pb-4">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`badge ${p.playing ? 'live' : ''}`}>
                <span className={`led ${p.playing ? 'animate-blink' : ''}`} /> {p.playing ? 'ON AIR' : t ? 'PAUSED' : 'IDLE'}
              </span>
              {t && <span className="badge">{t.format}</span>}
              {t?.lossless && <span className="badge ok">LOSSLESS</span>}
            </div>
            <button className="tbtn sm" onClick={onOpenWallpaperMode} title="Chế độ Wallpaper toàn màn hình (F)">
              [⛶] chế độ wallpaper
            </button>
          </div>

          {/* The vinyl shrinks with the available height so the whole screen fits without scrolling. */}
          <div className="my-2 flex min-h-[150px] w-full flex-1 items-center justify-center">
            <div className="relative aspect-square h-full max-h-[340px]">
              <VinylScope cover={t?.cover ?? null} seed={t?.title ?? 'chill'} playing={p.playing} className="absolute inset-0 h-full w-full" />
              <button className="absolute inset-[30%] cursor-pointer rounded-full" onClick={p.toggle} aria-label={p.playing ? 'Tạm dừng' : 'Phát'} />
            </div>
          </div>

          <BarScope playing={p.playing} bands={40} rows={8} className="h-9 w-full max-w-[460px]" />

          <div className="mt-3 flex w-full items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] text-ph-dim">
                <span className="text-cyan">&gt;</span> now_playing
                <span className="badge">{t?.isVideo ? 'VIDEO' : 'OFFLINE'}</span>
              </div>
              <h1 className={`truncate font-pixel text-[44px] leading-[1.05] text-ph-bright rgb-split ${glitch ? 'glitch' : ''}`}>
                {title}
                <span className="ml-1 inline-block h-[0.8em] w-[0.45em] animate-blink bg-ph align-baseline" />
              </h1>
              <div className="truncate text-[12px] text-ph-dim">
                {t ? [t.artist, t.album].filter(Boolean).join(' · ') : 'Bấm [+ THÊM NHẠC] để nạp file mp3 / flac / mp4 từ máy'}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button className={`tbtn ${p.isLiked ? 'on' : ''}`} onClick={p.toggleLike} disabled={!t}>
                {p.isLiked ? '♥' : '♡'} thích
              </button>
              <button className={`tbtn ${ambientTotal > 0 ? 'on' : ''}`} onClick={onOpenAmbient}>
                ≈ âm nền{p.soundscape.rain > 0 ? ` ${p.soundscape.rain}%` : ''}
              </button>
            </div>
          </div>
        </Panel>

        <Panel title="điều khiển" className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 text-[11px]">
            <span className="w-11 text-ph-bright">{fmtTime(p.time)}</span>
            <BlockBar className="flex-1" value={p.time} max={p.duration} onSeek={p.seek} />
            <span className="w-11 text-right text-ph-dim">{fmtTime(p.duration)}</span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <button className={`tbtn ${p.shuffle ? 'on' : ''}`} onClick={p.toggleShuffle}>
                shuf
              </button>
              <button className={`tbtn ${p.repeat !== 'off' ? 'on' : ''}`} onClick={p.cycleRepeat}>
                loop:{p.repeat === 'one' ? '1' : p.repeat}
              </button>
              <button className={`tbtn ${p.sleep ? 'on' : ''}`} onClick={onOpenSleep}>
                zzz {p.sleep === 'track' ? 'hết bài' : p.sleepLeft ? `${p.sleepLeft}m` : ''}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="tbtn" onClick={p.prev}>
                |◀◀
              </button>
              <button className="tbtn primary lg w-[150px] justify-center" onClick={p.toggle}>
                {p.playing ? '❚❚ TẠM DỪNG' : '▶ PHÁT'}
              </button>
              <button className="tbtn" onClick={p.next}>
                ▶▶|
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="tbtn" onClick={onOpenEQ}>
                eq:{eqLabel}
              </button>
              <span className="text-[11px] text-ph-dim">VOL</span>
              <TRange label="Âm lượng" className="w-20" value={p.muted ? 0 : p.volume} onChange={p.setVolume} />
              <span className="w-9 text-right text-[11px]">{Math.round((p.muted ? 0 : p.volume) * 100)}%</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Right deck ────────────────────────────────────── */}
      <div className="col-span-4 flex min-h-0 min-w-0 flex-col gap-5">
        <SideDeck p={p} />
        <WallpaperCard wallpaper={wallpaper} onGoWallpaper={onGoWallpaper} />
      </div>
    </div>
  )
}

function SideDeck({ p }: { p: Player }) {
  const [tab, setTab] = useState<Tab>('queue')
  const t = p.current
  const activeLyric = useRef<HTMLParagraphElement>(null)
  const synced = !!t?.lyrics.length && t.lyrics[0].time >= 0
  const lyricIndex = synced ? t!.lyrics.findLastIndex((l) => p.time >= l.time) : -1
  useEffect(() => activeLyric.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), [lyricIndex])

  return (
    <Panel title="bộ nhớ đệm" className="flex min-h-0 flex-1 flex-col p-3 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1">
          {(['queue', 'lyrics', 'info'] as Tab[]).map((id) => (
            <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {id === 'queue' ? 'hàng chờ' : id === 'lyrics' ? 'lời' : 'info'}
            </button>
          ))}
        </div>
        <span className="badge">{p.queue.length} bài</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === 'queue' &&
          (p.queue.length === 0 ? (
            <div className="py-10 text-center text-ph-dim">
              <div className="font-pixel text-[28px] text-ph-faint">[ EMPTY ]</div>
              <div className="mt-1 text-[11px]">hàng chờ trống — nạp file để bắt đầu</div>
            </div>
          ) : (
            p.queue.map((q, i) => (
              <div
                key={q.path}
                onClick={() => p.playAt(i)}
                className={`group flex cursor-pointer items-center gap-2.5 px-2 py-1.5 ${i === p.index ? 'row-active' : 'row-hover'}`}
              >
                <span className="w-5 text-right text-[11px] text-ph-dim">{i === p.index && p.playing ? '▶' : String(i + 1).padStart(2, '0')}</span>
                <PixelCover src={q.cover} seed={q.title} res={16} className="h-8 w-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px]">{q.title}</div>
                  <div className="truncate text-[10.5px] text-ph-dim">{q.artist}</div>
                </div>
                <span className="text-[11px] text-ph-dim">{fmtTime(q.duration)}</span>
                <button
                  className="tbtn sm ghost opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    p.remove(i)
                  }}
                  aria-label="Xóa khỏi hàng chờ"
                >
                  ×
                </button>
              </div>
            ))
          ))}

        {tab === 'lyrics' &&
          (t?.lyrics.length ? (
            <div className="space-y-2 py-2">
              {t.lyrics.map((l, i) => (
                <p
                  key={i}
                  ref={i === lyricIndex ? activeLyric : undefined}
                  onClick={() => l.time >= 0 && p.seek(l.time)}
                  className={`text-[13px] leading-relaxed ${i === lyricIndex ? 'glow border-l-2 border-ph pl-2 text-ph-bright' : synced ? 'cursor-pointer text-ph-dim hover:text-ph' : 'text-ph'}`}
                >
                  {l.text || ' '}
                </p>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-[12px] text-ph-dim">
              &gt; không tìm thấy lời trong file
              <br />
              (nhạc không lời hoặc file chưa gắn tag lyrics)
            </div>
          ))}

        {tab === 'info' &&
          (t ? (
            <table className="w-full text-[12px]">
              <tbody>
                {[
                  ['TITLE', t.title],
                  ['ARTIST', t.artist],
                  ['ALBUM', t.album || '—'],
                  ['FORMAT', t.format],
                  ['LOSSLESS', t.lossless ? 'YES' : 'NO'],
                  ['LENGTH', fmtTime(t.duration)],
                  ['PATH', t.path]
                ].map(([k, v]) => (
                  <tr key={k} className="align-top">
                    <td className="w-20 py-1 text-ph-dim">{k}</td>
                    <td className="break-all py-1 text-ph-bright">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-10 text-center text-[12px] text-ph-dim">&gt; chưa có bài nào được chọn</div>
          ))}
      </div>

      <button className="tbtn mt-3 w-full justify-center" onClick={p.addFiles}>
        + thêm nhạc từ máy
      </button>
    </Panel>
  )
}

function WallpaperCard({ wallpaper: wp, onGoWallpaper }: { wallpaper: WallpaperState | null; onGoWallpaper: () => void }) {
  const src = wp?.source
  const url = src ? window.lounge.mediaUrl(src.path) : null
  return (
    <Panel title="wallpaper desktop" className="p-3 pt-4">
      <div className="relative aspect-video w-full overflow-hidden border border-crt-line bg-crt-bg">
        {url && src?.kind === 'video' && <video src={url} className="h-full w-full object-cover" autoPlay loop muted style={{ filter: `brightness(${wp!.effects.brightness / 100})` }} />}
        {url && src?.kind === 'image' && <img src={url} className="h-full w-full object-cover" style={{ filter: `brightness(${wp!.effects.brightness / 100})` }} />}
        {!src && <div className="flex h-full items-center justify-center font-pixel text-[24px] text-ph-faint">NO WALLPAPER</div>}
        {src && <RainCanvas density={wp!.effects.rain} paused={wp!.paused} className="absolute inset-0 h-full w-full" />}
        <div className="scanlines absolute inset-0" />
        <div className="absolute top-1.5 left-1.5">
          <span className={`badge bg-crt-bg/80 ${src && !wp!.paused ? 'ok' : ''}`}>
            <span className="led" /> {!src ? 'OFF' : wp!.paused ? 'TẠM DỪNG' : `LIVE · ${wp!.displays} MÀN HÌNH`}
          </span>
        </div>
      </div>

      {src && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
          <label className="flex flex-col gap-1">
            <span className="flex justify-between text-ph-dim">
              MƯA <span className="text-cyan">{wp!.effects.rain}%</span>
            </span>
            <TRange label="Mật độ mưa" min={0} max={100} step={1} value={wp!.effects.rain} onChange={(v) => window.lounge.wallpaper.setEffects({ rain: v })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="flex justify-between text-ph-dim">
              SÁNG <span className="text-magenta">{wp!.effects.brightness}%</span>
            </span>
            <TRange label="Độ sáng" min={30} max={100} step={1} value={wp!.effects.brightness} onChange={(v) => window.lounge.wallpaper.setEffects({ brightness: v })} />
          </label>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {src && (
          <button className="tbtn sm" onClick={() => window.lounge.wallpaper.togglePause()}>
            {wp!.paused ? '▶ chạy' : '❚❚ dừng'}
          </button>
        )}
        <button className="tbtn sm flex-1 justify-center" onClick={onGoWallpaper}>
          cấu hình hình nền &gt;
        </button>
      </div>
    </Panel>
  )
}
