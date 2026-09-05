/**
 * DeepSeek Harness Desktop - Preload Script
 *
 * Exposes safe, limited APIs to the renderer process via contextBridge.
 * Follows Electron security best practices:
 * - contextIsolation: true
 * - nodeIntegration: false
 * - Only explicit API methods are exposed
 */

const { contextBridge, ipcRenderer } = require('electron')

/**
 * Desktop API exposed to the renderer process.
 * This bridge provides window control and desktop-specific features.
 */
const desktopAPI = {
  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximizeChange: (callback) => {
      const handler = (_event, maximized) => {
        callback(maximized)
      }
      ipcRenderer.on('window:maximize-change', handler)
      return () => ipcRenderer.removeListener('window:maximize-change', handler)
    },
  },

  // Sidebar control
  sidebarControl: {
    toggle: workspacePath => ipcRenderer.invoke('sidebar:toggle', workspacePath),
    hide: () => ipcRenderer.invoke('sidebar:hide'),
    resize: width => ipcRenderer.invoke('sidebar:resize', width),
    getState: () => ipcRenderer.invoke('sidebar:get-state'),
    setState: state => ipcRenderer.invoke('sidebar:set-state', state),
  },

  // App actions
  app: {
    newSession: () => ipcRenderer.invoke('app:new-session'),
    openWorkspace: () => ipcRenderer.invoke('app:open-workspace'),
    openSettings: () => ipcRenderer.invoke('app:open-settings'),
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getPlatform: () => ipcRenderer.invoke('app:get-platform'),
    listFiles: dirPath => ipcRenderer.invoke('app:list-files', dirPath),
  },

  // Auto updater
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),
    installUpdate: () => ipcRenderer.invoke('updater:install'),
    onUpdateAvailable: (callback) => {
      const handler = (_event, info) => {
        callback(info)
      }
      ipcRenderer.on('update:available', handler)
      return () => ipcRenderer.removeListener('update:available', handler)
    },
    onUpdateDownloaded: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('update:downloaded', handler)
      return () => ipcRenderer.removeListener('update:downloaded', handler)
    },
  },

  // Menu events (from native menu to renderer)
  menu: {
    onNewSession: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('menu:new-session', handler)
      return () => ipcRenderer.removeListener('menu:new-session', handler)
    },
    onOpenWorkspace: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('menu:open-workspace', handler)
      return () => ipcRenderer.removeListener('menu:open-workspace', handler)
    },
    onOpenSettings: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('menu:open-settings', handler)
      return () => ipcRenderer.removeListener('menu:open-settings', handler)
    },
  },

  // Sidebar panel - file operations for artifacts and change tracking
  sidebar: {
    getWorkspace: () => ipcRenderer.invoke('sidebar:get-workspace'),
    getActiveSessionCwd: () => ipcRenderer.invoke('sidebar:get-active-session-cwd'),
    listProducedFiles: dirPath => ipcRenderer.invoke('sidebar:list-produced-files', dirPath),
    listChangedFiles: workspacePath => ipcRenderer.invoke('sidebar:list-changed-files', workspacePath),
    getFileContent: filePath => ipcRenderer.invoke('sidebar:get-file-content', filePath),
    getFileDiff: (workspacePath, filePath) => ipcRenderer.invoke('sidebar:get-file-diff', workspacePath, filePath),
    pickFolder: () => ipcRenderer.invoke('sidebar:pick-folder'),
  },
}

// Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', desktopAPI)
