// Line icons for the non-retro skins (the retro skin keeps its text glyphs like [≡] and |◀◀).
// Inline SVG paths drawn with currentColor: nothing to load, tiny, crisp at any scale.

const PATHS = {
  play: 'M7 4.5v15l12.5-7.5z',
  pause: 'M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z',
  prev: 'M19.5 19.5 9.5 12l10-7.5zM4.5 4.5H7v15H4.5z',
  next: 'M4.5 4.5 14.5 12l-10 7.5zM17 4.5h2.5v15H17z',
  shuffle: 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  expand: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3',
  volume: 'M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9.5 9.5 0 0 1 0 13',
  mute: 'M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.6 1-1.1a5.5 5.5 0 0 0 0-7.7z',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  library: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  youtube: 'M2.5 7.1a2.8 2.8 0 0 1 2-2C6.3 4.6 12 4.6 12 4.6s5.7 0 7.5.5a2.8 2.8 0 0 1 2 2c.5 1.8.5 4.9.5 4.9s0 3.1-.5 4.9a2.8 2.8 0 0 1-2 2c-1.8.5-7.5.5-7.5.5s-5.7 0-7.5-.5a2.8 2.8 0 0 1-2-2C2 15.1 2 12 2 12s0-3.1.5-4.9zM10 15l5-3-5-3z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  image: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  minimize: 'M5 12h14',
  maximize: 'M5 5h14v14H5z',
  close: 'M6 6l12 12M18 6 6 18'
} as const

export type IconName = keyof typeof PATHS
const FILLED: IconName[] = ['play', 'pause', 'prev', 'next']

export function Icon({ name, size = 18, filled, className = '' }: { name: IconName; size?: number; filled?: boolean; className?: string }) {
  const fill = filled ?? FILLED.includes(name)
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`icon shrink-0 ${className}`}
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={fill ? 0 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
