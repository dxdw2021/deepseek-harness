/**
 * DeepSeek Harness Desktop - System Tray
 *
 * System tray integration:
 * - Tray icon with context menu
 * - Click/double-click to show/hide window
 * - Menu items for common actions
 */

import { Tray, Menu, nativeImage, BrowserWindow, app, nativeTheme } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

/** __dirname equivalent for ES modules */
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Tray instance */
let tray: Tray | null = null

/**
 * Get tray icon path based on platform and theme.
 *
 * Prefers a theme-matched icon, then .ico over .png, and always ends at
 * `tray-icon.png`, which ships with every build. The returned path never
 * refers to a missing file: an empty nativeImage would silently hide the tray
 * icon.
 */
function getTrayIconPath(): string {
  const suffix = nativeTheme.shouldUseDarkColors ? '-dark' : ''
  // Packaged: icons live beside app.asar in the unpacked resources dir;
  // development: the source resources directory next to dist/main.
  const base = app.isPackaged
    ? process.resourcesPath
    : join(__dirname, '../../resources')
  const candidates = [
    `tray-icon${suffix}.ico`,
    `tray-icon${suffix}.png`,
    'tray-icon.ico',
    'tray-icon.png',
  ]
  for (const name of candidates) {
    const candidate = join(base, name)
    if (existsSync(candidate)) return candidate
  }
  return join(base, 'tray-icon.png')
}

/**
 * Create and setup the system tray.
 */
export function setupTray(mainWindow: BrowserWindow, state: { isQuitting: boolean }): Tray {
  const iconPath = getTrayIconPath()
  const icon = nativeImage.createFromPath(iconPath)

  // Resize icon for macOS
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true)
  }

  tray = new Tray(icon)

  // Build context menu
  const contextMenu = buildContextMenu(mainWindow, state)
  tray.setContextMenu(contextMenu)

  // Tooltip
  tray.setToolTip('DeepSeek Harness')

  // Double-click to show/hide window
  tray.on('double-click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      showWindow(mainWindow)
    }
  })

  // Click to show window (Windows behavior)
  if (process.platform === 'win32') {
    tray.on('click', () => {
      if (mainWindow.isVisible()) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      } else {
        mainWindow.show()
      }
    })
  }

  return tray
}

/** Bring a hidden or minimized window back to the foreground. */
function showWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

/**
 * Build the tray context menu.
 */
function buildContextMenu(mainWindow: BrowserWindow, state: { isQuitting: boolean }): Menu {
  return Menu.buildFromTemplate([
    {
      label: '显示 DeepSeek Harness',
      click: () => {
        showWindow(mainWindow)
      },
    },
    { type: 'separator' },
    {
      label: '新建会话',
      click: () => {
        showWindow(mainWindow)
        mainWindow.webContents.send('menu:new-session')
      },
    },
    {
      label: '打开工作区...',
      click: () => {
        showWindow(mainWindow)
        mainWindow.webContents.send('menu:open-workspace')
      },
    },
    { type: 'separator' },
    {
      label: '设置...',
      accelerator: 'CmdOrCtrl+,',
      click: () => {
        showWindow(mainWindow)
        mainWindow.webContents.send('menu:open-settings')
      },
    },
    { type: 'separator' },
    {
      label: '最小化到托盘',
      click: () => {
        mainWindow.hide()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        state.isQuitting = true
        app.quit()
      },
    },
  ])
}

/**
 * Update tray menu (call when window state changes).
 */
export function updateTrayMenu(mainWindow: BrowserWindow, state: { isQuitting: boolean }): void {
  if (tray) {
    const contextMenu = buildContextMenu(mainWindow, state)
    tray.setContextMenu(contextMenu)
  }
}

/**
 * Destroy the tray.
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
