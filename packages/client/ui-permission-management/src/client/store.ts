/**
 * Permission Management settings store — uses createSnapshotStore from runtime.
 *
 * @module store
 */
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

export type PermissionAction = 'read' | 'write' | 'execute' | 'admin' | 'create' | 'delete' | 'update'
export type ResourceType = 'file' | 'directory' | 'tool' | 'session' | 'agent' | 'plugin' | 'system'

export interface PermissionRule {
  id: string
  description: string
  resourceType: ResourceType
  resourcePattern: string
  actions: PermissionAction[]
  priority: number
  enabled: boolean
}

export interface PermissionManagementState {
  status: 'idle' | 'loading' | 'error'
  rules: PermissionRule[]
  activeTab: 'rules' | 'audit'
  error: string | null
}

export class PermissionManagementController {
  readonly store: SnapshotStore<PermissionManagementState> = createSnapshotStore<PermissionManagementState>({
    status: 'idle', rules: [], activeTab: 'rules', error: null,
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
      const view = response.result.value.namespaces.find(e => e.ns === 'permission-management')
      if (view === undefined) { this.store.update((s) => { s.status = 'idle' }); return }
      const value = view.value as Record<string, unknown> | null
      this.store.update((s) => { s.status = 'idle'; s.rules = (value?.rules as PermissionRule[]) ?? [] })
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((s) => { s.status = 'error'; s.error = error instanceof Error ? error.message : String(error) })
    }
  }

  setActiveTab(tab: 'rules' | 'audit'): void {
    this.store.update((s) => { s.activeTab = tab })
  }

  dispose(): void { this.generation += 1 }
}

export function refreshIfLoaded(controller: PermissionManagementController): void {
  if (controller.store.getSnapshot().status === 'idle') return
  void controller.load()
}
