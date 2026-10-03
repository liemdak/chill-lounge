import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { WallpaperState } from '../../shared/types'
import { startRain } from './lib/rain'

const fill = { position: 'absolute', inset: 0, width: '100%', height: '100%' } as const

function Wallpaper() {
  const [state, setState] = useState<WallpaperState | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const rainRef = useRef<HTMLCanvasElement>(null)
  const live = useRef(state)
  live.current = state

  useEffect(() => {
    window.lounge.wallpaper.getState().then(setState)
    return window.lounge.wallpaper.onState(setState)
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (state?.paused) v.pause()
    else v.play().catch(() => {})
  }, [state?.paused, state?.source?.path])

  useEffect(
    () =>
      startRain(rainRef.current!, {
        density: () => live.current?.effects.rain ?? 0,
        paused: () => live.current?.paused ?? false
      }),
    []
  )

  const src = state?.source ? window.lounge.mediaUrl(state.source.path) : null
  const style = { ...fill, objectFit: state?.fit ?? 'cover', filter: `brightness(${(state?.effects.brightness ?? 100) / 100})` } as const

  return (
    <>
      {src && state?.source?.kind === 'image' && <img src={src} style={style} />}
      {src && state?.source?.kind === 'video' && <video ref={videoRef} src={src} style={style} autoPlay loop muted playsInline />}
      <canvas ref={rainRef} style={{ ...fill, imageRendering: 'pixelated', pointerEvents: 'none' }} />
      {state?.effects.scanlines && (
        <div style={{ ...fill, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0 1px, transparent 1px 3px)' }} />
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(<Wallpaper />)
