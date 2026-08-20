/**
 * Theme Enhanced settings store — manages the theme configuration state
 * and communicates with the Host through the settings API.
 *
 * @module store
 */

/** Theme types */
export type ThemeType = 'light' | 'dark' | 'system' | 'custom'

/** Theme colors */
export interface ThemeColors {
  primary: string
  secondary: string
  background: string
  surface: string
  text: string
  textSecondary: string
  border: string
  error: string
  warning: string
  success: string
  info: string
}

/** Theme definition */
export interface Theme {
  id: string
  name: string
  type: ThemeType
  colors: ThemeColors
  builtin: boolean
}

/** Theme Enhanced state */
export interface ThemeEnhancedState {
  /** Current status */
  status: 'idle' | 'loading' | 'error'
  /** Available themes */
  themes: Theme[]
  /** Current theme ID */
  currentThemeId: string
  /** Preview theme */
  previewTheme: Theme | null
  /** Custom theme being edited */
  editingTheme: Theme | null
  /** Error message if failed */
  error?: string
}

/** API interface for settings operations */
export interface SettingsApi {
  /** Read settings namespace */
  read(namespace: string): Promise<Record<string, unknown>>
  /** Write settings namespace */
  write(namespace: string, data: Record<string, unknown>): Promise<void>
}

/**
 * Theme Enhanced store — manages theme state and settings operations.
 */
export class ThemeEnhancedStore {
  /** Store state */
  private _state: ThemeEnhancedState = {
    status: 'idle',
    themes: [
      {
        id: 'light',
        name: 'Light',
        type: 'light',
        colors: {
          primary: '#1a73e8',
          secondary: '#5f6368',
          background: '#ffffff',
          surface: '#f8f9fa',
          text: '#202124',
          textSecondary: '#5f6368',
          border: '#dadce0',
          error: '#d93025',
          warning: '#f9ab00',
          success: '#1e8e3e',
          info: '#1a73e8',
        },
        builtin: true,
      },
      {
        id: 'dark',
        name: 'Dark',
        type: 'dark',
        colors: {
          primary: '#8ab4f8',
          secondary: '#9aa0a6',
          background: '#202124',
          surface: '#303134',
          text: '#e8eaed',
          textSecondary: '#9aa0a6',
          border: '#5f6368',
          error: '#f28b82',
          warning: '#fdd663',
          success: '#81c995',
          info: '#8ab4f8',
        },
        builtin: true,
      },
      {
        id: 'system',
        name: 'System',
        type: 'system',
        colors: {
          primary: '#1a73e8',
          secondary: '#5f6368',
          background: '#ffffff',
          surface: '#f8f9fa',
          text: '#202124',
          textSecondary: '#5f6368',
          border: '#dadce0',
          error: '#d93025',
          warning: '#f9ab00',
          success: '#1e8e3e',
          info: '#1a73e8',
        },
        builtin: true,
      },
    ],
    currentThemeId: 'system',
    previewTheme: null,
    editingTheme: null,
  }
  
  /** Listeners */
  private _listeners = new Set<() => void>()
  
  /** API reference */
  private _api: SettingsApi
  
  constructor(api: SettingsApi) {
    this._api = api
  }
  
  /** Get current snapshot */
  getSnapshot(): ThemeEnhancedState {
    return this._state
  }
  
  /** Subscribe to changes */
  subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => { this._listeners.delete(listener) }
  }
  
  /** Notify listeners */
  private _notify(): void {
    for (const listener of this._listeners) listener()
  }
  
  /** Load settings from Host */
  async load(): Promise<void> {
    this._state = { ...this._state, status: 'loading' }
    this._notify()
    
    try {
      const data = await this._api.read('theme-enhanced')
      this._state = {
        ...this._state,
        status: 'idle',
        themes: (data.themes as Theme[]) || this._state.themes,
        currentThemeId: (data.currentThemeId as string) || 'system',
      }
    } catch (error) {
      this._state = {
        ...this._state,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to load theme settings',
      }
    }
    this._notify()
  }
  
  /** Select theme */
  async selectTheme(themeId: string): Promise<void> {
    const previous = this._state.currentThemeId
    this._state = { ...this._state, currentThemeId: themeId }
    this._notify()
    
    try {
      await this._api.write('theme-enhanced', { currentThemeId: themeId })
    } catch (error) {
      this._state = { ...this._state, currentThemeId: previous }
      this._notify()
      throw error
    }
  }
  
  /** Start previewing theme */
  startPreview(theme: Theme): void {
    this._state = { ...this._state, previewTheme: theme }
    this._notify()
  }
  
  /** Stop previewing theme */
  stopPreview(): void {
    this._state = { ...this._state, previewTheme: null }
    this._notify()
  }
  
  /** Start editing custom theme */
  startEditing(theme: Theme | null): void {
    this._state = { ...this._state, editingTheme: theme ? { ...theme } : null }
    this._notify()
  }
  
  /** Update custom theme colors */
  updateEditingTheme(colors: Partial<ThemeColors>): void {
    if (!this._state.editingTheme) return
    this._state = {
      ...this._state,
      editingTheme: {
        ...this._state.editingTheme,
        colors: { ...this._state.editingTheme.colors, ...colors },
      },
    }
    this._notify()
  }
  
  /** Save custom theme */
  async saveCustomTheme(): Promise<void> {
    if (!this._state.editingTheme) return
    
    const previousThemes = this._state.themes
    const existingIndex = this._state.themes.findIndex(t => t.id === this._state.editingTheme!.id)
    
    if (existingIndex >= 0) {
      // Update existing custom theme
      this._state = {
        ...this._state,
        themes: this._state.themes.map(t =>
          t.id === this._state.editingTheme!.id ? this._state.editingTheme! : t
        ),
        editingTheme: null,
      }
    } else {
      // Add new custom theme
      this._state = {
        ...this._state,
        themes: [...this._state.themes, this._state.editingTheme!],
        editingTheme: null,
      }
    }
    this._notify()
    
    try {
      await this._api.write('theme-enhanced', { themes: this._state.themes })
    } catch (error) {
      this._state = { ...this._state, themes: previousThemes }
      this._notify()
      throw error
    }
  }
  
  /** Delete custom theme */
  async deleteCustomTheme(themeId: string): Promise<void> {
    const previousThemes = this._state.themes
    this._state = {
      ...this._state,
      themes: this._state.themes.filter(t => t.id !== themeId || t.builtin),
      currentThemeId: this._state.currentThemeId === themeId ? 'system' : this._state.currentThemeId,
    }
    this._notify()
    
    try {
      await this._api.write('theme-enhanced', {
        themes: this._state.themes,
        currentThemeId: this._state.currentThemeId,
      })
    } catch (error) {
      this._state = { ...this._state, themes: previousThemes }
      this._notify()
      throw error
    }
  }
}