/**
 * DeepSeek Harness Desktop - Auto Updater
 *
 * Handles automatic updates:
 * - Check for updates on startup
 * - Download and install updates
 * - Notify renderer of update status
 */

import { BrowserWindow, dialog, app } from 'electron'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const electronUpdater = require('electron-updater')
const autoUpdater = electronUpdater.autoUpdater
type UpdateInfo = any

/** Update state */
let updateAvailable = false
let updateInfo: UpdateInfo | null = null

/**
 * Setup the auto-updater.
 * @param getWindow - resolves the current window; update events keep working
 * after a renderer crash replaces the window, because the window is looked up
 * at send time instead of captured once.
 */
export function setupUpdater(getWindow: () => BrowserWindow | null): void {
  // Configure auto-updater for GitHub Releases
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // Configure GitHub release feed
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'deepseek-ai',
    repo: 'deepseek-harness',
    releaseType: 'release',
  })

  // Disable auto-download in dev mode
  if (process.env.NODE_ENV === 'development') {
    autoUpdater.autoDownload = false
    console.log('[updater] Auto-update disabled in development mode')
    return
  }

  // Check for updates periodically (every 4 hours)
  const CHECK_INTERVAL = 4 * 60 * 60 * 1000

  // Check on startup (after a short delay)
  setTimeout(() => {
    void checkForUpdates(getWindow)
  }, 30000) // 30 seconds after startup

  // Periodic checks
  setInterval(() => {
    void checkForUpdates(getWindow)
  }, CHECK_INTERVAL)

  // Event handlers
  setupUpdateEvents(getWindow)
}

/** Send an event to the current window's renderer; a replaced or closed window is skipped. */
function sendToWindow(channel: string, getWindow: () => BrowserWindow | null, payload?: unknown): void {
  const win = getWindow()
  if (win === null || win.isDestroyed() || win.webContents.isDestroyed()) return
  win.webContents.send(channel, payload)
}

/** Show a message box parented to the current window when one exists, else modeless. */
function showMessageBox(
  getWindow: () => BrowserWindow | null,
  options: Electron.MessageBoxOptions,
): Promise<Electron.MessageBoxReturnValue> {
  const win = getWindow()
  if (win !== null && !win.isDestroyed()) {
    return dialog.showMessageBox(win, options)
  }
  return dialog.showMessageBox(options)
}

/**
 * Check for updates.
 */
async function checkForUpdates(getWindow: () => BrowserWindow | null): Promise<void> {
  try {
    console.log('[updater] Checking for updates...')
    const result = await autoUpdater.checkForUpdates()

    if (result?.updateInfo) {
      updateAvailable = true
      updateInfo = result.updateInfo
      console.log(`[updater] Update available: ${result.updateInfo.version}`)
    } else {
      console.log('[updater] No updates available')
    }
  } catch (error) {
    console.error('[updater] Check failed:', error)
  }
}

/**
 * Setup update event handlers.
 */
function setupUpdateEvents(getWindow: () => BrowserWindow | null): void {
  // Update available
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    updateAvailable = true
    updateInfo = info

    // Notify renderer
    sendToWindow('update:available', getWindow, {
      version: info.version,
      releaseDate: info.releaseDate,
    })

    // Ask user if they want to download
    showMessageBox(getWindow, {
      type: 'info',
      title: '更新可用',
      message: `新版本 ${info.version} 已发布`,
      detail: '是否立即下载更新？',
      buttons: ['下载', '稍后'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate()
      }
    })
  })

  // Download progress
  autoUpdater.on('download-progress', (progress: { percent: number; transferred: number; total: number }) => {
    sendToWindow('update:progress', getWindow, {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  // Update downloaded
  autoUpdater.on('update-downloaded', () => {
    updateAvailable = false

    // Notify renderer
    sendToWindow('update:downloaded', getWindow)

    // Ask user to restart
    showMessageBox(getWindow, {
      type: 'info',
      title: '更新已下载',
      message: '更新已下载完成',
      detail: '应用将在重启后应用更新。是否立即重启？',
      buttons: ['立即重启', '稍后重启'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  })

  // Update error
  autoUpdater.on('error', (error: Error) => {
    console.error('[updater] Error:', error)
  })
}

/**
 * Manually trigger an update check (from menu or tray).
 * @param getWindow - resolves the current window for notifications.
 */
export function triggerUpdateCheck(getWindow: () => BrowserWindow | null): Promise<void> {
  return checkForUpdates(getWindow)
}

/**
 * Check if an update is available.
 */
export function isUpdateAvailable(): boolean {
  return updateAvailable
}

/**
 * Get the current update info.
 */
export function getUpdateInfo(): UpdateInfo | null {
  return updateInfo
}
