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

  // Sidebar panel handlers
  setupSidebarHandlers(mainWindow)
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

  // Sidebar control handlers (stub - sidebar is implemented in the web GUI)
  ipcMain.handle('sidebar:toggle', (_event, _workspacePath?: string) => {
    // Sidebar toggle is handled by the web GUI
    return false
  })

  ipcMain.handle('sidebar:hide', () => {
    return false
  })

  ipcMain.handle('sidebar:resize', (_event, _width: number) => {
    return true
  })

  ipcMain.handle('sidebar:get-state', () => {
    return { visible: false, width: 320, activeTab: 'files' }
  })

  ipcMain.handle('sidebar:set-state', (_event, _state) => {
    return true
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

  // File listing for @file reference feature
  ipcMain.handle('app:list-files', async (_event, dirPath: string) => {
    const { readdirSync, statSync } = await import('fs')
    const { join, relative } = await import('path')
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true })
      const files: Array<{ name: string; path: string; isDir: boolean }> = []
      for (const entry of entries.slice(0, 200)) { // limit to 200 entries
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        const fullPath = join(dirPath, entry.name)
        files.push({
          name: entry.name,
          path: relative(dirPath, fullPath).replace(/\\/g, '/'),
          isDir: entry.isDirectory(),
        })
      }
      return { success: true, files }
    } catch (error) {
      return { success: false, error: String(error), files: [] }
    }
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

/**
 * Sidebar panel IPC handlers - file operations for artifacts and change tracking.
 */

/** Walk session dirs and find the most recently modified session header with a cwd. */
function findLatestCwdFromSessions(
  fs: typeof import('fs'),
  path: typeof import('path'),
  sessionsRoot: string,
): { success: boolean; cwd: string } {
  let latestCwd = ''
  let latestMtime = 0
  try {
    const projectDirs = fs.readdirSync(sessionsRoot, { withFileTypes: true })
      .filter((d: any) => d.isDirectory())
    for (const proj of projectDirs) {
      const projPath = path.join(sessionsRoot, proj.name)
      const sessionDirs = fs.readdirSync(projPath, { withFileTypes: true })
        .filter((d: any) => d.isDirectory())
      for (const sess of sessionDirs) {
        const logDir = path.join(projPath, sess.name)
        const candidates = ['session.jsonl', 'session.jsonl.zst', 'session.jsonl.gz']
        for (const fname of candidates) {
          const logFile = path.join(logDir, fname)
          try {
            const firstLine = fs.readFileSync(logFile, 'utf-8').split('\n')[0]
            if (!firstLine) continue
            const header = JSON.parse(firstLine)
            if (header.cwd) {
              const stat = fs.statSync(logFile)
              if (stat.mtimeMs > latestMtime) {
                latestMtime = stat.mtimeMs
                latestCwd = header.cwd
              }
            }
            break
          } catch { /* skip */ }
        }
      }
    }
  } catch { /* sessions dir may not exist */ }
  return { success: true, cwd: latestCwd }
}

function setupSidebarHandlers(mainWindow: BrowserWindow): void {
  // Return the DSH home directory as the default workspace
  ipcMain.handle('sidebar:get-workspace', () => {
    return process.env.DSH_HOME || process.env.USERPROFILE || process.env.HOME || ''
  })

  // Get the current session's cwd by probing the web page's internal state
  ipcMain.handle('sidebar:get-active-session-cwd', async (_event) => {
    try {
      const win = _event.sender ? require('electron').BrowserWindow.fromWebContents(_event.sender) : null
      if (!win) return { success: true, cwd: '' }

      // Read workspace from the running DSH web app
      const cwd = await win.webContents.executeJavaScript(`
        (function() {
          try {
            // 1. Check __DSH_BOOT__ for workspace info
            var boot = window.__DSH_BOOT__
            if (boot && boot.workspace) {
              if (boot.workspace.root) return boot.workspace.root
              if (boot.workspace.path) return boot.workspace.path
            }

            // 2. Walk all window properties looking for stores with workspaceRoot
            var keys = Object.getOwnPropertyNames(window)
            for (var i = 0; i < keys.length; i++) {
              try {
                var obj = window[keys[i]]
                if (obj && typeof obj === 'object' && typeof obj.getState === 'function') {
                  var s = obj.getState()
                  if (s && typeof s === 'object') {
                    if (s.workspaceRoot && typeof s.workspaceRoot === 'string') return s.workspaceRoot
                    if (s.cwd && typeof s.cwd === 'string') return s.cwd
                  }
                }
              } catch(e2) {}
            }

            // 3. Search React fiber tree for workspaceRoot prop
            var root = document.getElementById('dsh-root') || document.getElementById('root')
            if (root) {
              var fiberKey = Object.keys(root).find(function(k) { return k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance') })
              if (fiberKey) {
                var fiber = root[fiberKey]
                var queue = [fiber]
                var visited = 0
                while (queue.length > 0 && visited < 200) {
                  var f = queue.shift()
                  visited++
                  if (!f) continue
                  if (f.memoizedProps) {
                    if (f.memoizedProps.workspaceRoot) return f.memoizedProps.workspaceRoot
                    if (f.memoizedProps.cwd && typeof f.memoizedProps.cwd === 'string') return f.memoizedProps.cwd
                  }
                  if (f.child) queue.push(f.child)
                  if (f.sibling) queue.push(f.sibling)
                }
              }
            }

            // 4. Check localStorage for saved workspace
            var saved = localStorage.getItem('dsh-sidebar-workspace')
            if (saved) return saved

            return ''
          } catch(e) { return '' }
        })()
      `)

      console.log('[sidebar] getActiveSessionCwd: ' + (cwd || '(empty)'))
      return { success: true, cwd: cwd || '' }
    } catch (error) {
      console.error('[sidebar] getActiveSessionCwd error:', error)
      return { success: false, error: String(error), cwd: '' }
    }
  })

  // Open folder picker dialog
  ipcMain.handle('sidebar:pick-folder', async (_event) => {
    try {
      const { dialog } = await import('electron')
      const win = _event.sender ? require('electron').BrowserWindow.fromWebContents(_event.sender) : null
      if (!win) return { success: false, path: '' }
      const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory'],
        title: 'Select Workspace Directory',
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, path: '' }
      }
      return { success: true, path: result.filePaths[0] }
    } catch (error) {
      return { success: false, path: '', error: String(error) }
    }
  })

  // List produced files (artifacts) from a directory
  ipcMain.handle('sidebar:list-produced-files', async (_event, dirPath: string) => {
    console.log('[sidebar] >>> list-produced-files CALLED with dirPath="' + dirPath + '"')
    const { readdirSync, statSync, existsSync } = await import('fs')
    const { join, relative, extname, resolve } = await import('path')
    const target = dirPath || process.env.DSH_HOME || process.env.USERPROFILE || process.env.HOME || '.'
    console.log('[sidebar] resolved target="' + target + '"')

    if (!existsSync(target)) {
      console.log('[sidebar] target does not exist')
      return { success: false, error: 'Directory not found: ' + target, files: [] }
    }

    try {
      const files: Array<{ name: string; path: string; size: number; modified: string; ext: string }> = []
      const SKIP = new Set(['.git', 'node_modules', 'dist', '.next', '__pycache__', '.vscode', '.idea'])
      const MAX_FILES = 300
      const MAX_DEPTH = 6

      const walk = (dir: string, base: string, depth: number): void => {
        if (depth > MAX_DEPTH || files.length >= MAX_FILES) return
        let entries: any[]
        try {
          entries = readdirSync(dir, { withFileTypes: true })
        } catch { return }
        for (const entry of entries) {
          if (files.length >= MAX_FILES) return
          if (entry.name.startsWith('.') || SKIP.has(entry.name)) continue
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            walk(fullPath, base, depth + 1)
          } else {
            try {
              const stat = statSync(fullPath)
              files.push({
                name: entry.name,
                path: relative(base, fullPath).replace(/\\/g, '/'),
                size: stat.size,
                modified: stat.mtime.toISOString(),
                ext: extname(entry.name),
              })
            } catch { /* skip unreadable */ }
          }
        }
      }
      const absTarget = resolve(target)
      console.log('[sidebar] walking "' + absTarget + '"')
      walk(absTarget, absTarget, 0)
      console.log('[sidebar] found ' + files.length + ' files')
      return { success: true, files }
    } catch (error) {
      return { success: false, error: String(error), files: [] }
    }
  })

  // List changed files using git
  ipcMain.handle('sidebar:list-changed-files', async (_event, workspacePath: string) => {
    const { execSync } = await import('child_process')
    const cwd = workspacePath || process.env.DSH_HOME || process.env.USERPROFILE || process.env.HOME || '.'
    try {
      const output = execSync('git diff --name-status HEAD 2>/dev/null || git status --porcelain 2>/dev/null', {
        cwd,
        encoding: 'utf-8',
        timeout: 5000,
      })
      const files: Array<{ path: string; status: 'added' | 'modified' | 'deleted' | 'renamed' }> = []
      const lines = output.split('\n').filter(Boolean)
      for (const line of lines) {
        const match = line.match(/^([AMDRC]\s+)(.+)$/)
        if (match) {
          const statusCode = match[1].trim()[0]
          const filePath = match[2].trim()
          let status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified'
          if (statusCode === 'A') status = 'added'
          else if (statusCode === 'D') status = 'deleted'
          else if (statusCode === 'R') status = 'renamed'
          files.push({ path: filePath, status })
        }
      }
      return { success: true, files }
    } catch (error) {
      return { success: false, error: String(error), files: [] }
    }
  })

  // Get file content for preview
  ipcMain.handle('sidebar:get-file-content', async (_event, filePath: string) => {
    const { readFileSync } = await import('fs')
    try {
      const content = readFileSync(filePath, 'utf-8')
      return { success: true, content: content.slice(0, 10000) }
    } catch (error) {
      return { success: false, error: String(error), content: '' }
    }
  })

  // Get unified diff for a changed file
  ipcMain.handle('sidebar:get-file-diff', async (_event, workspacePath: string, filePath: string) => {
    const { execSync } = await import('child_process')
    const cwd = workspacePath || process.env.DSH_HOME || process.env.USERPROFILE || process.env.HOME || '.'
    try {
      const output = execSync(`git diff HEAD -- "${filePath}"`, {
        cwd,
        encoding: 'utf-8',
        timeout: 5000,
      })
      return { success: true, diff: output }
    } catch (error) {
      return { success: false, error: String(error), diff: '' }
    }
  })
}
