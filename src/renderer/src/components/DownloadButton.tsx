import type { DownloadJob, DownloadMode } from '../../../shared/types'
import { useI18n, type TKey } from '../i18n'

const R = 8
const C = 2 * Math.PI * R

/** Circular progress: a ring filling up with the percentage, or spinning while it waits. */
function Ring({ pct, spin }: { pct: number; spin: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width={18} height={18} className={`shrink-0 -rotate-90 ${spin ? 'animate-spin' : ''}`} aria-hidden>
      <circle cx="10" cy="10" r={R} fill="none" stroke="currentColor" strokeOpacity={0.22} strokeWidth={2.5} />
      <circle
        cx="10"
        cy="10"
        r={R}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={spin ? C * 0.72 : C * (1 - pct / 100)}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
    </svg>
  )
}

/**
 * ↓mp3 / ↓mp4 for one search result. Once queued it shows how the download is going: a spinning
 * ring while waiting or converting, the ring filling with the percentage while downloading, ✓ when
 * done (click to show the file), ! on an error (click to retry).
 */
export function DownloadButton({ job, mode, onStart }: { job: DownloadJob | undefined; mode: DownloadMode; onStart: () => void }) {
  const { t } = useI18n()
  const label = mode === 'audio' ? '↓mp3' : '↓mp4'
  const tip = t(mode === 'audio' ? 'yt.dlAudio' : 'yt.dlVideo')

  if (!job || job.status === 'canceled')
    return (
      <button className="tbtn sm" onClick={onStart} title={tip}>
        {label}
      </button>
    )

  const status = t(`dl.status.${job.status}` as TKey)
  if (job.status === 'done')
    return (
      <button className="tbtn sm on" onClick={() => job.file && window.lounge.downloads.reveal(job.file)} title={`${tip} — ${status}`}>
        ✓ {mode === 'audio' ? 'mp3' : 'mp4'}
      </button>
    )
  if (job.status === 'error')
    return (
      <button className="tbtn sm danger text-magenta" onClick={() => window.lounge.downloads.retry(job.id)} title={`${status}: ${job.error ?? ''} — ${t('dl.retry')}`}>
        ! {t('dl.retry')}
      </button>
    )

  const pct = Math.round(job.progress)
  // (yt-dlp spends the first seconds looking the video up: spin until bytes start flowing)
  const spin = job.status === 'queued' || job.status === 'processing' || pct === 0
  return (
    <button
      className="tbtn sm w-[66px] gap-1.5"
      onClick={() => window.lounge.downloads.cancel(job.id)}
      title={`${status}${job.speed ? ` · ${job.speed}` : ''} — ${t('dl.cancel')}`}
      aria-label={`${tip}: ${status} ${pct}%`}
    >
      <Ring pct={pct} spin={spin} />
      <span className="tabular-nums">{job.status === 'processing' ? '⚙' : pct > 0 ? `${pct}%` : '…'}</span>
    </button>
  )
}
