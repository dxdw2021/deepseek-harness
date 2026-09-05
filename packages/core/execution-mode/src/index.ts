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
  private modeConfigs: {
    light: LightModeConfig
    balanced: BalancedModeConfig
    delivery: DeliveryModeConfig
  } = {
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
  }
  private modeSwitchingEnabled = true

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

  /**
   * Get mode configuration for the given mode.
   * Returns cached configuration set during plugin registration.
   * @param mode - execution mode to read config for.
   */
  getModeConfig(mode: ExecutionMode): LightModeConfig | BalancedModeConfig | DeliveryModeConfig {
    return this.modeConfigs[mode]
  }

  /**
   * Get mode configuration for the current mode.
   * @returns the configuration matching {@link getCurrentMode}.
   */
  getCurrentModeConfig(): LightModeConfig | BalancedModeConfig | DeliveryModeConfig {
    return this.modeConfigs[this.currentMode]
  }

  /**
   * Get behavioral constraints derived from the current execution mode.
   * The agent loop reads this to decide how many tool calls to allow,
   * whether plan/goal/subagent features are enabled, and whether
   * evidence collection is required.
   */
  getConstraints(): ModeConstraints {
    const config = this.getCurrentModeConfig()
    return {
      mode: this.currentMode,
      maxToolCalls: config.maxToolCalls,
      enablePlanMode: config.enablePlanMode,
      enableGoalMode: config.enableGoalMode,
      enableStreaming: config.enableStreaming,
      enableSubagents: 'enableSubagents' in config ? config.enableSubagents : false,
      enableEvidenceCollection: 'enableEvidenceCollection' in config ? config.enableEvidenceCollection : false,
      enableStrictValidation: 'enableStrictValidation' in config ? config.enableStrictValidation : false,
    }
  }

  /** Check if mode switching is enabled */
  isModeSwitchingEnabled(): boolean {
    return this.modeSwitchingEnabled
  }

  /** Get mode history */
  getHistory(): ExecutionMode[] {
    return [...this.history]
  }

  /** Reset to default mode */
  resetToDefault(): void {
    this.setMode('balanced')
  }

  /**
   * Update cached mode configs from settings. Called by the plugin's settings
   * watcher during initialization.
   * @param modes - new mode configuration values.
   */
  updateModeConfigs(modes: {
    light: Partial<LightModeConfig>
    balanced: Partial<BalancedModeConfig>
    delivery: Partial<DeliveryModeConfig>
  }): void {
    if (modes.light) {
      this.modeConfigs.light = { ...this.modeConfigs.light, ...modes.light }
    }
    if (modes.balanced) {
      this.modeConfigs.balanced = { ...this.modeConfigs.balanced, ...modes.balanced }
    }
    if (modes.delivery) {
      this.modeConfigs.delivery = { ...this.modeConfigs.delivery, ...modes.delivery }
    }
  }

  /** Update the mode-switching flag from settings. */
  setModeSwitchingEnabled(enabled: boolean): void {
    this.modeSwitchingEnabled = enabled
  }
}

/** Unified behavioral constraints for the current execution mode. */
export interface ModeConstraints {
  /** Current execution mode. */
  mode: ExecutionMode
  /** Maximum tool calls allowed per step. */
  maxToolCalls: number
  /** Whether plan mode is enabled. */
  enablePlanMode: boolean
  /** Whether goal mode is enabled. */
  enableGoalMode: boolean
  /** Whether streaming is enabled. */
  enableStreaming: boolean
  /** Whether subagents are enabled. */
  enableSubagents: boolean
  /** Whether evidence collection is enabled (delivery mode only). */
  enableEvidenceCollection: boolean
  /** Whether strict validation is enabled (delivery mode only). */
  enableStrictValidation: boolean
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

      if (config.enableModeSwitching !== undefined) {
        service.setModeSwitchingEnabled(config.enableModeSwitching)
      }

      // Register settings section and wire watcher so config changes
      // propagate into the cached mode configs.
      ctx.effect(() => {
        const scope = ctx.settings.register(
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

        // Initialize service from persisted settings.
        const initial = scope.get()
        service.updateModeConfigs(initial.modes)
        service.setModeSwitchingEnabled(initial.enableModeSwitching)
        if (config.defaultMode === undefined) {
          service.setMode(initial.defaultMode)
        }

        // Watch for settings changes
        scope.watch((next) => {
          service.updateModeConfigs(next.modes)
          service.setModeSwitchingEnabled(next.enableModeSwitching)
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
