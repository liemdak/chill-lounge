import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { WallpaperState } from '../../shared/types'
import { startVfx } from './lib/vfx'

const fill = { position: 'absolute', inset: 0, width: '100%', height: '100%' } as const

/** The window that lives behind the desktop icons: desktop media + pixel VFX + scanlines. */
function Wallpaper() {
  const [state, setState] = useState<WallpaperState | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRef = useRef<HTMLElement | null>(null)
  const vfxRef = useRef<HTMLCanvasElement>(null)
  const live = useRef(state)
  live.current = state
  const beat = useRef(0)

  useEffect(() => {
    window.lounge.wallpaper.getState().then(setState)
    return window.lounge.wallpaper.onState(setState)
  }, [])

  // Music-reactive brightness pulse, applied directly to avoid re-rendering at 30 Hz.
  useEffect(
    () =>
      window.lounge.wallpaper.onBeat((v) => {
        beat.current = v
        const s = live.current
        if (mediaRef.current && s) {
          const b = (s.effects.brightness / 100) * (1 + (s.effects.reactive ? v * 0.3 : 0))
          mediaRef.current.style.filter = `brightness(${b})`
        }
      }),
    []
  )

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (state?.paused) v.pause()
    else v.play().catch(() => {})
  }, [state?.paused, state?.desktop?.path])

  useEffect(
    () =>
      startVfx(vfxRef.current!, {
        layers: () => live.current?.effects ?? { rain: 0, snow: 0, fireflies: 0, stars: 0, glyphs: 0, petals: 0, fog: 0, vhs: 0 },
        paused: () => live.current?.paused ?? false,
        beat: () => (live.current?.effects.reactive ? beat.current : 0)
      }),
    []
  )

  // This window shows the desktop media, not the in-app one.
  const media = state?.desktop ?? null
  const src = media ? window.lounge.mediaUrl(media.path) : null
  const style = { ...fill, objectFit: state?.fit ?? 'cover', filter: `brightness(${(state?.effects.brightness ?? 100) / 100})` } as const

  return (
    <>
      {src && media?.kind === 'image' && <img ref={(el) => void (mediaRef.current = el)} src={src} style={style} />}
      {src && media?.kind === 'video' && (
        <video
          ref={(el) => {
            videoRef.current = el
            mediaRef.current = el
          }}
          src={src}
          style={style}
          autoPlay
          loop
          muted
          playsInline
        />
      )}
      <canvas ref={vfxRef} style={{ ...fill, imageRendering: 'pixelated', pointerEvents: 'none' }} />
      {state?.effects.scanlines && (
        <div style={{ ...fill, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0 1px, transparent 1px 3px)' }} />
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(<Wallpaper />)
