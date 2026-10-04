import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ToolsProgress, ToolsStatus, TrackInfo } from '../../../shared/types'
import { engine } from '../audio/engine'
import { useI18n } from '../i18n'
import { Panel } from './ui'

export type VideoQuality = 360 | 480 | 720

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

// Viewers that currently want the element, newest last. An exit animation can unmount the old
// viewer after the new one mounted, so on release the element goes to whoever is still borrowing.
const borrowers: HTMLDivElement[] = []

/** Local video files: borrow the one media element so picture and sound are the same stream. */
function BorrowedVideo({ className }: { className: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = ref.current
    if (!box) return
    const media = engine.media
    Object.assign(media.style, { width: '100%', height: '100%', objectFit: 'contain', background: '#000' })
    borrowers.push(box)
    box.appendChild(media)
    return () => {
      borrowers.splice(borrowers.indexOf(box), 1)
      const next = borrowers[borrowers.length - 1] ?? host
      if (next && media.parentElement !== next) next.appendChild(media)
    }
  }, [])
  return <div ref={ref} className={className} />
}

/**
 * YouTube: a muted video-only stream that follows the audio element, so toggling the picture
 * never interrupts the music.
 *
 * Sync rules (the old "re-seek whenever drift > 0.35 s" restarted the download every time a slow
 * stream fell behind, so it never caught up):
 * - while the video is still buffering, leave it alone;
 * - small drift: nudge playbackRate ±8 % until it lines up;
 * - big drift (> 1.2 s): jump, slightly ahead of the audio when behind, so it has buffer to play;
 * - stuck for 12 s: fetch a fresh stream URL (up to twice).
 */
function SyncedVideo({ path, quality, className }: { path: string; quality: VideoQuality; className: string }) {
  const { t } = useI18n()
  const ref = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'retrying'>('loading')
  const [src, setSrc] = useState(() => window.lounge.mediaUrl(path, true, quality))
  const retries = useRef(0)

  useEffect(() => {
    retries.current = 0
    setState('loading')
    setSrc(window.lounge.mediaUrl(path, true, quality))
  }, [path, quality])

  useEffect(() => {
    const v = ref.current!
    const m = engine.media
    let stalledSince = 0

    const follow = (): void => {
      if (m.paused !== v.paused) (m.paused ? v.pause() : v.play().catch(() => {}))
      if (v.seeking || m.paused) return
      if (v.readyState < 3) {
        stalledSince ||= performance.now()
        if (performance.now() - stalledSince > 12_000 && retries.current < 2) {
          retries.current++
          stalledSince = 0
          setState('retrying')
          setSrc(window.lounge.mediaUrl(path, true, quality, true))
        }
        return
      }
      stalledSince = 0
      const drift = v.currentTime - m.currentTime
      if (Math.abs(drift) > 1.2) {
        v.playbackRate = 1
        v.currentTime = m.currentTime + (drift < 0 ? 0.6 : 0)
      } else if (Math.abs(drift) > 0.12) v.playbackRate = drift < 0 ? 1.08 : 0.92
      else v.playbackRate = 1
    }
    const onMeta = (): void => {
      v.currentTime = m.currentTime
      follow()
    }
    const onSeeked = (): void => {
      v.currentTime = m.currentTime
    }
    const onPlaying = (): void => setState('ok')
    const onWaiting = (): void => setState((s) => (s === 'retrying' ? s : 'loading'))

    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('playing', onPlaying)
    v.addEventListener('waiting', onWaiting)
    for (const ev of ['play', 'pause']) m.addEventListener(ev, follow)
    m.addEventListener('seeked', onSeeked)
    const id = setInterval(follow, 400)
    return () => {
      clearInterval(id)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('playing', onPlaying)
      v.removeEventListener('waiting', onWaiting)
      for (const ev of ['play', 'pause']) m.removeEventListener(ev, follow)
      m.removeEventListener('seeked', onSeeked)
    }
  }, [src, path, quality])

  return (
    <div className={className}>
      <video ref={ref} src={src} muted playsInline className="h-full w-full bg-black object-contain" />
      {state !== 'ok' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 font-pixel text-[22px] text-ph-dim">
          {state === 'retrying' ? t('yt.retrying') : t('yt.loadingVideo')}
        </div>
      )}
    </div>
  )
}

/** Shows the playing video: YouTube (synced video-only stream) or a local mp4. */
export function VideoViewer({ track, show, quality = 480, className = '' }: { track: TrackInfo | null; show: boolean; quality?: VideoQuality; className?: string }) {
  if (!show || !track) return null
  return track.source === 'youtube' ? (
    <SyncedVideo key={track.path} path={track.path} quality={quality} className={className} />
  ) : (
    <BorrowedVideo className={className} />
  )
}

function useToolsInstall() {
  const [progress, setProgress] = useState<ToolsProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => window.lounge.tools.onProgress(setProgress), [])
  const install = async (): Promise<ToolsStatus | null> => {
    setBusy(true)
    setError(null)
    try {
      return await window.lounge.tools.install()
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
      return null
    } finally {
      setBusy(false)
    }
  }
  const pct = progress && progress.total ? Math.round((progress.received / progress.total) * 100) : 0
  return { progress, busy, error, install, pct }
}

function InstallProgress({ busy, progress, pct, error }: { busy: boolean; progress: ToolsProgress | null; pct: number; error: string | null }) {
  const { t } = useI18n()
  return (
    <>
      {busy && progress && (
        <div className="mb-3 text-[12px] text-ph-dim">
          {t('tools.installing', { name: progress.name, pct })}
          <div className="blockbar mt-1.5">
            <div className="fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {error && <div className="mb-3 text-[12px] text-magenta">{t('tools.failed', { e: error })}</div>}
    </>
  )
}

/** Gate for YouTube / downloads: asks before fetching the tools, shows progress. */
export function ToolsGate({ children }: { children: (status: ToolsStatus, refresh: (s: ToolsStatus) => void) => ReactNode }) {
  const { t } = useI18n()
  const [status, setStatus] = useState<ToolsStatus | null>(null)
  const inst = useToolsInstall()

  useEffect(() => {
    window.lounge.tools.status().then(setStatus)
  }, [])

  if (!status) return <div className="p-6 text-[12px] text-ph-dim">…</div>
  if (status.ytdlp && status.ffmpeg) return <>{children(status, setStatus)}</>

  return (
    <div className="p-5 pt-6">
      <Panel title={t('tools.title')} className="max-w-[720px] p-5 pt-6">
        <p className="mb-4 text-[13px] leading-relaxed text-ph">{t('tools.body')}</p>
        <InstallProgress {...inst} />
        <button
          className="tbtn primary"
          disabled={inst.busy}
          onClick={async () => {
            const s = await inst.install()
            if (s) setStatus(s)
          }}
        >
          {t('tools.install')}
        </button>
      </Panel>
    </div>
  )
}

/** Offered to people who installed the tools before Deno was part of the set. */
export function DenoBanner({ onInstalled }: { onInstalled: (s: ToolsStatus) => void }) {
  const { t } = useI18n()
  const inst = useToolsInstall()
  return (
    <Panel title={t('deno.title')} className="p-4 pt-5">
      <p className="mb-3 text-[12px] leading-relaxed text-ph">{t('deno.body')}</p>
      <InstallProgress {...inst} />
      <button
        className="tbtn primary sm"
        disabled={inst.busy}
        onClick={async () => {
          const s = await inst.install()
          if (s) onInstalled(s)
        }}
      >
        {t('deno.install')}
      </button>
    </Panel>
  )
}
