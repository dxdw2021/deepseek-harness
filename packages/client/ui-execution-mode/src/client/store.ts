/**
 * Execution Mode settings store — uses createSnapshotStore from runtime.
 *
 * @module store
 */
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

/** Execution mode types */
export type ExecutionMode = 'light' | 'balanced' | 'delivery'

/** Mode configuration */
export interface ModeConfig {
  maxToolCalls: number
  enableStreaming: boolean
  enablePlanMode: boolean
  enableGoalMode: boolean
  enableSubagents?: boolean
  enableEvidenceCollection?: boolean
  enableStrictValidation?: boolean
}

/** Execution mode settings state */
export interface ExecutionModeState {
  status: 'idle' | 'loading' | 'error'
  currentMode: ExecutionMode
  configs: Record<ExecutionMode, ModeConfig>
  enableModeSwitching: boolean
  error: string | null
}

/**
 * Execution Mode controller — manages mode state and settings operations.
 */
export class ExecutionModeController {
  /** Row snapshot consumed through a bound selector hook. */
  readonly store: SnapshotStore<ExecutionModeState> = createSnapshotStore<ExecutionModeState>({
    status: 'idle',
    currentMode: 'balanced',
    configs: {
      light: { maxToolCalls: 5, enableStreaming: true, enablePlanMode: false, enableGoalMode: false },
      balanced: { maxToolCalls: 10, enableStreaming: true, enablePlanMode: true, enableGoalMode: true, enableSubagents: true },
      delivery: { maxToolCalls: 20, enableStreaming: true, enablePlanMode: true, enableGoalMode: true, enableSubagents: true, enableEvidenceCollection: true, enableStrictValidation: true },
    },
    enableModeSwitching: true,
    error: null,
  })

  private generation = 0

  constructor(private readonly api: Pick<IApiClient, 'settings'>) {}

  /** Load settings from Host. */
  async load(): Promise<void> {
    const generation = ++this.generation
    this.store.update((state) => {
      state.status = 'loading'
      state.error = null
    })
    try {
      const response = await this.api.settings.describe({})
      if (!response.result.ok) throw new Error(response.result.error.message)
      if (generation !== this.generation) return
      const view = response.result.value.namespaces.find(entry => entry.ns === 'execution-mode')
      if (view === undefined) {
        this.store.update((state) => { state.status = 'idle' })
        return
      }
      const value = view.value as Record<string, unknown> | null
      this.store.update((state) => {
        state.status = 'idle'
        state.currentMode = (value?.currentMode as ExecutionMode) || 'balanced'
        state.enableModeSwitching = (value?.enableModeSwitching as boolean) ?? true
      })
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((state) => {
        state.status = 'error'
        state.error = error instanceof Error ? error.message : String(error)
      })
    }
  }

  /** Switch execution mode. */
  async setMode(mode: ExecutionMode): Promise<void> {
    const generation = ++this.generation
    this.store.update((state) => { state.currentMode = mode })
    try {
      const describeResult = (await this.api.settings.describe({})).result
      if (!describeResult.ok) throw new Error(describeResult.error.message)
      const ns = describeResult.value.namespaces.find((e: { ns: string }) => e.ns === 'execution-mode')
      if (ns === undefined) return
      const response = await this.api.settings.mutate({
        ns: 'execution-mode',
        ops: [{ op: 'set', path: ['currentMode'], value: mode }],
        expectedRevision: ns.revision,
      })
      if (generation !== this.generation) return
      if (!response.result.ok) throw new Error(response.result.error.message)
    } catch (error) {
      if (generation !== this.generation) return
      this.load()
    }
  }

  /** Stop in-flight responses from publishing after plugin disposal. */
  dispose(): void {
    this.generation += 1
  }
}

/**
 * Refetch only after the row has opened once.
 * @param controller - execution mode controller.
 */
export function refreshIfLoaded(controller: ExecutionModeController): void {
  if (controller.store.getSnapshot().status === 'idle') return
  void controller.load()
}
