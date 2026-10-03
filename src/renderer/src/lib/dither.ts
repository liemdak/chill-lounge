// Ordered (Bayer 4×4) dithering into a small purple phosphor palette — turns any cover
// art into retro pixel art. Results are cached per (src, size).

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5)

/** Dark → bright phosphor ramp. */
export const PALETTE: [number, number, number][] = [
  [7, 6, 15],
  [42, 26, 92],
  [113, 66, 207],
  [201, 168, 255],
  [244, 236, 255]
]

const cache = new Map<string, Promise<HTMLCanvasElement>>()

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Deterministic placeholder "art" for tracks without a cover: a gradient blob seeded by the title. */
function placeholder(ctx: CanvasRenderingContext2D, size: number, seed: string): void {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0
  const rnd = (): number => ((h = (h * 1103515245 + 12345) | 0) >>> 0) / 4294967296
  const g = ctx.createRadialGradient(size * rnd(), size * rnd(), 0, size / 2, size / 2, size * 0.8)
  g.addColorStop(0, '#f4ecff')
  g.addColorStop(0.35, '#9d6bff')
  g.addColorStop(1, '#07060f')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
}

export function ditherCover(src: string | null, size: number, seed = 'chill'): Promise<HTMLCanvasElement> {
  const key = `${src ?? seed}@${size}`
  const hit = cache.get(key)
  if (hit) return hit

  const job = (async () => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    try {
      if (!src) throw new Error('no cover')
      const img = await loadImage(src)
      const s = Math.min(img.width, img.height)
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
    } catch {
      placeholder(ctx, size, seed)
    }

    const px = ctx.getImageData(0, 0, size, size)
    const d = px.data
    const levels = PALETTE.length - 1
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4
        const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255
        const v = Math.min(levels, Math.max(0, Math.round(lum * levels + BAYER4[(y % 4) * 4 + (x % 4)])))
        const [r, g, b] = PALETTE[v]
        d[i] = r
        d[i + 1] = g
        d[i + 2] = b
      }
    }
    ctx.putImageData(px, 0, 0)
    return canvas
  })()
  cache.set(key, job)
  return job
}
