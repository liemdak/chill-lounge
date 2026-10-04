import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ToolsProgress, ToolsStatus, TrackInfo } from '../../../shared/types'
import { engine } from '../audio/engine'
import { useI18n } from '../i18n'
import { Panel } from './ui'

// The one <video> element that plays everything lives in a hidden host so it's always in the
// document — removing a media element from the DOM pauses it. Viewers borrow it and give it back
// in the same task, so moving it never interrupts playback.

let host: HTMLDivElement | null = null

export function MediaHost() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    host = ref.current
    if (host && !engine.media.parentElement) host.appendChild(engine.media)
  }, [])
  return <div ref={ref} aria-hidden className="pointer-events-none fixed top-0 left-0 h-px w-px overflow-hidden opacity-0" />
}

/** Local video files: borrow the one media element so picture and sound are the same stream. */
function BorrowedVideo({ className }: { className: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = ref.current
    if (!box) return
    const media = engine.media
    Object.assign(media.style, { width: '100%', height: '100%', objectFit: 'contain', background: '#000' })
    box.appendChild(media)
    return () => {
      if (host) host.appendChild(media)
    }
  }, [])
  return <div ref={ref} className={className} />
}

/**
 * YouTube: a muted video-only stream that follows the audio element (play / pause / seek, and
 * drift correction), so toggling the picture never interrupts the music.
 */
function SyncedVideo({ path, className }: { path: string; className: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const v = ref.current!
    const m = engine.media
    const follow = (): void => {
      if (Math.abs(v.currentTime - m.currentTime) > 0.35) v.currentTime = m.currentTime
      if (m.paused !== v.paused) (m.paused ? v.pause() : v.play().catch(() => {}))
    }
    const onSeek = (): void => {
      v.currentTime = m.currentTime
    }
    // Show "loading" until frames are actually there (after the initial seek to the audio time).
    v.addEventListener('loadedmetadata', follow)
    for (const ev of ['waiting', 'seeking']) v.addEventListener(ev, () => setLoading(true))
    for (const ev of ['playing', 'seeked']) v.addEventListener(ev, () => setLoading(v.readyState < 3))
    for (const ev of ['play', 'pause', 'ratechange']) m.addEventListener(ev, follow)
    m.addEventListener('seeked', onSeek)
    const id = setInterval(follow, 500)
    return () => {
      clearInterval(id)
      for (const ev of ['play', 'pause', 'ratechange']) m.removeEventListener(ev, follow)
      m.removeEventListener('seeked', onSeek)
      v.removeAttribute('src')
      v.load()
    }
  }, [path])
  return (
    <div className={className}>
      <video ref={ref} src={window.lounge.mediaUrl(path, true)} muted playsInline className="h-full w-full bg-black object-contain" />
      {loading && <div className="absolute inset-0 flex items-center justify-center font-pixel text-[22px] text-ph-dim">LOADING VIDEO…</div>}
    </div>
  )
}

/** Shows the playing video: YouTube (synced video-only stream) or a local mp4. */
export function VideoViewer({ track, show, className = '' }: { track: TrackInfo | null; show: boolean; className?: string }) {
  if (!show || !track) return null
  return track.source === 'youtube' ? <SyncedVideo key={track.path} path={track.path} className={className} /> : <BorrowedVideo className={className} />
}

/** Gate for YouTube / downloads: asks before fetching yt-dlp + ffmpeg, shows progress. */
export function ToolsGate({ children }: { children: (status: ToolsStatus) => ReactNode }) {
  const { t } = useI18n()
  const [status, setStatus] = useState<ToolsStatus | null>(null)
  const [progress, setProgress] = useState<ToolsProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.lounge.tools.status().then(setStatus)
    return window.lounge.tools.onProgress(setProgress)
  }, [])

  if (!status) return null
  if (status.ytdlp && status.ffmpeg) return <>{children(status)}</>

  const install = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      setStatus(await window.lounge.tools.install())
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setBusy(false)
    }
  }
  const pct = progress && progress.total ? Math.round((progress.received / progress.total) * 100) : 0

  return (
    <div className="p-5 pt-6">
      <Panel title={t('tools.title')} className="max-w-[720px] p-5 pt-6">
        <p className="mb-4 text-[13px] leading-relaxed text-ph">{t('tools.body')}</p>
        {busy && progress && (
          <div className="mb-3 text-[12px] text-ph-dim">
            {t('tools.installing', { name: progress.name, pct })}
            <div className="blockbar mt-1.5">
              <div className="fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        {error && <div className="mb-3 text-[12px] text-magenta">{t('tools.failed', { e: error })}</div>}
        <button className="tbtn primary" disabled={busy} onClick={install}>
          {t('tools.install')}
        </button>
      </Panel>
    </div>
  )
}
