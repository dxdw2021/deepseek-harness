/**
 * Tool registry and management system for DeepSeek Harness.
 * Provides a centralized registry for managing tools, their schemas, and execution.
 *
 * @module @deepseek-ai/dsh-tool-registry
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Tool category types */
export type ToolCategory =
  | 'file'          // File operations
  | 'shell'         // Shell operations
  | 'task'          // Task management
  | 'network'       // Network operations
  | 'search'        // Search operations
  | 'code'          // Code operations
  | 'memory'        // Memory operations
  | 'mcp'           // MCP tools
  | 'skill'         // Skill tools
  | 'subagent'      // Subagent tools
  | 'workflow'      // Workflow tools
  | 'custom'        // Custom tools

/** Tool permission levels */
export type ToolPermission = 'read' | 'write' | 'execute' | 'admin'

/** Tool definition */
export interface ToolDefinition {
  /** Unique tool name */
  name: string
  /** Tool description */
  description: string
  /** Tool category */
  category: ToolCategory
  /** Tool permissions required */
  permissions: ToolPermission[]
  /** Tool schema */
  schema: Record<string, unknown>
  /** Tool execution function */
  execute: (args: unknown, context: ToolExecutionContext) => Promise<unknown>
  /** Tool preview function (optional) */
  preview?: (args: unknown) => Promise<string>
  /** Tool image function (optional) */
  image?: (args: unknown) => Promise<Buffer>
  /** Whether tool is read-only */
  readOnly: boolean
  /** Whether tool supports streaming */
  streaming: boolean
  /** Tool timeout in milliseconds */
  timeoutMs?: number
  /** Tool metadata */
  metadata?: Record<string, unknown>
}

/** Tool execution context */
export interface ToolExecutionContext {
  /** Current session ID */
  sessionId: string
  /** Current agent ID */
  agentId: string
  /** Working directory */
  cwd: string
  /** User ID */
  userId?: string
  /** Tool call ID */
  callId: string
  /** Abort signal */
  signal: AbortSignal
  /** Additional context */
  context?: Record<string, unknown>
}

/** Tool execution result */
export interface ToolExecutionResult {
  /** Whether execution was successful */
  success: boolean
  /** Result value */
  value?: unknown
  /** Error message if failed */
  error?: string
  /** Execution metadata */
  metadata?: Record<string, unknown>
  /** Execution time in milliseconds */
  executionTime: number
  /** Token usage if applicable */
  tokenUsage?: {
    input: number
    output: number
    total: number
  }
}

/** Tool registry configuration */
export interface ToolRegistryConfig {
  /** Enable tool registry */
  enabled: boolean
  /** Default tool timeout in milliseconds */
  defaultTimeoutMs: number
  /** Maximum concurrent tool executions */
  maxConcurrentExecutions: number
  /** Enable tool caching */
  enableCaching: boolean
  /** Cache TTL in milliseconds */
  cacheTtlMs: number
  /** Enable tool metrics */
  enableMetrics: boolean
  /** Enable tool logging */
  enableLogging: boolean
}

/** Tool registry service definition */
export class ToolRegistryService extends Service {
  static inject = ['settings']

  /** Tool definitions registry */
  private tools: Map<string, ToolDefinition> = new Map()

  /** Tool execution metrics */
  private metrics: Map<string, {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageExecutionTime: number
    lastExecutionTime?: Date
  }> = new Map()

  /** Tool cache */
  private cache: Map<string, {
    result: unknown
    timestamp: Date
    ttl: number
  }> = new Map()

  /** Configuration */
  private config: ToolRegistryConfig = {
    enabled: true,
    defaultTimeoutMs: 30000,
    maxConcurrentExecutions: 10,
    enableCaching: true,
    cacheTtlMs: 300000, // 5 minutes
    enableMetrics: true,
    enableLogging: true,
  }

  constructor(ctx: Context) {
    super(ctx, 'toolRegistry')
  }

