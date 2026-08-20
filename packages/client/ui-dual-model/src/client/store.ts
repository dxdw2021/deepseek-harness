/**
 * Dual Model settings store — manages the dual model configuration state
 * and communicates with the Host through the settings API.
 *
 * @module store
 */

/** Model roles in dual model collaboration */
export type ModelRole = 'executor' | 'planner'

/** Model configuration */
export interface ModelConfig {
  provider: string
  model: string
  maxTokens?: number
  temperature?: number
}

/** Collaboration strategies */
export type CollaborationStrategy =
  | 'sequential'
  | 'parallel'
  | 'iterative'
  | 'adaptive'

/** Dual model configuration state */
export interface DualModelState {
  /** Current status */
  status: 'idle' | 'loading' | 'error'
  /** Whether dual model is enabled */
  enabled: boolean
  /** Executor model configuration */
  executor: ModelConfig
  /** Planner model configuration */
  planner: ModelConfig
  /** Collaboration strategy */
  strategy: CollaborationStrategy
  /** Available providers */
  availableProviders: string[]
  /** Available models per provider */
  availableModels: Record<string, string[]>
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
 * Dual Model store — manages configuration state and settings operations.
 */
export class DualModelStore {
  /** Store state */
  private _state: DualModelState = {
    status: 'idle',
    enabled: false,
    executor: { provider: 'deepseek', model: 'deepseek-chat' },
    planner: { provider: 'deepseek', model: 'deepseek-reasoner' },
    strategy: 'sequential',
    availableProviders: ['deepseek', 'openai', 'anthropic'],
    availableModels: {
      deepseek: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
      openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    },
  }
  
  /** Listeners */
  private _listeners = new Set<() => void>()
  
  /** API reference */
  private _api: SettingsApi
  
  constructor(api: SettingsApi) {
    this._api = api
  }
  
  /** Get current snapshot */
  getSnapshot(): DualModelState {
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
      const data = await this._api.read('dual-model')
      this._state = {
        ...this._state,
        status: 'idle',
        enabled: (data.enabled as boolean) ?? false,
        executor: (data.executor as ModelConfig) ?? this._state.executor,
        planner: (data.planner as ModelConfig) ?? this._state.planner,
        strategy: (data.strategy as CollaborationStrategy) ?? 'sequential',
      }
    } catch (error) {
      this._state = {
        ...this._state,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to load dual model settings',
      }
    }
    this._notify()
  }
  
  /** Toggle dual model enabled state */
  async toggleEnabled(enabled: boolean): Promise<void> {
    const previous = this._state.enabled
    this._state = { ...this._state, enabled }
    this._notify()
    
    try {
      await this._api.write('dual-model', { enabled })
    } catch (error) {
      this._state = { ...this._state, enabled: previous }
      this._notify()
      throw error
    }
  }
  
  /** Update executor model configuration */
  async updateExecutor(config: Partial<ModelConfig>): Promise<void> {
    const previous = this._state.executor
    this._state = { ...this._state, executor: { ...this._state.executor, ...config } }
    this._notify()
    
    try {
      await this._api.write('dual-model', { executor: this._state.executor })
    } catch (error) {
      this._state = { ...this._state, executor: previous }
      this._notify()
      throw error
    }
  }
  
  /** Update planner model configuration */
  async updatePlanner(config: Partial<ModelConfig>): Promise<void> {
    const previous = this._state.planner
    this._state = { ...this._state, planner: { ...this._state.planner, ...config } }
    this._notify()
    
    try {
      await this._api.write('dual-model', { planner: this._state.planner })
    } catch (error) {
      this._state = { ...this._state, planner: previous }
      this._notify()
      throw error
    }
  }
  
  /** Update collaboration strategy */
  async updateStrategy(strategy: CollaborationStrategy): Promise<void> {
    const previous = this._state.strategy
    this._state = { ...this._state, strategy }
    this._notify()
    
    try {
      await this._api.write('dual-model', { strategy })
    } catch (error) {
      this._state = { ...this._state, strategy: previous }
      this._notify()
      throw error
    }
  }
}