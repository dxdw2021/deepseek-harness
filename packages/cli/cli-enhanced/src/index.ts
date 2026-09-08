/**
 * CLI enhanced service for DeepSeek Harness.
 * Provides enhanced CLI features like interactive mode, session management, and output formatting.
 *
 * @module @deepseek-ai/dsh-cli-enhanced
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** CLI modes */
export type CliMode = 'interactive' | 'single-run' | 'resume' | 'batch'

/** Output formats */
export type OutputFormat = 'text' | 'json' | 'markdown' | 'yaml'

/** CLI configuration */
export interface CliEnhancedConfig {
  /** Enable CLI enhanced features */
  enabled: boolean
  /** Default CLI mode */
  defaultMode: CliMode
  /** Default output format */
  defaultOutputFormat: OutputFormat
  /** Enable color output */
  enableColors: boolean
  /** Enable progress indicators */
  enableProgress: boolean
  /** Enable command history */
  enableHistory: boolean
  /** Maximum history entries */
  maxHistoryEntries: number
  /** Enable auto-completion */
  enableAutoCompletion: boolean
  /** Session timeout in milliseconds */
  sessionTimeoutMs: number
}

/** CLI command definition */
export interface CliCommand {
  /** Command name */
  name: string
  /** Command description */
  description: string
  /** Command aliases */
  aliases: string[]
  /** Command options */
  options: CliCommandOption[]
  /** Command handler */
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

/** CLI command option */
export interface CliCommandOption {
  /** Option name */
  name: string
  /** Option description */
  description: string
  /** Option aliases */
  aliases: string[]
  /** Option type */
  type: 'string' | 'number' | 'boolean' | 'array'
  /** Whether option is required */
  required: boolean
  /** Default value */
  defaultValue?: unknown
}

/** CLI history entry */
export interface CliHistoryEntry {
  /** Entry ID */
  id: string
  /** Command executed */
  command: string
  /** Command arguments */
  args: Record<string, unknown>
  /** Execution timestamp */
  timestamp: Date
  /** Execution duration in milliseconds */
  duration: number
  /** Whether command was successful */
  success: boolean
  /** Error message if failed */
  error?: string
}

/** CLI enhanced service definition */
export class CliEnhancedService extends Service {
  static inject = ['settings', 'sessions']

  /** Registered commands */
  private commands: Map<string, CliCommand> = new Map()

  /** Command history */
  private history: CliHistoryEntry[] = []

  /** Configuration */
  private config: CliEnhancedConfig = {
    enabled: true,
    defaultMode: 'interactive',
    defaultOutputFormat: 'text',
    enableColors: true,
    enableProgress: true,
    enableHistory: true,
    maxHistoryEntries: 1000,
    enableAutoCompletion: true,
    sessionTimeoutMs: 3600000, // 1 hour
  }

  constructor(ctx: Context) {
    super(ctx, 'cliEnhanced')
  }

  /** Register a CLI command */
  registerCommand(command: CliCommand): () => void {
    if (!this.config.enabled) {
      throw new Error('CLI enhanced is disabled')
    }

    this.commands.set(command.name, command)

    // Register aliases
    for (const alias of command.aliases) {
      this.commands.set(alias, command)
    }

    this.ctx.emit('cli-enhanced/command-registered', command.name)

    // Return disposer
    return () => {
      this.commands.delete(command.name)
      for (const alias of command.aliases) {
        this.commands.delete(alias)
      }
      this.ctx.emit('cli-enhanced/command-unregistered', command.name)
    }
  }

  /** Get a command by name */
  getCommand(name: string): CliCommand | undefined {
    return this.commands.get(name)
  }

  /** Get all registered commands */
  getCommands(): CliCommand[] {
    const uniqueCommands = new Map<string, CliCommand>()
    for (const command of this.commands.values()) {
      uniqueCommands.set(command.name, command)
    }
    return Array.from(uniqueCommands.values())
  }

