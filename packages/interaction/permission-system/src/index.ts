/**
 * Permission system for DeepSeek Harness.
 * Provides role-based access control and permission management.
 *
 * @module @deepseek-ai/dsh-permission-system
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Permission action types */
export type PermissionAction = 'read' | 'write' | 'execute' | 'admin' | 'create' | 'delete' | 'update'

/** Resource types */
export type ResourceType =
  | 'file'        // File operations
  | 'directory'   // Directory operations
  | 'tool'        // Tool execution
  | 'session'     // Session management
  | 'agent'       // Agent operations
  | 'plugin'      // Plugin management
  | 'system'      // System operations

/** Permission rule */
export interface PermissionRule {
  /** Rule ID */
  id: string
  /** Rule description */
  description: string
  /** Resource type */
  resourceType: ResourceType
  /** Resource pattern (glob or regex) */
  resourcePattern: string
  /** Allowed actions */
  actions: PermissionAction[]
  /** Conditions for the rule */
  conditions?: PermissionCondition[]
  /** Priority (higher = more important) */
  priority: number
  /** Whether rule is enabled */
  enabled: boolean
}

/** Permission condition */
export interface PermissionCondition {
  /** Condition type */
  type: 'time' | 'user' | 'context' | 'environment'
  /** Condition operator */
  operator: 'equals' | 'not_equals' | 'contains' | 'matches' | 'gt' | 'lt'
  /** Condition value */
  value: unknown
}

/** Permission check result */
export interface PermissionCheckResult {
  /** Whether permission is granted */
  granted: boolean
  /** Reason for denial (if denied) */
  reason?: string
  /** Matching rule ID */
  ruleId?: string
  /** Check timestamp */
  timestamp: Date
}

/** Permission audit log entry */
export interface PermissionAuditEntry {
  /** Entry ID */
  id: string
  /** Timestamp */
  timestamp: Date
  /** User or agent ID */
  userId: string
  /** Resource type */
  resourceType: ResourceType
  /** Resource identifier */
  resource: string
  /** Requested action */
  action: PermissionAction
  /** Whether action was granted */
  granted: boolean
  /** Reason for denial */
  reason?: string
  /** Additional context */
  context?: Record<string, unknown>
}

/** Permission system configuration */
export interface PermissionSystemConfig {
  /** Enable permission system */
  enabled: boolean
  /** Enable audit logging */
  enableAuditLog: boolean
  /** Maximum audit log entries */
  maxAuditLogEntries: number
  /** Enable permission caching */
  enableCaching: boolean
  /** Cache TTL in milliseconds */
  cacheTtlMs: number
  /** Default policy (allow/deny) */
  defaultPolicy: 'allow' | 'deny'
  /** Enable role-based access */
  enableRoleBasedAccess: boolean
}

/** Permission system service definition */
export class PermissionSystemService extends Service {
  static inject = ['settings']

  /** Permission rules */
  private rules: Map<string, PermissionRule> = new Map()

  /** Audit log */
  private auditLog: PermissionAuditEntry[] = []

  /** Permission cache */
  private cache: Map<string, { result: PermissionCheckResult; timestamp: Date }> = new Map()

  /** Configuration */
  private config: PermissionSystemConfig = {
    enabled: true,
    enableAuditLog: true,
    maxAuditLogEntries: 10000,
    enableCaching: true,
    cacheTtlMs: 300000, // 5 minutes
    defaultPolicy: 'deny',
    enableRoleBasedAccess: true,
  }

  constructor(ctx: Context) {
    super(ctx, 'permissionSystem')
  }

  /** Add a permission rule */
  addRule(rule: Omit<PermissionRule, 'id'>): PermissionRule {
    if (!this.config.enabled) {
      throw new Error('Permission system is disabled')
    }

    const id = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newRule: PermissionRule = { ...rule, id }

    this.rules.set(id, newRule)
    this.ctx.emit('permission-system/rule-added', newRule)

    return newRule
  }

  /** Update a permission rule */
  updateRule(id: string, updates: Partial<Omit<PermissionRule, 'id'>>): PermissionRule | undefined {
    const rule = this.rules.get(id)
    if (!rule) return undefined

    const updatedRule: PermissionRule = { ...rule, ...updates, id: rule.id }
    this.rules.set(id, updatedRule)

    this.ctx.emit('permission-system/rule-updated', updatedRule)

    return updatedRule
  }

  /** Remove a permission rule */
  removeRule(id: string): boolean {
    const rule = this.rules.get(id)
    if (!rule) return false

    this.rules.delete(id)
    this.ctx.emit('permission-system/rule-removed', rule)

    return true
  }

  /** Get a permission rule by ID */
  getRule(id: string): PermissionRule | undefined {
    return this.rules.get(id)
  }

