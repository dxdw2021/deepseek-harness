/**
 * DeepSeek Harness Desktop - Main Process Entry
 *
 * Electron wrapper for the DeepSeek Harness Web GUI. Starts dsh web as a child
 * process and loads the GUI in a native window. The shell is crash-resilient:
 * GPU acceleration is disabled so a Viz/GPU-process failure cannot take the
 * shell down, renderer crashes log and recover by replacing the window (bounded
 * so a crash loop logs out instead of churning windows), and a dsh web restart
 * re-points the window at the new port.
 */

import { app, BrowserWindow } from 'electron'
import { startDshWeb, stopDshWeb, setProcessState } from './process.js'
import { createMainWindow } from './window.js'
import { BOOT_PAGE_URL, setBootStatus } from './splash.js'
import { setupTray, destroyTray } from './tray.js'
import { setupMenu } from './menu.js'
import { setupUpdater } from './updater.js'
import { setupIpcHandlers } from './ipc.js'
import { installFileLogging, getMainLogPath } from './logger.js'

// A packaged GUI app on Windows shows no console output; mirror every log
// line to <userData>/logs/main.log before anything can write to console.
installFileLogging()

// Renderer crashes under GPU contention are an environmental fact (drivers,
// virtual displays, AV scanners). Software rendering decouples the shell from
// the GPU process entirely.
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu-compositing')

let tray: Electron.Tray | null = null

/** Application state shared with the surface modules. */
const state = {
  webPort: 0,
  isQuitting: false,
  dshStarted: false,
}

/**
 * The current window. Modules that outlive a window replacement (updater
 * events, the activate/second-instance paths) resolve it here at use time.
 */
let currentWindow: BrowserWindow | null = null

/** Renderer-recovery bookkeeping: at most three window replacements per minute. */
const recovery = { count: 0, last: 0 }

function recordRecovery(): boolean {
  const now = Date.now()
  if (now - recovery.last > 60_000) recovery.count = 0
  recovery.last = now
  recovery.count += 1
  return recovery.count <= 3
}

/**
 * Create the window and re-attach every surface that closes over it (IPC
 * handlers, tray, native menu). Those closures capture the window, so a
 * replacement must re-mount them or old actions would act on a destroyed
 * object.
 */
