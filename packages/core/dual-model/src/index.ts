/**
 * Dual model collaboration capability for DeepSeek Harness agents.
 * Provides Executor + Planner separation for improved task execution.
 * 
 * @module @deepseek-ai/dsh-dual-model
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type { ExecutionMode } from '@deepseek-ai/dsh-execution-mode'

/** Model roles in dual model collaboration */
export type ModelRole = 'executor' | 'planner'

/** Model configuration */
export interface ModelConfig {
  /** Provider name */
  provider: string
  /** Model name */
  model: string
  /** Maximum tokens */
  maxTokens?: number
  /** Temperature */
  temperature?: number
}

/** Collaboration strategies */
export type CollaborationStrategy = 
  | 'sequential'    // Planner first, then Executor
  | 'parallel'      // Both models work simultaneously
  | 'iterative'     // Alternating between Planner and Executor
  | 'adaptive'      // Strategy based on task complexity

/** Dual model configuration */
export interface DualModelConfig {
  /** Enable dual model collaboration */
  enabled: boolean
  /** Executor model configuration */
  executor: ModelConfig
  /** Planner model configuration */
  planner: ModelConfig
  /** Collaboration strategy */
  strategy: CollaborationStrategy
}

/** Task planning result */
export interface TaskPlan {
  /** Unique plan ID */
  id: string
  /** Task description */
  description: string
  /** Steps to execute */
  steps: TaskStep[]
  /** Estimated complexity */
  complexity: 'low' | 'medium' | 'high'
  /** Required resources */
  resources: string[]
  /** Dependencies between steps */
  dependencies: Record<string, string[]>
}

/** Task step */
export interface TaskStep {
  /** Step ID */
  id: string
  /** Step description */
  description: string
  /** Tool calls needed */
  toolCalls: string[]
  /** Expected output */
  expectedOutput: string
  /** Validation criteria */
  validationCriteria: string[]
}

/** Execution result */
export interface ExecutionResult {
  /** Plan ID */
  planId: string
  /** Step results */
  stepResults: StepResult[]
  /** Overall success */
  success: boolean
  /** Error message if failed */
  error?: string
  /** Evidence collected */
  evidence: string[]
  /** Metrics */
  metrics: ExecutionMetrics
}

/** Step result */
export interface StepResult {
  /** Step ID */
  stepId: string
  /** Success status */
  success: boolean
  /** Output */
  output: string
  /** Error if failed */
  error?: string
  /** Tool calls made */
  toolCalls: ToolCallResult[]
}

/** Tool call result */
export interface ToolCallResult {
  /** Tool name */
  tool: string
  /** Arguments */
  args: Record<string, unknown>
  /** Result */
  result: unknown
  /** Success status */
  success: boolean
  /** Error if failed */
  error?: string
}

/** Execution metrics */
export interface ExecutionMetrics {
  /** Total time */
  totalTime: number
  /** Time per step */
  stepTimes: Record<string, number>
  /** Token usage */
  tokenUsage: {
    planner: number
    executor: number
    total: number
  }
  /** Tool call count */
  toolCallCount: number
}

/** Dual model service definition */
export class DualModelService extends Service {
  static inject = ['settings', 'executionMode']
  
  private config: DualModelConfig = {
    enabled: false,
    executor: {
      provider: 'deepseek',
      model: 'deepseek-chat',
    },
    planner: {
      provider: 'deepseek',
      model: 'deepseek-reasoner',
    },
    strategy: 'sequential',
  }
  
  constructor(ctx: Context) {
    super(ctx, 'dualModel')
  }
  
  /** Check if dual model is enabled */
  isEnabled(): boolean {
    return this.config.enabled
  }
  