  /** Get all permission rules */
  getAllRules(): PermissionRule[] {
    return Array.from(this.rules.values())
  }

  /** Get rules by resource type */
  getRulesByResourceType(resourceType: ResourceType): PermissionRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.resourceType === resourceType)
  }

  /** Check permission */
  checkPermission(
    userId: string,
    resourceType: ResourceType,
    resource: string,
    action: PermissionAction,
    context?: Record<string, unknown>,
  ): PermissionCheckResult {
    if (!this.config.enabled) {
      return { granted: true, timestamp: new Date() }
    }

    // Check cache
    const cacheKey = this.getCacheKey(userId, resourceType, resource, action)
    if (this.config.enableCaching) {
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp.getTime() < this.config.cacheTtlMs) {
        return cached.result
      }
    }

    // Find matching rules
    const matchingRules = this.findMatchingRules(resourceType, resource, action)

    // Evaluate rules
    let result: PermissionCheckResult | undefined

    if (matchingRules.length === 0) {
      // No matching rules, apply default policy
      result = {
        granted: this.config.defaultPolicy === 'allow',
        reason: this.config.defaultPolicy === 'allow' ? 'Default allow policy' : 'Default deny policy',
        timestamp: new Date(),
      }
    } else {
      // Evaluate rules by priority (highest first)
      const sortedRules = matchingRules.sort((a, b) => b.priority - a.priority)

      for (const rule of sortedRules) {
        if (!rule.enabled) continue

        // Check conditions
        if (rule.conditions && !this.evaluateConditions(rule.conditions, context)) {
          continue
        }

        // Check if action is allowed
        if (rule.actions.includes(action)) {
          result = {
            granted: true,
            ruleId: rule.id,
            timestamp: new Date(),
          }
          break
        }
      }

      // If no rule granted permission
      if (!result) {
        result = {
          granted: false,
          reason: 'No matching rule granted permission',
          timestamp: new Date(),
        }
      }
    }

    // Cache result
    if (this.config.enableCaching) {
      this.cache.set(cacheKey, { result, timestamp: new Date() })
    }

    // Audit log
    if (this.config.enableAuditLog) {
      this.addAuditEntry({
        userId,
        resourceType,
        resource,
        action,
        granted: result.granted,
        ...(result.reason !== undefined ? { reason: result.reason } : {}),
        ...(context !== undefined ? { context } : {}),
      })
    }

    // Emit permission check event
    this.ctx.emit('permission-system/permission-checked', userId, resourceType, resource, action, result.granted)

    return result
  }

  /** Find matching rules for a resource and action */
  private findMatchingRules(
    resourceType: ResourceType,
    resource: string,
    action: PermissionAction,
  ): PermissionRule[] {
    const matching: PermissionRule[] = []

    for (const rule of this.rules.values()) {
      if (rule.resourceType !== resourceType) continue
      if (!rule.actions.includes(action)) continue

      // Check resource pattern
      if (this.matchResourcePattern(rule.resourcePattern, resource)) {
        matching.push(rule)
      }
    }

    return matching
  }

  /** Match resource pattern against resource */
  private matchResourcePattern(pattern: string, resource: string): boolean {
    // Simple glob matching - in real implementation would use proper glob matching
    if (pattern === '*') return true
    if (pattern === resource) return true

    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(resource)
  }

  /** Evaluate permission conditions */
  private evaluateConditions(conditions: PermissionCondition[], context?: Record<string, unknown>): boolean {
    if (!conditions || conditions.length === 0) return true
    if (!context) return false

    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false
      }
    }

    return true
  }

  /** Evaluate a single condition */
  private evaluateCondition(condition: PermissionCondition, context: Record<string, unknown>): boolean {
    const value = context[condition.type]
    if (value === undefined) return false

    switch (condition.operator) {
      case 'equals':
        return value === condition.value
      case 'not_equals':
        return value !== condition.value
      case 'contains':
        return String(value).includes(String(condition.value))
      case 'matches':
        return new RegExp(String(condition.value)).test(String(value))
      case 'gt':
        return Number(value) > Number(condition.value)
      case 'lt':
        return Number(value) < Number(condition.value)
      default:
        return false
    }
  }

  /** Get cache key */
  private getCacheKey(
    userId: string,
    resourceType: ResourceType,
    resource: string,
    action: PermissionAction,
  ): string {
    return `${userId}:${resourceType}:${resource}:${action}`
  }

  /** Add audit log entry */
  private addAuditEntry(entry: Omit<PermissionAuditEntry, 'id' | 'timestamp'>): void {
    const auditEntry: PermissionAuditEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    }

    this.auditLog.push(auditEntry)

    // Trim audit log if needed
    if (this.auditLog.length > this.config.maxAuditLogEntries) {
      this.auditLog = this.auditLog.slice(-this.config.maxAuditLogEntries)
    }

    this.ctx.emit('permission-system/audit-entry-added', auditEntry)
  }

  /** Get audit log */
  getAuditLog(limit?: number): PermissionAuditEntry[] {
    if (limit) {
      return this.auditLog.slice(-limit)
    }
    return [...this.auditLog]
  }

  /** Clear audit log */
  clearAuditLog(): void {
    this.auditLog = []
    this.ctx.emit('permission-system/audit-log-cleared')
  }

  /** Clear permission cache */
  clearCache(): void {
    this.cache.clear()
  }

  /** Update configuration */
  updateConfig(config: Partial<PermissionSystemConfig>): void {
    this.config = { ...this.config, ...config }
    this.ctx.emit('permission-system/config-changed', this.config)
  }

  /** Get configuration */
  getConfig(): PermissionSystemConfig {
    return { ...this.config }
  }

  /** Get rule count */
  getRuleCount(): number {
    return this.rules.size
  }

  /** Get audit log count */
  getAuditLogCount(): number {
    return this.auditLog.length
  }
}

