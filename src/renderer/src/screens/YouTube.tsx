import { useEffect, useState } from 'react'
import type { DownloadMode, TrackInfo } from '../../../shared/types'
import { DenoBanner, ToolsGate, useYtAuth, VideoViewer, YouTubeAccount } from '../components/Media'
import { Panel, PixelCover } from '../components/ui'
import { useI18n } from '../i18n'
import { fmtTime, load, save } from '../lib/store'
import type { Player } from '../player/usePlayer'

const cleanError = (e: unknown): string => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '').slice(0, 200)

const download = (tracks: TrackInfo[], mode: DownloadMode): void =>
  void window.lounge.downloads.add(
    tracks.map((t) => ({ videoId: t.path.slice(3), title: t.title })),
    mode
  )

interface Props {
  p: Player
  /** Open the fullscreen video mode. */
  onCinema: () => void
  /** The fullscreen mode is showing the video, so this small viewer stays empty. */
  cinemaOpen: boolean
}

export function YouTubeScreen(props: Props) {
  return <ToolsGate>{(status, refresh) => <YouTubeInner {...props} deno={status.deno} onDeno={refresh} />}</ToolsGate>
}

function YouTubeInner({ p, onCinema, cinemaOpen, deno, onDeno }: Props & { deno: boolean; onDeno: Parameters<typeof DenoBanner>[0]['onInstalled'] }) {
  const { t } = useI18n()
  const [query, setQuery] = useState(() => load('yt', { query: '' }).query)
  const [results, setResults] = useState<TrackInfo[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [blockedUntil, setBlockedUntil] = useState(0)
  const signedIn = useYtAuth()
  const [, tick] = useState(0)
  useEffect(() => {
    window.lounge.youtube.blockStatus().then(setBlockedUntil)
    const off = window.lounge.youtube.onBlocked(setBlockedUntil)
    const id = setInterval(() => tick((n) => n + 1), 30_000)
    return () => {
      off()
      clearInterval(id)
    }
  }, [])
  const blockedMin = blockedUntil > Date.now() ? Math.ceil((blockedUntil - Date.now()) / 60_000) : 0

  const search = async (): Promise<void> => {
    const q = query.trim()
    if (!q) return
    save('yt', { query: q })
    setBusy(true)
    setError(null)
    try {
      setResults(await window.lounge.youtube.lookup(q))
    } catch (e) {
      setError(cleanError(e))
      setResults(null)
    } finally {
      setBusy(false)
    }
  }

  const queue = (tracks: TrackInfo[], playNow = false): void => {
    p.addTracks(tracks, playNow)
    setAdded((s) => new Set([...s, ...tracks.map((x) => x.path)]))
  }

  const cur = p.current
  const hasPicture = !!cur && (cur.source === 'youtube' || cur.isVideo)

  return (
    <div className="grid grid-cols-12 gap-5 p-5 pt-6">
      <div className="col-span-7 flex min-w-0 flex-col gap-5">
        <div>
          <div className="text-[11px] text-ph-dim">
            <span className="text-cyan">&gt;</span> yt --connect
          </div>
          <h2 className="font-pixel text-[38px] leading-none text-ph-bright rgb-split">{t('yt.title')}</h2>
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void search()
          }}
        >
          <div className="relative flex-1">
            <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-cyan">&gt;</span>
            <input className="tinput w-full pl-6" placeholder={t('yt.placeholder')} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          </div>
          <button className="tbtn primary" disabled={busy || !query.trim()}>
            {busy ? t('yt.searching') : t('yt.go')}
          </button>
        </form>

        <Panel
          title={t('yt.results', { n: results?.length ?? 0 })}
          right={
            results && results.length > 1 ? (
              <div className="flex gap-1">
                <button className="tbtn sm" onClick={() => queue(results, true)}>
                  {t('yt.playAll')}
                </button>
                <button className="tbtn sm" onClick={() => queue(results)}>
                  {t('yt.queueAll')}
                </button>
              </div>
            ) : undefined
          }
          className="p-2 pt-4"
        >
          {blockedMin > 0 && (
            <div className="m-2 border border-magenta/50 p-3 text-[12px] leading-relaxed text-magenta">
              {signedIn ? t('yt.blockedSignedIn') : t('yt.blocked', { m: blockedMin })}
              <button className="tbtn sm ml-2" onClick={() => window.lounge.youtube.unblock()}>
                {t('yt.retryNow')}
              </button>
            </div>
          )}
          {error && <div className="p-3 text-[12px] text-magenta">{t('yt.error', { e: error })}</div>}
          {!error && !results && <div className="py-10 text-center text-[12px] text-ph-dim">{busy ? t('yt.searching') : t('yt.empty')}</div>}
          {results?.length === 0 && <div className="py-10 text-center text-[12px] text-ph-dim">{t('yt.noResults')}</div>}
          {results?.map((r) => {
            const playing = cur?.path === r.path
            return (
              <div key={r.path} className={`group flex items-center gap-3 px-2 py-1.5 ${playing ? 'row-active' : 'row-hover'}`}>
                <PixelCover src={r.cover} seed={r.title} res={20} className="h-10 w-10 shrink-0 cursor-pointer" />
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => queue([r], true)} title={t('yt.play')}>
                  <div className="truncate text-[12.5px]">{r.title}</div>
                  <div className="truncate text-[10.5px] text-ph-dim">
                    {r.artist}
                    {r.duration > 0 && ` · ${fmtTime(r.duration)}`}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="tbtn sm" onClick={() => queue([r], true)} title={t('yt.play')}>
                    ▶
                  </button>
                  <button className={`tbtn sm ${added.has(r.path) ? 'on' : ''}`} onClick={() => queue([r])} title={t('yt.queue')}>
                    {added.has(r.path) ? '✓' : '+'}
                  </button>
                  <button className="tbtn sm" onClick={() => download([r], 'audio')} title={t('yt.dlAudio')}>
                    ↓mp3
                  </button>
                  <button className="tbtn sm" onClick={() => download([r], 'video')} title={t('yt.dlVideo')}>
                    ↓mp4
                  </button>
                </div>
              </div>
            )
          })}
        </Panel>
      </div>

      <div className="col-span-5 flex min-w-0 flex-col gap-5">
        <Panel title={t('yt.viewer')} className="p-3 pt-4">
          <div className="relative aspect-video w-full overflow-hidden border border-crt-line bg-black" onDoubleClick={() => hasPicture && onCinema()}>
            {!cinemaOpen && <VideoViewer track={cur} video={p.videoMode} playing={p.playing} className="absolute inset-0" />}
            {!hasPicture && (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[12px] leading-relaxed text-ph-dim">
                {t('yt.viewerHint')}
              </div>
            )}
            {p.buffering && cur?.source === 'youtube' && (
              <span className="badge absolute top-2 left-2 bg-crt-bg/80">
                <span className="led animate-blink" /> {t('now.buffering')}
              </span>
            )}
          </div>
          {cur && (
            <div className="mt-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] text-ph-bright">{cur.title}</div>
                <div className="truncate text-[10.5px] text-ph-dim">{cur.artist || t('player.unknownArtist')}</div>
              </div>
              {cur.source === 'youtube' && !p.noVideo && (
                <button className={`tbtn sm ${p.videoMode ? 'on' : ''}`} onClick={p.toggleVideo} title={t('yt.watchHint')}>
                  {p.videoMode ? t('yt.audioOnly') : t('yt.watch')}
                </button>
              )}
              {hasPicture && (
                <button className="tbtn sm" onClick={onCinema}>
                  {t('yt.fullscreen')}
                </button>
              )}
            </div>
          )}
          {p.noVideo && <p className="mt-2 text-[11px] text-ph-dim">{t('yt.noVideo')}</p>}
          <p className="mt-3 text-[11px] text-ph-faint">{t('yt.note')}</p>
        </Panel>
        <YouTubeAccount compact={!blockedMin} />
        {!deno && <DenoBanner onInstalled={onDeno} />}
      </div>
    </div>
  )
}
