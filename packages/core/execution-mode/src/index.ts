/**
 * Execution mode capability for DeepSeek Harness agents.
 * Provides three execution modes: Light, Balanced, and Delivery.
 *
 * @module @deepseek-ai/dsh-execution-mode
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Execution mode types */
export type ExecutionMode = 'light' | 'balanced' | 'delivery'

/** Light mode configuration */
export interface LightModeConfig {
  /** Maximum tool calls per step */
  maxToolCalls: number
  /** Enable streaming */
  enableStreaming: boolean
  /** Enable plan mode */
  enablePlanMode: boolean
  /** Enable goal mode */
  enableGoalMode: boolean
}

/** Balanced mode configuration */
export interface BalancedModeConfig {
  /** Maximum tool calls per step */
  maxToolCalls: number
  /** Enable streaming */
  enableStreaming: boolean
  /** Enable plan mode */
  enablePlanMode: boolean
  /** Enable goal mode */
  enableGoalMode: boolean
  /** Enable subagents */
  enableSubagents: boolean
}

/** Delivery mode configuration */
export interface DeliveryModeConfig {
  /** Maximum tool calls per step */
  maxToolCalls: number
  /** Enable streaming */
  enableStreaming: boolean
  /** Enable plan mode */
  enablePlanMode: boolean
  /** Enable goal mode */
  enableGoalMode: boolean
  /** Enable subagents */
  enableSubagents: boolean
  /** Enable evidence collection */
  enableEvidenceCollection: boolean
  /** Enable strict validation */
  enableStrictValidation: boolean
}

/** Execution mode service definition */
export class ExecutionModeService extends Service {
  static inject = ['settings']

  private currentMode: ExecutionMode = 'balanced'
  private history: ExecutionMode[] = []

  constructor(ctx: Context) {
    super(ctx, 'executionMode')
  }

  /** Get current execution mode */
  getCurrentMode(): ExecutionMode {
    return this.currentMode
  }

  /** Set execution mode */
  setMode(mode: ExecutionMode): void {
    const previousMode = this.currentMode
    this.history.push(previousMode)
    this.currentMode = mode
    this.ctx.emit('execution-mode/changed', mode, previousMode)
  }

  /** Get mode configuration */
  getModeConfig(mode: ExecutionMode): LightModeConfig | BalancedModeConfig | DeliveryModeConfig {
    const scope = this.ctx.settings.register(
      settingsNamespace('execution-mode'),
      z.object({
        defaultMode: z.union([z.const('light'), z.const('balanced'), z.const('delivery')]).default('balanced'),
        enableModeSwitching: z.boolean().default(true),
        modes: z.object({
          light: z.object({
            maxToolCalls: z.number().min(1).max(100).default(5),
            enableStreaming: z.boolean().default(true),
            enablePlanMode: z.boolean().default(false),
            enableGoalMode: z.boolean().default(false),
          }),
          balanced: z.object({
            maxToolCalls: z.number().min(1).max(100).default(10),
            enableStreaming: z.boolean().default(true),
            enablePlanMode: z.boolean().default(true),
            enableGoalMode: z.boolean().default(true),
            enableSubagents: z.boolean().default(true),
          }),
          delivery: z.object({
            maxToolCalls: z.number().min(1).max(100).default(20),
            enableStreaming: z.boolean().default(true),
            enablePlanMode: z.boolean().default(true),
            enableGoalMode: z.boolean().default(true),
            enableSubagents: z.boolean().default(true),
            enableEvidenceCollection: z.boolean().default(true),
            enableStrictValidation: z.boolean().default(true),
          }),
        }),
      }),
      {
        base: {
          defaultMode: 'balanced',
          enableModeSwitching: true,
          modes: {
            light: {
              maxToolCalls: 5,
              enableStreaming: true,
              enablePlanMode: false,
              enableGoalMode: false,
            },
            balanced: {
              maxToolCalls: 10,
              enableStreaming: true,
              enablePlanMode: true,
              enableGoalMode: true,
              enableSubagents: true,
            },
            delivery: {
              maxToolCalls: 20,
              enableStreaming: true,
              enablePlanMode: true,
              enableGoalMode: true,
              enableSubagents: true,
              enableEvidenceCollection: true,
              enableStrictValidation: true,
            },
          },
        },
      },
    )

    return scope.get().modes[mode]
  }

