import { useEffect, useRef, useState } from 'react'
import { getBeat } from '../lib/beat'
import { useSkin, type SkinId } from '../lib/theme'
import pythenian1 from '../assets/pythenians/pythenian-1.webp'
import pythenian2 from '../assets/pythenians/pythenian-2.webp'
import pythenian3 from '../assets/pythenians/pythenian-3.webp'
import pythenian4 from '../assets/pythenians/pythenian-4.webp'
import pythenian5 from '../assets/pythenians/pythenian-5.webp'

/** The owner's own Pythenians NFTs (used with their permission). */
export const PYTHENIANS = [pythenian1, pythenian2, pythenian3, pythenian4, pythenian5]

// Illustrations and HUD pieces for the themed skins (Pythenians, Ghibli, Naruto, GTA IV, Raiku).
// Drawn here as SVG / CSS in the spirit of each theme. The one exception is the Pythenians
// medallion, which shows the app owner's own Pythenians NFTs (assets/pythenians).
// Motion that follows the music reads the beat through the --beat CSS variable (set once per
// frame below), so none of it re-renders React.

const ART_SKINS: SkinId[] = ['pythenians', 'ghibli', 'naruto', 'gta', 'raiku']

/** Keeps --beat (0..1, bass energy) on <html> up to date while an art skin is on. */
export function useBeatVar(): void {
  const skin = useSkin()
  useEffect(() => {
    if (!ART_SKINS.includes(skin)) return
    let raf = 0
    const root = document.documentElement.style
    const tick = (): void => {
      raf = requestAnimationFrame(tick)
      root.setProperty('--beat', getBeat().toFixed(3))
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      root.removeProperty('--beat')
    }
  }, [skin])
}

/* ── Backdrops: scenes behind the whole app ─────────────────────────────── */

function GhibliScene() {
  return (
    <>
      <svg className="gh-clouds" viewBox="0 0 1600 300" preserveAspectRatio="xMidYMin slice" aria-hidden>
        {[
          [180, 110, 1],
          [760, 70, 1.3],
          [1320, 130, 0.9]
        ].map(([x, y, s], i) => (
          // (the CSS drift animates the outer group; the inner one keeps its place)
          <g key={i} className="gh-cloud" style={{ animationDelay: `${-i * 9}s` }}>
            <g transform={`translate(${x} ${y}) scale(${s})`}>
              <ellipse cx="0" cy="40" rx="120" ry="34" fill="#eef6fb" />
              <circle cx="-60" cy="22" r="42" fill="#fff" />
              <circle cx="0" cy="0" r="58" fill="#fff" />
              <circle cx="62" cy="18" r="46" fill="#fff" />
              <circle cx="110" cy="38" r="28" fill="#fff" />
              <ellipse cx="10" cy="56" rx="118" ry="14" fill="#d6e8f4" />
            </g>
          </g>
        ))}
      </svg>
      <svg className="gh-land" viewBox="0 0 1600 420" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <path d="M0 150 C200 70 380 110 560 85 C760 55 900 120 1100 80 C1300 40 1450 90 1600 70 L1600 420 L0 420Z" fill="#a9cf86" />
        {/* the big tree on the far hill */}
        <g transform="translate(1190 40)">
          <rect x="-7" y="30" width="14" height="60" rx="4" fill="#6b4a2f" />
          <circle cx="-30" cy="22" r="34" fill="#3f7a35" />
          <circle cx="22" cy="12" r="40" fill="#4f8a3d" />
          <circle cx="-4" cy="-18" r="36" fill="#5a9645" />
          <circle cx="44" cy="34" r="26" fill="#3f7a35" />
        </g>
        <path d="M0 250 C220 175 420 230 640 195 C860 160 1000 235 1240 200 C1400 178 1500 200 1600 190 L1600 420 L0 420Z" fill="#86bb60" />
        {/* the little red-roofed house, smoke curling from the chimney */}
        <g transform="translate(330 150)">
          <rect x="58" y="-34" width="14" height="30" fill="#8a5a3a" />
          <circle className="gh-smoke" cx="65" cy="-44" r="8" fill="#fff" />
          <circle className="gh-smoke" cx="65" cy="-44" r="8" fill="#fff" style={{ animationDelay: '-1.3s' }} />
          <circle className="gh-smoke" cx="65" cy="-44" r="8" fill="#fff" style={{ animationDelay: '-2.6s' }} />
          <rect x="0" y="0" width="96" height="62" fill="#f4ead2" stroke="#8a6a48" strokeWidth="2" />
          <polygon points="-12,4 48,-40 108,4" fill="#c8553d" stroke="#8a3a2a" strokeWidth="2" />
          <rect x="14" y="16" width="22" height="20" fill="#7fb2d8" stroke="#8a6a48" strokeWidth="2" />
          <line x1="25" y1="16" x2="25" y2="36" stroke="#8a6a48" strokeWidth="2" />
          <rect x="58" y="24" width="20" height="38" rx="9" fill="#8a5a3a" />
        </g>
        <path d="M455 212 C520 260 470 330 560 420 L610 420 C540 330 590 270 520 205Z" fill="#e8dcb2" opacity="0.8" />
        <path d="M0 330 C260 270 520 320 800 295 C1080 270 1300 320 1600 285 L1600 420 L0 420Z" fill="#6aa84f" />
        {Array.from({ length: 26 }, (_, i) => (
          <circle key={i} cx={40 + i * 61 + (i % 3) * 13} cy={340 + ((i * 37) % 60)} r={i % 4 === 0 ? 4 : 3} fill={['#fff', '#f6d65c', '#f28c8c', '#fff'][i % 4]} />
        ))}
      </svg>
      {Array.from({ length: 7 }, (_, i) => (
        <svg key={i} className="gh-leaf" viewBox="0 0 20 20" style={{ top: `${18 + i * 9}%`, animationDelay: `${-i * 3.1}s`, animationDuration: `${18 + i * 2}s` }} aria-hidden>
          <path d="M2 18 C2 8 10 2 18 2 C18 10 12 18 2 18Z" fill={i % 2 ? '#7fb35a' : '#a9cf86'} />
          <path d="M2 18 L14 6" stroke="#4f8a37" strokeWidth="1" />
        </svg>
      ))}
    </>
  )
}

