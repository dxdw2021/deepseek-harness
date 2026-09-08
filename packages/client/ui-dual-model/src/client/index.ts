/**
 * Dual Model UI plugin, browser half.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { DualModelSection } from './DualModelSection.tsx'
import type { DualModelSectionInjected } from './DualModelSection.tsx'
import { DualModelController, refreshIfLoaded } from './store.ts'
import { en, zh, type DualModelKey } from './locales.ts'

export type { DualModelSectionInjected, DualModelSectionProps } from './DualModelSection.tsx'
export type { DualModelKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.dual-model': DualModelKey }
}

const NS = 'settings.dual-model'
export const inject = ['slots', 'locale', 'connection', 'remote']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-dual-model: copy dictionaries')
  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new DualModelController(connection.api)
  const useSnapshot = bindSnapshotSelector(controller.store)
  const t = ctx.locale.bind(NS) as DualModelSectionInjected['t']
  const injected = (): DualModelSectionInjected => ({
    useSnapshot,
    toggleEnabled: (enabled) => controller.toggleEnabled(enabled),
    t,
  })

  ctx.effect(() => {
    const refresh = (): void => { refreshIfLoaded(controller) }
    const disposers = [
      ctx.remote.$on('settings/document-updated', (ns: string) => { if (ns === 'dual-model') refresh() }),
      ctx.on('connection/reset', refresh),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-dual-model: pushed invalidations')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'dual-model', order: 20,
    label: () => t('nav'), inject: injected,
  }, DualModelSection))
}
