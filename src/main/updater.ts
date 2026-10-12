import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import type { UpdateStatus } from '../shared/types'

// Update flow: check GitHub Releases at start and every few hours; when a newer version exists,
// tell the user (in-app prompt, plus a Windows notification when the app sits in the tray) and
// only download once they agree. A downloaded update installs on "restart now" or on quit.

const CHECK_EVERY = 6 * 3600_000

let status: UpdateStatus = { state: 'idle' }

/** Release notes come as HTML from GitHub; the prompt shows them as plain text. */
function notesText(info: UpdateInfo): string {
  const raw = typeof info.releaseNotes === 'string' ? info.releaseNotes : (info.releaseNotes ?? []).map((n) => n.note ?? '').join('\n')
  return raw
    .replace(/<\/(p|li|h\d)>|<br\s*\/?>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function setupUpdater(getWindow: () => BrowserWindow | null, onInstall: () => void): void {
  const set = (next: UpdateStatus): void => {
    status = next
    getWindow()?.webContents.send('update:status', status)
  }

  ipcMain.handle('update:get', () => status)
  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged && process.env.CHILL_TEST_UPDATES !== '1') return set({ state: 'dev' }), status
    await autoUpdater.checkForUpdates().catch((err: Error) => set({ state: 'error', message: err.message }))
    return status
  })
  ipcMain.on('update:download', () => {
    if (status.state !== 'available') return
    set({ ...status, state: 'downloading', percent: 0 })
    autoUpdater.downloadUpdate().catch((err: Error) => set({ state: 'error', message: err.message }))
  })
  ipcMain.on('update:install', () => {
    onInstall()
    autoUpdater.quitAndInstall()
  })

  // CHILL_TEST_UPDATES=1 lets a dev build check GitHub (with dev-app-update.yml) to try the prompt.
  const testing = !app.isPackaged && process.env.CHILL_TEST_UPDATES === '1'
  if (!app.isPackaged && !testing) return
  autoUpdater.forceDevUpdateConfig = testing

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => {
    // keep a found / downloading / ready update visible while re-checking
    if (status.state === 'idle' || status.state === 'latest' || status.state === 'error') set({ state: 'checking' })
  })
  autoUpdater.on('update-not-available', () => set({ state: 'latest' }))
  autoUpdater.on('update-available', (info) => {
    if (status.state === 'downloading' || status.state === 'ready') return
    set({ state: 'available', version: info.version, notes: notesText(info), date: info.releaseDate })
    const win = getWindow()
    if (Notification.isSupported() && (!win || !win.isVisible())) {
      const n = new Notification({ title: 'Chill Lounge', body: `Chill Lounge ${info.version} is available — click to update.` })
      n.on('click', () => {
        win?.show()
        win?.focus()
      })
      n.show()
    }
  })
  autoUpdater.on('download-progress', (p) => {
    if (status.state === 'downloading') set({ ...status, percent: Math.round(p.percent) })
  })
  autoUpdater.on('update-downloaded', (info) => set({ state: 'ready', version: info.version, notes: 'notes' in status ? status.notes : notesText(info) }))
  autoUpdater.on('error', (err) => {
    console.warn('[updater]', err.message)
    if (status.state === 'downloading' || status.state === 'checking') set({ state: 'error', message: err.message })
  })

  const check = (): void => void autoUpdater.checkForUpdates().catch(() => {})
  setTimeout(check, 5000)
  setInterval(check, CHECK_EVERY)
}
