// Small localStorage helpers for per-machine UI state (queue, EQ, prefs).
// Storage can throw or be empty; callers always get the fallback in that case.

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`lounge:${key}`)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export function loadArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(`lounge:${key}`)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(`lounge:${key}`, JSON.stringify(value))
  } catch {
    /* storage unavailable — fine, it's only a convenience */
  }
}

export const fmtTime = (s: number): string =>
  Number.isFinite(s) && s > 0 ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '00:00'
