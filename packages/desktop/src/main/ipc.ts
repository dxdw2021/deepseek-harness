/**
 * DeepSeek Harness Desktop - IPC Handlers
 *
 * Handles IPC messages from the renderer process:
 * - Window control
 * - App actions
 * - Updater commands
 */

import { BrowserWindow, ipcMain, app } from 'electron'

/** Application state interface */
interface AppState {
  webPort: number
  isQuitting: boolean
  dshStarted: boolean
}

/**
 * Setup all IPC handlers.
 */
export function setupIpcHandlers(mainWindow: BrowserWindow, state: AppState): void {
  // Window control handlers
  setupWindowHandlers(mainWindow)

  // App action handlers
  setupAppHandlers(mainWindow)

  // Updater handlers
  setupUpdaterHandlers(mainWindow)
}

/**
 * Window control IPC handlers.
 */
function setupWindowHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('window:minimize', () => {
    mainWindow.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  ipcMain.handle('window:close', () => {
    mainWindow.close()
  })

  ipcMain.handle('window:is-maximized', () => {
    return mainWindow.isMaximized()
  })

  // Notify renderer of maximize state changes
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximize-change', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximize-change', false)
  })
}

/**
 * App action IPC handlers.
 */
function setupAppHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('app:new-session', () => {
    mainWindow.webContents.send('menu:new-session')
  })

  ipcMain.handle('app:open-workspace', () => {
    mainWindow.webContents.send('menu:open-workspace')
  })

  ipcMain.handle('app:open-settings', () => {
    mainWindow.webContents.send('menu:open-settings')
  })

  ipcMain.handle('app:get-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:get-platform', () => {
    return process.platform
  })
}

/**
 * Updater IPC handlers.
 */
function setupUpdaterHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('updater:check', async () => {
    try {
      const { autoUpdater } = await import('electron-updater')
      await autoUpdater.checkForUpdates()
      return { success: true }
    } catch (error) {
      console.error('[updater] Check failed:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('updater:download', async () => {
    try {
      const { autoUpdater } = await import('electron-updater')
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      console.error('[updater] Download failed:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('updater:install', () => {
    const { autoUpdater } = require('electron-updater')
    autoUpdater.quitAndInstall()
  })
}
