/**
 * Desktop enhanced service for DeepSeek Harness.
 * Provides enhanced desktop features like theme management, notifications, and shortcuts.
 * 
 * @module @deepseek-ai/dsh-desktop-enhanced
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Theme types */
export type ThemeType = 'light' | 'dark' | 'system' | 'custom'

/** Theme colors */
export interface ThemeColors {
  /** Primary color */
  primary: string
  /** Secondary color */
  secondary: string
  /** Background color */
  background: string
  /** Surface color */
  surface: string
  /** Text color */
  text: string
  /** Text secondary color */
  textSecondary: string
  /** Border color */
  border: string
  /** Error color */
  error: string
  /** Warning color */
  warning: string
  /** Success color */
  success: string
  /** Info color */
  info: string
}

/** Theme definition */
export interface Theme {
  /** Theme ID */
  id: string
  /** Theme name */
  name: string
  /** Theme type */
  type: ThemeType
  /** Theme colors */
  colors: ThemeColors
  /** Whether theme is built-in */
  builtin: boolean
}

/** Notification types */
export type NotificationType = 'info' | 'success' | 'warning' | 'error'

/** Notification options */
export interface NotificationOptions {
  /** Notification title */
  title: string
  /** Notification message */
  message: string
  /** Notification type */
  type: NotificationType
  /** Notification duration in milliseconds */
  duration?: number
  /** Whether to show in system tray */
  showInTray?: boolean
  /** Click action */
  onClick?: () => void
  /** Close action */
  onClose?: () => void
}

/** Keyboard shortcut */
export interface KeyboardShortcut {
  /** Shortcut ID */
  id: string
  /** Shortcut description */
  description: string
  /** Shortcut keys (e.g., 'Ctrl+Shift+P') */
  keys: string
  /** Shortcut action */
  action: () => void
  /** Whether shortcut is enabled */
  enabled: boolean
}

/** Desktop enhanced configuration */
export interface DesktopEnhancedConfig {
  /** Enable desktop enhanced features */
  enabled: boolean
  /** Current theme ID */
  themeId: string
  /** Enable system tray */
  enableSystemTray: boolean
  /** Enable notifications */
  enableNotifications: boolean
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts: boolean
  /** Enable auto-start */
  enableAutoStart: boolean
  /** Enable minimize to tray */
  enableMinimizeToTray: boolean
}

/** Desktop enhanced service definition */
export class DesktopEnhancedService extends Service {
  static inject = ['settings']
  
  /** Available themes */
  private themes: Map<string, Theme> = new Map()
  
  /** Keyboard shortcuts */
  private shortcuts: Map<string, KeyboardShortcut> = new Map()
  
  /** Configuration */
  private config: DesktopEnhancedConfig = {
    enabled: true,
    themeId: 'system',
    enableSystemTray: true,
    enableNotifications: true,
    enableKeyboardShortcuts: true,
    enableAutoStart: false,
    enableMinimizeToTray: true,
  }
  
  constructor(ctx: Context) {
    super(ctx, 'desktopEnhanced')
    
    // Register built-in themes
    this.registerBuiltinThemes()
  }
  
  /** Register built-in themes */
  private registerBuiltinThemes(): void {
    const lightTheme: Theme = {
      id: 'light',
      name: 'Light',
      type: 'light',
      colors: {
        primary: '#667eea',
        secondary: '#764ba2',
        background: '#ffffff',
        surface: '#f5f5f5',
        text: '#000000',
        textSecondary: '#666666',
        border: '#e0e0e0',
        error: '#f44336',
        warning: '#ff9800',
        success: '#4caf50',
        info: '#2196f3',
      },
      builtin: true,
    }
    
    const darkTheme: Theme = {
      id: 'dark',
      name: 'Dark',
      type: 'dark',
      colors: {
        primary: '#667eea',
        secondary: '#764ba2',
        background: '#121212',
        surface: '#1e1e1e',
        text: '#ffffff',
        textSecondary: '#b0b0b0',
        border: '#333333',
        error: '#f44336',
        warning: '#ff9800',
        success: '#4caf50',
        info: '#2196f3',
      },
      builtin: true,
    }
    
    this.themes.set('light', lightTheme)
    this.themes.set('dark', darkTheme)
  }
  
  /** Get current theme */
  getCurrentTheme(): Theme | undefined {
    return this.themes.get(this.config.themeId)
  }
  
  /** Set current theme */
  setTheme(themeId: string): boolean {
    const theme = this.themes.get(themeId)
    if (!theme) return false
    
    this.config.themeId = themeId
    this.ctx.emit('desktop-enhanced/theme-changed', theme)
    
    return true
  }
  
  /** Get all available themes */
  getThemes(): Theme[] {
    return Array.from(this.themes.values())
  }
  
  /** Register a custom theme */
  registerTheme(theme: Theme): void {
    this.themes.set(theme.id, theme)
    this.ctx.emit('desktop-enhanced/theme-registered', theme)
  }
  
  /** Remove a custom theme */
  removeTheme(themeId: string): boolean {
    const theme = this.themes.get(themeId)
    if (!theme || theme.builtin) return false
    
    this.themes.delete(themeId)
    this.ctx.emit('desktop-enhanced/theme-removed', theme)
    
    return true
  }
  
  /** Show notification */
  showNotification(options: NotificationOptions): void {
    if (!this.config.enabled || !this.config.enableNotifications) return
    
    this.ctx.emit('desktop-enhanced/notification-shown', options)
    
    // Auto-close notification
    if (options.duration && options.duration > 0) {
      setTimeout(() => {
        this.ctx.emit('desktop-enhanced/notification-closed', options.title)
      }, options.duration)
    }
  }
  
