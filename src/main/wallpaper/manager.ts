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
type WallpaperSettings = ReturnType<typeof loadSettings>['wallpaper']

export function sourceFromPath(path: string): WallpaperSource {
  const ext = extname(path).slice(1).toLowerCase()
  return { path, kind: IMAGE_EXT.includes(ext) ? 'image' : 'video' }
}

/**
 * Two separate things live here:
 * - `source`: media chosen in the app, used as Chill Lounge's own background. Choosing it never
 *   touches Windows.
 * - `desktop`: media placed behind the desktop icons. Only set after the user confirms in the UI,
 *   and only restored on launch if they opted in.
 */
export class WallpaperManager {
  private windows = new Map<number, BrowserWindow>()
  private listeners = new Set<Listener>()
  private fullscreenTimer: NodeJS.Timeout | null = null
  private rebuildTimer: NodeJS.Timeout | null = null
  private pausedByUser = false
  private pausedByFullscreen = false
  private attachMode: WallpaperState['attachMode'] = null

  constructor() {
    // Debounced, and only for real geometry changes: work-area changes (taskbar auto-hide,
    // docking) used to tear the wallpaper windows down and rebuild them, which flickered.
    const rebuild = (): void => {
      if (this.rebuildTimer) clearTimeout(this.rebuildTimer)
      this.rebuildTimer = setTimeout(() => {
        if (this.wp.desktop) this.rebuildWindows()
      }, 600)
    }
    screen.on('display-added', rebuild)
    screen.on('display-removed', rebuild)
    screen.on('display-metrics-changed', (_e, _display, changed) => {
      if (changed.includes('bounds') || changed.includes('scaleFactor') || changed.includes('rotation')) rebuild()
    })
  }

  private get wp(): WallpaperSettings {
    return loadSettings().wallpaper
  }

  private save(patch: Partial<WallpaperSettings>): void {
    saveSettings({ wallpaper: { ...this.wp, ...patch } })
  }

  getState(): WallpaperState {
    const wp = this.wp
    return {
      source: wp.source,
      desktop: wp.desktop,
      restoreOnLaunch: wp.restoreOnLaunch,
      fit: wp.fit,
      autoPause: wp.autoPause,
      paused: this.pausedByUser || this.pausedByFullscreen,
      effects: wp.effects,
      history: wp.history,
      attachMode: this.attachMode,
      displays: this.windows.size
    }
  }

  /** Send something to every desktop wallpaper window (e.g. the music beat). */
  broadcast(channel: string, value: unknown): void {
    for (const win of this.windows.values()) if (!win.isDestroyed()) win.webContents.send(channel, value)
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): WallpaperState {
    const state = this.getState()
    for (const win of this.windows.values()) win.webContents.send('wallpaper:state', state)
    for (const fn of this.listeners) fn(state)
    return state
  }

  /** On launch the desktop wallpaper only comes back if the user asked for that. */
  restore(): void {
    if (this.wp.desktop && this.wp.restoreOnLaunch) this.rebuildWindows()
    else if (this.wp.desktop) this.save({ desktop: null })
    this.syncFullscreenWatcher()
  }

  /** Choose media for the in-app background. Never changes the Windows desktop. */
  select(path: string | null): WallpaperState {
    if (!path) {
      this.save({ source: null })
      return this.emit()
    }
    const source = sourceFromPath(path)
    this.save({ source, history: [source, ...this.wp.history.filter((s) => s.path !== path)].slice(0, 12) })
    return this.emit()
  }

  /** Put media on the desktop (the renderer asks for confirmation first), or remove it with null. */
  setDesktop(path: string | null, restoreOnLaunch?: boolean): WallpaperState {
    if (!path) {
      this.save({ desktop: null })
      this.destroyWindows()
      this.attachMode = null
      this.pausedByUser = false
      return this.emit()
    }
    const desktop = sourceFromPath(path)
    this.save({
      desktop,
      restoreOnLaunch: restoreOnLaunch ?? this.wp.restoreOnLaunch,
      history: [desktop, ...this.wp.history.filter((s) => s.path !== path)].slice(0, 12)
    })
    this.rebuildWindows()
    return this.emit()
  }

  setRestoreOnLaunch(v: boolean): WallpaperState {
    this.save({ restoreOnLaunch: v })
    return this.emit()
  }

  setFit(fit: FitMode): WallpaperState {
    this.save({ fit })
    return this.emit()
  }

  setEffects(patch: Partial<WallpaperEffects>): WallpaperState {
    this.save({ effects: { ...this.wp.effects, ...patch } })
    return this.emit()
  }

  forget(path: string): WallpaperState {
    this.save({ history: this.wp.history.filter((s) => s.path !== path) })
    return this.emit()
  }

  setAutoPause(autoPause: boolean): WallpaperState {
    this.save({ autoPause })
    this.syncFullscreenWatcher()
    return this.emit()
  }

  togglePause(): WallpaperState {
    this.pausedByUser = !this.pausedByUser
    return this.emit()
  }

  dispose(): void {
    if (this.fullscreenTimer) clearInterval(this.fullscreenTimer)
    this.destroyWindows()
  }

  private syncFullscreenWatcher(): void {
    const enabled = this.wp.autoPause
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
    const query = { query: { role: 'desktop' } }
    if (url) win.loadURL(`${url}/wallpaper.html?role=desktop`)
    else win.loadFile(join(__dirname, '../renderer/wallpaper.html'), query)
  }
}