  /** Check if mode switching is enabled */
  isModeSwitchingEnabled(): boolean {
    const scope = this.ctx.settings.register(
      settingsNamespace('execution-mode'),
      z.object({
        defaultMode: z.union([z.const('light'), z.const('balanced'), z.const('delivery')]).default('balanced'),
        enableModeSwitching: z.boolean().default(true),
        modes: z.object({
          light: z.object({
            maxToolCalls: z.number().min(1).max(100).default(5),
            enableStreaming: z.boolean().default(true),
            enablePlanMode: z.boolean().default(false),
            enableGoalMode: z.boolean().default(false),
          }),
          balanced: z.object({
            maxToolCalls: z.number().min(1).max(100).default(10),
            enableStreaming: z.boolean().default(true),
            enablePlanMode: z.boolean().default(true),
            enableGoalMode: z.boolean().default(true),
            enableSubagents: z.boolean().default(true),
          }),
          delivery: z.object({
            maxToolCalls: z.number().min(1).max(100).default(20),
            enableStreaming: z.boolean().default(true),
            enablePlanMode: z.boolean().default(true),
            enableGoalMode: z.boolean().default(true),
            enableSubagents: z.boolean().default(true),
            enableEvidenceCollection: z.boolean().default(true),
            enableStrictValidation: z.boolean().default(true),
          }),
        }),
      }),
      {
        base: {
          defaultMode: 'balanced',
          enableModeSwitching: true,
          modes: {
            light: {
              maxToolCalls: 5,
              enableStreaming: true,
              enablePlanMode: false,
              enableGoalMode: false,
            },
            balanced: {
              maxToolCalls: 10,
              enableStreaming: true,
              enablePlanMode: true,
              enableGoalMode: true,
              enableSubagents: true,
            },
            delivery: {
              maxToolCalls: 20,
              enableStreaming: true,
              enablePlanMode: true,
              enableGoalMode: true,
              enableSubagents: true,
              enableEvidenceCollection: true,
              enableStrictValidation: true,
            },
          },
        },
      },
    )

    return scope.get().enableModeSwitching
  }

  /** Get mode history */
  getHistory(): ExecutionMode[] {
    return [...this.history]
  }

  /** Reset to default mode */
  resetToDefault(): void {
    this.setMode('balanced')
  }
}

/** Plugin configuration */
export interface Config {
  /** Default execution mode */
  defaultMode?: ExecutionMode
  /** Enable mode switching via commands */
  enableModeSwitching?: boolean
}

/**
 * Create execution mode plugin.
 * @param config - plugin configuration.
 * @returns the Cordis plugin.
 */
export function createExecutionModePlugin(config: Config = {}): {
  name: string
  inject: string[]
  apply: (ctx: Context) => void
} {
  return {
    name: 'execution-mode',
    inject: ['settings'],
    apply(ctx) {
      const service = new ExecutionModeService(ctx)
      ctx.executionMode = service

      // Set default mode if provided
      if (config.defaultMode) {
        service.setMode(config.defaultMode)
      }

      // Register mode switching command if enabled
      if (config.enableModeSwitching !== false) {
        ctx.effect(() => {
          // In a real implementation, this would register with the command system
          return () => {
            // Cleanup
          }
        })
      }
    },
  }
}

// Type augmentation for Cordis context
declare module '@deepseek-ai/cordis' {
  interface Context {
    executionMode: ExecutionModeService
  }
}

// Event declarations
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Execution mode changed.
     * @param mode - new execution mode.
     * @param previousMode - previous execution mode.
     * @mode emit
     */
    'execution-mode/changed'(mode: ExecutionMode, previousMode: ExecutionMode): void
  }
}

export { ExecutionModeService as Service }