  /** Register keyboard shortcut */
  registerShortcut(shortcut: KeyboardShortcut): void {
    this.shortcuts.set(shortcut.id, shortcut)
    this.ctx.emit('desktop-enhanced/shortcut-registered', shortcut)
  }
  
  /** Remove keyboard shortcut */
  removeShortcut(shortcutId: string): boolean {
    const removed = this.shortcuts.delete(shortcutId)
    if (removed) {
      this.ctx.emit('desktop-enhanced/shortcut-removed', shortcutId)
    }
    return removed
  }
  
  /** Get all keyboard shortcuts */
  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values())
  }
  
  /** Execute keyboard shortcut */
  executeShortcut(shortcutId: string): boolean {
    const shortcut = this.shortcuts.get(shortcutId)
    if (!shortcut || !shortcut.enabled) return false
    
    try {
      shortcut.action()
      this.ctx.emit('desktop-enhanced/shortcut-executed', shortcutId)
      return true
    } catch (error) {
      this.ctx.emit('desktop-enhanced/shortcut-error', shortcutId, error)
      return false
    }
  }
  
  /** Update configuration */
  updateConfig(config: Partial<DesktopEnhancedConfig>): void {
    this.config = { ...this.config, ...config }
    this.ctx.emit('desktop-enhanced/config-changed', this.config)
  }
  
  /** Get configuration */
  getConfig(): DesktopEnhancedConfig {
    return { ...this.config }
  }
}

/** Plugin configuration */
export interface Config {
  /** Enable desktop enhanced features */
  enabled?: boolean
  /** Current theme ID */
  themeId?: string
  /** Enable system tray */
  enableSystemTray?: boolean
  /** Enable notifications */
  enableNotifications?: boolean
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean
  /** Enable auto-start */
  enableAutoStart?: boolean
  /** Enable minimize to tray */
  enableMinimizeToTray?: boolean
}

/**
 * Create desktop enhanced plugin.
 * @param config - plugin configuration.
 * @returns the Cordis plugin.
 */
export function createDesktopEnhancedPlugin(config: Config = {}): {
  name: string
  inject: string[]
  apply: (ctx: Context) => void
} {
  return {
    name: 'desktop-enhanced',
    inject: ['settings'],
    apply(ctx) {
      const service = new DesktopEnhancedService(ctx)
      ctx.desktopEnhanced = service
      
      // Apply configuration
      if (Object.keys(config).length > 0) {
        service.updateConfig(config)
      }
      
      // Register settings section
      ctx.effect(() => {
        const scope = ctx.settings.register(
          settingsNamespace('desktop-enhanced'),
          z.object({
            enabled: z.boolean().default(true),
            themeId: z.string().default('system'),
            enableSystemTray: z.boolean().default(true),
            enableNotifications: z.boolean().default(true),
            enableKeyboardShortcuts: z.boolean().default(true),
            enableAutoStart: z.boolean().default(false),
            enableMinimizeToTray: z.boolean().default(true),
          }),
          {
            base: {
              enabled: true,
              themeId: 'system',
              enableSystemTray: true,
              enableNotifications: true,
              enableKeyboardShortcuts: true,
              enableAutoStart: false,
              enableMinimizeToTray: true,
            },
          }
        )
        
        // Watch for settings changes
        scope.watch((next) => {
          service.updateConfig(next)
        })
        
        return () => {
          // Cleanup
        }
      })
    },
  }
}

// Type augmentation for Cordis context
declare module '@deepseek-ai/cordis' {
  interface Context {
    desktopEnhanced: DesktopEnhancedService
  }
}

// Event declarations
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Theme changed.
     * @param theme - new theme.
     * @mode emit
     */
    'desktop-enhanced/theme-changed'(theme: Theme): void
    
    /**
     * Theme registered.
     * @param theme - registered theme.
     * @mode emit
     */
    'desktop-enhanced/theme-registered'(theme: Theme): void
    
    /**
     * Theme removed.
     * @param theme - removed theme.
     * @mode emit
     */
    'desktop-enhanced/theme-removed'(theme: Theme): void
    
    /**
     * Notification shown.
     * @param options - notification options.
     * @mode emit
     */
    'desktop-enhanced/notification-shown'(options: NotificationOptions): void
    
    /**
     * Notification closed.
     * @param title - notification title.
     * @mode emit
     */
    'desktop-enhanced/notification-closed'(title: string): void
    
    /**
     * Shortcut registered.
     * @param shortcut - registered shortcut.
     * @mode emit
     */
    'desktop-enhanced/shortcut-registered'(shortcut: KeyboardShortcut): void
    
    /**
     * Shortcut removed.
     * @param shortcutId - removed shortcut ID.
     * @mode emit
     */
    'desktop-enhanced/shortcut-removed'(shortcutId: string): void
    
    /**
     * Shortcut executed.
     * @param shortcutId - executed shortcut ID.
     * @mode emit
     */
    'desktop-enhanced/shortcut-executed'(shortcutId: string): void
    
    /**
     * Shortcut error.
     * @param shortcutId - failed shortcut ID.
     * @param error - error that occurred.
     * @mode emit
     */
    'desktop-enhanced/shortcut-error'(shortcutId: string, error: unknown): void
    
    /**
     * Desktop enhanced configuration changed.
     * @param config - new configuration.
     * @mode emit
     */
    'desktop-enhanced/config-changed'(config: DesktopEnhancedConfig): void
  }
}

export { DesktopEnhancedService as Service }