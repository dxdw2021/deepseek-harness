/**
 * DeepSeek Harness Desktop - Electron API Type Declarations
 *
 * Type definitions for the electronAPI exposed via preload script.
 * Import this in your renderer code for type safety.
 */

/** Desktop API exposed to the renderer process */
interface ElectronAPI {
  /** Window control operations */
  window: {
    /** Minimize the window */
    minimize: () => Promise<void>
    /** Toggle maximize state */
    maximize: () => Promise<void>
    /** Close the window */
    close: () => Promise<void>
    /** Check if window is maximized */
    isMaximized: () => Promise<boolean>
    /** Listen for maximize state changes */
    onMaximizeChange: (callback: (maximized: boolean) => void) => () => void
  }

  /** Application actions */
  app: {
    /** Create a new session */
    newSession: () => Promise<void>
    /** Open workspace picker */
    openWorkspace: () => Promise<void>
    /** Open settings */
    openSettings: () => Promise<void>
    /** Get app version */
    getVersion: () => Promise<string>
    /** Get platform (darwin, win32, linux) */
    getPlatform: () => Promise<string>
    /** List files in a directory for @file reference */
    listFiles: (dirPath: string) => Promise<{
      success: boolean
      files: Array<{ name: string; path: string; isDir: boolean }>
      error?: string
    }>
  }

  /** Auto updater operations */
  updater: {
    /** Check for updates */
    checkForUpdates: () => Promise<{ success: boolean; error?: string }>
    /** Download available update */
    downloadUpdate: () => Promise<{ success: boolean; error?: string }>
    /** Install downloaded update */
    installUpdate: () => Promise<void>
    /** Listen for update available event */
    onUpdateAvailable: (callback: (info: { version: string }) => void) => () => void
    /** Listen for update downloaded event */
    onUpdateDownloaded: (callback: () => void) => () => void
  }

  /** Menu events from native menu to renderer */
  menu: {
    /** Listen for new session menu click */
    onNewSession: (callback: () => void) => () => void
    /** Listen for open workspace menu click */
    onOpenWorkspace: (callback: () => void) => () => void
    /** Listen for open settings menu click */
    onOpenSettings: (callback: () => void) => () => void
  }
}

/** Window with electronAPI */
interface Window {
  electronAPI?: ElectronAPI
}

declare global {
  interface Window extends Window {}
}

export type { ElectronAPI }
