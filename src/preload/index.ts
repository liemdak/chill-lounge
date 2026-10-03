import { contextBridge, ipcRenderer } from 'electron'
import {
  MEDIA_SCHEME,
  type FitMode,
  type TrackInfo,
  type WallpaperEffects,
  type WallpaperState
} from '../shared/types'

const api = {
  window: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    toggleMaximize: (): void => ipcRenderer.send('window:toggleMaximize'),
    close: (): void => ipcRenderer.send('window:close')
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
    apply: (path: string): Promise<WallpaperState> => ipcRenderer.invoke('wallpaper:apply', path),
    clear: (): Promise<WallpaperState> => ipcRenderer.invoke('wallpaper:clear'),
    setFit: (fit: FitMode): Promise<WallpaperState> => ipcRenderer.invoke('wallpaper:setFit', fit),
    setAutoPause: (v: boolean): Promise<WallpaperState> => ipcRenderer.invoke('wallpaper:setAutoPause', v),
    setEffects: (patch: Partial<WallpaperEffects>): Promise<WallpaperState> =>
      ipcRenderer.invoke('wallpaper:setEffects', patch),
    forget: (path: string): Promise<WallpaperState> => ipcRenderer.invoke('wallpaper:forget', path),
    togglePause: (): Promise<WallpaperState> => ipcRenderer.invoke('wallpaper:togglePause'),
    onState: (fn: (s: WallpaperState) => void): (() => void) => {
      const listener = (_e: unknown, s: WallpaperState): void => fn(s)
      ipcRenderer.on('wallpaper:state', listener)
      return () => ipcRenderer.removeListener('wallpaper:state', listener)
    }
  },
  settings: {
    getVolume: (): Promise<number> => ipcRenderer.invoke('settings:getVolume'),
    setVolume: (v: number): void => ipcRenderer.send('settings:setVolume', v)
  },
  mediaUrl: (path: string): string => `${MEDIA_SCHEME}://local/${encodeURIComponent(path)}`
}

export type LoungeApi = typeof api

contextBridge.exposeInMainWorld('lounge', api)
