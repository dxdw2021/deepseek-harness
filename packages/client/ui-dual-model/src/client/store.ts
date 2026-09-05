/**
 * Dual Model settings store — uses createSnapshotStore from runtime.
 *
 * @module store
 */
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

/** Model roles */
export type ModelRole = 'executor' | 'planner'

/** Model configuration */
export interface ModelConfig {
  provider: string
  model: string
  maxTokens?: number
  temperature?: number
}

/** Collaboration strategies */
export type CollaborationStrategy = 'sequential' | 'parallel' | 'iterative' | 'adaptive'

/** Dual model state */
export interface DualModelState {
  status: 'idle' | 'loading' | 'error'
  enabled: boolean
  executor: ModelConfig
  planner: ModelConfig
  strategy: CollaborationStrategy
  availableProviders: string[]
  availableModels: Record<string, string[]>
  error: string | null
}

/**
 * Dual Model controller — manages configuration state.
 */
export class DualModelController {
  readonly store: SnapshotStore<DualModelState> = createSnapshotStore<DualModelState>({
    status: 'idle',
    enabled: false,
    executor: { provider: 'deepseek', model: 'deepseek-chat' },
    planner: { provider: 'deepseek', model: 'deepseek-reasoner' },
    strategy: 'sequential',
    availableProviders: ['deepseek', 'openai', 'anthropic'],
    availableModels: {
      deepseek: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
      openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    },
    error: null,
  })

  private generation = 0

  constructor(private readonly api: Pick<IApiClient, 'settings'>) {}

  async load(): Promise<void> {
    const generation = ++this.generation
    this.store.update((state) => { state.status = 'loading'; state.error = null })
    try {
      const response = await this.api.settings.describe({})
      if (!response.result.ok) throw new Error(response.result.error.message)
      if (generation !== this.generation) return
      const view = response.result.value.namespaces.find(entry => entry.ns === 'dual-model')
      if (view === undefined) { this.store.update((s) => { s.status = 'idle' }); return }
      const value = view.value as Record<string, unknown> | null
      this.store.update((state) => {
        state.status = 'idle'
        state.enabled = (value?.enabled as boolean) ?? false
        state.executor = (value?.executor as ModelConfig) ?? state.executor
        state.planner = (value?.planner as ModelConfig) ?? state.planner
        state.strategy = (value?.strategy as CollaborationStrategy) ?? 'sequential'
      })
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((s) => { s.status = 'error'; s.error = error instanceof Error ? error.message : String(error) })
    }
  }

  async toggleEnabled(enabled: boolean): Promise<void> {
    this.store.update((s) => { s.enabled = enabled })
  }

  async updateStrategy(strategy: CollaborationStrategy): Promise<void> {
    this.store.update((s) => { s.strategy = strategy })
  }

  dispose(): void { this.generation += 1 }
}

export function refreshIfLoaded(controller: DualModelController): void {
  if (controller.store.getSnapshot().status === 'idle') return
  void controller.load()
}
