/**
 * Bot/IM Integration settings store — uses createSnapshotStore from runtime.
 *
 * @module store
 */
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

export type PlatformType = 'feishu' | 'lark' | 'wechat' | 'qq' | 'telegram' | 'slack' | 'discord'

export interface PlatformConfig {
  type: PlatformType
  enabled: boolean
  appId: string
  connected: boolean
}

export interface BotImState {
  status: 'idle' | 'loading' | 'error'
  platforms: PlatformConfig[]
  commandPrefix: string
  enableAutoReply: boolean
  error: string | null
}

export class BotImController {
  readonly store: SnapshotStore<BotImState> = createSnapshotStore<BotImState>({
    status: 'idle',
    platforms: [
      { type: 'feishu', enabled: false, appId: '', connected: false },
      { type: 'lark', enabled: false, appId: '', connected: false },
      { type: 'wechat', enabled: false, appId: '', connected: false },
      { type: 'qq', enabled: false, appId: '', connected: false },
      { type: 'telegram', enabled: false, appId: '', connected: false },
      { type: 'slack', enabled: false, appId: '', connected: false },
      { type: 'discord', enabled: false, appId: '', connected: false },
    ],
    commandPrefix: '/',
    enableAutoReply: true,
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
      const view = response.result.value.namespaces.find(e => e.ns === 'bot-im')
      if (view === undefined) { this.store.update((s) => { s.status = 'idle' }); return }
      const value = view.value as Record<string, unknown> | null
      this.store.update((s) => {
        s.status = 'idle'
        s.platforms = (value?.platforms as PlatformConfig[]) ?? s.platforms
        s.commandPrefix = (value?.commandPrefix as string) ?? '/'
        s.enableAutoReply = (value?.enableAutoReply as boolean) ?? true
      })
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((s) => { s.status = 'error'; s.error = error instanceof Error ? error.message : String(error) })
    }
  }

  dispose(): void { this.generation += 1 }
}

export function refreshIfLoaded(controller: BotImController): void {
  if (controller.store.getSnapshot().status === 'idle') return
  void controller.load()
}
