import { app, net } from 'electron'
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import type { ToolsProgress, ToolsStatus } from '../shared/types'

// yt-dlp and ffmpeg are not bundled with the installer (they'd add ~50 MB and yt-dlp must stay
// current anyway). They're fetched from their official GitHub releases the first time the user
// opens YouTube / Downloads and agrees, into %APPDATA%\Chill Lounge\bin.

const SOURCES = {
  'yt-dlp': { url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', file: 'yt-dlp.exe', gz: false },
  ffmpeg: { url: 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-win32-x64.gz', file: 'ffmpeg.exe', gz: true },
  ffprobe: { url: 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffprobe-win32-x64.gz', file: 'ffprobe.exe', gz: true }
} as const

type ToolName = keyof typeof SOURCES

export const binDir = (): string => join(app.getPath('userData'), 'bin')
export const ytdlpPath = (): string => join(binDir(), SOURCES['yt-dlp'].file)
export const ffmpegPath = (): string => join(binDir(), SOURCES.ffmpeg.file)

let cachedVersion: string | null = null

/** Run a binary and collect stdout (UTF-8). Rejects with stderr on a non-zero exit. */
export function run(bin: string, args: string[], onLine?: (line: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } })
    let out = ''
    let err = ''
    let partial = ''
    proc.stdout.setEncoding('utf8')
    proc.stderr.setEncoding('utf8')
    proc.stdout.on('data', (d: string) => {
      out += d
      if (!onLine) return
      partial += d
      const lines = partial.split(/\r?\n/)
      partial = lines.pop() ?? ''
      lines.forEach(onLine)
    })
    proc.stderr.on('data', (d: string) => (err += d))
    proc.on('error', reject)
    proc.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err.trim().split('\n').pop() || `exit ${code}`))))
  })
}

let versionJob: Promise<void> | null = null

/** Answers instantly from the file system; the yt-dlp version (a slow call) fills in later. */
export async function toolsStatus(): Promise<ToolsStatus> {
  const ytdlp = existsSync(ytdlpPath())
  const ffmpeg = existsSync(ffmpegPath()) && existsSync(join(binDir(), SOURCES.ffprobe.file))
  if (ytdlp && !cachedVersion && !versionJob) {
    versionJob = run(ytdlpPath(), ['--version'])
      .then((v) => void (cachedVersion = v.trim() || null))
      .catch(() => {})
      .finally(() => (versionJob = null))
  }
  return { ytdlp, ffmpeg, ytdlpVersion: ytdlp ? cachedVersion : null }
}

async function download(name: ToolName, onProgress: (p: ToolsProgress) => void): Promise<void> {
  const src = SOURCES[name]
  const target = join(binDir(), src.file)
  const tmp = `${target}.part`
  const res = await net.fetch(src.url)
  if (!res.ok || !res.body) throw new Error(`${name}: HTTP ${res.status}`)
  const total = Number(res.headers.get('content-length') ?? 0)
  let received = 0
  let lastEmit = 0
  const body = Readable.fromWeb(res.body as never)
  body.on('data', (chunk: Buffer) => {
    received += chunk.length
    const now = Date.now()
    if (now - lastEmit > 150) {
      lastEmit = now
      onProgress({ name, received, total })
    }
  })
  if (src.gz) await pipeline(body, createGunzip(), createWriteStream(tmp))
  else await pipeline(body, createWriteStream(tmp))
  rmSync(target, { force: true })
  renameSync(tmp, target)
  onProgress({ name, received: total || received, total: total || received })
}

/** Download whatever is missing. The renderer asks the user before calling this. */
export async function installTools(onProgress: (p: ToolsProgress) => void): Promise<ToolsStatus> {
  mkdirSync(binDir(), { recursive: true })
  for (const name of Object.keys(SOURCES) as ToolName[]) {
    if (!existsSync(join(binDir(), SOURCES[name].file))) await download(name, onProgress)
  }
  cachedVersion = null
  return toolsStatus()
}

/** yt-dlp breaks whenever YouTube changes things; it can update itself in place. */
export async function updateYtDlp(): Promise<ToolsStatus> {
  await run(ytdlpPath(), ['-U'])
  cachedVersion = null
  return toolsStatus()
}

let lastAutoUpdate = 0
/** Called before YouTube work; self-updates yt-dlp at most once a day, never blocking on failure. */
export function autoUpdateYtDlp(): void {
  if (Date.now() - lastAutoUpdate < 24 * 3600_000 || !existsSync(ytdlpPath())) return
  lastAutoUpdate = Date.now()
  updateYtDlp().catch((e) => console.warn('[tools] yt-dlp -U failed', e.message))
}
