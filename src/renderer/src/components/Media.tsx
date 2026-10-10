import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ToolsProgress, ToolsStatus, TrackInfo } from '../../../shared/types'
import { engine } from '../audio/engine'
import { useI18n } from '../i18n'
import { BarScope } from './scopes'
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

const thumb = (id: string, size: 'maxresdefault' | 'hqdefault'): string => `https://i.ytimg.com/vi/${id}/${size}.jpg`

/**
 * YouTube in audio mode: the video's thumbnail, big, over a blurred copy of itself, with the
 * spectrum underneath. Thumbnails come from YouTube's image servers, which keep working even when
 * playback is blocked.
 */
function ThumbView({ track, playing, className }: { track: TrackInfo; playing: boolean; className: string }) {
  const id = track.path.slice(3)
  const [src, setSrc] = useState(() => thumb(id, 'maxresdefault'))
  useEffect(() => setSrc(thumb(id, 'maxresdefault')), [id])
  // maxresdefault is missing for many older videos (YouTube then serves a 120×90 placeholder).
  const fallback = (img: HTMLImageElement): void => {
    if (img.naturalWidth <= 120 && src.includes('maxres')) setSrc(thumb(id, 'hqdefault'))
  }
  return (
    <div className={`overflow-hidden bg-black ${className}`}>
      <img src={src} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-xl" />
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-contain"
        onLoad={(e) => fallback(e.currentTarget)}
        onError={() => src.includes('maxres') && setSrc(thumb(id, 'hqdefault'))}
      />
      <div className="scanlines pointer-events-none absolute inset-0 opacity-60" />
      <BarScope playing={playing} bands={48} rows={10} className="absolute inset-x-0 bottom-0 h-[18%] w-full opacity-80" />
    </div>
  )
}

/**
 * The playing track's picture: YouTube shows its thumbnail (only the audio is streamed — it starts
 * faster and can be cached); a local video file shows itself. Returns null for local audio.
 */
export function VideoViewer({ track, playing, className = '' }: { track: TrackInfo | null; playing: boolean; className?: string }) {
  if (!track) return null
  if (track.source === 'youtube') return <ThumbView track={track} playing={playing} className={className} />
  return track.isVideo ? <BorrowedVideo className={className} /> : null
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

/** Whether a YouTube session (cookies) is saved, kept in sync with the main process. */
export function useYtAuth(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  useEffect(() => {
    window.lounge.youtube.auth.status().then(setSignedIn)
    return window.lounge.youtube.auth.onChange(setSignedIn)
  }, [])
  return signedIn
}

/**
 * Optional YouTube sign-in. Needed only when YouTube flags the network as a bot — then every
 * signed-out request fails, the official player included.
 */
export function YouTubeAccount({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  const signedIn = useYtAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const act = async (fn: () => Promise<boolean>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message.includes('not-signed-in-cookies') ? t('auth.badCookies') : t('auth.failed'))
    } finally {
      setBusy(false)
    }
  }

  if (signedIn === null) return null
  return (
    <Panel title={t('auth.title')} className="p-4 pt-5">
      {signedIn ? (
        <div className="flex items-center gap-3">
          <span className="badge ok shrink-0">
            <span className="led" /> {t('auth.on')}
          </span>
          <span className="min-w-0 flex-1 text-[11px] text-ph-dim">{t('auth.onHint')}</span>
          <button className="tbtn sm" onClick={() => window.lounge.youtube.auth.signOut()}>
            {t('auth.signOut')}
          </button>
        </div>
      ) : (
        <>
          {!compact && <p className="mb-3 text-[12px] leading-relaxed text-ph">{t('auth.body')}</p>}
          <p className="mb-3 text-[11px] leading-relaxed text-ph-dim">{t('auth.privacy')}</p>
          {error && <div className="mb-3 text-[12px] text-magenta">{error}</div>}
          <div className="flex flex-wrap gap-2">
            <button className="tbtn primary sm" disabled={busy} onClick={() => act(window.lounge.youtube.auth.signIn)}>
              {busy ? t('auth.waiting') : t('auth.signIn')}
            </button>
            <button className="tbtn sm" disabled={busy} onClick={() => act(window.lounge.youtube.auth.importCookies)}>
              {t('auth.import')}
            </button>
          </div>
        </>
      )}
    </Panel>
  )
}
