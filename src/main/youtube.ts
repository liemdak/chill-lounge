import { net } from 'electron'
import type { TrackInfo } from '../shared/types'
import { autoUpdateYtDlp, run, ytdlpPath } from './tools'

// YouTube support goes through yt-dlp: looking up links / playlists / searches, and resolving
// the actual stream URL that media-protocol.ts then proxies (so the audio stays CORS-clean and
// flows through the app's EQ and visualizer like a local file).

const MAX_ENTRIES = 300
const BASE = ['--no-warnings', '--encoding', 'utf-8']

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
  const json = await run(ytdlpPath(), [...BASE, '-J', '--flat-playlist', '--playlist-end', String(MAX_ENTRIES), toTarget(input)])
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
const pending = new Map<string, Promise<string>>()

const FORMATS = {
  // m4a first: AAC plays everywhere in Chromium and is light
  audio: 'bestaudio[ext=m4a]/bestaudio',
  // Video only, for the viewer; the audio keeps playing from the audio stream and the viewer
  // syncs to it. (YouTube dropped the muxed 360p format 18 for many videos.)
  video: 'bv*[height<=720][ext=mp4][vcodec^=avc1]/bv*[height<=720][ext=mp4]/bv*[height<=720]/bv*'
} as const

export type StreamMode = keyof typeof FORMATS

/** Warm the cache for a track that is about to play (yt-dlp takes several seconds per lookup). */
export function prefetch(id: string): void {
  resolveStream(id, 'audio').catch(() => {})
}

export function resolveStream(id: string, mode: StreamMode, fresh = false): Promise<string> {
  const key = `${id}:${mode}`
  const hit = streams.get(key)
  if (!fresh && hit && hit.expires > Date.now()) return Promise.resolve(hit.url)
  const inflight = pending.get(key)
  if (inflight) return inflight

  const job = run(ytdlpPath(), [...BASE, '-g', '-f', FORMATS[mode], '--no-playlist', watchUrl(id)])
    .then((out) => {
      const url = out.trim().split(/\r?\n/)[0]
      if (!url.startsWith('http')) throw new Error('no stream url')
      const expireParam = Number(new URL(url).searchParams.get('expire'))
      const expires = expireParam ? expireParam * 1000 - 10 * 60_000 : Date.now() + 3 * 3600_000
      streams.set(key, { url, expires })
      return url
    })
    .finally(() => pending.delete(key))
  pending.set(key, job)
  return job
}