/** Pagoda-roof village at sunset, drifting leaves, a faint swirl in the sky. */
function NarutoScene() {
  const roof = (x: number, y: number, w: number, tiers: number) =>
    Array.from({ length: tiers }, (_, i) => {
      const ww = w - i * (w / (tiers + 1))
      const yy = y - i * 34
      return (
        <g key={i}>
          <rect x={x - ww * 0.32} y={yy - 22} width={ww * 0.64} height="24" fill="#2a1a10" />
          <path d={`M${x - ww / 2 - 14} ${yy - 22} Q${x - ww / 2} ${yy - 30} ${x - ww / 2 + 10} ${yy - 36} L${x + ww / 2 - 10} ${yy - 36} Q${x + ww / 2} ${yy - 30} ${x + ww / 2 + 14} ${yy - 22}Z`} fill="#3a2418" />
        </g>
      )
    })
  return (
    <>
      <svg className="nr-swirl" viewBox="0 0 200 200" aria-hidden>
        <path d="M100 100 m0 -6 a6 6 0 1 1 -6 6 a14 14 0 1 1 14 14 a24 24 0 1 1 -24 -24 a36 36 0 1 1 36 36 a50 50 0 1 1 -50 -50 a66 66 0 1 1 66 66" fill="none" stroke="#ff7a1a" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <svg className="nr-land" viewBox="0 0 1600 380" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <path d="M0 170 L180 70 L330 150 L520 40 L700 160 L860 90 L1040 170 L1250 60 L1420 150 L1600 90 L1600 380 L0 380Z" fill="#e8955a" opacity="0.55" />
        <path d="M0 240 L220 150 L400 220 L610 130 L800 230 L1010 160 L1200 240 L1400 170 L1600 220 L1600 380 L0 380Z" fill="#c9683a" opacity="0.7" />
        <g fill="#3a2418">
          <rect x="0" y="300" width="1600" height="80" />
          {roof(140, 300, 150, 1)}
          {roof(300, 300, 120, 3)}
          {roof(470, 300, 170, 1)}
          {roof(640, 300, 130, 2)}
          {roof(1000, 300, 160, 1)}
          {roof(1180, 300, 130, 4)}
          {roof(1360, 300, 150, 1)}
          {roof(1520, 300, 120, 2)}
          {/* water tower */}
          <g transform="translate(820 190)">
            <rect x="-6" y="40" width="5" height="70" />
            <rect x="24" y="40" width="5" height="70" />
            <rect x="-14" y="0" width="52" height="44" rx="6" fill="#4a2e1e" />
            <path d="M-20 2 Q12 -26 44 2Z" fill="#c8553d" />
          </g>
        </g>
      </svg>
      {Array.from({ length: 6 }, (_, i) => (
        <svg key={i} className="gh-leaf nr-leaf" viewBox="0 0 20 20" style={{ top: `${12 + i * 11}%`, animationDelay: `${-i * 2.7}s`, animationDuration: `${14 + i * 2}s` }} aria-hidden>
          <path d="M2 18 C2 8 10 2 18 2 C18 10 12 18 2 18Z" fill={i % 2 ? '#5fae3a' : '#89c95a'} />
          <path d="M2 18 L14 6" stroke="#2e6b1d" strokeWidth="1" />
        </svg>
      ))}
    </>
  )
}