function createWindow(initialUrl?: string): BrowserWindow {
  const win = createMainWindow(state.webPort, initialUrl)
  currentWindow = win

  win.on('closed', () => {
    if (currentWindow === win) currentWindow = null
  })

  // Closing the window hides it to the tray instead of destroying it, so the
  // app keeps running and the tray (or another launch) can show it again. Real
  // shutdown destroys the window directly via shutdown() and skips this path.
  win.on('close', (event) => {
    if (!state.isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })

  // Renderer crash recovery: a dead renderer cannot reload, so replace the
  // window. "clean-exit" is the renderer shutting down on its own (window
  // close, app quit) and needs no recovery.
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[dsh-desktop] Renderer gone (reason=${details.reason} exit=${details.exitCode})`)
    if (state.isQuitting || details.reason === 'clean-exit') return
    void recoverWindow()
  })

  if (tray !== null) {
    destroyTray()
    tray = null
  }
  setupIpcHandlers(win, state)
  tray = setupTray(win, state)
  setupMenu(win, state)

  return win
}

/**
 * Replace the window after a renderer crash. Bounded to three replacements per
 * minute so a crash loop reports itself instead of churning windows forever.
 */
async function recoverWindow(): Promise<void> {
  if (!recordRecovery()) {
    console.error('[dsh-desktop] Too many renderer crashes; not replacing the window again.')
    return
  }
  if (currentWindow !== null && !currentWindow.isDestroyed()) {
    currentWindow.destroy()
  }
  if (state.isQuitting) return
  createWindow()
}

/**
 * Main application startup sequence.
 * 1. Start dsh web subprocess
 * 2. Create main window
 * 3. Setup system tray
 * 4. Setup native menu
 * 5. Setup auto-updater
 */
async function main(): Promise<void> {
  // Ensure single instance
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
    return
  }

  // Handle second instance (show existing window)
  app.on('second-instance', () => {
    const win = currentWindow
    if (win === null) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  // Wait for app ready
  await app.whenReady()

  console.log('[dsh-desktop] Starting DeepSeek Harness Desktop...')

  // Wire the quit flag that process.ts consults on dsh exit, so shutting the
  // app down does not look like an unexpected dsh crash and trigger a restart.
  setProcessState(state)

  try {
    // 1. Show the main window on the boot page immediately, so the slow
    //    one-time first-launch preparation (dsh web profile init, the Windows
    //    junction fallback) is never a blank desktop. The window later swaps
    //    to the real web GUI; one window the whole way through.
    const win = createWindow(BOOT_PAGE_URL)
    setBootStatus(win, '首次启动正在准备环境，可能需要几分钟…')

    // 2. Start dsh web subprocess
    console.log('[dsh-desktop] Starting dsh web...')
    state.webPort = await startDshWeb({
      // dsh web rebooted on a new OS-assigned port; follow it so the window
      // keeps a live server instead of pointing at a dead one.
      onRestart: (port) => {
        console.log(`[dsh-desktop] dsh web restarted on port ${port}`)
        state.webPort = port
        const current = currentWindow
        if (current !== null && !current.isDestroyed()) {
          void current.loadURL(`http://127.0.0.1:${String(port)}`)
        }
      },
    })
    state.dshStarted = true
    console.log(`[dsh-desktop] dsh web started on port ${state.webPort}`)

    // 3. Swap the boot page for the real web GUI
    if (!win.isDestroyed()) {
      void win.loadURL(`http://127.0.0.1:${state.webPort}`)
    }

    // 4. Setup auto-updater against the live window
    setupUpdater(() => currentWindow)

    console.log('[dsh-desktop] Desktop ready!')

  } catch (error) {
    console.error('[dsh-desktop] Failed to start:', error)
    const win = currentWindow
    // Show the failure on the window instead of quitting: a silent exit gives
    // the user (and us) nothing to debug, while the boot page can surface the
    // exact error and the log file path.
    if (win !== null && !win.isDestroyed() && win.webContents.getURL().startsWith('data:')) {
      setBootStatus(
        win,
        `启动失败：${String(error)}\n\n日志文件：${getMainLogPath()}\n\n可从托盘菜单退出应用。`,
      )
    }
  }
}

/**
 * Graceful shutdown handler.
 */
async function shutdown(): Promise<void> {
  console.log('[dsh-desktop] Shutting down...')

  // Stop dsh web process
  if (state.dshStarted) {
    await stopDshWeb()
    state.dshStarted = false
  }

  // Destroy tray
  if (tray !== null) {
    destroyTray()
    tray = null
  }

  // Destroy window
  const win = currentWindow
  if (win !== null && !win.isDestroyed()) {
    win.destroy()
  }
  currentWindow = null
}

// App lifecycle events
app.on('before-quit', () => {
  state.isQuitting = true
})

app.on('will-quit', (event) => {
  event.preventDefault()
  void shutdown().finally(() => app.exit(0))
})

app.on('window-all-closed', () => {
  // On macOS, keep app running in dock
  if (process.platform !== 'darwin' && state.isQuitting) {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS, recreate window when dock icon clicked
  if (currentWindow === null && state.dshStarted) {
    createWindow()
  } else if (currentWindow !== null) {
    currentWindow.show()
  }
})

// Crash guards. A child/GPU/utility process failure must not kill the shell:
// software rendering carries the surface and the renderer path replaces the
// window. Main-process exceptions log and the shell keeps serving the tray.
app.on('child-process-gone', (_event, details) => {
  console.error(`[dsh-desktop] ${details.type} process gone (reason=${details.reason} exit=${details.exitCode})`)
})

process.on('uncaughtException', (error) => {
  console.error('[dsh-desktop] Uncaught exception:', error)
})

process.on('unhandledRejection', (reason) => {
  console.error('[dsh-desktop] Unhandled rejection:', reason)
})

// Start the application
main().catch((error) => {
  console.error('[dsh-desktop] Fatal error:', error)
  app.exit(1)
})
