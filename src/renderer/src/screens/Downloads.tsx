import { useEffect, useState } from 'react'
import type { DownloadJob, DownloadMode, ToolsStatus } from '../../../shared/types'
import { ToolsGate, useYtAuth, YouTubeAccount } from '../components/Media'
import { Panel } from '../components/ui'
import { useI18n, type TKey } from '../i18n'
import { load, save } from '../lib/store'
import type { Player } from '../player/usePlayer'

const cleanError = (e: unknown): string => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '').slice(0, 200)

const BOT_RE = /confirm you.re not a bot|sign in to confirm/i

const YT_LINK = /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i

const STATUS_STYLE: Record<DownloadJob['status'], string> = {
  queued: '',
  downloading: 'live',
  processing: 'live',
  done: 'ok',
  error: 'text-magenta',
  canceled: ''
}

export function useDownloads(): DownloadJob[] {
  const [jobs, setJobs] = useState<DownloadJob[]>([])
  useEffect(() => {
    window.lounge.downloads.list().then(setJobs)
    return window.lounge.downloads.onUpdate(setJobs)
  }, [])
  return jobs
}

export function DownloadsScreen({ p, jobs }: { p: Player; jobs: DownloadJob[] }) {
  return <ToolsGate>{(status) => <DownloadsInner p={p} jobs={jobs} tools={status} />}</ToolsGate>
}

