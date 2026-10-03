import { BrowserWindow, screen, type Display } from 'electron'
import { extname, join } from 'node:path'
import {
  IMAGE_EXT,
  type FitMode,
  type WallpaperEffects,
  type WallpaperSource,
  type WallpaperState
} from '../../shared/types'
import { loadSettings, saveSettings } from '../settings'
import { attachToDesktop, hwndFromBuffer, isFullscreenAppRunning, refreshDesktop, refreshLayered } from './win32'

type Listener = (state: WallpaperState) => void

export function sourceFromPath(path: string): WallpaperSource {
  const ext = extname(path).slice(1).toLowerCase()
  return { path, kind: IMAGE_EXT.includes(ext) ? 'image' : 'video' }
}

/** Owns one borderless window per display, parented behind the desktop icons. */
export class WallpaperManager {
  private windows = new Map<number, BrowserWindow>()
  private listeners = new Set<Listener>()
  private fullscreenTimer: NodeJS.Timeout | null = null
  private pausedByUser = false
  private pausedByFullscreen = false
  private attachMode: WallpaperState['attachMode'] = null

  constructor() {
    const rebuild = (): void => {
      if (this.source) this.rebuildWindows()
    }
    screen.on('display-added', rebuild)
    screen.on('display-removed', rebuild)
    screen.on('display-metrics-changed', rebuild)
  }

  private get source(): WallpaperSource | null {
    return loadSettings().wallpaper.source
  }

  getState(): WallpaperState {
    const wp = loadSettings().wallpaper
    return {
      source: wp.source,
      fit: wp.fit,
      autoPause: wp.autoPause,
      paused: this.pausedByUser || this.pausedByFullscreen,
      effects: wp.effects,
      history: wp.history,
      attachMode: this.attachMode,
      displays: this.windows.size
    }
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    const state = this.getState()
    for (const win of this.windows.values()) win.webContents.send('wallpaper:state', state)
    for (const fn of this.listeners) fn(state)
  }

  restore(): void {
    if (this.source) this.rebuildWindows()
    this.syncFullscreenWatcher()
  }

  apply(path: string): WallpaperState {
    const wp = loadSettings().wallpaper
    const source = sourceFromPath(path)
    const history = [source, ...wp.history.filter((s) => s.path !== path)].slice(0, 12)
    saveSettings({ wallpaper: { ...wp, source, history } })
    this.rebuildWindows()
    this.emit()
    return this.getState()
  }

  clear(): WallpaperState {
    const wp = loadSettings().wallpaper
    saveSettings({ wallpaper: { ...wp, source: null } })
    this.destroyWindows()
    this.attachMode = null
    this.emit()
    return this.getState()
  }

  setFit(fit: FitMode): WallpaperState {
    saveSettings({ wallpaper: { ...loadSettings().wallpaper, fit } })
    this.emit()
    return this.getState()
  }

  setEffects(patch: Partial<WallpaperEffects>): WallpaperState {
    const wp = loadSettings().wallpaper
    saveSettings({ wallpaper: { ...wp, effects: { ...wp.effects, ...patch } } })
    this.emit()
    return this.getState()
  }

  forget(path: string): WallpaperState {
    const wp = loadSettings().wallpaper
    saveSettings({ wallpaper: { ...wp, history: wp.history.filter((s) => s.path !== path) } })
    this.emit()
    return this.getState()
  }

  setAutoPause(autoPause: boolean): WallpaperState {
    saveSettings({ wallpaper: { ...loadSettings().wallpaper, autoPause } })
    this.syncFullscreenWatcher()
    this.emit()
    return this.getState()
  }

  togglePause(): WallpaperState {
    this.pausedByUser = !this.pausedByUser
    this.emit()
    return this.getState()
  }

  dispose(): void {
    if (this.fullscreenTimer) clearInterval(this.fullscreenTimer)
    this.destroyWindows()
  }

  private syncFullscreenWatcher(): void {
    const enabled = loadSettings().wallpaper.autoPause
    if (enabled && !this.fullscreenTimer) {
      this.fullscreenTimer = setInterval(() => {
        const busy = this.windows.size > 0 && isFullscreenAppRunning()
        if (busy !== this.pausedByFullscreen) {
          this.pausedByFullscreen = busy
          console.log(`[wallpaper] fullscreen app ${busy ? 'detected, pausing' : 'gone, resuming'}`)
          this.emit()
        }
      }, 2000)
    } else if (!enabled && this.fullscreenTimer) {
      clearInterval(this.fullscreenTimer)
      this.fullscreenTimer = null
      this.pausedByFullscreen = false
    }
  }

  private destroyWindows(): void {
    if (this.windows.size === 0) return
    for (const win of this.windows.values()) win.destroy()
    this.windows.clear()
    refreshDesktop()
  }

  private rebuildWindows(): void {
    this.destroyWindows()
    for (const display of screen.getAllDisplays()) this.createWindow(display)
  }

  private createWindow(display: Display): void {
    const win = new BrowserWindow({
      ...display.bounds,
      show: false,
      frame: false,
      skipTaskbar: true,
      focusable: false,
      resizable: false,
      hasShadow: false,
      backgroundColor: '#0B0918',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        backgroundThrottling: false,
        sandbox: false
      }
    })
    win.setIgnoreMouseEvents(true)
    this.windows.set(display.id, win)

    win.once('ready-to-show', () => {
      win.showInactive()
      const rect = screen.dipToScreenRect(null, display.bounds)
      const hwnd = hwndFromBuffer(win.getNativeWindowHandle())
      this.attachMode = attachToDesktop(hwnd, rect)
      console.log(`[wallpaper] display ${display.id} attached via ${this.attachMode}`, rect)
      // Explorer finishes its own z-order shuffling shortly after; nudge DWM once more.
      for (const ms of [300, 1500]) {
        setTimeout(() => !win.isDestroyed() && refreshLayered(hwnd), ms)
      }
      this.emit()
    })

    const url = process.env['ELECTRON_RENDERER_URL']
    if (url) win.loadURL(`${url}/wallpaper.html`)
    else win.loadFile(join(__dirname, '../renderer/wallpaper.html'))
  }
}
