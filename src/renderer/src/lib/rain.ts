// Pixel rain: drawn on a canvas at 1/scale resolution and shown with image-rendering:
// pixelated, so every drop is made of chunky pixels. Shared by the wallpaper window
// and the in-app previews so the preview matches what lands on the desktop.

export interface RainOptions {
  /** 0..100 */
  density: () => number
  paused?: () => boolean
  scale?: number
}

export function startRain(canvas: HTMLCanvasElement, opts: RainOptions): () => void {
  const scale = opts.scale ?? 3
  const ctx = canvas.getContext('2d')!
  type Drop = { x: number; y: number; len: number; speed: number; alpha: number }
  let drops: Drop[] = []
  let w = 0
  let h = 0
  let raf = 0
  let last = performance.now()

  const spawn = (top = false): Drop => ({
    x: Math.random() * (w + h * 0.25),
    y: top ? -Math.random() * 20 : Math.random() * h,
    len: 2 + Math.floor(Math.random() * 5),
    speed: 50 + Math.random() * 70,
    alpha: 0.25 + Math.random() * 0.55
  })

  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now

    const cw = Math.max(1, Math.round(canvas.clientWidth / scale))
    const ch = Math.max(1, Math.round(canvas.clientHeight / scale))
    if (cw !== w || ch !== h) {
      w = canvas.width = cw
      h = canvas.height = ch
      drops = []
    }
    if (opts.paused?.()) return

    const target = Math.round((opts.density() / 100) * (w * h) / 90)
    while (drops.length < target) drops.push(spawn(drops.length > 0))
    if (drops.length > target) drops.length = target

    ctx.clearRect(0, 0, w, h)
    for (const d of drops) {
      d.y += d.speed * dt
      d.x -= d.speed * dt * 0.25
      if (d.y > h || d.x < -4) Object.assign(d, spawn(true))
      ctx.fillStyle = `rgba(201, 168, 255, ${d.alpha})`
      // a short diagonal of single pixels
      for (let k = 0; k < d.len; k++) ctx.fillRect(Math.round(d.x + k * 0.25), Math.round(d.y - k), 1, 1)
      if (d.y > h - 2) {
        ctx.fillStyle = `rgba(61, 245, 255, ${d.alpha * 0.8})`
        ctx.fillRect(Math.round(d.x) - 1, h - 1, 3, 1)
      }
    }
  }
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}
