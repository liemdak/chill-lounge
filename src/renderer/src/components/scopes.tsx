import { useEffect, useRef } from 'react'
import { readBands } from '../audio/engine'
import { ditherCover, PALETTE } from '../lib/dither'

const rgb = (i: number, a = 1): string => `rgba(${PALETTE[i].join(',')},${a})`
const reduceMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Spinning pixel-art vinyl with the dithered cover in the middle and a radial spectrum
 * around it. Rendered at RES×RES and scaled up with image-rendering: pixelated.
 */
export function VinylScope({ cover, seed, playing, className = '' }: { cover: string | null; seed: string; playing: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef({ playing })
  live.current.playing = playing

  useEffect(() => {
    const RES = 168
    const c = RES / 2
    const discR = Math.round(RES * 0.33)
    const labelR = Math.round(discR * 0.46)
    const canvas = ref.current!
    canvas.width = canvas.height = RES
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    // Pre-render the disc (grooves + label) once per cover.
    const disc = document.createElement('canvas')
    disc.width = disc.height = discR * 2
    const dctx = disc.getContext('2d')!
    const img = dctx.createImageData(discR * 2, discR * 2)
    for (let y = 0; y < discR * 2; y++) {
      for (let x = 0; x < discR * 2; x++) {
        const dx = x - discR + 0.5
        const dy = y - discR + 0.5
        const dist = Math.hypot(dx, dy)
        if (dist > discR) continue
        const i = (y * discR * 2 + x) * 4
        const groove = Math.floor(dist) % 3 === 0
        // two thin, dithered light reflections across the grooves
        const sheen = Math.abs(Math.sin(Math.atan2(dy, dx) + 0.6)) > 0.985 && dist > labelR + 2 && (x + y) % 2 === 0
        const [r, g, b] = sheen ? PALETTE[2] : groove ? PALETTE[1] : PALETTE[0]
        img.data.set([r, g, b, 255], i)
        if (dist > discR - 1) img.data.set([...PALETTE[2], 255], i)
      }
    }
    dctx.putImageData(img, 0, 0)

    let alive = true
    ditherCover(cover, labelR * 2, seed).then((art) => {
      if (!alive) return
      dctx.save()
      dctx.beginPath()
      dctx.arc(discR, discR, labelR, 0, Math.PI * 2)
      dctx.clip()
      dctx.drawImage(art, discR - labelR, discR - labelR)
      dctx.restore()
      dctx.fillStyle = rgb(0)
      dctx.fillRect(discR - 1, discR - 1, 3, 3)
    })

    const N = 72
    const data = new Uint8Array(256)
    const levels = new Float32Array(N)
    const peaks = new Float32Array(N)
    let angle = 0
    let last = performance.now()
    let raf = 0

    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const on = live.current.playing
      const bands = on ? readBands(data, N / 2) : null

      ctx.clearRect(0, 0, RES, RES)
      const maxLen = RES / 2 - discR - 6
      for (let i = 0; i < N; i++) {
        const half = i < N / 2 ? i : N - 1 - i
        const idle = reduceMotion() ? 0.05 : 0.05 + 0.04 * Math.sin(now / 700 + i * 0.4)
        const target = Math.max(bands ? bands[half] : 0, idle)
        levels[i] += (target - levels[i]) * 0.4
        peaks[i] = Math.max(levels[i], peaks[i] - dt * 0.35)

        const a = (i / N) * Math.PI * 2 - Math.PI / 2
        const cos = Math.cos(a)
        const sin = Math.sin(a)
        const len = Math.round(levels[i] * maxLen)
        for (let s = 0; s < len; s += 2) {
          const t = s / maxLen
          ctx.fillStyle = t > 0.75 ? rgb(4) : t > 0.4 ? rgb(3) : rgb(2, 0.9)
          ctx.fillRect(Math.round(c + cos * (discR + 4 + s)), Math.round(c + sin * (discR + 4 + s)), 1, 1)
        }
        const p = Math.round(peaks[i] * maxLen)
        ctx.fillStyle = 'rgba(61,245,255,0.9)'
        ctx.fillRect(Math.round(c + cos * (discR + 5 + p)), Math.round(c + sin * (discR + 5 + p)), 1, 1)
      }

      if (on && !reduceMotion()) angle += dt * 1.3
      ctx.save()
      ctx.translate(c, c)
      ctx.rotate(Math.round(angle * 24) / 24) // quantized rotation keeps it chunky
      ctx.drawImage(disc, -discR, -discR)
      ctx.restore()
    }
    raf = requestAnimationFrame(frame)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [cover, seed])

  return (
    <canvas
      ref={ref}
      className={`pixelated ${className}`}
      style={{ filter: 'drop-shadow(0 0 10px rgba(157,107,255,0.55))' }}
      aria-hidden
    />
  )
}

/** Segmented LED spectrum bars with falling peak markers. */
export function BarScope({ playing, bands = 32, rows = 12, className = '' }: { playing: boolean; bands?: number; rows?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef({ playing })
  live.current.playing = playing

  useEffect(() => {
    const canvas = ref.current!
    const W = bands * 3 - 1
    const H = rows * 2 - 1
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    const data = new Uint8Array(256)
    const peaks = new Float32Array(bands)
    let raf = 0
    let last = performance.now()
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame)
      const dt = (now - last) / 1000
      last = now
      const vals = live.current.playing ? readBands(data, bands) : new Array(bands).fill(0)
      ctx.clearRect(0, 0, W, H)
      for (let b = 0; b < bands; b++) {
        const lit = Math.round(vals[b] * rows)
        peaks[b] = Math.max(lit, peaks[b] - dt * 10)
        for (let r = 0; r < rows; r++) {
          const y = H - 1 - r * 2
          ctx.fillStyle = r < lit ? (r > rows * 0.75 ? rgb(4) : r > rows * 0.4 ? rgb(3) : rgb(2)) : rgb(1, 0.5)
          ctx.fillRect(b * 3, y, 2, 1)
        }
        if (peaks[b] > 0.5) {
          ctx.fillStyle = 'rgba(255,79,216,0.95)'
          ctx.fillRect(b * 3, H - 1 - Math.round(peaks[b]) * 2, 2, 1)
        }
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [bands, rows])

  return <canvas ref={ref} className={`pixelated ${className}`} aria-hidden />
}
