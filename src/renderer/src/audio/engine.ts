/**
 * One AudioContext for the whole app.
 *
 *   <video> ─► low ─► mid ─► high ─► warmth ─► analyser ─► musicGain ─┐
 *   rain / vinyl / fire / cafe noise ─► per-layer gain ─► ambientBus ─┴─► speakers
 *
 * The analyser only sees the music so the visualizers react to the track, not the rain.
 * Ambient layers are synthesized noise (adapted from the Stitch/AI Studio prototype).
 */

export type AmbientKey = 'rain' | 'vinyl' | 'fire' | 'cafe'
export interface EQSettings {
  low: number
  mid: number
  high: number
  warmth: number
}

const AMBIENT_MAX: Record<AmbientKey, number> = { rain: 0.7, vinyl: 0.4, fire: 0.5, cafe: 0.4 }

function warmthCurve(amount: number): Float32Array<ArrayBuffer> {
  const k = (amount / 100) * 12
  const n = 1024
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = k === 0 ? x : ((1 + k) * x) / (1 + k * Math.abs(x))
  }
  return curve
}

class AudioEngine {
  readonly media: HTMLVideoElement
  analyser: AnalyserNode | null = null
  private ctx: AudioContext | null = null
  private low!: BiquadFilterNode
  private mid!: BiquadFilterNode
  private high!: BiquadFilterNode
  private warmth!: WaveShaperNode
  private musicGain!: GainNode
  private ambientBus!: GainNode
  private ambient = new Map<AmbientKey, GainNode>()
  private volume = 0.7
  private eq: EQSettings = { low: 0, mid: 0, high: 0, warmth: 0 }

  constructor() {
    this.media = document.createElement('video')
    this.media.crossOrigin = 'anonymous'
    this.media.playsInline = true
  }

  /** Build the graph on first use (needs to happen after a user gesture). */
  private ensure(): AudioContext {
    if (this.ctx) return this.ctx
    const ctx = new AudioContext()
    this.ctx = ctx

    this.low = Object.assign(ctx.createBiquadFilter(), { type: 'lowshelf' as const })
    this.low.frequency.value = 250
    this.mid = Object.assign(ctx.createBiquadFilter(), { type: 'peaking' as const })
    this.mid.frequency.value = 1200
    this.high = Object.assign(ctx.createBiquadFilter(), { type: 'highshelf' as const })
    this.high.frequency.value = 4500
    this.warmth = ctx.createWaveShaper()
    this.warmth.oversample = '2x'
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.smoothingTimeConstant = 0.78
    this.musicGain = ctx.createGain()
    this.ambientBus = ctx.createGain()

    ctx
      .createMediaElementSource(this.media)
      .connect(this.low)
      .connect(this.mid)
      .connect(this.high)
      .connect(this.warmth)
      .connect(this.analyser)
      .connect(this.musicGain)
      .connect(ctx.destination)
    this.ambientBus.connect(ctx.destination)

    this.setVolume(this.volume)
    this.setEQ(this.eq)
    return ctx
  }

  resume(): void {
    const ctx = this.ensure()
    if (ctx.state === 'suspended') void ctx.resume()
  }

  setVolume(v: number): void {
    this.volume = v
    if (this.ctx) this.musicGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02)
  }

  setEQ(eq: EQSettings): void {
    this.eq = eq
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.low.gain.setTargetAtTime(eq.low, t, 0.02)
    this.mid.gain.setTargetAtTime(eq.mid, t, 0.02)
    this.high.gain.setTargetAtTime(eq.high, t, 0.02)
    this.warmth.curve = warmthCurve(eq.warmth)
  }

  /** 0..100. Noise layers are only created the first time they are turned up. */
  setAmbient(key: AmbientKey, level: number): void {
    if (level <= 0 && !this.ambient.has(key)) return
    const ctx = this.ensure()
    if (ctx.state === 'suspended') void ctx.resume()
    const gain = this.ambient.get(key) ?? this.createAmbient(key)
    gain.gain.setTargetAtTime((level / 100) * AMBIENT_MAX[key], ctx.currentTime, 0.1)
  }

  /** Fade music + ambience out over `seconds`, then pause. Used by the sleep timer. */
  fadeOutAndPause(seconds = 8): void {
    if (!this.ctx) return void this.media.pause()
    const t = this.ctx.currentTime
    for (const g of [this.musicGain, this.ambientBus]) {
      g.gain.setValueAtTime(g.gain.value, t)
      g.gain.linearRampToValueAtTime(0, t + seconds)
    }
    setTimeout(() => {
      this.media.pause()
      this.musicGain.gain.value = this.volume
      this.ambientBus.gain.value = 0
    }, seconds * 1000)
  }

  /** Bring ambience back after a sleep-timer fade. */
  restoreAmbience(): void {
    if (this.ctx) this.ambientBus.gain.setTargetAtTime(1, this.ctx.currentTime, 0.2)
  }

  private createAmbient(key: AmbientKey): GainNode {
    const ctx = this.ctx!
    const sr = ctx.sampleRate
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(this.ambientBus)
    this.ambientBus.gain.value = 1

    const loop = (seconds: number, fill: (data: Float32Array, i: number) => number): AudioBufferSourceNode => {
      const buf = ctx.createBuffer(1, Math.floor(sr * seconds), sr)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = fill(data, i)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      src.start()
      return src
    }
    const filter = (type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode => {
      const f = ctx.createBiquadFilter()
      f.type = type
      f.frequency.value = freq
      f.Q.value = q
      return f
    }

    if (key === 'rain') {
      // Pink noise through a lowpass: rain on a window.
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
      loop(2, () => {
        const w = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + w * 0.0555179
        b1 = 0.99332 * b1 + w * 0.0750759
        b2 = 0.969 * b2 + w * 0.153852
        b3 = 0.8665 * b3 + w * 0.3104856
        b4 = 0.55 * b4 + w * 0.5329522
        b5 = -0.7616 * b5 - w * 0.016898
        const out = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.08
        b6 = w * 0.115926
        return out
      })
        .connect(filter('lowpass', 1100))
        .connect(gain)
    } else if (key === 'vinyl') {
      loop(2, () => (Math.random() < 0.0008 ? (Math.random() * 2 - 1) * 0.4 : (Math.random() * 2 - 1) * 0.008)).connect(gain)
    } else if (key === 'fire') {
      loop(1, () => (Math.random() < 0.002 ? (Math.random() * 2 - 1) * 0.3 : 0))
        .connect(filter('lowpass', 600))
        .connect(gain)
    } else {
      loop(3, () => (Math.random() * 2 - 1) * 0.03)
        .connect(filter('bandpass', 500, 3))
        .connect(gain)
    }

    this.ambient.set(key, gain)
    return gain
  }
}

export const engine = new AudioEngine()

/** Read `count` spectrum bands (0..1), log-spaced so bass isn't squashed into one bar. */
export function readBands(data: Uint8Array<ArrayBuffer>, count: number): number[] {
  const analyser = engine.analyser
  const out = new Array<number>(count).fill(0)
  if (!analyser) return out
  analyser.getByteFrequencyData(data)
  const usable = data.length * 0.75
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i / count) ** 1.7 * usable)
    const to = Math.max(from + 1, Math.floor(((i + 1) / count) ** 1.7 * usable))
    let sum = 0
    for (let j = from; j < to; j++) sum += data[j]
    out[i] = sum / (to - from) / 255
  }
  return out
}
