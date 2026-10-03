// Pixel VFX engine: every layer is drawn at 1/scale resolution straight into one ImageData
// buffer and shown with image-rendering: pixelated. Writing pixels directly (instead of a
// fillRect per pixel) keeps it cheap enough to run all day behind the desktop icons.
//
// Layers (0..100 each, stackable): stars, fog, rain, snow, petals, fireflies, glyphs, vhs.
// An optional `beat` (0..1, bass energy of the playing track) makes everything react to music.

import type { WallpaperEffects } from '../../../shared/types'

export type VfxLayers = Pick<WallpaperEffects, 'rain' | 'snow' | 'fireflies' | 'stars' | 'glyphs' | 'petals' | 'fog' | 'vhs'>
export type VfxKey = keyof VfxLayers

export const VFX_KEYS: VfxKey[] = ['rain', 'snow', 'fireflies', 'stars', 'glyphs', 'petals', 'fog', 'vhs']

export const NO_VFX: VfxLayers = { rain: 0, snow: 0, fireflies: 0, stars: 0, glyphs: 0, petals: 0, fog: 0, vhs: 0 }

export const VFX_PRESETS: { id: 'rainNight' | 'winter' | 'terminal' | 'summer' | 'sakura' | 'off'; layers: VfxLayers }[] = [
  { id: 'rainNight', layers: { ...NO_VFX, rain: 60, fog: 30 } },
  { id: 'winter', layers: { ...NO_VFX, snow: 65, stars: 25, fog: 20 } },
  { id: 'terminal', layers: { ...NO_VFX, glyphs: 55, vhs: 25 } },
  { id: 'summer', layers: { ...NO_VFX, fireflies: 60, stars: 55 } },
  { id: 'sakura', layers: { ...NO_VFX, petals: 55, fireflies: 15 } },
  { id: 'off', layers: NO_VFX }
]

export const hasVfx = (l: Partial<VfxLayers> | undefined): boolean => !!l && VFX_KEYS.some((k) => (l[k] ?? 0) > 0)

export interface VfxOptions {
  layers: () => VfxLayers
  paused?: () => boolean
  /** 0..1 music energy; 0 when not reacting. */
  beat?: () => number
  scale?: number
}

// 3×5 bitmap glyphs for the terminal rain ("0", "1", ">", "<", "/", "+", "=", "#", katakana-ish…)
const GLYPHS = [
  '111101101101111', '010110010010111', '111001010010010', '100010001010100', '001010100010001', '001001010100100',
  '000010111010000', '000111000111000', '101111101111101', '111001011010100', '011110010011110', '110001110001110'
].map((s) => [...s].map((c) => c === '1'))

// Ordered-dither thresholds (0..1) for a 4×4 Bayer matrix.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)

const C = {
  rain: [201, 168, 255],
  splash: [61, 245, 255],
  snow: [244, 236, 255],
  star: [230, 218, 254],
  shoot: [61, 245, 255],
  fly: [255, 226, 140],
  flyCore: [255, 244, 200],
  petal: [255, 154, 213],
  petalDark: [255, 79, 216],
  glyph: [157, 107, 255],
  glyphHead: [244, 236, 255],
  fog: [201, 168, 255],
  noise: [244, 236, 255]
}

type P = { x: number; y: number; vx: number; vy: number; a: number; s: number; k: number }

