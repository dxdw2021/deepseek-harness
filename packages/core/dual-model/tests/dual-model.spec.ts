import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, {
  LlmAdapter,
  type GenerateOptions,
  type LlmProviderInfo,
  type LlmResolvedModelInfo,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import { DualModelService, type TaskPlan } from '../src/index.ts'

const contexts: Context[] = []

/**
 * Test adapter that returns a scripted planner JSON for the first request
 * (planTask) and a one-line result for every subsequent request (step
 * execution). Detects which call it is from the user message text.
 */
class ScriptedDualModelAdapter extends LlmAdapter {
  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: provider }
  }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model })
  }

  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const promptText = (options.messages[0]?.content ?? [])
      .map((b: { type: string; text?: string }) => (b.type === 'text' ? b.text : ''))
      .join(' ')

    if (promptText.startsWith('Plan this task:')) {
      // Planner call: emit a complete TaskPlan JSON in one text block.
      const plan = {
        id: 'plan-1',
        description: 'implement the feature',
        steps: [
          { id: 'step-1', description: 'analyze requirements', toolCalls: ['read_file'], expectedOutput: 'doc', validationCriteria: ['ok'] },
          { id: 'step-2', description: 'implement', toolCalls: ['write_file'], expectedOutput: 'code', validationCriteria: ['ok'] },
        ],
        complexity: 'medium',
        resources: ['fs'],
        dependencies: { 'step-2': ['step-1'] },
      }
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: JSON.stringify(plan) }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: JSON.stringify(plan) } }
      yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 20 } }
      yield { type: 'finish', reason: { kind: 'stop' } }
      return
    }

    // Executor call: emit a short result for whatever step is being run.
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: 'step result ok' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'step result ok' } }
    yield { type: 'usage', usage: { inputTokens: 5, outputTokens: 3 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

async function setup(): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(LlmRuntime)
  ctx.llm.registerAdapter(['mock'], new ScriptedDualModelAdapter())
  return ctx
}

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

describe('DualModelService', () => {
  it('starts disabled with the sequential strategy and the deepseek defaults', () => {
    const service = new DualModelService(new Context())
    expect(service.isEnabled()).toBe(false)
    expect(service.getStrategy()).toBe('sequential')
    expect(service.getExecutorModel().model).toBe('deepseek-chat')
    expect(service.getPlannerModel().model).toBe('deepseek-reasoner')
  })

  it('toggles enabled state and merges configuration updates', () => {
    const service = new DualModelService(new Context())
    service.setEnabled(true)
    expect(service.isEnabled()).toBe(true)
    service.updateConfig({ strategy: 'parallel' })
    expect(service.getStrategy()).toBe('parallel')
  })

  it('resolves the executor or planner model per execution mode', () => {
    const service = new DualModelService(new Context())
    expect(service.getModelForMode('light').model).toBe('deepseek-chat')
    expect(service.getModelForMode('balanced').model).toBe('deepseek-chat')
    expect(service.getModelForMode('delivery').model).toBe('deepseek-reasoner')
  })

  it('refuses to plan or execute while disabled', async () => {
    const service = new DualModelService(new Context())
    const plan: TaskPlan = { id: 'p', description: '', steps: [], complexity: 'low', resources: [], dependencies: {} }
    await expect(service.planTask('build a feature')).rejects.toThrow('disabled')
    await expect(service.executePlan(plan)).rejects.toThrow('disabled')
  })

  it('routes a plan through the LLM runtime and executes its steps', async () => {
    const ctx = await setup()
    // Override default providers to the registered 'mock' adapter.
    const service = new DualModelService(ctx)
    service.setEnabled(true)
    service.updateConfig({
      executor: { provider: 'mock', model: 'mock' },
      planner: { provider: 'mock', model: 'mock' },
    })

    const plan = await service.planTask('implement the feature')
    expect(plan.steps).toHaveLength(2)
    expect(plan.steps[0]?.id).toBe('step-1')

    const result = await service.executePlan(plan)
    expect(result.success).toBe(true)
    expect(result.stepResults).toHaveLength(2)
    expect(result.stepResults.every(r => r.success)).toBe(true)
    expect(result.metrics.toolCallCount).toBeGreaterThan(0)
    expect(result.metrics.tokenUsage.executor).toBeGreaterThan(0)
  })
})
