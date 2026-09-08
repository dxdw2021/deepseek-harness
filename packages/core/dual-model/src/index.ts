/**
 * Dual model collaboration capability for DeepSeek Harness agents.
 * Provides Executor + Planner separation for improved task execution.
 *
 * @module @deepseek-ai/dsh-dual-model
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm'
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

/**
 * System prompt sent to the planner model to produce a structured TaskPlan.
 *
 * The model must respond with a JSON object whose shape matches
 * {@link TaskPlan} (minus `id`, which is generated locally).
 */
const PLANNING_SYSTEM_PROMPT = `You are a task planning assistant. Given a task description, produce a structured plan as a JSON object.

The JSON object MUST have exactly this shape:
{
  "description": "<string: brief task description>",
  "complexity": "<'low' | 'medium' | 'high'>",
  "resources": ["<string: resource names>"],
  "dependencies": { "<step-id>": ["<dependency step-id>"] },
  "steps": [
    {
      "id": "<step-N>",
      "description": "<what this step does>",
      "toolCalls": ["<tool name>"],
      "expectedOutput": "<what this step produces>",
      "validationCriteria": ["<how to verify this step>"]
    }
  ]
}

Rules:
- Each step id MUST be "step-1", "step-2", etc. (no gaps).
- Dependencies reference earlier step ids only.
- Output ONLY the JSON object, no markdown fences or explanation.`

/**
 * Assemble the text content from an LLM stream response into a single string.
 * Drains the stream through a {@link BlockAssembler} and extracts text blocks.
 * @param ctx - Cordis context carrying the LLM runtime.
 * @param options - generation request options.
 * @returns assembled text and token counts.
 */
async function assembleStreamText(
  ctx: Context,
  options: Parameters<Context['llm']['stream']>[0],
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const assembler = new BlockAssembler()
  for await (const chunk of ctx.llm.stream(options)) assembler.push(chunk)
  const blocks = assembler.blocks()
  const text = blocks
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join('')
  const usage = assembler.usage
  return {
    text,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
  }
}

/** Dual model service definition */
export class DualModelService extends Service {
  static inject = ['settings', 'executionMode', 'llm']

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

  /** Plan a task using the planner model via the LLM runtime. */
  async planTask(task: string): Promise<TaskPlan> {
    if (!this.config.enabled) {
      throw new Error('Dual model collaboration is disabled')
    }

    const plannerCfg = this.config.planner
    const planId = `plan-${Date.now()}`

    const { text: rawJson } = await assembleStreamText(this.ctx, {
      provider: plannerCfg.provider,
      model: plannerCfg.model,
      system: PLANNING_SYSTEM_PROMPT,
      messages: [
        createUserMessage({
          content: [{ type: 'text', text: `Plan this task: ${task}` }],
          source: { kind: 'plugin', plugin: 'dsh-dual-model' },
        }),
      ],
      temperature: plannerCfg.temperature ?? 0.3,
      ...plannerCfg.maxTokens !== undefined ? { maxTokens: plannerCfg.maxTokens } : {},
    })

    const parsed = parsePlanJson(rawJson)

    return {
      id: planId,
      description: parsed.description ?? task,
      steps: parsed.steps ?? [],
      complexity: parsed.complexity ?? 'medium',
      resources: parsed.resources ?? [],
      dependencies: parsed.dependencies ?? {},
    }
  }

  /** Execute a plan using the executor model via the LLM runtime. */
  async executePlan(plan: TaskPlan): Promise<ExecutionResult> {
    if (!this.config.enabled) {
      throw new Error('Dual model collaboration is disabled')
    }

    const startTime = Date.now()
    const stepResults: StepResult[] = []
    const times: Record<string, number> = {}
    let executorTokens = 0

    for (const step of plan.steps) {
      const stepStart = Date.now()

      // Check dependencies — skip steps whose dependencies did not succeed.
      const dependencies = plan.dependencies[step.id] ?? []
      const allDependenciesMet = dependencies.every(depId =>
        stepResults.some(result => result.stepId === depId && result.success),
      )

      if (!allDependenciesMet) {
        stepResults.push({
          stepId: step.id,
          success: false,
          output: '',
          error: 'Dependencies not met',
          toolCalls: [],
        })
        times[step.id] = Date.now() - stepStart
        continue
      }

      try {
        const executorCfg = this.config.executor
        const stepPrompt = [
          'Execute the following step from a task plan.',
          '',
          `Step: ${step.description}`,
          `Expected output: ${step.expectedOutput}`,
          `Tool calls needed: ${step.toolCalls.join(', ') || 'none specified'}`,
          `Validation criteria: ${step.validationCriteria.join('; ')}`,
          '',
          'Provide the result of executing this step.',
        ].join('\n')

        const { text: output, outputTokens } = await assembleStreamText(this.ctx, {
          provider: executorCfg.provider,
          model: executorCfg.model,
          messages: [
            createUserMessage({
              content: [{ type: 'text', text: stepPrompt }],
              source: { kind: 'plugin', plugin: 'dsh-dual-model' },
            }),
          ],
          temperature: executorCfg.temperature ?? 0.7,
          ...executorCfg.maxTokens !== undefined ? { maxTokens: executorCfg.maxTokens } : {},
        })

        executorTokens += outputTokens

        stepResults.push({
          stepId: step.id,
          success: true,
          output,
          toolCalls: step.toolCalls.map(tool => ({
            tool,
            args: {},
            result: null,
            success: true,
          })),
        })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        stepResults.push({
          stepId: step.id,
          success: false,
          output: '',
          error: message,
          toolCalls: [],
        })
      }

      times[step.id] = Date.now() - stepStart
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
        stepTimes: times,
        tokenUsage: {
          planner: 0,
          executor: executorTokens,
          total: executorTokens,
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

/**
 * Best-effort parse of a planner model JSON response.
 * Strips markdown fences and leading/trailing whitespace before parsing.
 * @param raw - raw text from the planner model.
 * @returns partial task plan fields parsed from JSON.
 */
function parsePlanJson(raw: string): Partial<TaskPlan> {
  let cleaned = raw.trim()
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  try {
    return JSON.parse(cleaned) as Partial<TaskPlan>
  } catch {
    throw new Error(
      `planner model returned unparseable JSON: ${cleaned.slice(0, 200)}`,
    )
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
    inject: ['settings', 'executionMode', 'llm'],
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