export function startVfx(canvas: HTMLCanvasElement, opts: VfxOptions): () => void {
  const scale = opts.scale ?? 3
  const ctx = canvas.getContext('2d')!
  let w = 0
  let h = 0
  let img: ImageData | null = null
  let px: Uint32Array | null = null
  let fogNoise: Float32Array | null = null
  let fw = 0
  let fh = 0
  const L = {
    rain: [] as P[],
    snow: [] as P[],
    petals: [] as P[],
    flies: [] as P[],
    stars: [] as P[],
    splash: [] as P[],
    cols: [] as P[]
  }
  let shoot: P | null = null
  let flash = 0
  let nextFlash = performance.now() + 6000
  let tear = 0
  let t = 0
  let raf = 0
  let last = performance.now()

  const pack = (rgb: number[], a: number): number =>
    ((Math.max(0, Math.min(255, Math.round(a * 255))) << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]) >>> 0
  const plot = (x: number, y: number, c: number): void => {
    x |= 0
    y |= 0
    if (x >= 0 && y >= 0 && x < w && y < h) px![y * w + x] = c
  }
  const R = Math.random

  /** Keep `arr` at `n` particles, creating new ones with `make`. */
  const fit = (arr: P[], n: number, make: (initial: boolean) => P): void => {
    while (arr.length < n) arr.push(make(true))
    if (arr.length > n) arr.length = n
  }

  const resize = (cw: number, ch: number): void => {
    w = canvas.width = cw
    h = canvas.height = ch
    img = ctx.createImageData(w, h)
    px = new Uint32Array(img.data.buffer)
    for (const k of Object.keys(L) as (keyof typeof L)[]) L[k] = []
    // Fog: a tileable value-noise field at quarter resolution, two octaves.
    fw = Math.ceil(w / 4) + 2
    fh = Math.ceil(h / 4) + 2
    const base = (cell: number): Float32Array => {
      const gw = Math.ceil(fw / cell) + 2
      const gh = Math.ceil(fh / cell) + 2
      const g = Float32Array.from({ length: gw * gh }, R)
      const out = new Float32Array(fw * fh)
      for (let y = 0; y < fh; y++)
        for (let x = 0; x < fw; x++) {
          const gx = x / cell
          const gy = y / cell
          const x0 = gx | 0
          const y0 = gy | 0
          const sx = gx - x0
          const sy = gy - y0
          const a = g[y0 * gw + x0] + (g[y0 * gw + x0 + 1] - g[y0 * gw + x0]) * sx
          const b = g[(y0 + 1) * gw + x0] + (g[(y0 + 1) * gw + x0 + 1] - g[(y0 + 1) * gw + x0]) * sx
          out[y * fw + x] = a + (b - a) * sy
        }
      return out
    }
    const o1 = base(10)
    const o2 = base(4)
    fogNoise = o1.map((v, i) => Math.max(0, v * 0.7 + o2[i] * 0.3 - 0.35) / 0.65)
  }

  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now

    const cw = Math.max(1, Math.round(canvas.clientWidth / scale))
    const ch = Math.max(1, Math.round(canvas.clientHeight / scale))
    if (cw !== w || ch !== h) resize(cw, ch)
    if (opts.paused?.()) return

    const lv = opts.layers()
    const beat = Math.min(1, Math.max(0, opts.beat?.() ?? 0))
    const speed = 1 + beat * 1.2
    t += dt
    const A = w * h
    px!.fill(0)

    // ── stars (background) + shooting stars ──
    fit(L.stars, Math.round((lv.stars / 100) * (A / 170)), () => ({ x: R() * w, y: R() * h * 0.85, vx: 0, vy: 0, a: 0.3 + R() * 0.7, s: R() * 6, k: R() < 0.15 ? 1 : 0 }))
    for (const s of L.stars) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.8 + s.a) + s.s))
      plot(s.x, s.y, pack(s.k ? C.shoot : C.star, Math.min(1, tw * s.a + beat * 0.4)))
    }
    if (lv.stars > 0) {
      if (!shoot && R() < dt * (0.08 + (lv.stars / 100) * 0.25)) shoot = { x: w * (0.3 + R() * 0.7), y: R() * h * 0.3, vx: -90 - R() * 60, vy: 45 + R() * 30, a: 1, s: 0, k: 0 }
      if (shoot) {
        shoot.x += shoot.vx * dt
        shoot.y += shoot.vy * dt
        shoot.a -= dt * 0.9
        const n = Math.hypot(shoot.vx, shoot.vy)
        for (let k = 0; k < 14; k++) plot(shoot.x - (shoot.vx / n) * k, shoot.y - (shoot.vy / n) * k, pack(C.shoot, shoot.a * (1 - k / 14)))
        if (shoot.a <= 0 || shoot.x < 0 || shoot.y > h) shoot = null
      }
    }

    // ── fog: two-octave noise drifting sideways, smoothly sampled then Bayer-dithered ──
    if (lv.fog > 0 && fogNoise) {
      const amt = (lv.fog / 100) * 0.55
      const ox = (t * 1.6) % (fw - 2)
      const levels = [pack(C.fog, amt * 0.25), pack(C.fog, amt * 0.5), pack(C.fog, amt * 0.75), pack(C.fog, amt)]
      for (let y = 0; y < h; y++) {
        const gy = Math.min(fh - 2, y / 4)
        const y0 = gy | 0
        const sy = gy - y0
        const lift = 0.5 + 0.5 * (y / h) // thicker toward the bottom
        for (let x = 0; x < w; x++) {
          const gx = (x / 4 + ox) % (fw - 2)
          const x0 = gx | 0
          const sx = gx - x0
          const i = y0 * fw + x0
          const top = fogNoise[i] + (fogNoise[i + 1] - fogNoise[i]) * sx
          const bot = fogNoise[i + fw] + (fogNoise[i + fw + 1] - fogNoise[i + fw]) * sx
          const v = (top + (bot - top) * sy) * lift
          const level = Math.floor(v * 4 + BAYER[(y & 3) * 4 + (x & 3)]) - 1
          if (level >= 0) px![y * w + x] = levels[Math.min(3, level)]
        }
      }
    }

    // ── rain (far + near) with splashes ──
    fit(L.rain, Math.round(Math.pow(lv.rain / 100, 0.75) * (A / 26)), (initial) => {
      const near = R() < 0.3
      return { x: R() * (w + h * 0.3), y: initial ? R() * h : -R() * h * 0.2, vx: 0, vy: near ? 150 + R() * 70 : 70 + R() * 50, a: near ? 0.6 + R() * 0.35 : 0.22 + R() * 0.3, s: near ? 6 + ((R() * 7) | 0) : 2 + ((R() * 4) | 0), k: near ? 1 : 0 }
    })
    for (const d of L.rain) {
      d.y += d.vy * dt * speed
      d.x -= d.vy * dt * 0.28 * speed
      if (d.y - d.s > h || d.x < -4) {
        if (d.k && d.y > h && L.splash.length < 400) for (let k = 0; k < 2; k++) L.splash.push({ x: d.x, y: h - 1, vx: (R() - 0.5) * 40, vy: -30 - R() * 40, a: 0.35, s: 0, k: 0 })
        d.y = -R() * 20
        d.x = R() * (w + h * 0.3)
        continue
      }
      for (let k = 0; k < d.s; k++) plot(d.x + k * 0.28, d.y - k, pack(C.rain, d.a * (1 - k / (d.s + 1))))
    }
    for (let i = L.splash.length - 1; i >= 0; i--) {
      const s = L.splash[i]
      s.a -= dt
      if (s.a <= 0) {
        L.splash.splice(i, 1)
        continue
      }
      s.vy += 160 * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      plot(s.x, s.y, pack(C.splash, Math.min(1, s.a * 2.5)))
    }

    // ── snow ──
    fit(L.snow, Math.round(Math.pow(lv.snow / 100, 0.8) * (A / 55)), (initial) => ({ x: R() * w, y: initial ? R() * h : -2, vx: 0, vy: 8 + R() * 14, a: 0.5 + R() * 0.5, s: R() * 6, k: R() < 0.2 ? 1 : 0 }))
    for (const f of L.snow) {
      f.y += f.vy * dt * speed
      f.x += Math.sin(t * 0.9 + f.s) * 6 * dt
      if (f.y > h) {
        f.y = -2
        f.x = R() * w
      }
      const c = pack(C.snow, f.a)
      plot(f.x, f.y, c)
      if (f.k) {
        plot(f.x + 1, f.y, c)
        plot(f.x, f.y + 1, c)
        plot(f.x + 1, f.y + 1, c)
      }
    }

    // ── petals ──
    fit(L.petals, Math.round((lv.petals / 100) * (A / 420)), (initial) => ({ x: R() * w - 20, y: initial ? R() * h : -3, vx: 4 + R() * 6, vy: 6 + R() * 8, a: 0.8, s: R() * 6, k: 0 }))
    for (const p of L.petals) {
      p.y += p.vy * dt * speed
      p.x += (p.vx + Math.sin(t * 1.4 + p.s) * 10) * dt * speed
      if (p.y > h || p.x > w + 4) {
        p.y = -3
        p.x = R() * w - 20
      }
      const flip = Math.sin(t * 3 + p.s) > 0
      plot(p.x, p.y, pack(C.petal, p.a))
      plot(p.x + (flip ? 1 : -1), p.y, pack(C.petal, p.a * 0.8))
      plot(p.x, p.y + 1, pack(C.petalDark, p.a))
    }

    // ── fireflies ──
    const flyN = lv.fireflies > 0 ? Math.max(3, Math.round((lv.fireflies / 100) * (A / 800))) : 0
    fit(L.flies, flyN, () => ({ x: R() * w, y: h * (0.3 + R() * 0.7), vx: 0, vy: 0, a: 0, s: R() * 10, k: 0.5 + R() }))
    for (const f of L.flies) {
      f.x += Math.cos(t * 0.6 * f.k + f.s) * 7 * dt
      f.y += Math.sin(t * 0.45 * f.k + f.s * 1.7) * 5 * dt
      if (f.x < -3) f.x = w + 2
      if (f.x > w + 3) f.x = -2
      const pulse = Math.max(0, Math.sin(t * 2.2 * f.k + f.s)) * 0.85 + 0.15 + beat * 0.5
      const halo = pack(C.fly, Math.min(1, pulse * 0.22))
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) plot(f.x + dx, f.y + dy, halo)
      plot(f.x, f.y, pack(C.flyCore, Math.min(1, pulse)))
    }

    // ── terminal glyph rain ──
    const colCount = Math.floor(w / 4)
    if (lv.glyphs > 0) {
      fit(L.cols, Math.round(colCount * (0.15 + (lv.glyphs / 100) * 0.85)), (initial) => ({ x: ((R() * colCount) | 0) * 4, y: initial ? R() * h : -R() * h * 0.5, vx: 0, vy: 14 + R() * 26, a: 0, s: (R() * GLYPHS.length) | 0, k: 3 + ((R() * 6) | 0) }))
      for (const c of L.cols) {
        c.y += c.vy * dt * speed
        c.a += dt
        if (c.a > 0.12) {
          c.a = 0
          c.s = (R() * GLYPHS.length) | 0
        }
        if (c.y - c.k * 6 > h) {
          c.y = -R() * 30
          c.x = ((R() * colCount) | 0) * 4
        }
        for (let k = 0; k < c.k; k++) {
          const g = GLYPHS[(c.s + k * 5) % GLYPHS.length]
          const gy = Math.round(c.y) - k * 6
          const col = k === 0 ? pack(C.glyphHead, 0.95) : pack(C.glyph, 0.75 * (1 - k / c.k))
          for (let i = 0; i < 15; i++) if (g[i]) plot(c.x + (i % 3), gy + ((i / 3) | 0), col)
        }
      }
    } else L.cols.length = 0

    // ── VHS: speckle noise, rolling band, occasional tear lines ──
    if (lv.vhs > 0) {
      const k = lv.vhs / 100
      const noise = Math.round(k * (A / 160))
      for (let i = 0; i < noise; i++) plot(R() * w, R() * h, pack(C.noise, R() * 0.35 * k))
      const band = (t * 22) % (h + 12)
      for (let y = 0; y < 6; y++) {
        const yy = (band - y) | 0
        if (yy < 0 || yy >= h) continue
        const c = pack(C.noise, 0.06 * k * (1 - y / 6))
        for (let x = 0; x < w; x++) if (!px![yy * w + x]) px![yy * w + x] = c
      }
      if (tear <= 0 && R() < dt * k * 0.6) tear = 0.18
      if (tear > 0) {
        tear -= dt
        for (let n = 0; n < 3; n++) {
          const y = (R() * h) | 0
          const x0 = (R() * w * 0.6) | 0
          const len = (w * (0.2 + R() * 0.4)) | 0
          const c = pack(n % 2 ? C.shoot : C.petalDark, 0.35 * k)
          for (let x = x0; x < Math.min(w, x0 + len); x++) px![y * w + x] = c
        }
      }
    }

    ctx.putImageData(img!, 0, 0)

    // Lightning in a downpour; a soft purple pulse on strong beats.
    if (lv.rain >= 80 && now > nextFlash) {
      flash = 1
      nextFlash = now + 8000 + R() * 12000
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(230, 218, 254, ${flash * 0.22})`
      ctx.fillRect(0, 0, w, h)
      flash = Math.max(0, flash - dt * 5)
    }
    if (beat > 0.35) {
      ctx.fillStyle = `rgba(157, 107, 255, ${(beat - 0.35) * 0.12})`
      ctx.fillRect(0, 0, w, h)
    }
  }
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}
