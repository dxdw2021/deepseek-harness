/**
 * Tool Registry UI plugin, browser half — registers the Tool Registry
 * settings section for managing tools and their configurations.
 *
 * Export discipline: packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
// Type-only: pulls the shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ctx.remote merge and the forwarded-event key face
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { ToolRegistrySection } from './ToolRegistrySection.tsx'
import type { ToolRegistrySectionInjected } from './ToolRegistrySection.tsx'
import { ToolRegistryStore } from './store.ts'
import { en, zh, type ToolRegistryKey } from './locales.ts'

export type { ToolRegistrySectionInjected, ToolRegistrySectionProps } from './ToolRegistrySection.tsx'
export type { ToolRegistryKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Tool Registry page copy. */
    'settings.tool-registry': ToolRegistryKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.tool-registry'
export type { ToolRegistryState } from './store.ts'

/**
 * Refetch the page snapshot only after its first load.
 * @param controller - the page store.
 */
export function refreshIfLoaded(controller: ToolRegistryStore): void {
  if (controller.store.getSnapshot().status === 'idle') return
  void controller.load()
}

/**
 * Required services (cordis fiber inject).
 */
export const inject = ['slots', 'locale', 'connection', 'remote']

/**
 * Register the Tool Registry section once the `settings.section` declaration
 * is on the ledger, wire its store to the connection, and keep it fresh on
 * every pushed invalidation.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-tool-registry: copy dictionaries')

  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new ToolRegistryStore(connection.api)
  const useSnapshot = bindSnapshotSelector(controller.store)
  const t = ctx.locale.bind(NS) as ToolRegistrySectionInjected['t']
  const injected = (): ToolRegistrySectionInjected => ({
    controller,
    useSnapshot,
    api: connection.api,
    t,
  })

  // Pushed invalidations converge every open surface without polling.
  ctx.effect(() => {
    const refresh = (): void => { refreshIfLoaded(controller) }
    const disposers = [
      ctx.remote.$on('settings/document-updated', (ns) => {
        if (ns === 'tool-registry') refresh()
      }),
      ctx.on('connection/reset', refresh),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-tool-registry: pushed invalidations')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'tool-registry',
    order: 30,
    label: () => t('nav'),
    inject: injected,
  }, ToolRegistrySection))
}