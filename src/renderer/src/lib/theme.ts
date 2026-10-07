import { useSyncExternalStore } from 'react'
import { load, save } from './store'

// Colour themes. Every colour in the UI comes from these few tokens: CSS reads them as
// --color-* variables (index.css derives the borders, glows and tints from them), and the canvas
// art (dithered covers, vinyl, spectrum) reads the same values through palette() / accent().

export type ThemeId = 'crt' | 'amber' | 'green' | 'gameboy' | 'vapor' | 'ice' | 'cassette'

interface Theme {
  bg: string
  panel: string
  panel2: string
  /** Darkest lit shade, used by the canvas art between bg and purple. */
  deep: string
  ph: string
  phBright: string
  phDim: string
  phFaint: string
  /** Filled accents (active buttons). */
  purple: string
  /** Lines, sliders, highlights. */
  violet: string
  /** "Hot": live badges, errors, peaks. */
  magenta: string
  /** "Cool": OK badges, prompts, values. */
  cyan: string
}

export const THEMES: Record<ThemeId, Theme> = {
  // The original purple phosphor.
  crt: {
    bg: '#07060f', panel: '#0d0a1c', panel2: '#151030', deep: '#2a1a5c',
    ph: '#c9a8ff', phBright: '#f4ecff', phDim: '#8a76b8', phFaint: '#4a3f6e',
    purple: '#7142cf', violet: '#9d6bff', magenta: '#ff4fd8', cyan: '#3df5ff'
  },
  // Amber monochrome monitor (IBM 5151 / Wyse).
  amber: {
    bg: '#0c0802', panel: '#150e05', panel2: '#20160a', deep: '#3a2208',
    ph: '#ffb547', phBright: '#fff0d4', phDim: '#b8823d', phFaint: '#5c3f1c',
    purple: '#8a4b12', violet: '#ff9f2e', magenta: '#ff5f45', cyan: '#ffe08a'
  },
  // P1 green phosphor terminal.
  green: {
    bg: '#030a05', panel: '#07130b', panel2: '#0c1f12', deep: '#0f3a1d',
    ph: '#7dff9a', phBright: '#e4ffe9', phDim: '#4aa862', phFaint: '#1f4a2b',
    purple: '#1d6b34', violet: '#3ee06a', magenta: '#ffcf4d', cyan: '#b4ffd9'
  },
  // The four-shade olive LCD of the original handheld.
  gameboy: {
    bg: '#0b1a0b', panel: '#102610', panel2: '#163316', deep: '#1c3f1c',
    ph: '#9bbc0f', phBright: '#e0f8d0', phDim: '#6f8f2a', phFaint: '#306230',
    purple: '#306230', violet: '#8bac0f', magenta: '#f8f8a0', cyan: '#c4e85a'
  },
  // Neon pink and cyan on deep violet.
  vapor: {
    bg: '#0d0618', panel: '#170a2a', panel2: '#22103c', deep: '#3a1253',
    ph: '#ff8ee6', phBright: '#fff1fb', phDim: '#b46fb0', phFaint: '#5b2d63',
    purple: '#6a2bd9', violet: '#ff6ad5', magenta: '#fffa8a', cyan: '#41f0ff'
  },
  // Blue mainframe terminal (IBM 3270).
  ice: {
    bg: '#030914', panel: '#071326', panel2: '#0c1d38', deep: '#10284d',
    ph: '#8cc8ff', phBright: '#eaf5ff', phDim: '#5784b3', phFaint: '#233c5e',
    purple: '#1c4f99', violet: '#4aa3ff', magenta: '#ff7aa8', cyan: '#7dffe0'
  },
  // Warm 70s tape deck: rust, orange and teal.
  cassette: {
    bg: '#120807', panel: '#1d0d0a', panel2: '#2a1410', deep: '#45180f',
    ph: '#ffb199', phBright: '#fff0e8', phDim: '#c0775f', phFaint: '#5e2e24',
    purple: '#a3341f', violet: '#ff6b3d', magenta: '#ffd166', cyan: '#7fd6c2'
  }
}

export const THEME_IDS = Object.keys(THEMES) as ThemeId[]

const VARS: Record<keyof Theme, string> = {
  bg: '--color-crt-bg',
  panel: '--color-crt-panel',
  panel2: '--color-crt-panel-2',
  deep: '--color-crt-deep',
  ph: '--color-ph',
  phBright: '--color-ph-bright',
  phDim: '--color-ph-dim',
  phFaint: '--color-ph-faint',
  purple: '--color-purple',
  violet: '--color-violet',
  magenta: '--color-magenta',
  cyan: '--color-cyan'
}

const rgbOf = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]

let current: ThemeId = 'crt'
const listeners = new Set<() => void>()

/** Dark → bright ramp for the canvas art (dithered covers, vinyl, spectrum). */
export const palette = (): [number, number, number][] => {
  const th = THEMES[current]
  return [th.bg, th.deep, th.purple, th.ph, th.phBright].map(rgbOf)
}
export const accent = (key: 'magenta' | 'cyan' | 'violet', alpha = 1): string => `rgba(${rgbOf(THEMES[current][key]).join(',')},${alpha})`

export function applyTheme(id: ThemeId): void {
  current = THEMES[id] ? id : 'crt'
  const root = document.documentElement.style
  for (const [key, name] of Object.entries(VARS)) root.setProperty(name, THEMES[current][key as keyof Theme])
  document.documentElement.dataset.theme = current
  save('theme', { id: current })
  for (const fn of listeners) fn()
}

/** Apply the saved theme before the first render (no flash of the default colours). */
export const initTheme = (): void => applyTheme(load('theme', { id: 'crt' as ThemeId }).id)

/** Current theme; re-renders when it changes (canvas art redraws on it). */
export function useTheme(): ThemeId {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => current
  )
}
