/**
 * Theme Enhanced UI plugin, browser half.
 *
 * Export discipline: packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { ThemeEnhancedSection } from './ThemeEnhancedSection.tsx'
import type { ThemeEnhancedSectionInjected } from './ThemeEnhancedSection.tsx'
import { ThemeEnhancedController, refreshIfLoaded } from './store.ts'
import { en, zh, type ThemeEnhancedKey } from './locales.ts'

export type { ThemeEnhancedSectionInjected, ThemeEnhancedSectionProps } from './ThemeEnhancedSection.tsx'
export type { ThemeEnhancedKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.theme-enhanced': ThemeEnhancedKey }
}

const NS = 'settings.theme-enhanced'
export const inject = ['slots', 'locale', 'connection', 'remote']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-theme-enhanced: copy dictionaries')
  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new ThemeEnhancedController(connection.api)
  const useSnapshot = bindSnapshotSelector(controller.store)
  const t = ctx.locale.bind(NS) as ThemeEnhancedSectionInjected['t']
  const injected = (): ThemeEnhancedSectionInjected => ({ controller, useSnapshot, t })

  ctx.effect(() => {
    const refresh = (): void => { refreshIfLoaded(controller) }
    const disposers = [
      ctx.remote.$on('settings/document-updated', (ns) => { if (ns === 'theme-enhanced') refresh() }),
      ctx.on('connection/reset', refresh),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-theme-enhanced: pushed invalidations')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'theme-enhanced', order: 60,
    label: () => t('nav'), inject: injected,
  }, ThemeEnhancedSection))
}
