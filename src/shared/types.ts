export type MediaKind = 'image' | 'video'
export type FitMode = 'cover' | 'contain' | 'fill'

export interface WallpaperSource {
  path: string
  kind: MediaKind
}

/** Overlays drawn by the wallpaper window itself, on top of the image/video. */
export interface WallpaperEffects {
  /** Rain particle density, 0 = off. */
  rain: number
  /** 30..100 (%), applied as a CSS brightness filter. */
  brightness: number
  /** CRT scanline overlay. */
  scanlines: boolean
}

export interface WallpaperState {
  source: WallpaperSource | null
  fit: FitMode
  autoPause: boolean
  paused: boolean
  effects: WallpaperEffects
  /** Recently applied wallpapers, newest first. */
  history: WallpaperSource[]
  /** How the window got attached to the desktop; useful when debugging new Windows builds. */
  attachMode: 'progman-24h2' | 'workerw-legacy' | 'failed' | null
  displays: number
}

export interface Settings {
  wallpaper: {
    source: WallpaperSource | null
    fit: FitMode
    autoPause: boolean
    effects: WallpaperEffects
    history: WallpaperSource[]
  }
  volume: number
}

/** Metadata read from an audio/video file's tags. */
export interface TrackInfo {
  path: string
  title: string
  artist: string
  album: string
  duration: number
  /** e.g. "MP3 · 320 kbps · 44.1 kHz" */
  format: string
  lossless: boolean
  /** data: URL of the embedded cover art, if any. */
  cover: string | null
  /** Synced lyrics (seconds) or plain lines with time = -1. */
  lyrics: { time: number; text: string }[]
  isVideo: boolean
}

export const MEDIA_SCHEME = 'lounge-media'

export const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']
export const VIDEO_EXT = ['mp4', 'webm', 'mkv', 'mov']
export const AUDIO_EXT = ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'opus']
