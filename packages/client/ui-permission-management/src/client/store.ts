/**
 * Permission Management settings store — manages the permission rules and audit logs
 * and communicates with the Host through the settings API.
 *
 * @module store
 */

/** Permission action types */
export type PermissionAction = 'read' | 'write' | 'execute' | 'admin' | 'create' | 'delete' | 'update'

/** Resource types */
export type ResourceType =
  | 'file'
  | 'directory'
  | 'tool'
  | 'session'
  | 'agent'
  | 'plugin'
  | 'system'

/** Permission rule */
export interface PermissionRule {
  id: string
  description: string
  resourceType: ResourceType
  resourcePattern: string
  actions: PermissionAction[]
  priority: number
  enabled: boolean
}

/** Permission audit log entry */
export interface PermissionAuditEntry {
  id: string
  timestamp: Date
  userId: string
  resourceType: ResourceType
  resource: string
  action: PermissionAction
  granted: boolean
  reason?: string
}

/** Permission Management state */
export interface PermissionManagementState {
  /** Current status */
  status: 'idle' | 'loading' | 'error'
  /** Permission rules */
  rules: PermissionRule[]
  /** Audit log entries */
  auditLog: PermissionAuditEntry[]
  /** Current tab */
  activeTab: 'rules' | 'audit'
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
 * Permission Management store — manages permission state and settings operations.
 */
export class PermissionManagementStore {
  /** Store state */
  private _state: PermissionManagementState = {
    status: 'idle',
    rules: [],
    auditLog: [],
    activeTab: 'rules',
  }
  
  /** Listeners */
  private _listeners = new Set<() => void>()
  
  /** API reference */
  private _api: SettingsApi
  
  constructor(api: SettingsApi) {
    this._api = api
  }
  
  /** Get current snapshot */
  getSnapshot(): PermissionManagementState {
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
      const data = await this._api.read('permission-management')
      this._state = {
        ...this._state,
        status: 'idle',
        rules: (data.rules as PermissionRule[]) || [],
        auditLog: (data.auditLog as PermissionAuditEntry[]) || [],
      }
    } catch (error) {
      this._state = {
        ...this._state,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to load permission management',
      }
    }
    this._notify()
  }
  
  /** Toggle rule enabled state */
  async toggleRule(ruleId: string, enabled: boolean): Promise<void> {
    const previousRules = this._state.rules
    this._state = {
      ...this._state,
      rules: this._state.rules.map(rule =>
        rule.id === ruleId ? { ...rule, enabled } : rule
      ),
    }
    this._notify()
    
    try {
      await this._api.write('permission-management', { rules: this._state.rules })
    } catch (error) {
      this._state = { ...this._state, rules: previousRules }
      this._notify()
      throw error
    }
  }
  
  /** Create a new rule */
  async createRule(rule: Omit<PermissionRule, 'id'>): Promise<void> {
    const newRule: PermissionRule = {
      ...rule,
      id: `rule-${Date.now()}`,
    }
    const previousRules = this._state.rules
    this._state = {
      ...this._state,
      rules: [...this._state.rules, newRule],
    }
    this._notify()
    
    try {
      await this._api.write('permission-management', { rules: this._state.rules })
    } catch (error) {
      this._state = { ...this._state, rules: previousRules }
      this._notify()
      throw error
    }
  }
  
  /** Delete a rule */
  async deleteRule(ruleId: string): Promise<void> {
    const previousRules = this._state.rules
    this._state = {
      ...this._state,
      rules: this._state.rules.filter(rule => rule.id !== ruleId),
    }
    this._notify()
    
    try {
      await this._api.write('permission-management', { rules: this._state.rules })
    } catch (error) {
      this._state = { ...this._state, rules: previousRules }
      this._notify()
      throw error
    }
  }
  
  /** Set active tab */
  setActiveTab(tab: 'rules' | 'audit'): void {
    this._state = { ...this._state, activeTab: tab }
    this._notify()
  }
}