import { net, protocol } from 'electron'
import { createReadStream, statSync } from 'node:fs'
import { extname } from 'node:path'
import { Readable } from 'node:stream'
import { AUDIO_EXT, IMAGE_EXT, MEDIA_SCHEME, VIDEO_EXT } from '../shared/types'
import { resolveStream, type Quality } from './youtube'

// Serves local media files to the renderers as lounge-media://local/<encoded path>.
// Range requests are handled by hand so <video>/<audio> can seek and loop.

const MIME: Record<string, string> = {
  mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', mov: 'video/quicktime',
  mp3: 'audio/mpeg', flac: 'audio/flac', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  aac: 'audio/aac', opus: 'audio/opus',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  bmp: 'image/bmp'
}
const ALLOWED = new Set([...IMAGE_EXT, ...VIDEO_EXT, ...AUDIO_EXT])

export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, bypassCSP: true }
    }
  ])
}

// googlevideo throttles or cuts long open-ended responses, so the player is fed in 4 MB chunks
// (it simply asks for the next range when it needs more, like yt-dlp's own chunked downloads).
const CHUNK = 4 * 1024 * 1024

/**
 * lounge-media://yt/<videoId>?m=audio|video&q=360|480|720[&fresh=1] — proxy a YouTube stream
 * resolved by yt-dlp. Ranges are clamped to CHUNK so seeking is quick; on any upstream failure the
 * stream URL is re-resolved once and the request retried.
 */
async function proxyYouTube(req: Request, url: URL): Promise<Response> {
  const id = url.pathname.slice(1)
  const mode = url.searchParams.get('m') === 'video' ? 'video' : 'audio'
  const q = ([360, 480, 720].includes(Number(url.searchParams.get('q'))) ? Number(url.searchParams.get('q')) : 480) as Quality
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get('range') ?? '')
  const start = m ? Number(m[1]) : 0
  const end = m && m[2] ? Math.min(Number(m[2]), start + CHUNK - 1) : start + CHUNK - 1

  for (const fresh of url.searchParams.has('fresh') ? [true] : [false, true]) {
    try {
      const stream = await resolveStream(id, mode, q, fresh)
      const res = await net.fetch(stream, { headers: { Range: `bytes=${start}-${end}` } })
      if (!res.ok) {
        console.warn(`[yt] upstream ${res.status} for ${id} (${mode})${fresh ? '' : ', re-resolving'}`)
        continue
      }
      const headers: Record<string, string> = { 'Access-Control-Allow-Origin': '*', 'Accept-Ranges': 'bytes' }
      for (const h of ['content-type', 'content-length', 'content-range']) {
        const v = res.headers.get(h)
        if (v) headers[h] = v
      }
      return new Response(res.body, { status: res.status, headers })
    } catch (err) {
      console.warn('[yt] stream failed', id, mode, (err as Error).message)
    }
  }
  return new Response('stream unavailable', { status: 502 })
}

export function handleMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, (req) => {
    const parsed = new URL(req.url)
    if (parsed.host === 'yt') return proxyYouTube(req, parsed)
    const path = decodeURIComponent(parsed.pathname.slice(1))
    const ext = extname(path).slice(1).toLowerCase()
    if (!ALLOWED.has(ext)) return new Response('Unsupported file', { status: 403 })

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
    return new Response(Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream, {
      status: 206,
      headers
    })
  })
}
