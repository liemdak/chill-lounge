import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Settings } from '../shared/types'

const DEFAULTS: Settings = {
  wallpaper: {
    source: null,
    fit: 'cover',
    autoPause: true,
    effects: { rain: 0, brightness: 100, scanlines: false },
    history: []
  },
  volume: 0.7
}

const file = (): string => join(app.getPath('userData'), 'settings.json')

let cache: Settings | null = null

export function loadSettings(): Settings {
  if (cache) return cache
  try {
    const raw = existsSync(file()) ? JSON.parse(readFileSync(file(), 'utf8')) : {}
    const wp = { ...DEFAULTS.wallpaper, ...raw.wallpaper }
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
