import { app, BrowserWindow, dialog, session, type Cookie } from 'electron'
import { copyFileSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Optional YouTube sign-in. When YouTube flags a network ("Sign in to confirm you're not a bot")
// every signed-out request fails — yt-dlp, the official embed and even youtube.com in a browser.
// A signed-in session gets through, so the person can sign in here (or import a cookies.txt).
//
// Only cookies are kept, in a Netscape cookies.txt that yt-dlp reads with --cookies. The sign-in
// window uses a throwaway in-memory session that is never used again, which is what yt-dlp
// recommends: a browser that keeps using the same session rotates the cookies and breaks the file.

const cookiesFile = (): string => join(app.getPath('userData'), 'youtube-cookies.txt')

const SIGN_IN_URL =
  'https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=' +
  encodeURIComponent('https://www.youtube.com/signin?action_handle_signin=true&app=desktop&next=https%3A%2F%2Fwww.youtube.com%2F')

// Cookies that only exist once signed in.
const AUTH_COOKIES = ['SAPISID', '__Secure-3PAPISID', 'LOGIN_INFO']

let listener: ((signedIn: boolean) => void) | null = null
export function onAuthChange(fn: (signedIn: boolean) => void): void {
  listener = fn
}

export const isSignedIn = (): boolean => existsSync(cookiesFile())

// Signed-in calls are slower (YouTube serves account clients more checks) and wear on the
// account, so cookies are only used once YouTube has asked for a sign-in, for a while after.
const PREFER_MS = 30 * 60_000
let preferUntil = 0
/** Whether the next yt-dlp call should go straight to the signed-in session. */
export const cookiesPreferred = (): boolean => isSignedIn() && Date.now() < preferUntil
/** YouTube asked for a sign-in: use the session for the next half hour. */
export const preferCookies = (): void => void (preferUntil = Date.now() + PREFER_MS)

let seq = 0
/**
 * yt-dlp rewrites its cookie file when it exits (YouTube rotates some cookies), and several run at
 * once (a stream, a prefetch, a download). Each gets its own copy; a successful run's copy then
 * replaces the saved file, so the session stays fresh and never gets half-written.
 */
export function cookieCopy(): { args: string[]; done: (ok: boolean) => void } {
  if (!isSignedIn()) return { args: [], done: () => {} }
  const copy = join(app.getPath('temp'), `chill-lounge-cookies-${process.pid}-${++seq}.txt`)
  copyFileSync(cookiesFile(), copy)
  return {
    args: ['--cookies', copy],
    done: (ok) => {
      try {
        if (ok && isSignedIn()) renameSync(copy, cookiesFile())
        else rmSync(copy, { force: true })
      } catch {
        rmSync(copy, { force: true })
      }
    }
  }
}

function toNetscape(cookies: Cookie[]): string {
  const lines = ['# Netscape HTTP Cookie File', '# Written by Chill Lounge for yt-dlp. Do not share this file.', '']
  for (const c of cookies) {
    if (!c.domain) continue
    const sub = !c.hostOnly
    const domain = sub && !c.domain.startsWith('.') ? `.${c.domain}` : c.domain
    const expires = c.expirationDate ? Math.floor(c.expirationDate) : 0
    lines.push([(c.httpOnly ? '#HttpOnly_' : '') + domain, sub ? 'TRUE' : 'FALSE', c.path ?? '/', c.secure ? 'TRUE' : 'FALSE', expires, c.name, c.value].join('\t'))
  }
  return lines.join('\n') + '\n'
}

/**
 * Opens Google's sign-in page in its own window. Resolves true once the person is signed in to
 * YouTube (cookies saved), false if they closed the window.
 */
export function signIn(parent: BrowserWindow | null): Promise<boolean> {
  const ses = session.fromPartition(`yt-auth-${Date.now()}`)
  // Google refuses to sign in from browsers that identify as an embedded app.
  ses.setUserAgent(ses.getUserAgent().replace(/\s(Electron|chill-lounge|Chill Lounge)\/\S+/gi, ''))

  const win = new BrowserWindow({
    parent: parent ?? undefined,
    width: 500,
    height: 720,
    title: 'YouTube',
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: { session: ses, sandbox: true, contextIsolation: true }
  })
  // Popups (e.g. "use another account" help pages) open in the system browser instead.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  return new Promise((resolve) => {
    let done = false
    const finish = (ok: boolean): void => {
      if (done) return
      done = true
      if (!win.isDestroyed()) win.close()
      if (ok) listener?.(true)
      resolve(ok)
    }
    const check = async (): Promise<void> => {
      if (done || win.isDestroyed()) return
      const host = new URL(win.webContents.getURL() || 'about:blank').host
      if (!host.endsWith('youtube.com')) return
      const cookies = [...(await ses.cookies.get({ domain: 'youtube.com' })), ...(await ses.cookies.get({ domain: 'google.com' }))]
      if (!cookies.some((c) => AUTH_COOKIES.includes(c.name))) return
      writeFileSync(cookiesFile(), toNetscape(cookies), { mode: 0o600 })
      finish(true)
    }
    win.webContents.on('did-navigate', () => void check())
    win.webContents.on('did-finish-load', () => void check())
    win.on('closed', () => finish(false))
    win.loadURL(SIGN_IN_URL)
  })
}

export function signOut(): void {
  rmSync(cookiesFile(), { force: true })
  listener?.(false)
}

/** Use a cookies.txt exported from a browser (fallback when Google refuses the in-app sign-in). */
export async function importCookies(parent: BrowserWindow | null, title: string): Promise<boolean> {
  const res = await dialog.showOpenDialog(parent!, { title, properties: ['openFile'], filters: [{ name: 'cookies.txt', extensions: ['txt'] }] })
  const file = res.filePaths[0]
  if (res.canceled || !file) return false
  const text = readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/).filter((l) => /^(#HttpOnly_)?\.?([\w-]+\.)*youtube\.com\t/.test(l))
  if (!lines.length || !lines.some((l) => AUTH_COOKIES.some((n) => l.includes(`\t${n}\t`)))) throw new Error('not-signed-in-cookies')
  writeFileSync(cookiesFile(), text.startsWith('# Netscape') || text.startsWith('# HTTP Cookie File') ? text : `# Netscape HTTP Cookie File\n${text}`, { mode: 0o600 })
  listener?.(true)
  return true
}
