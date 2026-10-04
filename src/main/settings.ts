import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Settings } from '../shared/types'

const DEFAULTS: Settings = {
  wallpaper: {
    source: null,
    desktop: null,
    restoreOnLaunch: false,
    fit: 'cover',
    autoPause: true,
    effects: {
      rain: 0,
      snow: 0,
      fireflies: 0,
      stars: 0,
      glyphs: 0,
      petals: 0,
      fog: 0,
      vhs: 0,
      brightness: 100,
      scanlines: false,
      reactive: false
    },
    history: []
  },
  volume: 0.7,
  language: 'vi',
  downloadDir: null
}

const file = (): string => join(app.getPath('userData'), 'settings.json')

let cache: Settings | null = null

export function loadSettings(): Settings {
  if (cache) return cache
  try {
    const raw = existsSync(file()) ? JSON.parse(readFileSync(file(), 'utf8')) : {}
    const wp = { ...DEFAULTS.wallpaper, ...raw.wallpaper }
    // v0.2 put the chosen media straight on the desktop; from v0.3 that needs explicit consent.
    if (raw.wallpaper && !('desktop' in raw.wallpaper)) wp.desktop = null
    wp.effects = { ...DEFAULTS.wallpaper.effects, ...raw.wallpaper?.effects }
    cache = { ...DEFAULTS, ...raw, wallpaper: wp }
  } catch {
    cache = structuredClone(DEFAULTS)
  }
  return cache!
}

export function saveSettings(patch: Partial<Settings>): Settings {
  cache = { ...loadSettings(), ...patch }
  writeFileSync(file(), JSON.stringify(cache, null, 2))
  return cache
}