function DownloadsInner({ p, jobs, tools: initialTools }: { p: Player; jobs: DownloadJob[]; tools: ToolsStatus }) {
  const { t } = useI18n()
  const [link, setLink] = useState('')
  const [mode, setModeState] = useState<DownloadMode>(() => load('dl', { mode: 'audio' as DownloadMode }).mode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dir, setDir] = useState('')
  const [tools, setTools] = useState(initialTools)
  const [updating, setUpdating] = useState(false)
  const signedIn = useYtAuth()
  const botBlocked = jobs.some((j) => j.status === 'error' && BOT_RE.test(j.error ?? '')) || BOT_RE.test(error ?? '')

  useEffect(() => {
    window.lounge.downloads.getDir().then(setDir)
  }, [])

  const setMode = (m: DownloadMode): void => {
    setModeState(m)
    save('dl', { mode: m })
  }

  const start = async (): Promise<void> => {
    if (!link.trim()) return
    if (!YT_LINK.test(link.trim())) return setError(t('dl.needLink'))
    setBusy(true)
    setError(null)
    try {
      const found = await window.lounge.youtube.lookup(link.trim())
      await window.lounge.downloads.add(
        found.map((x) => ({ videoId: x.path.slice(3), title: x.title })),
        mode
      )
      setLink('')
    } catch (e) {
      setError(cleanError(e))
    } finally {
      setBusy(false)
    }
  }

  const updateYtdlp = async (): Promise<void> => {
    setUpdating(true)
    try {
      setTools(await window.lounge.tools.updateYtdlp())
    } catch (e) {
      setError(cleanError(e))
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 p-5 pt-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] text-ph-dim">
            <span className="text-cyan">&gt;</span> dl --queue
          </div>
          <h2 className="font-pixel text-[38px] leading-none text-ph-bright rgb-split">{t('dl.title')}</h2>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ph-dim">
          <span className="badge ok">
            <span className="led" /> {t('tools.ready', { v: tools.ytdlpVersion ?? '?' })}
          </span>
          <button className="tbtn sm" disabled={updating} onClick={updateYtdlp}>
            {updating ? t('tools.updating') : t('tools.update')}
          </button>
        </div>
      </div>

      <Panel title={t('dl.title').toLowerCase()} className="flex flex-col gap-3 p-4 pt-5">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void start()
          }}
        >
          <div className="relative flex-1">
            <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-cyan">&gt;</span>
            <input className="tinput w-full pl-6" placeholder={t('dl.placeholder')} value={link} onChange={(e) => setLink(e.target.value)} />
          </div>
          <button className="tbtn primary" disabled={busy || !link.trim()}>
            {busy ? t('dl.lookingUp') : t('dl.start')}
          </button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ph-dim">{t('dl.mode')}</span>
            {(['audio', 'video'] as DownloadMode[]).map((m) => (
              <button key={m} className={`tab ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
                {t(m === 'audio' ? 'dl.audio' : 'dl.video')}
              </button>
            ))}
          </div>
          <div className="flex min-w-0 items-center gap-2 text-[11px]">
            <span className="text-ph-dim">{t('dl.folder')}:</span>
            <span className="max-w-[340px] truncate text-ph-bright" title={dir}>
              {dir}
            </span>
            <button className="tbtn sm" onClick={() => window.lounge.downloads.chooseDir().then(setDir)}>
              {t('dl.change')}
            </button>
            <button className="tbtn sm" onClick={window.lounge.downloads.openDir}>
              {t('dl.open')}
            </button>
          </div>
        </div>
        {error && <div className="text-[12px] text-magenta">{error === t('dl.needLink') ? error : t('yt.error', { e: error })}</div>}
        <div className="text-[11px] text-ph-faint">{t('dl.autoAdd')}</div>
      </Panel>

      {botBlocked && !signedIn && <div className="border border-magenta/50 p-3 text-[12px] text-magenta">{t('dl.botHint')}</div>}
      {(botBlocked || signedIn) && <YouTubeAccount compact />}

      <Panel
        title={t('dl.queue', { n: jobs.length })}
        right={
          jobs.some((j) => ['done', 'error', 'canceled'].includes(j.status)) ? (
            <button className="tbtn sm" onClick={window.lounge.downloads.clearFinished}>
              {t('dl.clear')}
            </button>
          ) : undefined
        }
        className="p-2 pt-4"
      >
        {jobs.length === 0 && <div className="py-10 text-center text-[12px] text-ph-dim">{t('dl.empty')}</div>}
        {[...jobs].reverse().map((j) => (
          <div key={j.id} className="flex items-center gap-3 border-b border-crt-line/40 px-2 py-2 last:border-0">
            <span className="w-12 shrink-0 text-[10.5px] text-ph-dim">{j.mode === 'audio' ? '♪ MP3' : '▣ MP4'}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px]">{j.title}</div>
              {(j.status === 'downloading' || j.status === 'processing') && (
                <div className="mt-1 flex items-center gap-2 text-[10.5px] text-ph-dim">
                  <div className="blockbar h-2.5 flex-1">
                    <div className="fill" style={{ width: `${j.progress}%` }} />
                  </div>
                  <span className="w-28 text-right">
                    {j.progress.toFixed(0)}% {j.speed && `· ${j.speed}`}
                  </span>
                </div>
              )}
              {j.status === 'error' && <div className="truncate text-[10.5px] text-magenta">{j.error}</div>}
              {j.status === 'done' && j.error === 'already-downloaded' && <div className="text-[10.5px] text-ph-dim">{t('dl.already')}</div>}
            </div>
            <span className={`badge shrink-0 ${STATUS_STYLE[j.status]}`}>{t(`dl.status.${j.status}` as TKey)}</span>
            <div className="flex shrink-0 gap-1">
              {(j.status === 'queued' || j.status === 'downloading' || j.status === 'processing') && (
                <button className="tbtn sm danger" onClick={() => window.lounge.downloads.cancel(j.id)}>
                  {t('dl.cancel')}
                </button>
              )}
              {(j.status === 'error' || j.status === 'canceled') && (
                <button className="tbtn sm" onClick={() => window.lounge.downloads.retry(j.id)}>
                  {t('dl.retry')}
                </button>
              )}
              {j.status === 'done' && j.track && (
                <>
                  <button className="tbtn sm" onClick={() => p.addTracks([j.track!], true)}>
                    {t('dl.play')}
                  </button>
                  <button className="tbtn sm" onClick={() => window.lounge.downloads.reveal(j.file!)}>
                    {t('dl.show')}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </Panel>
    </div>
  )
}
