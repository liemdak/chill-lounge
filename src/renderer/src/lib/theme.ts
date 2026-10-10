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

// Skins change the whole look — shapes, fonts, window chrome, icons — not just the colours.
// "retro" is the CRT terminal and takes any colour theme above; the others bring their own
// palette (Glass follows Windows' light / dark mode). Skins are CSS-only ([data-skin] rules in
// index.css) plus system or bundled fonts, so switching costs no memory.
export type SkinId = 'retro' | 'glass' | 'anime' | 'win98' | 'win11'
export const SKIN_IDS: SkinId[] = ['retro', 'glass', 'anime', 'win98', 'win11']

export const SKIN_THEMES: Record<'glassLight' | 'glassDark' | 'anime' | 'win98' | 'win11', Theme> = {
  glassLight: {
    bg: '#f2f2f7', panel: '#ffffff', panel2: '#f7f7fa', deep: '#d8d8e0',
    ph: '#1d1d1f', phBright: '#000000', phDim: '#6e6e73', phFaint: '#c7c7cc',
    purple: '#007aff', violet: '#007aff', magenta: '#ff2d55', cyan: '#34c759'
  },
  glassDark: {
    bg: '#0f0f13', panel: '#1c1c22', panel2: '#26262e', deep: '#2c2c3a',
    ph: '#ececf1', phBright: '#ffffff', phDim: '#a1a1aa', phFaint: '#55555f',
    purple: '#0a84ff', violet: '#0a84ff', magenta: '#ff375f', cyan: '#30d158'
  },
  // Pastel lo-fi: cream pink paper, lavender ink, sakura accents.
  anime: {
    bg: '#fff5fa', panel: '#ffffff', panel2: '#fff0f7', deep: '#ffd6e8',
    ph: '#5b4b8a', phBright: '#3a2d66', phDim: '#9a8fc0', phFaint: '#e3d9f5',
    purple: '#ff8fc7', violet: '#b18cff', magenta: '#ff5fa2', cyan: '#3fb6f0'
  },
  win98: {
    bg: '#c0c0c0', panel: '#c0c0c0', panel2: '#dfdfdf', deep: '#808080',
    ph: '#000000', phBright: '#000000', phDim: '#3c3c3c', phFaint: '#808080',
    purple: '#000080', violet: '#000080', magenta: '#c00000', cyan: '#007000'
  },
  win11: {
    bg: '#1f1f1f', panel: '#2b2b2b', panel2: '#323232', deep: '#3a3a3a',
    ph: '#ffffff', phBright: '#ffffff', phDim: '#c5c5c5', phFaint: '#5d5d5d',
    purple: '#4cc2ff', violet: '#4cc2ff', magenta: '#ff99a4', cyan: '#6ccb5f'
  }
}

let current: ThemeId = 'crt'
let skin: SkinId = 'retro'
const darkQuery = matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

/** The colours in use: the retro colour theme, or the skin's own palette. */
function tokens(): Theme {
  if (skin === 'retro') return THEMES[current]
  if (skin === 'glass') return darkQuery.matches ? SKIN_THEMES.glassDark : SKIN_THEMES.glassLight
  return SKIN_THEMES[skin]
}

/** Dark → bright ramp for the canvas art (dithered covers, vinyl, spectrum). */
export const palette = (): [number, number, number][] => {
  const th = tokens()
  return [th.bg, th.deep, th.purple, th.ph, th.phBright].map(rgbOf)
}
export const accent = (key: 'magenta' | 'cyan' | 'violet', alpha = 1): string => `rgba(${rgbOf(tokens()[key]).join(',')},${alpha})`

function apply(): void {
  const root = document.documentElement
  const th = tokens()
  for (const [key, name] of Object.entries(VARS)) root.style.setProperty(name, th[key as keyof Theme])
  root.dataset.theme = current
  root.dataset.skin = skin
  root.dataset.scheme = skin === 'glass' ? (darkQuery.matches ? 'dark' : 'light') : ''
  save('theme', { id: current, skin })
  for (const fn of listeners) fn()
}

/** Colour theme of the retro skin. */
export function applyTheme(id: ThemeId): void {
  current = THEMES[id] ? id : 'crt'
  apply()
}

export function applySkin(id: SkinId): void {
  skin = SKIN_IDS.includes(id) ? id : 'retro'
  apply()
}

/** Apply the saved look before the first render (no flash of the default colours). */
export function initTheme(): void {
  const saved = load('theme', { id: 'crt' as ThemeId, skin: 'retro' as SkinId })
  current = THEMES[saved.id] ? saved.id : 'crt'
  skin = SKIN_IDS.includes(saved.skin) ? saved.skin : 'retro'
  apply()
  darkQuery.addEventListener('change', () => skin === 'glass' && apply())
}

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Changes with any colour change (theme, skin, light / dark): canvas art redraws on it. */
export function useTheme(): string {
  return useSyncExternalStore(subscribe, () => `${skin}/${current}/${darkQuery.matches}`)
}

export const useColorTheme = (): ThemeId => useSyncExternalStore(subscribe, () => current)
export const useSkin = (): SkinId => useSyncExternalStore(subscribe, () => skin)
