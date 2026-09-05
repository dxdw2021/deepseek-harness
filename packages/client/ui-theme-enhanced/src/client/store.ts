/**
 * Theme Enhanced settings store — uses createSnapshotStore from runtime.
 *
 * @module store
 */
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

export type ThemeType = 'light' | 'dark' | 'system' | 'custom'

export interface Theme {
  id: string
  name: string
  type: ThemeType
  builtin: boolean
}

export interface ThemeEnhancedState {
  status: 'idle' | 'loading' | 'error'
  themes: Theme[]
  currentThemeId: string
  error: string | null
}

export class ThemeEnhancedController {
  readonly store: SnapshotStore<ThemeEnhancedState> = createSnapshotStore<ThemeEnhancedState>({
    status: 'idle',
    themes: [
      { id: 'light', name: 'Light', type: 'light', builtin: true },
      { id: 'dark', name: 'Dark', type: 'dark', builtin: true },
      { id: 'system', name: 'System', type: 'system', builtin: true },
    ],
    currentThemeId: 'system',
    error: null,
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
      const view = response.result.value.namespaces.find(e => e.ns === 'theme-enhanced')
      if (view === undefined) { this.store.update((s) => { s.status = 'idle' }); return }
      const value = view.value as Record<string, unknown> | null
      this.store.update((s) => {
        s.status = 'idle'
        s.currentThemeId = (value?.currentThemeId as string) ?? 'system'
        s.themes = (value?.themes as Theme[]) ?? s.themes
      })
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((s) => { s.status = 'error'; s.error = error instanceof Error ? error.message : String(error) })
    }
  }

  async selectTheme(themeId: string): Promise<void> {
    this.store.update((s) => { s.currentThemeId = themeId })
  }

  dispose(): void { this.generation += 1 }
}

export function refreshIfLoaded(controller: ThemeEnhancedController): void {
  if (controller.store.getSnapshot().status === 'idle') return
  void controller.load()
}
