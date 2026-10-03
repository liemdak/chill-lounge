import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, screen, Tray } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'node:path'
import { AUDIO_EXT, IMAGE_EXT, VIDEO_EXT, type FitMode, type Lang, type WallpaperEffects } from '../shared/types'
import { handleMediaProtocol, registerMediaScheme } from './media-protocol'
import { loadSettings, saveSettings } from './settings'
import { readTrackInfo } from './tags'
import { WallpaperManager } from './wallpaper/manager'

// Chromium throttles windows it thinks are covered; wallpaper windows always are.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

registerMediaScheme()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let wallpaper: WallpaperManager
let quitting = false

const ICON = join(__dirname, '../../resources/icon.png')

/** The few strings the main process shows itself (tray menu, file dialogs). */
const STRINGS = {
  vi: {
    open: 'Mở Chill Lounge',
    pauseWp: 'Tạm dừng hình nền desktop',
    resumeWp: 'Tiếp tục hình nền desktop',
    removeWp: 'Gỡ hình nền khỏi desktop',
    quit: 'Thoát',
    pickWallpaper: 'Chọn ảnh hoặc video',
    media: 'Ảnh / Video',
    pickAudio: 'Chọn bài hát',
    audio: 'Nhạc / Video'
  },
  en: {
    open: 'Open Chill Lounge',
    pauseWp: 'Pause desktop wallpaper',
    resumeWp: 'Resume desktop wallpaper',
    removeWp: 'Remove wallpaper from desktop',
    quit: 'Quit',
    pickWallpaper: 'Choose an image or video',
    media: 'Images / Videos',
    pickAudio: 'Choose songs',
    audio: 'Music / Video'
  }
} satisfies Record<Lang, Record<string, string>>

const tr = (): (typeof STRINGS)['vi'] => STRINGS[loadSettings().language] ?? STRINGS.vi

function createMainWindow(): void {
  // Fit the work area: at 150% scaling a 1080p screen is only 1280×720 DIP.
  const area = screen.getPrimaryDisplay().workAreaSize
  mainWindow = new BrowserWindow({
    width: Math.min(1280, Math.round(area.width * 0.94)),
    height: Math.min(820, Math.round(area.height * 0.94)),
    minWidth: Math.min(1040, area.width),
    minHeight: Math.min(600, area.height),
    frame: false,
    backgroundColor: '#0B0918',
    title: 'Chill Lounge',
    icon: ICON,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    mainWindow?.setFullScreen(false)
    mainWindow?.hide()
  })
  mainWindow.on('enter-full-screen', () => mainWindow?.webContents.send('window:fullscreen', true))
  mainWindow.on('leave-full-screen', () => mainWindow?.webContents.send('window:fullscreen', false))
  // Chromium swallows the Esc keyDown while the window is fullscreen (only the keyUp gets
  // through), so the page never sees it. Leave fullscreen on either.
  mainWindow.webContents.on('before-input-event', (e, input) => {
    if (input.key === 'Escape' && mainWindow?.isFullScreen()) {
      e.preventDefault()
      mainWindow.setFullScreen(false)
    }
  })

  const url = process.env['ELECTRON_RENDERER_URL']
  if (url) mainWindow.loadURL(url)
  else mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

function showMainWindow(): void {
  if (!mainWindow) return
  mainWindow.show()
  mainWindow.focus()
}

function createTray(): void {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }))
  tray.setToolTip('Chill Lounge')
  const rebuildMenu = (): void => {
    const s = tr()
    const state = wallpaper.getState()
    tray?.setContextMenu(
      Menu.buildFromTemplate([
        { label: s.open, click: showMainWindow },
        { type: 'separator' },
        { label: state.paused ? s.resumeWp : s.pauseWp, enabled: !!state.desktop, click: () => wallpaper.togglePause() },
        { label: s.removeWp, enabled: !!state.desktop, click: () => wallpaper.setDesktop(null) },
        { type: 'separator' },
        { label: s.quit, click: () => app.quit() }
      ])
    )
  }
  rebuildMenu()
  wallpaper.onChange(rebuildMenu)
  ipcMain.on('app:languageChanged', rebuildMenu)
  tray.on('click', showMainWindow)
}