function GtaScene() {
  return (
    <>
      <div className="gta-rain" aria-hidden />
      <svg className="gta-bridge" viewBox="0 0 1600 260" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <g stroke="#111820" strokeWidth="5" fill="none">
          <path d="M120 200 Q500 40 880 200" />
          <path d="M880 200 Q1180 70 1480 200" />
          {Array.from({ length: 34 }, (_, i) => {
            const x = 140 + i * 40
            const y = x < 880 ? 200 - 160 * (1 - ((x - 500) / 380) ** 2) : 200 - 130 * (1 - ((x - 1180) / 300) ** 2)
            return <line key={i} x1={x} y1={Math.max(40, y)} x2={x} y2="200" strokeWidth="2" />
          })}
        </g>
        <rect x="80" y="196" width="1460" height="10" fill="#111820" />
        <rect x="470" y="30" width="16" height="190" fill="#111820" />
        <rect x="1160" y="60" width="16" height="160" fill="#111820" />
      </svg>
    </>
  )
}

/** Faint graffiti tags and doodles over the purple, like the Pythenians artwork. */
function PytheniansScene() {
  const tags = [
    ['gm', 6, 18, -12, 64],
    ['PYTH', 72, 14, 8, 72],
    ['ϟ', 44, 30, -6, 90],
    ['wen', 14, 62, 10, 54],
    ['mola', 80, 58, -8, 58],
    ['♥', 30, 82, 14, 70],
    ['★', 88, 86, -16, 66],
    ['Pythenians', 52, 74, -4, 46],
    ['ϟ', 92, 34, 12, 52],
    ['gm', 60, 46, 6, 40]
  ] as const
  return (
    <div className="py-scene" aria-hidden>
      {tags.map(([text, x, y, rot, size], i) => (
        <span key={i} className="py-tag" style={{ left: `${x}%`, top: `${y}%`, transform: `rotate(${rot}deg)`, fontSize: size }}>
          {text}
        </span>
      ))}
    </div>
  )
}

/** Scenery behind the app for the skins that have one. */
export function SkinBackdrop() {
  const skin = useSkin()
  useBeatVar()
  const scene = skin === 'ghibli' ? <GhibliScene /> : skin === 'naruto' ? <NarutoScene /> : skin === 'gta' ? <GtaScene /> : skin === 'pythenians' ? <PytheniansScene /> : null
  if (!scene) return null
  return (
    <div className={`skin-backdrop sb-${skin}`} aria-hidden>
      {scene}
    </div>
  )
}

/* ── Pieces around the Now Playing cover ───────────────────────────────── */

/** The owner's Pythenians NFTs, in a gold Greek-key medallion beside the cover — a new one each track. */
function PytheniansMedallion({ trackKey }: { trackKey: string | null }) {
  let h = 0
  for (const c of trackKey ?? '') h = (h * 31 + c.charCodeAt(0)) | 0
  const current = Math.abs(h) % PYTHENIANS.length
  return (
    <div className="py-medal" aria-hidden>
      {PYTHENIANS.map((src, i) => (
        <img key={src} src={src} alt="" draggable={false} className={i === current ? 'on' : ''} />
      ))}
    </div>
  )
}

