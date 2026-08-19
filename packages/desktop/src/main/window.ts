/**
 * DeepSeek Harness Desktop - Window Management
 *
 * Creates and manages the main BrowserWindow:
 * - Window creation with optimal settings
 * - Window state persistence (size, position, maximized)
 * - Platform-specific adaptations
 */

import { BrowserWindow, screen, session } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Store from 'electron-store'

/** __dirname equivalent for ES modules */
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Window state for persistence */
interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

/** Persistent store for window state */
const windowStore = new Store<WindowState>({
  name: 'window-state',
  defaults: {
    width: 1400,
    height: 900,
    isMaximized: false,
  },
})

/**
 * Get the saved window state.
 */
export function getWindowState(): WindowState {
  return windowStore.store
}

/**
 * Save window state to disk.
 */
function saveWindowState(win: BrowserWindow): void {
  if (win.isMaximized()) {
    // When maximized, save the restore bounds
    windowStore.set({
      isMaximized: true,
      width: windowStore.get('width'),
      height: windowStore.get('height'),
    })
  } else {
    const bounds = win.getBounds()
    windowStore.set({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: false,
    })
  }
}

/**
 * Restore window bounds from saved state.
 */
function restoreWindowState(): { x?: number; y?: number; width: number; height: number } {
  const state = windowStore.store

  // Validate saved position is still visible on a display
  if (state.x !== undefined && state.y !== undefined) {
    const displays = screen.getAllDisplays()
    const isVisible = displays.some((display) => {
      const { x, y, width, height } = display.bounds
      return (
        state.x! >= x &&
        state.y! >= y &&
        state.x! < x + width &&
        state.y! < y + height
      )
    })

    if (isVisible) {
      return {
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
      }
    }
  }

  // Default: centered on primary display
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  return {
    width: Math.min(state.width, screenWidth),
    height: Math.min(state.height, screenHeight),
  }
}

/**
 * Get preload script path.
 */
function getPreloadPath(): string {
  return join(__dirname, 'preload.js')
}

/**
 * Get icon path based on platform.
 */
function getIconPath(): string {
  const ext = process.platform === 'win32' ? '.ico' :
    process.platform === 'darwin' ? '.icns' : '.png'
  return join(__dirname, '../../resources/icon' + ext)
}

/**
 * Create the main application window.
 * @param port - The port dsh web is listening on.
 * @param initialUrl - URL to load first (the boot page while the server is
 * starting); defaults to the dsh web GUI, which the caller can load later.
 * @returns The created BrowserWindow instance.
 */
export function createMainWindow(port: number, initialUrl?: string): BrowserWindow {
  const { x, y, width, height } = restoreWindowState()
  const isMaximized = windowStore.get('isMaximized')

  // Platform-specific window options
  const platformOptions: Partial<Electron.BrowserWindowConstructorOptions> = {}

  if (process.platform === 'darwin') {
    // macOS: hidden title bar with inset traffic lights
    platformOptions.titleBarStyle = 'hiddenInset'
    platformOptions.trafficLightPosition = { x: 12, y: 12 }
  } else if (process.platform === 'win32') {
    // Windows: use native title bar for better integration
    platformOptions.frame = true
  } else {
    // Linux: use native title bar
    platformOptions.frame = true
  }

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    minWidth: 800,
    minHeight: 600,
    title: 'DeepSeek Harness',
    icon: getIconPath(),
    show: false, // Hide until ready
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    ...platformOptions,
  })

  // Pin the desktop client identity on the webContents so every future load
  // (recoveries, dsh web restarts) keeps it without repeating the option.
  win.webContents.setUserAgent('DeepSeek-Harness-Desktop')

  // Load dsh web GUI (or the boot page while the server is still starting)
  win.loadURL(initialUrl ?? `http://127.0.0.1:${port}`)

  // Show window when ready (prevent white flash)
  win.once('ready-to-show', () => {
    if (isMaximized) {
      win.maximize()
    }
    win.show()
  })

  // Save window state on close
  win.on('close', () => {
    saveWindowState(win)
  })

  // Handle navigation attempts (prevent leaving the app)
  win.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url)
    if (parsedUrl.hostname !== '127.0.0.1' && parsedUrl.hostname !== 'localhost') {
      event.preventDefault()
    }
  })

  // Handle new window requests (open in external browser)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      import('electron').then(({ shell }) => {
        shell.openExternal(url)
      })
    }
    return { action: 'deny' }
  })

  // Configure CSP for security
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' http://127.0.0.1:* http://localhost:*; " +
          "script-src 'self' http://127.0.0.1:* http://localhost:* 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' http://127.0.0.1:* http://localhost:* 'unsafe-inline'; " +
          "img-src 'self' http://127.0.0.1:* http://localhost:* data: blob:; " +
          "font-src 'self' http://127.0.0.1:* http://localhost:* data:; " +
          "connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* wss://127.0.0.1:*; " +
          "worker-src 'self' http://127.0.0.1:* blob:; " +
          "frame-src 'none'",
        ],
      },
    })
  })

  return win
}

/**
 * Get the main window instance.
 * Note: This is a helper - prefer passing window references directly.
 */
export function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] ?? null
}
