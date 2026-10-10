import { app, net } from 'electron'
import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { once } from 'node:events'
import { Readable } from 'node:stream'
import { resolveStream } from './youtube'

// Audio cache for YouTube tracks: the current track and the next couple in the queue are saved
// as m4a files (~1 MB a minute), so skipping, seeking and the next song start instantly instead
// of waiting on yt-dlp and googlevideo. Least-recently-played files go once the cache passes
// LIMIT, so it never grows past a few hundred MB.

const LIMIT = 300 * 1024 * 1024
const CHUNK = 4 * 1024 * 1024 // googlevideo throttles long responses; read it in pieces
const PARALLEL = 2
// Hour-long mixes (~60 MB) just stream: caching them would push out dozens of songs.
const MAX_FILE = 40 * 1024 * 1024

const dir = (): string => join(app.getPath('userData'), 'audio-cache')
const fileFor = (id: string): string => join(dir(), `${id}.m4a`)

/** The cached file of a video, if it's complete. Marks it as recently used. */
export function cachedAudio(id: string): string | null {
  const file = fileFor(id)
  if (!existsSync(file)) return null
  const now = new Date()
  try {
    utimesSync(file, now, now)
  } catch {
    /* read-only or busy: only the eviction order suffers */
  }
  return file
}

const queue: string[] = []
const running = new Set<string>()
const failed = new Map<string, number>()

async function save(id: string): Promise<void> {
  mkdirSync(dir(), { recursive: true })
  const part = `${fileFor(id)}.part`
  const out = createWriteStream(part)
  try {
    let url = await resolveStream(id)
    let pos = 0
    let total = Infinity
    let retried = false
    while (pos < total) {
      const res = await net.fetch(url, { headers: { Range: `bytes=${pos}-${pos + CHUNK - 1}` }, cache: 'no-store' })
      if (res.status !== 206 || !res.body) {
        if (retried) throw new Error(`upstream ${res.status}`)
        retried = true
        url = await resolveStream(id, true)
        continue
      }
      total = Number(/\/(\d+)$/.exec(res.headers.get('content-range') ?? '')?.[1]) || pos
      if (total > MAX_FILE) {
        void res.body.cancel()
        throw new Error('too long to cache')
      }
      for await (const chunk of Readable.fromWeb(res.body as never) as AsyncIterable<Buffer>) {
        pos += chunk.length
        if (!out.write(chunk)) await once(out, 'drain')
      }
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())))
    renameSync(part, fileFor(id))
    evict()
  } catch (err) {
    out.destroy()
    rmSync(part, { force: true })
    throw err
  }
}

function pump(): void {
  while (running.size < PARALLEL && queue.length) {
    const id = queue.shift()!
    if (running.has(id) || existsSync(fileFor(id))) continue
    running.add(id)
    save(id)
      .catch((err) => {
        // (a long mix is never retried; a failure is, after a while)
        failed.set(id, /too long/.test((err as Error).message) ? Infinity : Date.now())
        console.warn('[cache] could not save', id, (err as Error).message)
      })
      .finally(() => {
        running.delete(id)
        pump()
      })
  }
}

/** Save these videos in the background, in order (the playing one first). */
export function warmCache(ids: string[]): void {
  for (const id of ids) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(id) || existsSync(fileFor(id)) || running.has(id) || queue.includes(id)) continue
    // A video that failed (removed, region-blocked…) isn't retried for a while.
    if (Date.now() - (failed.get(id) ?? 0) < 10 * 60_000) continue
    queue.push(id)
  }
  pump()
}

/** Drop the least recently played files until the cache is well under its limit. */
function evict(): void {
  const files = readdirSync(dir())
    .filter((f) => f.endsWith('.m4a'))
    .map((f) => {
      const s = statSync(join(dir(), f))
      return { path: join(dir(), f), size: s.size, used: s.mtimeMs }
    })
    .sort((a, b) => a.used - b.used)
  let total = files.reduce((n, f) => n + f.size, 0)
  for (const f of files) {
    if (total <= LIMIT * 0.8) break
    try {
      rmSync(f.path)
      total -= f.size
    } catch {
      /* playing right now — skip it */
    }
  }
}

/** Leftovers of downloads cut short by quitting. */
export function cleanCache(): void {
  if (!existsSync(dir())) return
  for (const f of readdirSync(dir())) if (f.endsWith('.part')) rmSync(join(dir(), f), { force: true })
}
