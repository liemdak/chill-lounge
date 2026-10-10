import { app, net } from 'electron'
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import type { ToolsProgress, ToolsStatus } from '../shared/types'

// yt-dlp, ffmpeg and Deno are not bundled with the installer (they'd add ~120 MB and yt-dlp must
// stay current anyway). They're fetched from their official GitHub releases the first time the
// user opens YouTube / Downloads and agrees, into %APPDATA%\Chill Lounge\bin.
//
// Deno is the JavaScript runtime yt-dlp uses to solve YouTube's stream challenges. Without it
// extraction is deprecated, slower, and some stream URLs come back unusable.
//
// yt-dlp comes as the "onedir" zip build (an exe next to its _internal folder): it starts in about
// 1 s, where the single-file exe unpacks itself to a temp folder on every run (~3 s, every track).

type Source = { url: string; file: string; unpack: 'none' | 'gz' | 'zip'; dir?: string }

const SOURCES: Record<'yt-dlp' | 'ffmpeg' | 'ffprobe' | 'deno', Source> = {
  'yt-dlp': { url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_win.zip', file: join('yt-dlp', 'yt-dlp.exe'), unpack: 'zip', dir: 'yt-dlp' },
  ffmpeg: { url: 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-win32-x64.gz', file: 'ffmpeg.exe', unpack: 'gz' },
  ffprobe: { url: 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffprobe-win32-x64.gz', file: 'ffprobe.exe', unpack: 'gz' },
  deno: { url: 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip', file: 'deno.exe', unpack: 'zip' }
}

type ToolName = keyof typeof SOURCES

export const binDir = (): string => join(app.getPath('userData'), 'bin')
/** The single-file build older versions installed; still used until the onedir build is in. */
const legacyYtdlp = (): string => join(binDir(), 'yt-dlp.exe')
const onedirYtdlp = (): string => join(binDir(), SOURCES['yt-dlp'].file)
export const ytdlpPath = (): string => (existsSync(onedirYtdlp()) || !existsSync(legacyYtdlp()) ? onedirYtdlp() : legacyYtdlp())
export const ffmpegPath = (): string => join(binDir(), SOURCES.ffmpeg.file)
export const denoPath = (): string => join(binDir(), SOURCES.deno.file)

/** Extra yt-dlp arguments pointing it at Deno, when installed. */
export const jsRuntimeArgs = (): string[] => (existsSync(denoPath()) ? ['--js-runtimes', `deno:${denoPath()}`] : [])

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
  return { ytdlp, ffmpeg, deno: existsSync(denoPath()), ytdlpVersion: ytdlp ? cachedVersion : null }
}

async function download(name: ToolName, onProgress: (p: ToolsProgress) => void): Promise<void> {
  const src = SOURCES[name]
  const target = join(binDir(), src.file)
  const tmp = src.dir ? join(binDir(), `${src.dir}.zip`) : `${target}.${src.unpack === 'zip' ? 'zip' : 'part'}`
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
  if (src.unpack === 'gz') await pipeline(body, createGunzip(), createWriteStream(tmp))
  else await pipeline(body, createWriteStream(tmp))
  if (src.unpack === 'zip') {
    // Windows 10+ ships bsdtar, which reads zip archives. A folder build is unpacked next to the
    // old one and swapped in, so a running copy is never half-replaced.
    const dest = src.dir ? join(binDir(), `${src.dir}.new`) : binDir()
    if (src.dir) rmSync(dest, { recursive: true, force: true })
    mkdirSync(dest, { recursive: true })
    await run(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', tmp, '-C', dest])
    rmSync(tmp, { force: true })
    if (src.dir) {
      rmSync(join(binDir(), src.dir), { recursive: true, force: true })
      renameSync(dest, join(binDir(), src.dir))
    }
  } else {
    rmSync(target, { force: true })
    renameSync(tmp, target)
  }
  onProgress({ name, received: total || received, total: total || received })
}

/** Download whatever is missing. The renderer asks the user before calling this. */
export async function installTools(onProgress: (p: ToolsProgress) => void): Promise<ToolsStatus> {
  mkdirSync(binDir(), { recursive: true })
  for (const name of Object.keys(SOURCES) as ToolName[]) {
    const have = name === 'yt-dlp' ? existsSync(ytdlpPath()) : existsSync(join(binDir(), SOURCES[name].file))
    if (!have) await download(name, onProgress)
  }
  cachedVersion = null
  return toolsStatus()
}

/** Latest yt-dlp release tag, read from where GitHub's "latest" link redirects to. */
async function latestYtdlpTag(): Promise<string | null> {
  const res = await net.fetch('https://github.com/yt-dlp/yt-dlp/releases/latest', { redirect: 'manual' })
  return /\/tag\/([^/?#]+)/.exec(res.headers.get('location') ?? '')?.[1] ?? null
}

/**
 * yt-dlp breaks whenever YouTube changes things. The folder build can't update itself, so fetch
 * the latest release when it's newer (or when only the old single-file build is installed).
 */
export async function updateYtDlp(): Promise<ToolsStatus> {
  if (existsSync(onedirYtdlp())) {
    const [latest, current] = await Promise.all([latestYtdlpTag(), run(onedirYtdlp(), ['--version']).then((v) => v.trim())])
    if (!latest || latest === current) return toolsStatus()
  }
  await download('yt-dlp', () => {})
  // (a running download may still hold the old exe; it goes on a later update then)
  try {
    if (existsSync(onedirYtdlp())) rmSync(legacyYtdlp(), { force: true })
  } catch {
    /* in use */
  }
  cachedVersion = null
  return toolsStatus()
}

let lastAutoUpdate = 0
/**
 * Called before YouTube work, never blocking on failure: moves old installs to the fast build
 * right away, otherwise checks for a newer yt-dlp at most once a day.
 */
export function autoUpdateYtDlp(): void {
  if (!existsSync(ytdlpPath())) return
  if (existsSync(onedirYtdlp()) && existsSync(legacyYtdlp())) {
    try {
      rmSync(legacyYtdlp(), { force: true })
    } catch {
      /* still running from an earlier call */
    }
  }
  const wait = ytdlpPath() === legacyYtdlp() ? 10 * 60_000 : 24 * 3600_000
  if (Date.now() - lastAutoUpdate < wait) return
  lastAutoUpdate = Date.now()
  updateYtDlp().catch((e) => console.warn('[tools] yt-dlp update failed', e.message))
}