/** Check GitHub Releases for a newer build; download in the background, install on quit. */
function setupUpdater(): void {
  if (!app.isPackaged) return
  const send = (status: string, version?: string): void => mainWindow?.webContents.send('update:status', { status, version })
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-available', (info) => send('downloading', info.version))
  autoUpdater.on('update-downloaded', (info) => send('ready', info.version))
  autoUpdater.on('error', (err) => console.warn('[updater]', err.message))
  ipcMain.on('update:install', () => {
    quitting = true
    autoUpdater.quitAndInstall()
  })
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000)
}

function registerIpc(): void {
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:toggleMaximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window:setFullScreen', (_e, on: boolean) => mainWindow?.setFullScreen(on))
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.handle('media:readTags', (_e, paths: string[]) => Promise.all(paths.map(readTrackInfo)))

  ipcMain.handle('dialog:pickWallpaper', async () => {
    const s = tr()
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: s.pickWallpaper,
      properties: ['openFile'],
      filters: [{ name: s.media, extensions: [...IMAGE_EXT, ...VIDEO_EXT] }]
    })
    return res.canceled ? null : res.filePaths[0]
  })
  ipcMain.handle('dialog:pickAudio', async () => {
    const s = tr()
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: s.pickAudio,
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: s.audio, extensions: [...AUDIO_EXT, ...VIDEO_EXT] }]
    })
    return res.canceled ? [] : res.filePaths
  })

  ipcMain.handle('wallpaper:getState', () => wallpaper.getState())
  ipcMain.handle('wallpaper:select', (_e, path: string | null) => wallpaper.select(path))
  ipcMain.handle('wallpaper:setDesktop', (_e, path: string | null, restore?: boolean) => wallpaper.setDesktop(path, restore))
  ipcMain.handle('wallpaper:setRestoreOnLaunch', (_e, v: boolean) => wallpaper.setRestoreOnLaunch(v))
  ipcMain.handle('wallpaper:setFit', (_e, fit: FitMode) => wallpaper.setFit(fit))
  ipcMain.handle('wallpaper:setAutoPause', (_e, v: boolean) => wallpaper.setAutoPause(v))
  ipcMain.handle('wallpaper:togglePause', () => wallpaper.togglePause())
  ipcMain.handle('wallpaper:setEffects', (_e, patch: Partial<WallpaperEffects>) => wallpaper.setEffects(patch))
  ipcMain.handle('wallpaper:forget', (_e, path: string) => wallpaper.forget(path))
  ipcMain.on('vfx:beat', (_e, v: number) => wallpaper.broadcast('vfx:beat', v))

  ipcMain.handle('settings:getVolume', () => loadSettings().volume)
  ipcMain.on('settings:setVolume', (_e, v: number) => saveSettings({ volume: v }))
  ipcMain.handle('settings:getLanguage', () => loadSettings().language)
  ipcMain.on('settings:setLanguage', (e, lang: Lang) => {
    saveSettings({ language: lang })
    ipcMain.emit('app:languageChanged', e)
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showMainWindow)

  app.whenReady().then(() => {
    app.setAppUserModelId('com.liemdak.chill-lounge')
    handleMediaProtocol()
    wallpaper = new WallpaperManager()
    wallpaper.onChange((state) => mainWindow?.webContents.send('wallpaper:state', state))
    registerIpc()
    createMainWindow()
    createTray()
    wallpaper.restore()
    setupUpdater()
  })

  app.on('before-quit', () => {
    quitting = true
    wallpaper?.dispose()
  })

  // Stay alive in the tray when the main window is hidden.
  app.on('window-all-closed', () => {})
}