  /** Register a tool */
  register(tool: ToolDefinition): () => void {
    if (!this.config.enabled) {
      throw new Error('Tool registry is disabled')
    }

    // Validate tool name
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`)
    }

    // Register tool
    this.tools.set(tool.name, tool)

    // Initialize metrics
    this.metrics.set(tool.name, {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
    })

    // Emit registration event
    this.ctx.emit('tool-registry/tool-registered', tool.name, tool.category)

    // Return disposer
    return () => {
      this.tools.delete(tool.name)
      this.metrics.delete(tool.name)
      this.ctx.emit('tool-registry/tool-unregistered', tool.name)
    }
  }

  /** Get a tool by name */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /** Get all tools */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  /** Get tools by category */
  getByCategory(category: ToolCategory): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool => tool.category === category)
  }

  /** Get tools by permission */
  getByPermission(permission: ToolPermission): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool =>
      tool.permissions.includes(permission),
    )
  }

  /** Get read-only tools */
  getReadOnlyTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool => tool.readOnly)
  }

  /** Get writable tools */
  getWritableTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool => !tool.readOnly)
  }

  /** Execute a tool */
  async execute(
    name: string,
    args: unknown,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now()

    // Get tool definition
    const tool = this.tools.get(name)
    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found`,
        executionTime: Date.now() - startTime,
      }
    }

    // Check permissions
    if (!this.hasRequiredPermissions(tool, context)) {
      return {
        success: false,
        error: `Insufficient permissions for tool "${name}"`,
        executionTime: Date.now() - startTime,
      }
    }

    // Check cache
    const cacheKey = this.getCacheKey(name, args)
    if (this.config.enableCaching && tool.readOnly) {
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp.getTime() < cached.ttl) {
        return {
          success: true,
          value: cached.result,
          metadata: { fromCache: true },
          executionTime: Date.now() - startTime,
        }
      }
    }

    // Execute tool
    try {
      const result = await Promise.race([
        tool.execute(args, context),
        this.createTimeoutPromise(tool.timeoutMs || this.config.defaultTimeoutMs, context.signal),
      ])

      // Update metrics
      this.updateMetrics(name, true, Date.now() - startTime)

      // Cache result
      if (this.config.enableCaching && tool.readOnly) {
        this.cache.set(cacheKey, {
          result,
          timestamp: new Date(),
          ttl: this.config.cacheTtlMs,
        })
      }

      // Emit execution event
      this.ctx.emit('tool-registry/tool-executed', name, true, Date.now() - startTime)

      return {
        success: true,
        value: result,
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      // Update metrics
      this.updateMetrics(name, false, Date.now() - startTime)

      // Emit execution event
      this.ctx.emit('tool-registry/tool-executed', name, false, Date.now() - startTime)

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      }
    }
  }

  /** Get tool metrics */
  getMetrics(name: string): Record<string, unknown> | undefined {
    return this.metrics.get(name)
  }

  /** Get all metrics */
  getAllMetrics(): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {}
    for (const [name, metrics] of this.metrics) {
      result[name] = metrics
    }
    return result
  }

  /** Clear cache */
  clearCache(): void {
    this.cache.clear()
  }

  /** Get cache size */
  getCacheSize(): number {
    return this.cache.size
  }

  /** Update configuration */
  updateConfig(config: Partial<ToolRegistryConfig>): void {
    this.config = { ...this.config, ...config }
    this.ctx.emit('tool-registry/config-changed', this.config)
  }

  /** Get configuration */
  getConfig(): ToolRegistryConfig {
    return { ...this.config }
  }

  /** Check if tool has required permissions */
  private hasRequiredPermissions(_tool: ToolDefinition, _context: ToolExecutionContext): boolean {
    // In a real implementation, this would check against user permissions
    // For now, return true
    return true
  }

  /** Get cache key for tool execution */
  private getCacheKey(name: string, args: unknown): string {
    return `${name}:${JSON.stringify(args)}`
  }

  /** Create timeout promise */
  private createTimeoutPromise(timeoutMs: number, signal: AbortSignal): Promise<never> {
    return new Promise((_, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      signal.addEventListener('abort', () => {
        clearTimeout(timeout)
        reject(new Error('Tool execution cancelled'))
      })
    })
  }

  /** Update tool metrics */
  private updateMetrics(name: string, success: boolean, executionTime: number): void {
    if (!this.config.enableMetrics) return

    const metrics = this.metrics.get(name)
    if (!metrics) return

    metrics.totalExecutions++
    if (success) {
      metrics.successfulExecutions++
    } else {
      metrics.failedExecutions++
    }

    // Update average execution time
    metrics.averageExecutionTime =
      (metrics.averageExecutionTime * (metrics.totalExecutions - 1) + executionTime) /
      metrics.totalExecutions

    metrics.lastExecutionTime = new Date()
  }
}

/** Plugin configuration */
export interface Config {
  /** Enable tool registry */
  enabled?: boolean
  /** Default tool timeout in milliseconds */
  defaultTimeoutMs?: number
  /** Maximum concurrent tool executions */
  maxConcurrentExecutions?: number
  /** Enable tool caching */
  enableCaching?: boolean
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number
  /** Enable tool metrics */
  enableMetrics?: boolean
  /** Enable tool logging */
  enableLogging?: boolean
}

/**
 * Create tool registry plugin.
 * @param config - plugin configuration.
 * @returns the Cordis plugin.
 */
export function createToolRegistryPlugin(config: Config = {}): {
  name: string
  inject: string[]
  apply: (ctx: Context) => void
} {
  return {
    name: 'tool-registry',
    inject: ['settings'],
    apply(ctx) {
      const service = new ToolRegistryService(ctx)
      ctx.toolRegistry = service

      // Apply configuration
      if (Object.keys(config).length > 0) {
        service.updateConfig(config)
      }

      // Register settings section
      ctx.effect(() => {
        const scope = ctx.settings.register(
          settingsNamespace('tool-registry'),
          z.object({
            enabled: z.boolean().default(true),
            defaultTimeoutMs: z.number().min(1000).max(300000).default(30000),
            maxConcurrentExecutions: z.number().min(1).max(100).default(10),
            enableCaching: z.boolean().default(true),
            cacheTtlMs: z.number().min(0).max(3600000).default(300000),
            enableMetrics: z.boolean().default(true),
            enableLogging: z.boolean().default(true),
          }),
          {
            base: {
              enabled: true,
              defaultTimeoutMs: 30000,
              maxConcurrentExecutions: 10,
              enableCaching: true,
              cacheTtlMs: 300000,
              enableMetrics: true,
              enableLogging: true,
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
    },
  }
}

// Type augmentation for Cordis context
declare module '@deepseek-ai/cordis' {
  interface Context {
    toolRegistry: ToolRegistryService
  }
}

// Event declarations
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Tool registered.
     * @param name - tool name.
     * @param category - tool category.
     * @mode emit
     */
    'tool-registry/tool-registered'(name: string, category: ToolCategory): void

    /**
     * Tool unregistered.
     * @param name - tool name.
     * @mode emit
     */
    'tool-registry/tool-unregistered'(name: string): void

    /**
     * Tool executed.
     * @param name - tool name.
     * @param success - whether execution was successful.
     * @param executionTime - execution time in milliseconds.
     * @mode emit
     */
    'tool-registry/tool-executed'(name: string, success: boolean, executionTime: number): void

    /**
     * Tool registry configuration changed.
     * @param config - new configuration.
     * @mode emit
     */
    'tool-registry/config-changed'(config: ToolRegistryConfig): void
  }
}

export { ToolRegistryService as Service }