  /** Enable or disable dual model */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
    this.ctx.emit('dual-model/enabled-changed', enabled)
  }
  
  /** Get current configuration */
  getConfig(): DualModelConfig {
    return { ...this.config }
  }
  
  /** Update configuration */
  updateConfig(config: Partial<DualModelConfig>): void {
    this.config = { ...this.config, ...config }
    this.ctx.emit('dual-model/config-changed', this.config)
  }
  
  /** Get executor model */
  getExecutorModel(): ModelConfig {
    return { ...this.config.executor }
  }
  
  /** Get planner model */
  getPlannerModel(): ModelConfig {
    return { ...this.config.planner }
  }
  
  /** Set collaboration strategy */
  setStrategy(strategy: CollaborationStrategy): void {
    this.config.strategy = strategy
    this.ctx.emit('dual-model/strategy-changed', strategy)
  }
  
  /** Get current strategy */
  getStrategy(): CollaborationStrategy {
    return this.config.strategy
  }
  
  /** Plan a task using the planner model */
  async planTask(task: string): Promise<TaskPlan> {
    if (!this.config.enabled) {
      throw new Error('Dual model collaboration is disabled')
    }
    
    // In a real implementation, this would call the planner model
    // For now, return a mock plan
    return {
      id: `plan-${Date.now()}`,
      description: task,
      steps: [
        {
          id: 'step-1',
          description: 'Analyze the task requirements',
          toolCalls: ['read_file', 'grep'],
          expectedOutput: 'Task analysis document',
          validationCriteria: ['Requirements identified', 'Constraints documented'],
        },
        {
          id: 'step-2',
          description: 'Implement the solution',
          toolCalls: ['write_file', 'edit_file'],
          expectedOutput: 'Implemented solution',
          validationCriteria: ['Code compiles', 'Tests pass'],
        },
        {
          id: 'step-3',
          description: 'Validate the implementation',
          toolCalls: ['bash'],
          expectedOutput: 'Validation report',
          validationCriteria: ['All tests pass', 'Code coverage meets threshold'],
        },
      ],
      complexity: 'medium',
      resources: ['file_system', 'shell'],
      dependencies: {
        'step-2': ['step-1'],
        'step-3': ['step-2'],
      },
    }
  }
  
  /** Execute a plan using the executor model */
  async executePlan(plan: TaskPlan): Promise<ExecutionResult> {
    if (!this.config.enabled) {
      throw new Error('Dual model collaboration is disabled')
    }
    
    const startTime = Date.now()
    const stepResults: StepResult[] = []
    
    // Execute steps based on strategy
    for (const step of plan.steps) {
      // Check dependencies
      const dependencies = plan.dependencies[step.id] || []
      const allDependenciesMet = dependencies.every(depId => 
        stepResults.some(result => result.stepId === depId && result.success)
      )
      
      if (!allDependenciesMet) {
        stepResults.push({
          stepId: step.id,
          success: false,
          output: '',
          error: 'Dependencies not met',
          toolCalls: [],
        })
        continue
      }
      
      // Execute step (mock implementation)
      const stepResult: StepResult = {
        stepId: step.id,
        success: true,
        output: `Completed step: ${step.description}`,
        toolCalls: step.toolCalls.map(tool => ({
          tool,
          args: {},
          result: null,
          success: true,
        })),
      }
      
      stepResults.push(stepResult)
    }
    
    const totalTime = Date.now() - startTime
    const allSuccess = stepResults.every(result => result.success)
    
    return {
      planId: plan.id,
      stepResults,
      success: allSuccess,
      evidence: stepResults.map(result => result.output),
      metrics: {
        totalTime,
        stepTimes: stepResults.reduce((acc, result) => {
          acc[result.stepId] = totalTime / plan.steps.length
          return acc
        }, {} as Record<string, number>),
        tokenUsage: {
          planner: 0,
          executor: 0,
          total: 0,
        },
        toolCallCount: stepResults.reduce((acc, result) => acc + result.toolCalls.length, 0),
      },
    }
  }
  
  /** Get model for current execution mode */
  getModelForMode(mode: ExecutionMode): ModelConfig {
    switch (mode) {
      case 'light':
        return this.config.executor
      case 'balanced':
        return this.config.executor
      case 'delivery':
        return this.config.planner
      default:
        return this.config.executor
    }
  }
}

/** Plugin configuration */
export interface Config {
  /** Enable dual model collaboration */
  enabled?: boolean
  /** Executor model configuration */
  executor?: Partial<ModelConfig>
  /** Planner model configuration */
  planner?: Partial<ModelConfig>
  /** Collaboration strategy */
  strategy?: CollaborationStrategy
}

/**
 * Create dual model plugin.
 * @param config - plugin configuration.
 * @returns the Cordis plugin.
 */
export function createDualModelPlugin(config: Config = {}): {
  name: string
  inject: string[]
  apply: (ctx: Context) => void
} {
  return {
    name: 'dual-model',
    inject: ['settings', 'executionMode'],
    apply(ctx) {
      const service = new DualModelService(ctx)
      ctx.dualModel = service
      
      // Apply configuration
      if (config.enabled !== undefined) {
        service.setEnabled(config.enabled)
      }
      
      if (config.executor) {
        const currentConfig = service.getConfig()
        service.updateConfig({
          executor: { ...currentConfig.executor, ...config.executor },
        })
      }
      
      if (config.planner) {
        const currentConfig = service.getConfig()
        service.updateConfig({
          planner: { ...currentConfig.planner, ...config.planner },
        })
      }
      
      if (config.strategy) {
        service.setStrategy(config.strategy)
      }
      
      // Register settings section
      ctx.effect(() => {
        const scope = ctx.settings.register(
          settingsNamespace('dual-model'),
          z.object({
            enabled: z.boolean().default(false),
            executor: z.object({
              provider: z.string().default('deepseek'),
              model: z.string().default('deepseek-chat'),
              maxTokens: z.number().default(4096),
              temperature: z.number().min(0).max(2).default(0.7),
            }),
            planner: z.object({
              provider: z.string().default('deepseek'),
              model: z.string().default('deepseek-reasoner'),
              maxTokens: z.number().default(8192),
              temperature: z.number().min(0).max(2).default(0.3),
            }),
            strategy: z.union([
              z.const('sequential'),
              z.const('parallel'),
              z.const('iterative'),
              z.const('adaptive'),
            ]).default('sequential'),
          }),
          {
            base: {
              enabled: false,
              executor: {
                provider: 'deepseek',
                model: 'deepseek-chat',
                maxTokens: 4096,
                temperature: 0.7,
              },
              planner: {
                provider: 'deepseek',
                model: 'deepseek-reasoner',
                maxTokens: 8192,
                temperature: 0.3,
              },
              strategy: 'sequential',
            },
          }
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
    dualModel: DualModelService
  }
}

// Event declarations
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Dual model enabled state changed.
     * @param enabled - new enabled state.
     * @mode emit
     */
    'dual-model/enabled-changed'(enabled: boolean): void
    
    /**
     * Dual model configuration changed.
     * @param config - new configuration.
     * @mode emit
     */
    'dual-model/config-changed'(config: DualModelConfig): void
    
    /**
     * Dual model collaboration strategy changed.
     * @param strategy - new strategy.
     * @mode emit
     */
    'dual-model/strategy-changed'(strategy: CollaborationStrategy): void
  }
}

export { DualModelService as Service }