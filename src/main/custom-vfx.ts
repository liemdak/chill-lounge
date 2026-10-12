import { app, dialog, type BrowserWindow } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { CUSTOM_VFX_EXT, CUSTOM_VFX_MAX_MB, type CustomVfx } from '../shared/types'

// User-uploaded effects. Only images and videos (rendered by the browser engine like any
// wallpaper) — no scripts, shaders or animation formats that run code — so a bad file can at worst
// fail to show. Files are copied into the app's data folder and capped in size.

const dir = (): string => join(app.getPath('userData'), 'vfx')

const DEFAULTS: Omit<CustomVfx, 'kind' | 'file' | 'name'> = {
  motion: 'fall',
  amount: 40,
  size: 28,
  speed: 35,
  spin: true,
  opacity: 80,
  blend: 'normal'
}

/** Ask for a file, check it, keep a copy. Resolves null if the user cancels. */
export async function importCustomVfx(parent: BrowserWindow | null, kind: CustomVfx['kind'], title: string): Promise<CustomVfx | null> {
  const exts = CUSTOM_VFX_EXT[kind] as readonly string[]
  const res = await dialog.showOpenDialog(parent!, { title, properties: ['openFile'], filters: [{ name: exts.join(' / ').toUpperCase(), extensions: [...exts] }] })
  const src = res.filePaths[0]
  if (res.canceled || !src) return null

  const ext = extname(src).slice(1).toLowerCase()
  if (!exts.includes(ext)) throw new Error('vfx-type')
  if (statSync(src).size > CUSTOM_VFX_MAX_MB[kind] * 1024 * 1024) throw new Error('vfx-too-big')

  mkdirSync(dir(), { recursive: true })
  const file = join(dir(), `${Date.now()}-${basename(src).replace(/[^\w.-]+/g, '_')}`)
  copyFileSync(src, file)
  cleanCustomVfx(file)
  const video = ext === 'webm' || ext === 'mp4'
  // Effect videos are usually drawn on black: let the black drop out by default.
  return { ...DEFAULTS, kind, file, name: basename(src), blend: video ? 'screen' : 'normal' }
}

/** Delete copies no longer in use (the wallpaper windows may still hold one; that's retried later). */
export function cleanCustomVfx(keep: string | null | undefined): void {
  if (!existsSync(dir())) return
  for (const f of readdirSync(dir())) {
    const p = join(dir(), f)
    if (p === keep) continue
    try {
      rmSync(p, { force: true })
    } catch {
      /* in use */
    }
  }
}
