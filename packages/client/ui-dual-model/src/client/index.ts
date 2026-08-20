/**
 * Dual Model UI plugin, browser half — registers the Dual Model
 * settings section for configuring Executor + Planner collaboration.
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
import { DualModelSection } from './DualModelSection.tsx'
import type { DualModelSectionInjected } from './DualModelSection.tsx'
import { DualModelStore } from './store.ts'
import { en, zh, type DualModelKey } from './locales.ts'

export type { DualModelSectionInjected, DualModelSectionProps } from './DualModelSection.tsx'
export type { DualModelKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Dual Model page copy. */
    'settings.dual-model': DualModelKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.dual-model'
export type { DualModelState } from './store.ts'

/**
 * Refetch the page snapshot only after its first load.
 * @param controller - the page store.
 */
export function refreshIfLoaded(controller: DualModelStore): void {
  if (controller.store.getSnapshot().status === 'idle') return
  void controller.load()
}

/**
 * Required services (cordis fiber inject).
 */
export const inject = ['slots', 'locale', 'connection', 'remote']

/**
 * Register the Dual Model section once the `settings.section` declaration
 * is on the ledger, wire its store to the connection, and keep it fresh on
 * every pushed invalidation.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-dual-model: copy dictionaries')

  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new DualModelStore(connection.api)
  const useSnapshot = bindSnapshotSelector(controller.store)
  const t = ctx.locale.bind(NS) as DualModelSectionInjected['t']
  const injected = (): DualModelSectionInjected => ({
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
        if (ns === 'dual-model') refresh()
      }),
      ctx.on('connection/reset', refresh),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-dual-model: pushed invalidations')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dual-model',
    order: 20,
    label: () => t('nav'),
    inject: injected,
  }, DualModelSection))
}