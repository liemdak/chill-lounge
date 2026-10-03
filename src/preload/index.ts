import { contextBridge, ipcRenderer } from 'electron'
import {
  MEDIA_SCHEME,
  type FitMode,
  type Lang,
  type TrackInfo,
  type WallpaperEffects,
  type WallpaperState
} from '../shared/types'

type Off = () => void
function on<T>(channel: string, fn: (v: T) => void): Off {
  const listener = (_e: unknown, v: T): void => fn(v)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  window: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    toggleMaximize: (): void => ipcRenderer.send('window:toggleMaximize'),
    setFullScreen: (v: boolean): void => ipcRenderer.send('window:setFullScreen', v),
    onFullScreen: (fn: (v: boolean) => void): Off => on('window:fullscreen', fn),
    close: (): void => ipcRenderer.send('window:close')
  },
  app: {
    version: (): Promise<string> => ipcRenderer.invoke('app:version'),
    onUpdate: (fn: (u: { status: 'downloading' | 'ready'; version?: string }) => void): Off => on('update:status', fn),
    installUpdate: (): void => ipcRenderer.send('update:install')
  },
  dialog: {
    pickWallpaper: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickWallpaper'),
    pickAudio: (): Promise<string[]> => ipcRenderer.invoke('dialog:pickAudio')
  },
  media: {
    readTags: (paths: string[]): Promise<TrackInfo[]> => ipcRenderer.invoke('media:readTags', paths)
  },
  wallpaper: {
    getState: (): Promise<WallpaperState> => ipcRenderer.invoke('wallpaper:getState'),
    /** In-app background only — never touches the Windows desktop. */
    select: (path: string | null): Promise<WallpaperState> => ipcRenderer.invoke('wallpaper:select', path),
    /** Place on / remove from the Windows desktop. The UI must confirm with the user first. */
    setDesktop: (path: string | null, restoreOnLaunch?: boolean): Promise<WallpaperState> =>
      ipcRenderer.invoke('wallpaper:setDesktop', path, restoreOnLaunch),
    setRestoreOnLaunch: (v: boolean): Promise<WallpaperState> => ipcRenderer.invoke('wallpaper:setRestoreOnLaunch', v),
    setFit: (fit: FitMode): Promise<WallpaperState> => ipcRenderer.invoke('wallpaper:setFit', fit),
    setAutoPause: (v: boolean): Promise<WallpaperState> => ipcRenderer.invoke('wallpaper:setAutoPause', v),
    setEffects: (patch: Partial<WallpaperEffects>): Promise<WallpaperState> =>
      ipcRenderer.invoke('wallpaper:setEffects', patch),
    forget: (path: string): Promise<WallpaperState> => ipcRenderer.invoke('wallpaper:forget', path),
    togglePause: (): Promise<WallpaperState> => ipcRenderer.invoke('wallpaper:togglePause'),
    onState: (fn: (s: WallpaperState) => void): Off => on('wallpaper:state', fn)
  },
  settings: {
    getVolume: (): Promise<number> => ipcRenderer.invoke('settings:getVolume'),
    setVolume: (v: number): void => ipcRenderer.send('settings:setVolume', v),
    getLanguage: (): Promise<Lang> => ipcRenderer.invoke('settings:getLanguage'),
    setLanguage: (lang: Lang): void => ipcRenderer.send('settings:setLanguage', lang)
  },
  mediaUrl: (path: string): string => `${MEDIA_SCHEME}://local/${encodeURIComponent(path)}`
}

export type LoungeApi = typeof api

contextBridge.exposeInMainWorld('lounge', api)
