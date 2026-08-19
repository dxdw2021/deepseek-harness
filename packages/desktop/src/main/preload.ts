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
    onMaximizeChange: (callback: (maximized: boolean) => void) => {
      const handler = (_event: any, maximized: boolean) => {
        callback(maximized)
      }
      ipcRenderer.on('window:maximize-change', handler)
      return () => ipcRenderer.removeListener('window:maximize-change', handler)
    },
  },

  // App actions
  app: {
    newSession: () => ipcRenderer.invoke('app:new-session'),
    openWorkspace: () => ipcRenderer.invoke('app:open-workspace'),
    openSettings: () => ipcRenderer.invoke('app:open-settings'),
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getPlatform: () => ipcRenderer.invoke('app:get-platform'),
  },

  // Auto updater
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),
    installUpdate: () => ipcRenderer.invoke('updater:install'),
    onUpdateAvailable: (callback: (info: { version: string }) => void) => {
      const handler = (_event: any, info: { version: string }) => {
        callback(info)
      }
      ipcRenderer.on('update:available', handler)
      return () => ipcRenderer.removeListener('update:available', handler)
    },
    onUpdateDownloaded: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('update:downloaded', handler)
      return () => ipcRenderer.removeListener('update:downloaded', handler)
    },
  },

  // Menu events (from native menu to renderer)
  menu: {
    onNewSession: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('menu:new-session', handler)
      return () => ipcRenderer.removeListener('menu:new-session', handler)
    },
    onOpenWorkspace: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('menu:open-workspace', handler)
      return () => ipcRenderer.removeListener('menu:open-workspace', handler)
    },
    onOpenSettings: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('menu:open-settings', handler)
      return () => ipcRenderer.removeListener('menu:open-settings', handler)
    },
  },
}

// Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', desktopAPI)
