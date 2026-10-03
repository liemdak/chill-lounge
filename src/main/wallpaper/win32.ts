import koffi from 'koffi'

// Thin bindings over the handful of user32/shell32 calls needed to put a window
// behind the desktop icons. Handles are passed around as bigint (intptr_t).

const user32 = koffi.load('user32.dll')
const shell32 = koffi.load('shell32.dll')

koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' })
koffi.proto('bool __stdcall EnumWindowsProc(intptr_t hwnd, intptr_t lParam)')

const FindWindowW = user32.func('intptr_t __stdcall FindWindowW(str16 cls, str16 title)')
const FindWindowExW = user32.func(
  'intptr_t __stdcall FindWindowExW(intptr_t parent, intptr_t childAfter, str16 cls, str16 title)'
)
const SendMessageTimeoutW = user32.func(
  'intptr_t __stdcall SendMessageTimeoutW(intptr_t hwnd, uint32_t msg, uintptr_t wParam, intptr_t lParam, uint32_t flags, uint32_t timeout, intptr_t result)'
)
const EnumWindows = user32.func(
  'bool __stdcall EnumWindows(EnumWindowsProc *cb, intptr_t lParam)'
)
const SetParent = user32.func('intptr_t __stdcall SetParent(intptr_t child, intptr_t parent)')
const SetWindowPos = user32.func(
  'bool __stdcall SetWindowPos(intptr_t hwnd, intptr_t after, int x, int y, int cx, int cy, uint32_t flags)'
)
const GetWindowLongPtrW = user32.func('intptr_t __stdcall GetWindowLongPtrW(intptr_t hwnd, int index)')
const SetWindowLongPtrW = user32.func(
  'intptr_t __stdcall SetWindowLongPtrW(intptr_t hwnd, int index, intptr_t value)'
)
const MapWindowPoints = user32.func(
  'int __stdcall MapWindowPoints(intptr_t from, intptr_t to, _Inout_ RECT *pts, uint32_t count)'
)
koffi.struct('POINT', { x: 'long', y: 'long' })
const ClientToScreen = user32.func('bool __stdcall ClientToScreen(intptr_t hwnd, _Inout_ POINT *pt)')
const GetClientRect = user32.func('bool __stdcall GetClientRect(intptr_t hwnd, _Out_ RECT *rect)')
const SetLayeredWindowAttributes = user32.func(
  'bool __stdcall SetLayeredWindowAttributes(intptr_t hwnd, uint32_t key, uint8_t alpha, uint32_t flags)'
)
const IsWindow = user32.func('bool __stdcall IsWindow(intptr_t hwnd)')
const SystemParametersInfoW = user32.func(
  'bool __stdcall SystemParametersInfoW(uint32_t action, uint32_t param, void *pv, uint32_t winIni)'
)
koffi.struct('MONITORINFO', { cbSize: 'uint32_t', rcMonitor: 'RECT', rcWork: 'RECT', dwFlags: 'uint32_t' })
const GetForegroundWindow = user32.func('intptr_t __stdcall GetForegroundWindow()')
const GetWindowRect = user32.func('bool __stdcall GetWindowRect(intptr_t hwnd, _Out_ RECT *rect)')
const GetClassNameW = user32.func('int __stdcall GetClassNameW(intptr_t hwnd, void *buf, int max)')
const GetWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(intptr_t hwnd, _Out_ uint32_t *pid)')
const MonitorFromWindow = user32.func('intptr_t __stdcall MonitorFromWindow(intptr_t hwnd, uint32_t flags)')
const GetMonitorInfoW = user32.func('bool __stdcall GetMonitorInfoW(intptr_t monitor, _Inout_ MONITORINFO *info)')
const SHQueryUserNotificationState = shell32.func(
  'int32_t __stdcall SHQueryUserNotificationState(_Out_ int32_t *state)'
)

const WM_SPAWN_WORKERW = 0x052c
const SMTO_NORMAL = 0x0000
const GWL_STYLE = -16
const GWL_EXSTYLE = -20
const WS_EX_LAYERED = 0x00080000n
const LWA_ALPHA = 0x2
const WS_CHILD = 0x40000000n
const WS_POPUP = 0x80000000n
const WS_CAPTION = 0x00c00000n
const WS_THICKFRAME = 0x00040000n
const SWP_NOSIZE = 0x0001
const SWP_NOMOVE = 0x0002
const SWP_NOACTIVATE = 0x0010
const SWP_FRAMECHANGED = 0x0020
const SWP_SHOWWINDOW = 0x0040
const SPI_GETDESKWALLPAPER = 0x0073
const SPI_SETDESKWALLPAPER = 0x0014

export interface PhysicalRect {
  x: number
  y: number
  width: number
  height: number
}

export type AttachMode = 'progman-24h2' | 'workerw-legacy' | 'failed'

const h = (v: number | bigint): bigint => BigInt(v)

export function hwndFromBuffer(buf: Buffer): bigint {
  return buf.length >= 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0))
}

/** Map a rect in screen pixels to the client coordinates of `parent`. */
function toClient(parent: bigint, r: PhysicalRect): PhysicalRect {
  const rect = { left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height }
  MapWindowPoints(0, parent, rect, 2)
  return { x: rect.left, y: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top }
}

/**
 * Position `hwnd` inside `parent` so its *client area* covers `screenRect`. Chromium keeps
 * an invisible resize border around frameless windows (10px left/right/bottom here), so we
 * measure the inset after the first move and grow the window to compensate.
 */
