/**
 * Theme Enhanced UI plugin, browser half — registers the Theme Enhanced
 * settings section for custom theme management and preview.
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
import { ThemeEnhancedSection } from './ThemeEnhancedSection.tsx'
import type { ThemeEnhancedSectionInjected } from './ThemeEnhancedSection.tsx'
import { ThemeEnhancedStore } from './store.ts'
import { en, zh, type ThemeEnhancedKey } from './locales.ts'

export type { ThemeEnhancedSectionInjected, ThemeEnhancedSectionProps } from './ThemeEnhancedSection.tsx'
export type { ThemeEnhancedKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Theme Enhanced page copy. */
    'settings.theme-enhanced': ThemeEnhancedKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.theme-enhanced'
export type { ThemeEnhancedState } from './store.ts'

/**
 * Refetch the page snapshot only after its first load.
 * @param controller - the page store.
 */
export function refreshIfLoaded(controller: ThemeEnhancedStore): void {
  if (controller.store.getSnapshot().status === 'idle') return
  void controller.load()
}

/**
 * Required services (cordis fiber inject).
 */
export const inject = ['slots', 'locale', 'connection', 'remote']

/**
 * Register the Theme Enhanced section once the `settings.section` declaration
 * is on the ledger, wire its store to the connection, and keep it fresh on
 * every pushed invalidation.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-theme-enhanced: copy dictionaries')

  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new ThemeEnhancedStore(connection.api)
  const useSnapshot = bindSnapshotSelector(controller.store)
  const t = ctx.locale.bind(NS) as ThemeEnhancedSectionInjected['t']
  const injected = (): ThemeEnhancedSectionInjected => ({
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
        if (ns === 'theme-enhanced') refresh()
      }),
      ctx.on('connection/reset', refresh),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-theme-enhanced: pushed invalidations')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'theme-enhanced',
    order: 60,
    label: () => t('nav'),
    inject: injected,
  }, ThemeEnhancedSection))
}