  /** Execute a command */
  async executeCommand(commandName: string, args: Record<string, unknown>): Promise<unknown> {
    const command = this.commands.get(commandName)
    if (!command) {
      throw new Error(`Unknown command: ${commandName}`)
    }

    const startTime = Date.now()
    const historyId = `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    try {
      const result = await command.handler(args)
      const duration = Date.now() - startTime

      // Add to history
      if (this.config.enableHistory) {
        this.addHistoryEntry({
          id: historyId,
          command: commandName,
          args,
          timestamp: new Date(),
          duration,
          success: true,
        })
      }

      this.ctx.emit('cli-enhanced/command-executed', commandName, true, duration)

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Add to history
      if (this.config.enableHistory) {
        this.addHistoryEntry({
          id: historyId,
          command: commandName,
          args,
          timestamp: new Date(),
          duration,
          success: false,
          error: errorMessage,
        })
      }

      this.ctx.emit('cli-enhanced/command-executed', commandName, false, duration)

      throw error
    }
  }

  /** Add history entry */
  private addHistoryEntry(entry: CliHistoryEntry): void {
    this.history.push(entry)

    // Trim history if needed
    if (this.history.length > this.config.maxHistoryEntries) {
      this.history = this.history.slice(-this.config.maxHistoryEntries)
    }

    this.ctx.emit('cli-enhanced/history-added', entry)
  }

  /** Get command history */
  getHistory(limit?: number): CliHistoryEntry[] {
    if (limit) {
      return this.history.slice(-limit)
    }
    return [...this.history]
  }

  /** Clear command history */
  clearHistory(): void {
    this.history = []
    this.ctx.emit('cli-enhanced/history-cleared')
  }

  /** Get auto-completion suggestions */
  getAutoCompletions(partial: string): string[] {
    if (!this.config.enableAutoCompletion) return []

    const suggestions: string[] = []
    const partialLower = partial.toLowerCase()

    for (const command of this.getCommands()) {
      if (command.name.toLowerCase().startsWith(partialLower)) {
        suggestions.push(command.name)
      }
    }

    return suggestions.sort()
  }

  /** Format output */
  formatOutput(data: unknown, format: OutputFormat): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2)
      case 'yaml':
        // Simple YAML-like output
        if (typeof data === 'object' && data !== null) {
          return Object.entries(data as Record<string, unknown>)
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join('\n')
        }
        return String(data)
      case 'markdown':
        if (typeof data === 'object' && data !== null) {
          const entries = Object.entries(data as Record<string, unknown>)
          return entries.map(([key, value]) => `**${key}**: ${JSON.stringify(value)}`).join('\n')
        }
        return String(data)
      case 'text':
      default:
        if (typeof data === 'object' && data !== null) {
          return JSON.stringify(data, null, 2)
        }
        return String(data)
    }
  }

  /** Update configuration */
  updateConfig(config: Partial<CliEnhancedConfig>): void {
    this.config = { ...this.config, ...config }
    this.ctx.emit('cli-enhanced/config-changed', this.config)
  }

  /** Get configuration */
  getConfig(): CliEnhancedConfig {
    return { ...this.config }
  }
}

/** Plugin configuration */
export interface Config {
  /** Enable CLI enhanced features */
  enabled?: boolean
  /** Default CLI mode */
  defaultMode?: CliMode
  /** Default output format */
  defaultOutputFormat?: OutputFormat
  /** Enable color output */
  enableColors?: boolean
  /** Enable progress indicators */
  enableProgress?: boolean
  /** Enable command history */
  enableHistory?: boolean
  /** Maximum history entries */
  maxHistoryEntries?: number
  /** Enable auto-completion */
  enableAutoCompletion?: boolean
  /** Session timeout in milliseconds */
  sessionTimeoutMs?: number
}

/**
 * Create CLI enhanced plugin.
 * @param config - plugin configuration.
 * @returns the Cordis plugin.
 */
export function createCliEnhancedPlugin(config: Config = {}): {
  name: string
  inject: string[]
  apply: (ctx: Context) => void
} {
  return {
    name: 'cli-enhanced',
    inject: ['settings', 'sessions'],
    apply(ctx) {
      const service = new CliEnhancedService(ctx)
      ctx.cliEnhanced = service

      // Apply configuration
      if (Object.keys(config).length > 0) {
        service.updateConfig(config)
      }

      // Register settings section
      ctx.effect(() => {
        const scope = ctx.settings.register(
          settingsNamespace('cli-enhanced'),
          z.object({
            enabled: z.boolean().default(true),
            defaultMode: z.union([
              z.const('interactive'),
              z.const('single-run'),
              z.const('resume'),
              z.const('batch'),
            ]).default('interactive'),
            defaultOutputFormat: z.union([
              z.const('text'),
              z.const('json'),
              z.const('markdown'),
              z.const('yaml'),
            ]).default('text'),
            enableColors: z.boolean().default(true),
            enableProgress: z.boolean().default(true),
            enableHistory: z.boolean().default(true),
            maxHistoryEntries: z.number().min(10).max(10000).default(1000),
            enableAutoCompletion: z.boolean().default(true),
            sessionTimeoutMs: z.number().min(60000).max(86400000).default(3600000),
          }),
          {
            base: {
              enabled: true,
              defaultMode: 'interactive',
              defaultOutputFormat: 'text',
              enableColors: true,
              enableProgress: true,
              enableHistory: true,
              maxHistoryEntries: 1000,
              enableAutoCompletion: true,
              sessionTimeoutMs: 3600000,
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
    cliEnhanced: CliEnhancedService
  }
}

// Event declarations
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Command registered.
     * @param name - command name.
     * @mode emit
     */
    'cli-enhanced/command-registered'(name: string): void

    /**
     * Command unregistered.
     * @param name - command name.
     * @mode emit
     */
    'cli-enhanced/command-unregistered'(name: string): void

    /**
     * Command executed.
     * @param name - command name.
     * @param success - whether execution was successful.
     * @param duration - execution duration in milliseconds.
     * @mode emit
     */
    'cli-enhanced/command-executed'(name: string, success: boolean, duration: number): void

    /**
     * History added.
     * @param entry - history entry.
     * @mode emit
     */
    'cli-enhanced/history-added'(entry: CliHistoryEntry): void

    /**
     * History cleared.
     * @mode emit
     */
    'cli-enhanced/history-cleared'(): void

    /**
     * CLI enhanced configuration changed.
     * @param config - new configuration.
     * @mode emit
     */
    'cli-enhanced/config-changed'(config: CliEnhancedConfig): void
  }
}

export { CliEnhancedService as Service }