function place(hwnd: bigint, parent: bigint, after: bigint, screenRect: PhysicalRect): void {
  const r = toClient(parent, screenRect)
  const flags = SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED
  SetWindowPos(hwnd, after, r.x, r.y, r.width, r.height, flags)

  const origin = { x: 0, y: 0 }
  const client = { left: 0, top: 0, right: 0, bottom: 0 }
  ClientToScreen(hwnd, origin)
  GetClientRect(hwnd, client)
  const dx = origin.x - screenRect.x
  const dy = origin.y - screenRect.y
  const dw = screenRect.width - client.right
  const dh = screenRect.height - client.bottom
  if (dx || dy || dw || dh) {
    SetWindowPos(hwnd, after, r.x - dx, r.y - dy, r.width + dw, r.height + dh, flags)
  }
}

/**
 * setIgnoreMouseEvents() makes the window WS_EX_LAYERED. After it is re-parented under
 * Progman, DWM keeps showing nothing (and Chromium's compositor stalls for every window of
 * the app) until the layered attributes are set again, so re-apply them after attaching.
 */
export function refreshLayered(hwnd: bigint): void {
  if (h(GetWindowLongPtrW(hwnd, GWL_EXSTYLE)) & WS_EX_LAYERED) {
    SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA)
  }
}

export function attachToDesktop(hwnd: bigint, screenRect: PhysicalRect): AttachMode {
  const mode = reparent(hwnd, screenRect)
  if (mode !== 'failed') refreshLayered(hwnd)
  return mode
}

/**
 * Re-parent `hwnd` so it renders between the desktop wallpaper and the icons.
 *
 * Pre-24H2: Progman spawns a top-level WorkerW behind the one hosting SHELLDLL_DefView;
 * we parent into that WorkerW.
 * 24H2+: SHELLDLL_DefView and the WorkerW are both children of Progman, so we parent
 * into Progman and slot ourselves in the z-order between DefView (icons) and WorkerW.
 */
function reparent(hwnd: bigint, screenRect: PhysicalRect): AttachMode {
  const progman = h(FindWindowW('Progman', null))
  if (!progman) return 'failed'

  SendMessageTimeoutW(progman, WM_SPAWN_WORKERW, 0xd, 0x1, SMTO_NORMAL, 1000, 0)

  const defViewInProgman = h(FindWindowExW(progman, 0, 'SHELLDLL_DefView', null))
  const workerInProgman = h(FindWindowExW(progman, 0, 'WorkerW', null))

  if (defViewInProgman && workerInProgman) {
    let style = h(GetWindowLongPtrW(hwnd, GWL_STYLE))
    style = (style & ~(WS_POPUP | WS_CAPTION | WS_THICKFRAME)) | WS_CHILD
    SetWindowLongPtrW(hwnd, GWL_STYLE, style)
    SetParent(hwnd, progman)
    place(hwnd, progman, defViewInProgman, screenRect)
    SetWindowPos(workerInProgman, hwnd, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE)
    return 'progman-24h2'
  }

  let workerw = 0n
  EnumWindows((top: number | bigint) => {
    if (h(FindWindowExW(top, 0, 'SHELLDLL_DefView', null))) {
      workerw = h(FindWindowExW(0, top, 'WorkerW', null))
    }
    return true
  }, 0)
  if (!workerw) return 'failed'

  SetParent(hwnd, workerw)
  place(hwnd, workerw, 0n, screenRect)
  return 'workerw-legacy'
}

export function isWindow(hwnd: bigint): boolean {
  return IsWindow(hwnd)
}

/** Re-apply the current Windows wallpaper so the last rendered frame of our window disappears. */
export function refreshDesktop(): void {
  const buf = Buffer.alloc(520 * 2)
  if (!SystemParametersInfoW(SPI_GETDESKWALLPAPER, 520, buf, 0)) return
  const path = buf.toString('utf16le').split('\0')[0]
  SystemParametersInfoW(SPI_SETDESKWALLPAPER, 0, Buffer.from(path + '\0', 'utf16le'), 0)
}

const SHELL_CLASSES = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd'])

/** True while a fullscreen game, fullscreen app or presentation is in the foreground. */
export function isFullscreenAppRunning(): boolean {
  // 3 = QUNS_RUNNING_D3D_FULL_SCREEN, 4 = QUNS_PRESENTATION_MODE. QUNS_BUSY (2) is skipped on
  // purpose: Windows also reports it for plain maximized borderless windows.
  const state = [0]
  if (SHQueryUserNotificationState(state) === 0 && (state[0] === 3 || state[0] === 4)) return true

  const fg = GetForegroundWindow()
  if (!fg) return false
  const pid = [0]
  GetWindowThreadProcessId(fg, pid)
  if (pid[0] === process.pid) return false
  const cls = Buffer.alloc(512)
  GetClassNameW(fg, cls, 256)
  if (SHELL_CLASSES.has(cls.toString('utf16le').split('\0')[0])) return false

  // A real fullscreen window covers the whole monitor, taskbar included; maximized ones don't.
  const win = { left: 0, top: 0, right: 0, bottom: 0 }
  if (!GetWindowRect(fg, win)) return false
  const zero = { left: 0, top: 0, right: 0, bottom: 0 }
  const info = { cbSize: 40, rcMonitor: { ...zero }, rcWork: { ...zero }, dwFlags: 0 }
  if (!GetMonitorInfoW(MonitorFromWindow(fg, 2), info)) return false
  const m = info.rcMonitor
  return win.left <= m.left && win.top <= m.top && win.right >= m.right && win.bottom >= m.bottom
}
