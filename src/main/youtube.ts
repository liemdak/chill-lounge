import type { TrackInfo } from '../shared/types'
import { MEDIA_SCHEME } from '../shared/types'
import { autoUpdateYtDlp, jsRuntimeArgs, run, ytdlpPath } from './tools'
import { cookieCopy, cookiesPreferred, isSignedIn, preferCookies } from './youtube-auth'

// YouTube support goes through yt-dlp: looking up links / playlists / searches, and resolving
// the audio stream URL that media-protocol.ts then proxies or audio-cache.ts saves (so the audio
// stays CORS-clean and flows through the app's EQ and visualizer like a local file).

const MAX_ENTRIES = 300
const base = (): string[] => ['--no-warnings', '--encoding', 'utf-8', ...jsRuntimeArgs()]

export const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`
export const isYtPath = (p: string): boolean => p.startsWith('yt:')
/** Thumbnail served by media-protocol.ts (CORS-clean, so covers can be drawn on canvas). */
export const thumbUrl = (id: string): string => `${MEDIA_SCHEME}://thumb/${id}`

const ID_RE = /^[A-Za-z0-9_-]{11}$/

/** Accepts watch / youtu.be / shorts / playlist URLs; anything else becomes a search. */
function toTarget(input: string): string {
  const s = input.trim()
  if (ID_RE.test(s)) return watchUrl(s)
  if (/^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(s)) return s
  return `ytsearch12:${s}`
}

// When YouTube answers "Sign in to confirm you're not a bot" it has flagged this IP. Signed in,
// the call is simply retried with the session; signed out, hammering it only extends the flag, so
// stop calling yt-dlp for a while and tell the UI.
const BOT_RE = /confirm you.re not a bot|sign in to confirm/i
const BLOCK_MS = 10 * 60_000
let blockedUntil = 0
let onBlocked: ((until: number) => void) | null = null

export const blockStatus = (): number => (Date.now() < blockedUntil ? blockedUntil : 0)
export function onBlockChange(fn: (until: number) => void): void {
  onBlocked = fn
}
export function clearBlock(): void {
  blockedUntil = 0
  onBlocked?.(0)
}

/** Run yt-dlp signed out first (faster); with the saved session only when YouTube insists. */
async function ytdlp(args: string[]): Promise<string> {
  try {
    if (!cookiesPreferred()) {
      try {
        return await run(ytdlpPath(), [...base(), ...args])
      } catch (err) {
        if (!BOT_RE.test((err as Error).message) || !isSignedIn()) throw err
        preferCookies()
      }
    }
    const cookies = cookieCopy()
    try {
      const out = await run(ytdlpPath(), [...base(), ...cookies.args, ...args])
      cookies.done(true)
      return out
    } catch (err) {
      cookies.done(false)
      throw err
    }
  } catch (err) {
    if (BOT_RE.test((err as Error).message)) {
      blockedUntil = Date.now() + BLOCK_MS
      onBlocked?.(blockedUntil)
    }
    throw err
  }
}

interface YtEntry {
  id?: string
  title?: string
  channel?: string
  uploader?: string
  duration?: number
  _type?: string
  entries?: YtEntry[]
}

export async function lookup(input: string): Promise<TrackInfo[]> {
  autoUpdateYtDlp()
  const json = await ytdlp(['-J', '--flat-playlist', '--playlist-end', String(MAX_ENTRIES), toTarget(input)])
  const info = JSON.parse(json) as YtEntry
  const entries = (info.entries ?? [info]).filter((e): e is YtEntry & { id: string } => !!e.id && ID_RE.test(e.id))
  return entries.map((e) => ({
    path: `yt:${e.id}`,
    title: e.title ?? e.id,
    artist: e.channel ?? e.uploader ?? '',
    album: '',
    duration: e.duration ?? 0,
    format: 'YOUTUBE',
    lossless: false,
    // (a URL, not the image: results show at once, covers fill in as they load)
    cover: thumbUrl(e.id),
    lyrics: [],
    isVideo: false,
    source: 'youtube' as const,
    url: watchUrl(e.id)
  }))
}

// Stream URLs expire after a few hours; cache them until shortly before that.
const streams = new Map<string, { url: string; expires: number }>()
const pending = new Map<string, Promise<string>>()

// m4a first: AAC plays everywhere in Chromium and is light (~1 MB a minute).
const AUDIO_FORMAT = 'bestaudio[ext=m4a]/bestaudio'

function resolve(id: string): Promise<string> {
  const inflight = pending.get(id)
  if (inflight) return inflight
  const job = ytdlp(['-g', '-f', AUDIO_FORMAT, '--no-playlist', watchUrl(id)])
    .then((out) => {
      const url = out.trim().split(/\r?\n/).find((u) => u.startsWith('http'))
      if (!url) throw new Error('no stream url')
      const expire = Number(new URL(url).searchParams.get('expire'))
      streams.set(id, { url, expires: expire ? expire * 1000 - 10 * 60_000 : Date.now() + 3 * 3600_000 })
      return url
    })
    .finally(() => pending.delete(id))
  pending.set(id, job)
  return job
}

/** Warm the cache for a track that is about to play (yt-dlp takes a few seconds per lookup). */
export function prefetch(id: string): void {
  if (blockStatus() || !ID_RE.test(id)) return
  const hit = streams.get(id)
  if (!hit || hit.expires < Date.now()) resolve(id).catch(() => {})
}

/** The audio stream URL of a video; `fresh` forces a new lookup (the cached one failed). */
export async function resolveStream(id: string, fresh = false): Promise<string> {
  const hit = streams.get(id)
  if (!fresh && hit && hit.expires > Date.now()) return hit.url
  if (blockStatus()) throw new Error('youtube-blocked')
  if (fresh) streams.delete(id)
  return resolve(id)
}