/** Plugin configuration */
export interface Config {
  /** Enable permission system */
  enabled?: boolean
  /** Enable audit logging */
  enableAuditLog?: boolean
  /** Maximum audit log entries */
  maxAuditLogEntries?: number
  /** Enable permission caching */
  enableCaching?: boolean
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number
  /** Default policy (allow/deny) */
  defaultPolicy?: 'allow' | 'deny'
  /** Enable role-based access */
  enableRoleBasedAccess?: boolean
}

/** Cordis plugin name for the namespace exports. */
export const name = 'permission-system'

/** Services required before the permission system can mount. */
export const inject = ['settings']

/**
 * Mount the permission system service and register its settings section.
 * @param ctx - cordis context.
 * @param config - plugin configuration.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const service = new PermissionSystemService(ctx)
  ctx.permissionSystem = service

  // Apply configuration
  if (Object.keys(config).length > 0) {
    service.updateConfig(config)
  }

  // Register settings section
  ctx.effect(() => {
    const scope = ctx.settings.register(
      settingsNamespace('permission-system'),
      z.object({
        enabled: z.boolean().default(true),
        enableAuditLog: z.boolean().default(true),
        maxAuditLogEntries: z.number().min(100).max(1000000).default(10000),
        enableCaching: z.boolean().default(true),
        cacheTtlMs: z.number().min(0).max(3600000).default(300000),
        defaultPolicy: z.union([z.const('allow'), z.const('deny')]).default('deny'),
        enableRoleBasedAccess: z.boolean().default(true),
      }),
      {
        base: {
          enabled: true,
          enableAuditLog: true,
          maxAuditLogEntries: 10000,
          enableCaching: true,
          cacheTtlMs: 300000,
          defaultPolicy: 'deny',
          enableRoleBasedAccess: true,
        },
      },
    )

    // Watch for settings changes
    scope.watch((next) => {
      service.updateConfig(next)
    })

    return () => {
      // Cleanup
    }
  })
}

// Type augmentation for Cordis context
declare module '@deepseek-ai/cordis' {
  interface Context {
    permissionSystem: PermissionSystemService
  }
}

// Event declarations
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Permission rule added.
     * @param rule - added rule.
     * @mode emit
     */
    'permission-system/rule-added'(rule: PermissionRule): void

    /**
     * Permission rule updated.
     * @param rule - updated rule.
     * @mode emit
     */
    'permission-system/rule-updated'(rule: PermissionRule): void

    /**
     * Permission rule removed.
     * @param rule - removed rule.
     * @mode emit
     */
    'permission-system/rule-removed'(rule: PermissionRule): void

    /**
     * Permission checked.
     * @param userId - user ID.
     * @param resourceType - resource type.
     * @param resource - resource identifier.
     * @param action - requested action.
     * @param granted - whether permission was granted.
     * @mode emit
     */
    'permission-system/permission-checked'(
      userId: string,
      resourceType: ResourceType,
      resource: string,
      action: PermissionAction,
      granted: boolean
    ): void

    /**
     * Audit entry added.
     * @param entry - audit entry.
     * @mode emit
     */
    'permission-system/audit-entry-added'(entry: PermissionAuditEntry): void

    /**
     * Audit log cleared.
     * @mode emit
     */
    'permission-system/audit-log-cleared'(): void

    /**
     * Permission system configuration changed.
     * @param config - new configuration.
     * @mode emit
     */
    'permission-system/config-changed'(config: PermissionSystemConfig): void
  }
}

export { PermissionSystemService as Service }
