import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, screen, Tray } from 'electron'
import { join } from 'node:path'
import { AUDIO_EXT, IMAGE_EXT, VIDEO_EXT, type FitMode, type WallpaperEffects } from '../shared/types'
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
    mainWindow?.hide()
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
    const paused = wallpaper.getState().paused
    tray?.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Mở Chill Lounge', click: showMainWindow },
        { label: paused ? 'Tiếp tục wallpaper' : 'Tạm dừng wallpaper', click: () => wallpaper.togglePause() },
        { type: 'separator' },
        { label: 'Thoát', click: () => app.quit() }
      ])
    )
  }
  rebuildMenu()
  wallpaper.onChange(rebuildMenu)
  tray.on('click', showMainWindow)
}

function registerIpc(): void {
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:toggleMaximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())

  ipcMain.handle('media:readTags', (_e, paths: string[]) => Promise.all(paths.map(readTrackInfo)))

  ipcMain.handle('dialog:pickWallpaper', async () => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: 'Chọn ảnh hoặc video làm wallpaper',
      properties: ['openFile'],
      filters: [{ name: 'Ảnh / Video', extensions: [...IMAGE_EXT, ...VIDEO_EXT] }]
    })
    return res.canceled ? null : res.filePaths[0]
  })
  ipcMain.handle('dialog:pickAudio', async () => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: 'Chọn bài hát',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Nhạc / Video', extensions: [...AUDIO_EXT, ...VIDEO_EXT] }]
    })
    return res.canceled ? [] : res.filePaths
  })

  ipcMain.handle('wallpaper:getState', () => wallpaper.getState())
  ipcMain.handle('wallpaper:apply', (_e, path: string) => wallpaper.apply(path))
  ipcMain.handle('wallpaper:clear', () => wallpaper.clear())
  ipcMain.handle('wallpaper:setFit', (_e, fit: FitMode) => wallpaper.setFit(fit))
  ipcMain.handle('wallpaper:setAutoPause', (_e, v: boolean) => wallpaper.setAutoPause(v))
  ipcMain.handle('wallpaper:togglePause', () => wallpaper.togglePause())
  ipcMain.handle('wallpaper:setEffects', (_e, patch: Partial<WallpaperEffects>) => wallpaper.setEffects(patch))
  ipcMain.handle('wallpaper:forget', (_e, path: string) => wallpaper.forget(path))

  ipcMain.handle('settings:getVolume', () => loadSettings().volume)
  ipcMain.on('settings:setVolume', (_e, v: number) => saveSettings({ volume: v }))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showMainWindow)

  app.whenReady().then(() => {
    app.setAppUserModelId('com.chill-lounge.app')
    handleMediaProtocol()
    wallpaper = new WallpaperManager()
    wallpaper.onChange((state) => mainWindow?.webContents.send('wallpaper:state', state))
    registerIpc()
    createMainWindow()
    createTray()
    wallpaper.restore()
  })

  app.on('before-quit', () => {
    quitting = true
    wallpaper?.dispose()
  })

  // Stay alive in the tray when the main window is hidden.
  app.on('window-all-closed', () => {})
}
