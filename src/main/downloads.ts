import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { DownloadJob, DownloadMode } from '../shared/types'
import { loadSettings } from './settings'
import { readTrackInfo } from './tags'
import { autoUpdateYtDlp, binDir, jsRuntimeArgs, ytdlpPath } from './tools'
import { watchUrl } from './youtube'
import { cookieArgs } from './youtube-auth'

// Download queue on top of yt-dlp + ffmpeg. One job at a time keeps YouTube from rate-limiting
// and the laptop fan quiet. Audio-only → mp3 with tags + cover; video → mp4 up to 1080p.

type Listener = (jobs: DownloadJob[]) => void

const ARGS: Record<DownloadMode, string[]> = {
  audio: ['-x', '--audio-format', 'mp3', '--audio-quality', '0'],
  video: ['-f', 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*[height<=1080]+ba/b', '--merge-output-format', 'mp4']
}

export function downloadDir(): string {
  return loadSettings().downloadDir ?? join(app.getPath('music'), 'Chill Lounge')
}

export class Downloads {
  private jobs: DownloadJob[] = []
  private proc: ChildProcess | null = null
  private listeners = new Set<Listener>()

  list(): DownloadJob[] {
    return this.jobs
  }

  onChange(fn: Listener): void {
    this.listeners.add(fn)
  }

  private emit(): void {
    const snapshot = this.jobs.map((j) => ({ ...j }))
    for (const fn of this.listeners) fn(snapshot)
  }

  private patch(job: DownloadJob, p: Partial<DownloadJob>): void {
    Object.assign(job, p)
    this.emit()
  }

  add(items: { videoId: string; title: string }[], mode: DownloadMode): DownloadJob[] {
    for (const it of items) {
      // Don't queue the same video/mode twice while it's pending or done.
      if (this.jobs.some((j) => j.videoId === it.videoId && j.mode === mode && !['error', 'canceled'].includes(j.status))) continue
      this.jobs.push({
        id: `${it.videoId}-${mode}-${Date.now()}`,
        videoId: it.videoId,
        title: it.title,
        mode,
        status: 'queued',
        progress: 0,
        speed: '',
        eta: '',
        file: null,
        error: null,
        track: null
      })
    }
    this.emit()
    this.pump()
    return this.jobs
  }

  cancel(id: string): void {
    const job = this.jobs.find((j) => j.id === id)
    if (!job) return
    if (job.status === 'downloading' || job.status === 'processing') this.proc?.kill()
    if (job.status !== 'done') this.patch(job, { status: 'canceled' })
  }

  retry(id: string): void {
    const job = this.jobs.find((j) => j.id === id)
    if (!job || !['error', 'canceled'].includes(job.status)) return
    this.patch(job, { status: 'queued', progress: 0, error: null })
    this.pump()
  }

  clearFinished(): void {
    this.jobs = this.jobs.filter((j) => !['done', 'error', 'canceled'].includes(j.status))
    this.emit()
  }

  private pump(): void {
    if (this.proc) return
    const job = this.jobs.find((j) => j.status === 'queued')
    if (!job) return
    autoUpdateYtDlp()
    const dir = downloadDir()
    mkdirSync(dir, { recursive: true })

    const args = [
      '--no-warnings',
      '--encoding', 'utf-8',
      '--no-playlist',
      ...jsRuntimeArgs(),
      ...cookieArgs(),
      '--ffmpeg-location', binDir(),
      '--embed-metadata',
      '--embed-thumbnail',
      '--download-archive', join(dir, `.archive-${job.mode}.txt`),
      '-o', join(dir, '%(title)s [%(id)s].%(ext)s'),
      '--newline',
      // --print (below) implies --quiet, which would hide progress; force it back on.
      '--progress',
      '--progress-template', 'download:PROGRESS|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
      '--print', 'after_move:FILE|%(filepath)s',
      ...ARGS[job.mode],
      watchUrl(job.videoId)
    ]
    this.patch(job, { status: 'downloading' })
    const proc = spawn(ytdlpPath(), args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } })
    this.proc = proc
    let errText = ''
    let partial = ''
    proc.stdout!.setEncoding('utf8')
    proc.stderr!.setEncoding('utf8')
    proc.stdout!.on('data', (d: string) => {
      partial += d
      const lines = partial.split(/\r?\n/)
      partial = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('PROGRESS|')) {
          const [, pct, speed, eta] = line.split('|')
          const progress = parseFloat(pct)
          // At 100% yt-dlp moves on to ffmpeg (mp3 conversion / merging / cover art).
          if (Number.isFinite(progress)) this.patch(job, { progress, speed: speed.trim(), eta: eta.trim(), status: progress >= 100 ? 'processing' : 'downloading' })
        } else if (line.startsWith('FILE|')) {
          job.file = line.slice(5).trim()
        } else if (/^\[(ExtractAudio|Merger|EmbedThumbnail|Metadata|VideoConvertor)\]/.test(line)) {
          if (job.status !== 'processing') this.patch(job, { status: 'processing', progress: 100 })
        }
      }
    })
    proc.stderr!.on('data', (d: string) => (errText += d))
    proc.on('close', async (code) => {
      this.proc = null
      if (job.status === 'canceled') {
        // leave it
      } else if (code === 0 && job.file && existsSync(job.file)) {
        const track = await readTrackInfo(job.file)
        this.patch(job, { status: 'done', progress: 100, track })
      } else if (code === 0) {
        // Already in the download archive: yt-dlp skipped it.
        this.patch(job, { status: 'done', progress: 100, error: 'already-downloaded' })
      } else {
        const msg = errText.trim().split('\n').filter((l) => l.includes('ERROR')).pop() ?? errText.trim().split('\n').pop() ?? `exit ${code}`
        this.patch(job, { status: 'error', error: msg.replace(/^ERROR:\s*/, '').slice(0, 240) })
      }
      this.pump()
    })
  }

  dispose(): void {
    this.proc?.kill()
  }
}