/** A four-pointed throwing star that spins while music plays. */
function Shuriken() {
  return (
    <svg className="nr-shuriken" viewBox="0 0 100 100" aria-hidden>
      <path d="M50 2 L60 40 L98 50 L60 60 L50 98 L40 60 L2 50 L40 40Z" fill="#9aa3ad" stroke="#2b2f36" strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 2 L60 40 L50 50Z M98 50 L60 60 L50 50Z M50 98 L40 60 L50 50Z M2 50 L40 40 L50 50Z" fill="#cfd5dc" />
      <circle cx="50" cy="50" r="9" fill="#fff4e0" stroke="#2b2f36" strokeWidth="3" />
    </svg>
  )
}

const fmtCash = (s: number): string => `$${String(Math.floor(s * 37)).padStart(8, '0')}`

/** GTA-style HUD around the cover: radar with health / armour rings, cash, wanted stars, clock. */
function GtaHud({ time }: { time: number }) {
  const stars = useRef<HTMLDivElement>(null)
  // wanted level follows the bass, updated straight on the DOM
  useEffect(() => {
    let raf = 0
    let last = -1
    const tick = (): void => {
      raf = requestAnimationFrame(tick)
      const n = Math.min(5, Math.round(getBeat() * 6))
      if (n !== last && stars.current) {
        last = n
        stars.current.dataset.wanted = String(n)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const now = new Date()
  return (
    <>
      <div className="gta-hud-top">
        <div className="gta-clock">{`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`}</div>
        <div className="gta-cash">{fmtCash(time)}</div>
        <div className="gta-stars" ref={stars} data-wanted="0">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i}>★</span>
          ))}
        </div>
      </div>
      <div className="gta-radar">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="56" fill="none" stroke="#3fae4a" strokeWidth="6" strokeDasharray="176 400" transform="rotate(90 60 60)" />
          <circle cx="60" cy="60" r="56" fill="none" stroke="#4a8fd0" strokeWidth="6" strokeDasharray="0 176 176 400" transform="rotate(90 60 60)" />
        </svg>
        <div className="gta-radar-map" />
        <div className="gta-radar-sweep" />
        <span className="gta-radar-me">▲</span>
        <span className="gta-radar-n">N</span>
      </div>
    </>
  )
}

/** Wooden shutters and a flower box around the cover window. */
function GhibliWindow() {
  return (
    <>
      {['left', 'right'].map((side) => (
        <svg key={side} className={`gh-shutter ${side}`} viewBox="0 0 40 120" preserveAspectRatio="none" aria-hidden>
          <rect x="1" y="1" width="38" height="118" rx="3" fill="#8f6440" stroke="#5c3d24" strokeWidth="2" />
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1="6" y1={12 + i * 12} x2="34" y2={16 + i * 12} stroke="#5c3d24" strokeWidth="2" />
          ))}
        </svg>
      ))}
      <svg className="gh-flowerbox" viewBox="0 0 200 40" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <g key={i} transform={`translate(${16 + i * 21} ${8 + (i % 2) * 4})`}>
            <line x1="0" y1="4" x2="0" y2="16" stroke="#4f8a37" strokeWidth="2" />
            <circle r="6" fill={['#e8564a', '#f6d65c', '#f28cb1'][i % 3]} />
            <circle r="2.2" fill="#fff6d0" />
          </g>
        ))}
        <rect x="4" y="20" width="192" height="18" rx="3" fill="#8f6440" stroke="#5c3d24" strokeWidth="2" />
      </svg>
    </>
  )
}

/** Decoration around the Now Playing cover for the art skins. */
export function HeroDecor({ time, trackKey }: { time: number; trackKey: string | null }) {
  const skin = useSkin()
  if (skin === 'pythenians') return <PytheniansMedallion trackKey={trackKey} />
  if (skin === 'naruto')
    return (
      <>
        <Shuriken />
        <svg className="nr-kunai-hero" viewBox="0 0 30 120" aria-hidden>
          <path d="M15 0 L27 34 L15 46 L3 34Z" fill="#7f8893" stroke="#2b2f36" strokeWidth="2.5" />
          <rect x="11" y="46" width="8" height="52" fill="#2b1d10" />
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1="10" y1={52 + i * 8} x2="20" y2={48 + i * 8} stroke="#c9a46a" strokeWidth="2" />
          ))}
          <circle cx="15" cy="108" r="9" fill="none" stroke="#2b2f36" strokeWidth="4" />
        </svg>
      </>
    )
  if (skin === 'gta') return <GtaHud time={time} />
  if (skin === 'ghibli') return <GhibliWindow />
  return null
}

