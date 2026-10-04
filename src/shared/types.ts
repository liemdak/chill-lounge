export type MediaKind = 'image' | 'video'
export type FitMode = 'cover' | 'contain' | 'fill'

export interface WallpaperSource {
  path: string
  kind: MediaKind
}

/** Overlays drawn by the wallpaper window itself, on top of the image/video. */
export interface WallpaperEffects {
  // Pixel VFX layers, 0..100 each (0 = off); they stack.
  rain: number
  snow: number
  fireflies: number
  stars: number
  glyphs: number
  petals: number
  fog: number
  vhs: number
  /** 30..100 (%), applied as a CSS brightness filter. */
  brightness: number
  /** CRT scanline overlay. */
  scanlines: boolean
  /** Particles and brightness pulse with the bass of the playing track. */
  reactive: boolean
}

export type Lang = 'vi' | 'en'

export interface WallpaperState {
  /** Media chosen in the app — shown as Chill Lounge's own background. */
  source: WallpaperSource | null
  /** Media currently placed on the Windows desktop (only after the user confirms). */
  desktop: WallpaperSource | null
  /** Put the desktop wallpaper back automatically when the app starts. */
  restoreOnLaunch: boolean
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
    desktop: WallpaperSource | null
    restoreOnLaunch: boolean
    fit: FitMode
    autoPause: boolean
    effects: WallpaperEffects
    history: WallpaperSource[]
  }
  volume: number
  language: Lang
  /** Where downloads go; defaults to Music\Chill Lounge. */
  downloadDir: string | null
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
  /** Set for YouTube tracks; `path` is then `yt:<id>`. */
  source?: 'youtube'
  /** Watch URL for YouTube tracks. */
  url?: string
}

export const MEDIA_SCHEME = 'lounge-media'

export const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']
export const VIDEO_EXT = ['mp4', 'webm', 'mkv', 'mov']
export const AUDIO_EXT = ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'opus']

export type DownloadMode = 'audio' | 'video'

export interface DownloadJob {
  id: string
  videoId: string
  title: string
  mode: DownloadMode
  status: 'queued' | 'downloading' | 'processing' | 'done' | 'error' | 'canceled'
  progress: number
  speed: string
  eta: string
  file: string | null
  error: string | null
  /** Filled when the job finishes, so the renderer can add it to the library. */
  track: TrackInfo | null
}

export interface ToolsStatus {
  ytdlp: boolean
  ffmpeg: boolean
  ytdlpVersion: string | null
}

export interface ToolsProgress {
  name: 'yt-dlp' | 'ffmpeg' | 'ffprobe'
  received: number
  total: number
}
