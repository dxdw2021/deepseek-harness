/**
 * Tool Registry settings store — manages the tool registry state
 * and communicates with the Host through the settings API.
 *
 * @module store
 */

/** Tool category types */
export type ToolCategory =
  | 'file'
  | 'shell'
  | 'task'
  | 'network'
  | 'search'
  | 'code'
  | 'memory'
  | 'mcp'
  | 'skill'
  | 'subagent'
  | 'workflow'
  | 'custom'

/** Tool permission levels */
export type ToolPermission = 'read' | 'write' | 'execute' | 'admin'

/** Tool definition */
export interface ToolDefinition {
  name: string
  description: string
  category: ToolCategory
  permissions: ToolPermission[]
  readOnly: boolean
  streaming: boolean
  enabled: boolean
  usageCount: number
  lastUsed?: Date
}

/** Tool Registry state */
export interface ToolRegistryState {
  /** Current status */
  status: 'idle' | 'loading' | 'error'
  /** List of tools */
  tools: ToolDefinition[]
  /** Filtered tools */
  filteredTools: ToolDefinition[]
  /** Current category filter */
  categoryFilter: ToolCategory | 'all'
  /** Search query */
  searchQuery: string
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
 * Tool Registry store — manages tool state and settings operations.
 */
export class ToolRegistryStore {
  /** Store state */
  private _state: ToolRegistryState = {
    status: 'idle',
    tools: [],
    filteredTools: [],
    categoryFilter: 'all',
    searchQuery: '',
  }
  
  /** Listeners */
  private _listeners = new Set<() => void>()
  
  /** API reference */
  private _api: SettingsApi
  
  constructor(api: SettingsApi) {
    this._api = api
  }
  
  /** Get current snapshot */
  getSnapshot(): ToolRegistryState {
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
  
  /** Update filtered tools based on current filters */
  private _updateFilteredTools(): void {
    let filtered = this._state.tools
    
    if (this._state.categoryFilter !== 'all') {
      filtered = filtered.filter(tool => tool.category === this._state.categoryFilter)
    }
    
    if (this._state.searchQuery) {
      const query = this._state.searchQuery.toLowerCase()
      filtered = filtered.filter(tool =>
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query)
      )
    }
    
    this._state = { ...this._state, filteredTools: filtered }
  }
  
  /** Load tools from Host */
  async load(): Promise<void> {
    this._state = { ...this._state, status: 'loading' }
    this._notify()
    
    try {
      const data = await this._api.read('tool-registry')
      const tools = (data.tools as ToolDefinition[]) || []
      this._state = {
        ...this._state,
        status: 'idle',
        tools,
        filteredTools: tools,
      }
      this._updateFilteredTools()
    } catch (error) {
      this._state = {
        ...this._state,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to load tool registry',
      }
    }
    this._notify()
  }
  
  /** Toggle tool enabled state */
  async toggleTool(toolName: string, enabled: boolean): Promise<void> {
    const previousTools = this._state.tools
    this._state = {
      ...this._state,
      tools: this._state.tools.map(tool =>
        tool.name === toolName ? { ...tool, enabled } : tool
      ),
    }
    this._updateFilteredTools()
    this._notify()
    
    try {
      await this._api.write('tool-registry', { tools: this._state.tools })
    } catch (error) {
      this._state = { ...this._state, tools: previousTools }
      this._updateFilteredTools()
      this._notify()
      throw error
    }
  }
  
  /** Set category filter */
  setCategoryFilter(category: ToolCategory | 'all'): void {
    this._state = { ...this._state, categoryFilter: category }
    this._updateFilteredTools()
    this._notify()
  }
  
  /** Set search query */
  setSearchQuery(query: string): void {
    this._state = { ...this._state, searchQuery: query }
    this._updateFilteredTools()
    this._notify()
  }
}