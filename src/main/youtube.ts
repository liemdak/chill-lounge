import { net } from 'electron'
import type { TrackInfo } from '../shared/types'
import { autoUpdateYtDlp, jsRuntimeArgs, run, ytdlpPath } from './tools'

// YouTube support goes through yt-dlp: looking up links / playlists / searches, and resolving
// the actual stream URL that media-protocol.ts then proxies (so the audio stays CORS-clean and
// flows through the app's EQ and visualizer like a local file).

const MAX_ENTRIES = 300
const base = (): string[] => ['--no-warnings', '--encoding', 'utf-8', ...jsRuntimeArgs()]

export const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`
export const isYtPath = (p: string): boolean => p.startsWith('yt:')

const ID_RE = /^[A-Za-z0-9_-]{11}$/

/** Accepts watch / youtu.be / shorts / playlist URLs; anything else becomes a search. */
function toTarget(input: string): string {
  const s = input.trim()
  if (ID_RE.test(s)) return watchUrl(s)
  if (/^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(s)) return s
  return `ytsearch12:${s}`
}

async function thumbnail(id: string): Promise<string | null> {
  try {
    const res = await net.fetch(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`)
    if (!res.ok) return null
    return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
  } catch {
    return null
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    })
  )
  return out
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
  const json = await run(ytdlpPath(), [...base(), '-J', '--flat-playlist', '--playlist-end', String(MAX_ENTRIES), toTarget(input)])
  const info = JSON.parse(json) as YtEntry
  const entries = (info.entries ?? [info]).filter((e): e is YtEntry & { id: string } => !!e.id && ID_RE.test(e.id))
  return mapLimit(entries, 6, async (e) => ({
    path: `yt:${e.id}`,
    title: e.title ?? e.id,
    artist: e.channel ?? e.uploader ?? '',
    album: '',
    duration: e.duration ?? 0,
    format: 'YOUTUBE',
    lossless: false,
    cover: await thumbnail(e.id),
    lyrics: [],
    isVideo: true,
    source: 'youtube' as const,
    url: watchUrl(e.id)
  }))
}


// Stream URLs expire after a few hours; cache them until shortly before that.
const streams = new Map<string, { url: string; expires: number }>()
const pending = new Map<string, Promise<void>>()

export type StreamMode = 'audio' | 'video'
export type Quality = 360 | 480 | 720

// Audio: m4a first (AAC plays everywhere in Chromium and is light).
// Video: video-only, for the viewer — the audio keeps playing from the audio stream and the viewer
// syncs to it (YouTube dropped the muxed 360p format 18 for many videos). H.264 first: cheapest to
// decode on laptops.
const AUDIO_FORMAT = 'bestaudio[ext=m4a]/bestaudio'
const videoFormat = (q: Quality): string => `bv*[height<=${q}][ext=mp4][vcodec^=avc1]/bv*[height<=${q}][ext=mp4]/bv*[height<=${q}]/bv*`
const cacheKey = (id: string, mode: StreamMode, q: Quality): string => (mode === 'audio' ? `${id}:audio` : `${id}:video:${q}`)

// When YouTube answers "Sign in to confirm you're not a bot" it has flagged this IP. Hammering it
// only extends the flag, so stop calling yt-dlp for a while and tell the UI.
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

/**
 * One yt-dlp call resolves both the audio and the video stream (same extraction, half the
 * requests), so turning the video view on afterwards is instant.
 */
function resolvePair(id: string, q: Quality): Promise<void> {
  const pk = `${id}:${q}`
  const inflight = pending.get(pk)
  if (inflight) return inflight
  const job = run(ytdlpPath(), [...base(), '-g', '-f', `${AUDIO_FORMAT},${videoFormat(q)}`, '--no-playlist', watchUrl(id)])
    .then((out) => {
      const urls = out.trim().split(/\r?\n/).filter((u) => u.startsWith('http'))
      if (!urls.length) throw new Error('no stream url')
      for (const url of urls) {
        const params = new URL(url).searchParams
        const mode: StreamMode = (params.get('mime') ?? '').startsWith('audio') ? 'audio' : 'video'
        const expire = Number(params.get('expire'))
        streams.set(cacheKey(id, mode, q), { url, expires: expire ? expire * 1000 - 10 * 60_000 : Date.now() + 3 * 3600_000 })
      }
    })
    .catch((err: Error) => {
      if (BOT_RE.test(err.message)) {
        blockedUntil = Date.now() + BLOCK_MS
        onBlocked?.(blockedUntil)
      }
      throw err
    })
    .finally(() => pending.delete(pk))
  pending.set(pk, job)
  return job
}

/** Warm the cache for a track that is about to play (yt-dlp takes several seconds per lookup). */
export function prefetch(id: string, _mode: StreamMode = 'audio', q: Quality = 480): void {
  if (blockStatus()) return
  resolvePair(id, q).catch(() => {})
}

export async function resolveStream(id: string, mode: StreamMode, q: Quality = 480, fresh = false): Promise<string> {
  const key = cacheKey(id, mode, q)
  const hit = streams.get(key)
  if (!fresh && hit && hit.expires > Date.now()) return hit.url
  if (blockStatus()) throw new Error('youtube-blocked')
  if (fresh) streams.delete(key)
  await resolvePair(id, q)
  const got = streams.get(key)
  if (!got) throw new Error('no stream url')
  return got.url
}
