/**
 * Tool Registry settings store — uses createSnapshotStore from runtime.
 *
 * @module store
 */
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

export type ToolCategory = 'file' | 'shell' | 'task' | 'network' | 'search' | 'code' | 'memory' | 'mcp' | 'skill' | 'subagent' | 'workflow' | 'custom'

export interface ToolDefinition {
  name: string
  description: string
  category: ToolCategory
  enabled: boolean
  usageCount: number
}

export interface ToolRegistryState {
  status: 'idle' | 'loading' | 'error'
  tools: ToolDefinition[]
  categoryFilter: ToolCategory | 'all'
  searchQuery: string
  error: string | null
}

export class ToolRegistryController {
  readonly store: SnapshotStore<ToolRegistryState> = createSnapshotStore<ToolRegistryState>({
    status: 'idle', tools: [], categoryFilter: 'all', searchQuery: '', error: null,
  })
  private generation = 0
  constructor(private readonly api: Pick<IApiClient, 'settings'>) {}

  async load(): Promise<void> {
    const generation = ++this.generation
    this.store.update((s) => { s.status = 'loading'; s.error = null })
    try {
      const response = await this.api.settings.describe({})
      if (!response.result.ok) throw new Error(response.result.error.message)
      if (generation !== this.generation) return
      const view = response.result.value.namespaces.find(e => e.ns === 'tool-registry')
      if (view === undefined) { this.store.update((s) => { s.status = 'idle' }); return }
      const value = view.value as Record<string, unknown> | null
      this.store.update((s) => {
        s.status = 'idle'
        s.tools = (value?.tools as ToolDefinition[]) ?? []
      })
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((s) => { s.status = 'error'; s.error = error instanceof Error ? error.message : String(error) })
    }
  }

  setCategoryFilter(category: ToolCategory | 'all'): void {
    this.store.update((s) => { s.categoryFilter = category })
  }

  setSearchQuery(query: string): void {
    this.store.update((s) => { s.searchQuery = query })
  }

  dispose(): void { this.generation += 1 }
}

export function refreshIfLoaded(controller: ToolRegistryController): void {
  if (controller.store.getSnapshot().status === 'idle') return
  void controller.load()
}
