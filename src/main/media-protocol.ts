import { net, protocol } from 'electron'
import { createReadStream, statSync } from 'node:fs'
import { extname } from 'node:path'
import { Readable } from 'node:stream'
import { AUDIO_EXT, IMAGE_EXT, MEDIA_SCHEME, VIDEO_EXT } from '../shared/types'
import { cachedAudio, warmCache } from './audio-cache'
import { resolveStream } from './youtube'

// lounge-media:// serves the renderers:
//   local/<encoded path>  a local file (Range requests by hand so <video>/<audio> can seek and loop)
//   yt/<videoId>          a YouTube track's audio: from the audio cache, else proxied live
//   thumb/<videoId>       a YouTube thumbnail, CORS-clean so it can be drawn on canvas

const MIME: Record<string, string> = {
  mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', mov: 'video/quicktime',
  mp3: 'audio/mpeg', flac: 'audio/flac', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  aac: 'audio/aac', opus: 'audio/opus',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  bmp: 'image/bmp'
}
const ALLOWED = new Set([...IMAGE_EXT, ...VIDEO_EXT, ...AUDIO_EXT])
const ID_RE = /^[A-Za-z0-9_-]{11}$/

export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, bypassCSP: true }
    }
  ])
}

function serveFile(req: Request, path: string): Response {
  const ext = extname(path).slice(1).toLowerCase()
  let size: number
  try {
    size = statSync(path).size
  } catch {
    return new Response('Not found', { status: 404 })
  }

  const headers: Record<string, string> = {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*'
  }
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') ?? '')
  if (!range) {
    headers['Content-Length'] = String(size)
    return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, { status: 200, headers })
  }

  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
  headers['Content-Range'] = `bytes ${start}-${end}/${size}`
  headers['Content-Length'] = String(end - start + 1)
  return new Response(Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream, { status: 206, headers })
}

// googlevideo throttles or cuts long responses, so it is read in 4 MB chunks (like yt-dlp's own
// chunked downloads). The player still gets one response running to the end of the file: seeking
// breaks if a response stops short of what was asked for.
const CHUNK = 4 * 1024 * 1024
// A googlevideo request that hasn't answered by then is stuck; give up and re-resolve.
const UPSTREAM_TIMEOUT = 15_000

interface Chunk {
  body: ReadableStream<Uint8Array>
  ctl: AbortController
  /** Total file size, from Content-Range. */
  total: number
  type: string | null
}

/** One googlevideo range request; throws on errors so the caller can re-resolve the URL. */
async function fetchChunk(stream: string, from: number, to: number): Promise<Chunk> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), UPSTREAM_TIMEOUT)
  const res = await net
    .fetch(stream, { headers: { Range: `bytes=${from}-${to}` }, cache: 'no-store', signal: ctl.signal })
    .finally(() => clearTimeout(timer))
  if (res.status !== 206 || !res.body) {
    ctl.abort()
    throw new Error(`upstream ${res.status}`)
  }
  const total = Number(/\/(\d+)$/.exec(res.headers.get('content-range') ?? '')?.[1])
  return { body: res.body, ctl, total, type: res.headers.get('content-type') }
}

/**
 * lounge-media://yt/<videoId>[?fresh=1] — a YouTube track's audio. Cached tracks come straight from
 * disk; others are proxied from the stream yt-dlp resolved (and saved to the cache meanwhile). On
 * an upstream failure the stream URL is re-resolved once and the chunk retried. When the player
 * drops the request, the chunk being read is cancelled and no more are fetched.
 */
async function serveYouTube(req: Request, url: URL): Promise<Response> {
  const id = url.pathname.slice(1)
  if (!ID_RE.test(id)) return new Response('Bad id', { status: 400 })
  const cached = cachedAudio(id)
  if (cached) return serveFile(req, cached)
  warmCache([id])

  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get('range') ?? '')
  const start = m ? Number(m[1]) : 0
  const wanted = m && m[2] ? Number(m[2]) : Infinity

  let freshUsed = url.searchParams.has('fresh')
  /** Fetch a chunk, re-resolving the stream URL once if the cached one fails. */
  const chunkAt = async (from: number, to: number): Promise<Chunk> => {
    try {
      return await fetchChunk(await resolveStream(id, freshUsed), from, to)
    } catch (err) {
      const msg = (err as Error).message
      if (freshUsed || msg === 'youtube-blocked') throw err
      console.warn('[yt] chunk failed, re-resolving', id, msg)
      freshUsed = true
      return fetchChunk(await resolveStream(id, true), from, to)
    }
  }

  let first: Chunk
  try {
    first = await chunkAt(start, Math.min(wanted, start + CHUNK - 1))
  } catch (err) {
    console.warn('[yt] stream failed', id, (err as Error).message)
    return new Response('stream unavailable', { status: 502 })
  }
  const last = Math.min(wanted, first.total - 1)

  let current = first
  let reader = current.body.getReader()
  let pos = start
  const body = new ReadableStream<Uint8Array>({
    async pull(c) {
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (!done) {
            pos += value.byteLength
            return c.enqueue(value)
          }
          if (pos > last) return c.close()
          current = await chunkAt(pos, Math.min(last, pos + CHUNK - 1))
          reader = current.body.getReader()
        }
      } catch (err) {
        current.ctl.abort()
        c.error(err)
      }
    },
    cancel() {
      current.ctl.abort()
      reader.cancel().catch(() => {})
    }
  })

  return new Response(body, {
    status: 206,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Accept-Ranges': 'bytes',
      'Content-Type': first.type ?? 'audio/mp4',
      'Content-Length': String(last - start + 1),
      'Content-Range': `bytes ${start}-${last}/${first.total}`
    }
  })
}

/** lounge-media://thumb/<videoId> — YouTube's 320×180 thumbnail. */
async function serveThumb(url: URL): Promise<Response> {
  const id = url.pathname.slice(1)
  if (!ID_RE.test(id)) return new Response('Bad id', { status: 400 })
  try {
    const res = await net.fetch(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`)
    if (!res.ok) return new Response(null, { status: res.status })
    return new Response(res.body, {
      headers: { 'Content-Type': 'image/jpeg', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=604800' }
    })
  } catch {
    return new Response(null, { status: 502 })
  }
}

export function handleMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, (req) => {
    const parsed = new URL(req.url)
    if (parsed.host === 'yt') return serveYouTube(req, parsed)
    if (parsed.host === 'thumb') return serveThumb(parsed)
    const path = decodeURIComponent(parsed.pathname.slice(1))
    if (!ALLOWED.has(extname(path).slice(1).toLowerCase())) return new Response('Unsupported file', { status: 403 })
    return serveFile(req, path)
  })
}
