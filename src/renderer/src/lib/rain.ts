// Pixel rain: drawn at 1/scale resolution straight into an ImageData buffer and shown with
// image-rendering: pixelated, so every drop is made of chunky pixels. Writing pixels directly
// (instead of one fillRect per pixel) lets us draw thousands of drops cheaply, which matters
// because the same code runs all day on the desktop wallpaper.
//
// Two layers: far drops (short, dim, slow) and near drops (long, bright, fast), plus splashes
// at the bottom and, in a downpour (density ≥ 80), the occasional lightning flash.

export interface RainOptions {
  /** 0..100 */
  density: () => number
  paused?: () => boolean
  scale?: number
}

type Drop = { x: number; y: number; len: number; speed: number; alpha: number; near: boolean }
type Splash = { x: number; y: number; vx: number; vy: number; life: number }

const RAIN = [201, 168, 255] // phosphor lavender
const SPLASH = [61, 245, 255] // cyan

export function startRain(canvas: HTMLCanvasElement, opts: RainOptions): () => void {
  const scale = opts.scale ?? 3
  const ctx = canvas.getContext('2d')!
  let w = 0
  let h = 0
  let img: ImageData | null = null
  let px: Uint32Array | null = null
  let drops: Drop[] = []
  const splashes: Splash[] = []
  let flash = 0
  let nextFlash = performance.now() + 6000
  let raf = 0
  let last = performance.now()

  // Little-endian RGBA packed into one uint32
  const pack = (rgb: number[], a: number): number => ((Math.round(a * 255) << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]) >>> 0

  const spawn = (top: boolean): Drop => {
    const near = Math.random() < 0.3
    return {
      x: Math.random() * (w + h * 0.3),
      y: top ? -Math.random() * h * 0.2 : Math.random() * h,
      len: near ? 6 + Math.floor(Math.random() * 7) : 2 + Math.floor(Math.random() * 4),
      speed: near ? 150 + Math.random() * 70 : 70 + Math.random() * 50,
      alpha: near ? 0.6 + Math.random() * 0.35 : 0.22 + Math.random() * 0.3,
      near
    }
  }

  const plot = (x: number, y: number, color: number): void => {
    x |= 0
    y |= 0
    if (x >= 0 && y >= 0 && x < w && y < h) px![y * w + x] = color
  }

  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now

    const cw = Math.max(1, Math.round(canvas.clientWidth / scale))
    const ch = Math.max(1, Math.round(canvas.clientHeight / scale))
    if (cw !== w || ch !== h) {
      w = canvas.width = cw
      h = canvas.height = ch
      img = ctx.createImageData(w, h)
      px = new Uint32Array(img.data.buffer)
      drops = []
    }
    if (opts.paused?.()) return

    const density = opts.density()
    // Perceptual curve: low settings already read as rain, high settings become a downpour.
    const target = Math.round(Math.pow(density / 100, 0.75) * (w * h) / 26)
    while (drops.length < target) drops.push(spawn(drops.length > 0))
    if (drops.length > target) drops.length = target

    px!.fill(0)
    const wind = 0.28
    for (const d of drops) {
      d.y += d.speed * dt
      d.x -= d.speed * dt * wind
      if (d.y - d.len > h || d.x < -4) {
        if (d.near && d.y > h && splashes.length < 400) {
          for (let k = 0; k < 2; k++) {
            splashes.push({ x: d.x, y: h - 1, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 40, life: 0.35 })
          }
        }
        Object.assign(d, spawn(true))
        continue
      }
      for (let k = 0; k < d.len; k++) {
        // fade toward the tail
        plot(d.x + k * wind, d.y - k, pack(RAIN, d.alpha * (1 - k / (d.len + 1))))
      }
    }

    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i]
      s.life -= dt
      if (s.life <= 0) {
        splashes.splice(i, 1)
        continue
      }
      s.vy += 160 * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      plot(s.x, s.y, pack(SPLASH, Math.min(1, s.life * 2.5)))
    }

    ctx.putImageData(img!, 0, 0)

    // Lightning in a downpour: a brief lavender flash every 8–20 s.
    if (density >= 80 && now > nextFlash) {
      flash = 1
      nextFlash = now + 8000 + Math.random() * 12000
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(230, 218, 254, ${flash * 0.22})`
      ctx.fillRect(0, 0, w, h)
      flash = Math.max(0, flash - dt * 5)
    }
  }
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}
