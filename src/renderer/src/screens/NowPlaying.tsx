import { useEffect, useRef, useState } from 'react'
import type { WallpaperState } from '../../../shared/types'
import { BarScope, VinylScope } from '../components/scopes'
import { EffectsQuick } from '../components/Effects'
import { BlockBar, Panel, PixelCover, TRange, useTypewriter, VfxCanvas } from '../components/ui'
import { useI18n } from '../i18n'
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
  const { t } = useI18n()
  const tr = p.current
  const title = useTypewriter(tr?.title ?? 'NO SIGNAL')
  const [glitch, setGlitch] = useState(false)
  useEffect(() => {
    setGlitch(true)
    const id = setTimeout(() => setGlitch(false), 750)
    return () => clearTimeout(id)
  }, [tr?.path])

  const ambientTotal = Object.values(p.soundscape).reduce((a, b) => a + b, 0)
  const eqLabel = p.eq.preset === 'custom' ? t('eq.custom') : t(EQ_PRESETS[p.eq.preset].label)

  return (
    <div className="grid h-full min-h-[560px] grid-cols-12 gap-5 p-5 pt-6">
      {/* ── Stage ─────────────────────────────────────────── */}
      <div className="col-span-8 flex min-h-0 min-w-0 flex-col gap-5">
        <Panel title={t('now.title')} className="flex min-h-0 flex-1 flex-col items-center px-6 pt-5 pb-4">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`badge ${p.playing ? 'live' : ''}`}>
                <span className={`led ${p.playing ? 'animate-blink' : ''}`} /> {p.playing ? 'ON AIR' : tr ? 'PAUSED' : 'IDLE'}
              </span>
              {tr && <span className="badge">{tr.format}</span>}
              {tr?.lossless && <span className="badge ok">LOSSLESS</span>}
            </div>
            <button className="tbtn sm" onClick={onOpenWallpaperMode} title={t('player.wpMode')}>
              {t('now.wpModeBtn')}
            </button>
          </div>

          {/* The vinyl shrinks with the available height so the whole screen fits without scrolling. */}
          <div className="my-2 flex min-h-[150px] w-full flex-1 items-center justify-center">
            <div className="relative aspect-square h-full max-h-[340px]">
              <VinylScope cover={tr?.cover ?? null} seed={tr?.title ?? 'chill'} playing={p.playing} className="absolute inset-0 h-full w-full" />
              <button className="absolute inset-[30%] cursor-pointer rounded-full" onClick={p.toggle} aria-label={p.playing ? t('player.pause') : t('player.play')} />
            </div>
          </div>

          <BarScope playing={p.playing} bands={40} rows={8} className="h-9 w-full max-w-[460px]" />

          <div className="mt-3 flex w-full items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] text-ph-dim">
                <span className="text-cyan">&gt;</span> now_playing
                <span className="badge">{tr?.isVideo ? 'VIDEO' : 'OFFLINE'}</span>
              </div>
              <h1 className={`truncate font-pixel text-[44px] leading-[1.05] text-ph-bright rgb-split ${glitch ? 'glitch' : ''}`}>
                {title}
                <span className="ml-1 inline-block h-[0.8em] w-[0.45em] animate-blink bg-ph align-baseline" />
              </h1>
              <div className="truncate text-[12px] text-ph-dim">
                {tr ? [tr.artist || t('player.unknownArtist'), tr.album].filter(Boolean).join(' · ') : t('now.emptyHint')}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button className={`tbtn ${p.isLiked ? 'on' : ''}`} onClick={p.toggleLike} disabled={!tr}>
                {p.isLiked ? '♥' : '♡'} {t('now.like')}
              </button>
              <button className={`tbtn ${ambientTotal > 0 ? 'on' : ''}`} onClick={onOpenAmbient}>
                ≈ {t('now.ambient')}
                {p.soundscape.rain > 0 ? ` ${p.soundscape.rain}%` : ''}
              </button>
            </div>
          </div>
        </Panel>

        <Panel title={t('now.controls')} className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 text-[11px]">
            <span className="w-11 text-ph-bright">{fmtTime(p.time)}</span>
            <BlockBar className="flex-1" value={p.time} max={p.duration} onSeek={p.seek} />
            <span className="w-11 text-right text-ph-dim">{fmtTime(p.duration)}</span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <button className={`tbtn ${p.shuffle ? 'on' : ''}`} onClick={p.toggleShuffle} title={t('player.shuffle')}>
                shuf
              </button>
              <button className={`tbtn ${p.repeat !== 'off' ? 'on' : ''}`} onClick={p.cycleRepeat} title={t('player.repeat')}>
                loop:{p.repeat === 'one' ? '1' : p.repeat}
              </button>
              <button className={`tbtn ${p.sleep ? 'on' : ''}`} onClick={onOpenSleep} title={t('sleep.title')}>
                zzz {p.sleep === 'track' ? t('now.sleepTrack') : p.sleepLeft ? `${p.sleepLeft}m` : ''}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="tbtn" onClick={p.prev} aria-label={t('player.prev')}>
                |◀◀
              </button>
              <button className="tbtn primary lg w-[150px] justify-center" onClick={p.toggle}>
                {p.playing ? t('player.pauseLong') : t('player.play')}
              </button>
              <button className="tbtn" onClick={p.next} aria-label={t('player.next')}>
                ▶▶|
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="tbtn" onClick={onOpenEQ}>
                eq:{eqLabel}
              </button>
              <span className="text-[11px] text-ph-dim">VOL</span>
              <TRange label={t('player.volume')} className="w-20" value={p.muted ? 0 : p.volume} onChange={p.setVolume} />
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
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('queue')
  const tr = p.current
  const activeLyric = useRef<HTMLParagraphElement>(null)
  const synced = !!tr?.lyrics.length && tr.lyrics[0].time >= 0
  const lyricIndex = synced ? tr!.lyrics.findLastIndex((l) => p.time >= l.time) : -1
  useEffect(() => activeLyric.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), [lyricIndex])

  const tabLabel = { queue: t('now.tabQueue'), lyrics: t('now.tabLyrics'), info: t('now.tabInfo') }

  return (
    <Panel title={t('now.deck')} className="flex min-h-0 flex-1 flex-col p-3 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1">
          {(['queue', 'lyrics', 'info'] as Tab[]).map((id) => (
            <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {tabLabel[id]}
            </button>
          ))}
        </div>
        <span className="badge">{t('now.tracks', { n: p.queue.length })}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === 'queue' &&
          (p.queue.length === 0 ? (
            <div className="py-10 text-center text-ph-dim">
              <div className="font-pixel text-[28px] text-ph-faint">[ EMPTY ]</div>
              <div className="mt-1 text-[11px]">{t('now.queueEmpty')}</div>
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
                  <div className="truncate text-[10.5px] text-ph-dim">{q.artist || t('player.unknownArtist')}</div>
                </div>
                <span className="text-[11px] text-ph-dim">{fmtTime(q.duration)}</span>
                <button
                  className="tbtn sm ghost opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    p.remove(i)
                  }}
                  aria-label={t('now.removeFromQueue')}
                >
                  ×
                </button>
              </div>
            ))
          ))}

        {tab === 'lyrics' &&
          (tr?.lyrics.length ? (
            <div className="space-y-2 py-2">
              {tr.lyrics.map((l, i) => (
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
              {t('now.noLyrics')}
              <br />
              {t('now.noLyricsHint')}
            </div>
          ))}

        {tab === 'info' &&
          (tr ? (
            <table className="w-full text-[12px]">
              <tbody>
                {[
                  ['TITLE', tr.title],
                  ['ARTIST', tr.artist || '—'],
                  ['ALBUM', tr.album || '—'],
                  ['FORMAT', tr.format],
                  ['LOSSLESS', tr.lossless ? 'YES' : 'NO'],
                  ['LENGTH', fmtTime(tr.duration)],
                  ['PATH', tr.path]
                ].map(([k, v]) => (
                  <tr key={k} className="align-top">
                    <td className="w-20 py-1 text-ph-dim">{k}</td>
                    <td className="break-all py-1 text-ph-bright">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-10 text-center text-[12px] text-ph-dim">{t('now.noTrack')}</div>
          ))}
      </div>

      <button className="tbtn mt-3 w-full justify-center" onClick={p.addFiles}>
        {t('now.addMusic')}
      </button>
    </Panel>
  )
}

function WallpaperCard({ wallpaper: wp, onGoWallpaper }: { wallpaper: WallpaperState | null; onGoWallpaper: () => void }) {
  const { t } = useI18n()
  const src = wp?.source ?? wp?.desktop ?? null
  const url = src ? window.lounge.mediaUrl(src.path) : null
  const filter = { filter: `brightness(${(wp?.effects.brightness ?? 100) / 100})` }
  return (
    <Panel title={t('wpcard.title')} className="p-3 pt-4">
      <div className="relative aspect-video w-full overflow-hidden border border-crt-line bg-crt-bg">
        {url && src?.kind === 'video' && <video src={url} className="h-full w-full object-cover" autoPlay loop muted style={filter} />}
        {url && src?.kind === 'image' && <img src={url} className="h-full w-full object-cover" style={filter} />}
        {!src && <div className="flex h-full items-center justify-center font-pixel text-[24px] text-ph-faint">NO WALLPAPER</div>}
        {wp && <VfxCanvas layers={wp.effects} reactive={wp.effects.reactive} className="absolute inset-0 h-full w-full" />}
        <div className="scanlines absolute inset-0" />
        <div className="absolute top-1.5 left-1.5 flex gap-1.5">
          {!src && <span className="badge bg-crt-bg/80">{t('wpcard.none')}</span>}
          {wp?.source && <span className="badge ok bg-crt-bg/80">{t('wpcard.inApp')}</span>}
          {wp?.desktop && (
            <span className={`badge bg-crt-bg/80 ${wp.paused ? '' : 'live'}`}>
              <span className="led" /> {t('wpcard.onDesktop')}
            </span>
          )}
        </div>
      </div>

      {wp && (
        <div className="mt-3">
          <EffectsQuick fx={wp.effects} />
        </div>
      )}

      <button className="tbtn sm mt-3 w-full justify-center" onClick={onGoWallpaper}>
        {t('wpcard.configure')}
      </button>
    </Panel>
  )
}
