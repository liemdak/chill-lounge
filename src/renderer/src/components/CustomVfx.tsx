import { useEffect, useRef, type CSSProperties } from 'react'
import type { CustomVfx } from '../../../shared/types'

const MAX_PARTICLES = 140
const isVideo = (file: string): boolean => /\.(webm|mp4)$/i.test(file)

interface P {
  x: number
  y: number
  s: number
  v: number
  phase: number
  rot: number
  vr: number
  a: number
}

/** The user's image as particles on a 2D canvas (capped, paused when hidden). */
function Particles({ fx, beat, paused, style, className }: { fx: CustomVfx; beat: () => number; paused?: boolean; style?: CSSProperties; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  // (read through a ref: callers pass a new beat function every render)
  const live = useRef({ fx, paused, beat })
  live.current = { fx, paused, beat }

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    img.src = window.lounge.mediaUrl(fx.file)
    let w = 0
    let h = 0
    let dpr = 1
    const fit = (): void => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = canvas.clientWidth * dpr
      h = canvas.clientHeight * dpr
      canvas.width = w
      canvas.height = h
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)

    const spawn = (anywhere: boolean): P => {
      const { motion } = live.current.fx
      const p: P = { x: Math.random() * w, y: Math.random() * h, s: 0.6 + Math.random() * 0.6, v: 0.6 + Math.random() * 0.6, phase: Math.random() * 6.28, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.04, a: 0.65 + Math.random() * 0.35 }
      if (!anywhere) {
        const m = live.current.fx.size * dpr
        if (motion === 'fall') p.y = -m
        else if (motion === 'float') p.y = h + m
        else p.x = -m
      }
      return p
    }
    let parts: P[] = []
    let raf = 0
    let t = 0
    const frame = (): void => {
      raf = requestAnimationFrame(frame)
      const { fx: f, paused: stop } = live.current
      if (stop || document.hidden || !img.complete || !img.naturalWidth) return
      const want = f.amount > 0 ? Math.max(1, Math.round((f.amount / 100) * MAX_PARTICLES)) : 0
      while (parts.length < want) parts.push(spawn(true))
      if (parts.length > want) parts.length = want
      t += 1
      const b = live.current.beat()
      const speed = (0.3 + (f.speed / 100) * 2.4) * dpr
      const base = f.size * dpr * (1 + b * 0.35)
      const ratio = img.naturalHeight / img.naturalWidth
      ctx.clearRect(0, 0, w, h)
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]
        const sway = Math.sin(t * 0.02 + p.phase)
        if (f.motion === 'fall') {
          p.y += speed * p.v
          p.x += sway * 0.5 * dpr
        } else if (f.motion === 'float') {
          p.y -= speed * p.v * 0.7
          p.x += sway * 0.6 * dpr
        } else {
          p.x += speed * p.v
          p.y += sway * 0.35 * dpr
        }
        if (f.spin) p.rot += p.vr * (0.5 + f.speed / 100)
        const size = base * p.s
        if (p.y > h + size || p.y < -size * 2 || p.x > w + size || p.x < -size * 2) {
          parts[i] = spawn(false)
          continue
        }
        ctx.save()
        ctx.globalAlpha = Math.min(1, p.a * (0.85 + b * 0.3))
        ctx.translate(p.x, p.y)
        if (f.spin) ctx.rotate(p.rot)
        ctx.drawImage(img, -size / 2, (-size * ratio) / 2, size, size * ratio)
        ctx.restore()
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      parts = []
    }
  }, [fx.file])

  return <canvas ref={ref} className={`pointer-events-none ${className ?? ''}`} style={style} aria-hidden />
}

/**
 * The user's own effect, layered over the wallpaper: particles made from their image, or their
 * animated image / video as an overlay.
 */
export function CustomVfxLayer({ fx, beat, paused, style, className }: { fx: CustomVfx | null | undefined; beat: () => number; paused?: boolean; style?: CSSProperties; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (paused) v.pause()
    else v.play().catch(() => {})
  }, [paused, fx?.file])
  if (!fx) return null
  if (fx.kind === 'particle') return <Particles fx={fx} beat={beat} paused={paused} style={style} className={className} />

  const look: CSSProperties = { ...style, objectFit: 'cover', opacity: fx.opacity / 100, mixBlendMode: fx.blend === 'screen' ? 'screen' : 'normal', pointerEvents: 'none' }
  const src = window.lounge.mediaUrl(fx.file)
  return isVideo(fx.file) ? (
    <video ref={videoRef} key={src} src={src} className={className} style={look} autoPlay loop muted playsInline aria-hidden />
  ) : (
    <img key={src} src={src} className={className} style={look} alt="" aria-hidden />
  )
}
