/**
 * Execution Mode settings store — manages the execution mode state
 * and communicates with the Host through the settings API.
 *
 * @module store
 */

/** Execution mode types */
export type ExecutionMode = 'light' | 'balanced' | 'delivery'

/** Mode configuration */
export interface ModeConfig {
  maxToolCalls: number
  enableStreaming: boolean
  enablePlanMode: boolean
  enableGoalMode: boolean
  enableSubagents?: boolean
  enableEvidenceCollection?: boolean
  enableStrictValidation?: boolean
}

/** Execution mode settings state */
export interface ExecutionModeState {
  /** Current status */
  status: 'idle' | 'loading' | 'error'
  /** Current execution mode */
  currentMode: ExecutionMode
  /** Mode configurations */
  configs: Record<ExecutionMode, ModeConfig>
  /** Whether mode switching is enabled */
  enableModeSwitching: boolean
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
 * Execution Mode store — manages mode state and settings operations.
 */
export class ExecutionModeStore {
  /** Store state */
  private _state: ExecutionModeState = {
    status: 'idle',
    currentMode: 'balanced',
    configs: {
      light: { maxToolCalls: 5, enableStreaming: true, enablePlanMode: false, enableGoalMode: false },
      balanced: { maxToolCalls: 10, enableStreaming: true, enablePlanMode: true, enableGoalMode: true, enableSubagents: true },
      delivery: { maxToolCalls: 20, enableStreaming: true, enablePlanMode: true, enableGoalMode: true, enableSubagents: true, enableEvidenceCollection: true, enableStrictValidation: true },
    },
    enableModeSwitching: true,
  }
  
  /** Listeners */
  private _listeners = new Set<() => void>()
  
  /** API reference */
  private _api: SettingsApi
  
  constructor(api: SettingsApi) {
    this._api = api
  }
  
  /** Get current snapshot */
  getSnapshot(): ExecutionModeState {
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
      const data = await this._api.read('execution-mode')
      this._state = {
        ...this._state,
        status: 'idle',
        currentMode: (data.currentMode as ExecutionMode) || 'balanced',
        configs: (data.configs as Record<ExecutionMode, ModeConfig>) || this._state.configs,
        enableModeSwitching: (data.enableModeSwitching as boolean) ?? true,
      }
    } catch (error) {
      this._state = {
        ...this._state,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to load execution mode settings',
      }
    }
    this._notify()
  }
  
  /** Switch execution mode */
  async setMode(mode: ExecutionMode): Promise<void> {
    const previousMode = this._state.currentMode
    this._state = { ...this._state, currentMode: mode }
    this._notify()
    
    try {
      await this._api.write('execution-mode', { currentMode: mode })
    } catch (error) {
      // Revert on failure
      this._state = { ...this._state, currentMode: previousMode }
      this._notify()
      throw error
    }
  }
  
  /** Update mode configuration */
  async updateConfig(mode: ExecutionMode, config: Partial<ModeConfig>): Promise<void> {
    const previousConfigs = this._state.configs
    this._state = {
      ...this._state,
      configs: {
        ...this._state.configs,
        [mode]: { ...this._state.configs[mode], ...config },
      },
    }
    this._notify()
    
    try {
      await this._api.write('execution-mode', { configs: this._state.configs })
    } catch (error) {
      // Revert on failure
      this._state = { ...this._state, configs: previousConfigs }
      this._notify()
      throw error
    }
  }
  
  /** Toggle mode switching */
  async toggleModeSwitching(enabled: boolean): Promise<void> {
    const previous = this._state.enableModeSwitching
    this._state = { ...this._state, enableModeSwitching: enabled }
    this._notify()
    
    try {
      await this._api.write('execution-mode', { enableModeSwitching: enabled })
    } catch (error) {
      this._state = { ...this._state, enableModeSwitching: previous }
      this._notify()
      throw error
    }
  }
}