/* ── Banners when the track changes ────────────────────────────────────── */

/** GTA: "TRACK PASSED / RESPECT +"; Naruto: a puff of smoke. Shown for a moment on each new track. */
export function TrackBanner({ trackKey }: { trackKey: string | null }) {
  const skin = useSkin()
  const first = useRef(true)
  const [shown, setShown] = useState<string | null>(null)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!trackKey || (skin !== 'gta' && skin !== 'naruto')) return
    setShown(trackKey)
    const id = setTimeout(() => setShown(null), skin === 'gta' ? 2800 : 1100)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey])
  if (!shown) return null
  if (skin === 'gta')
    return (
      <div className="gta-passed" key={shown}>
        <div className="gta-passed-title">TRACK PASSED</div>
        <div className="gta-passed-sub">RESPECT +</div>
      </div>
    )
  return (
    <svg className="nr-poof" key={shown} viewBox="0 0 200 160" aria-hidden>
      {[
        [60, 90, 42],
        [110, 70, 52],
        [150, 100, 38],
        [90, 120, 36],
        [130, 128, 34],
        [40, 120, 26]
      ].map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill={i % 2 ? '#f2f0ec' : '#e2ddd5'} stroke="#8d857a" strokeWidth="3" />
      ))}
      <text x="100" y="108" textAnchor="middle" className="nr-poof-text">
        POOF!
      </text>
    </svg>
  )
}

/* ── Raiku: the visualizer is a block being built ──────────────────────── */

/**
 * Rows of slots filling up as the music plays (faster on the beat), some "captured" (marked
 * ▸), then a fresh block starts — after the "block being built" diagrams on raiku.com.
 */
export function RaikuBlocks({ playing, className = '' }: { playing: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef(playing)
  live.current = playing
  const [slot, setSlot] = useState(412_118_340)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const COLS = 30
    const ROWS = 3
    const CELL = 14
    const GAP = 4
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = (COLS * (CELL + GAP)) * dpr
    canvas.height = (ROWS * (CELL + GAP)) * dpr
    ctx.scale(dpr, dpr)
    const state = new Uint8Array(COLS * ROWS) // 0 empty, 1 landed, 2 captured
    let filled = 0
    let acc = 0
    let raf = 0
    let last = performance.now()
    const draw = (): void => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < state.length; i++) {
        const x = (i % COLS) * (CELL + GAP)
        const y = Math.floor(i / COLS) * (CELL + GAP)
        if (state[i]) {
          ctx.fillStyle = '#223d0e'
          ctx.fillRect(x, y, CELL, CELL)
          if (state[i] === 2) {
            ctx.fillStyle = '#efeee9'
            ctx.beginPath()
            ctx.moveTo(x + 4, y + 3)
            ctx.lineTo(x + 11, y + 7)
            ctx.lineTo(x + 4, y + 11)
            ctx.fill()
          }
        } else {
          ctx.strokeStyle = '#b9bfae'
          ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1)
          ctx.fillStyle = '#c9cbbd'
          for (let dx = 3; dx < CELL - 1; dx += 3) for (let dy = 3; dy < CELL - 1; dy += 3) ctx.fillRect(x + dx, y + dy, 1, 1)
        }
      }
    }
    const tick = (now: number): void => {
      raf = requestAnimationFrame(tick)
      const dt = now - last
      last = now
      if (!live.current) return
      acc += dt * (0.6 + getBeat() * 3.5)
      if (acc < 110) return
      acc = 0
      if (filled >= state.length) {
        state.fill(0)
        filled = 0
        setSlot((s) => s + 1)
      } else {
        state[filled] = Math.random() < 0.18 ? 2 : 1
        filled++
      }
      draw()
    }
    draw()
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className={`raiku-blocks ${className}`}>
      <div className="raiku-blocks-label">
        <span>■ BLOCK BEING BUILT</span>
        <span>SLOT {slot.toLocaleString('en-US')}</span>
      </div>
      <canvas ref={ref} aria-hidden />
    </div>
  )
}
