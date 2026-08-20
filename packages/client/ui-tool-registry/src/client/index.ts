/**
 * Tool Registry UI plugin, browser half.
 *
 * Export discipline: packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { ToolRegistrySection } from './ToolRegistrySection.tsx'
import type { ToolRegistrySectionInjected } from './ToolRegistrySection.tsx'
import { ToolRegistryController, refreshIfLoaded } from './store.ts'
import { en, zh, type ToolRegistryKey } from './locales.ts'

export type { ToolRegistrySectionInjected, ToolRegistrySectionProps } from './ToolRegistrySection.tsx'
export type { ToolRegistryKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.tool-registry': ToolRegistryKey }
}

const NS = 'settings.tool-registry'
export const inject = ['slots', 'locale', 'connection', 'remote']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-tool-registry: copy dictionaries')
  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new ToolRegistryController(connection.api)
  const useSnapshot = bindSnapshotSelector(controller.store)
  const t = ctx.locale.bind(NS) as ToolRegistrySectionInjected['t']
  const injected = (): ToolRegistrySectionInjected => ({ controller, useSnapshot, t })

  ctx.effect(() => {
    const refresh = (): void => { refreshIfLoaded(controller) }
    const disposers = [
      ctx.remote.$on('settings/document-updated', (ns) => { if (ns === 'tool-registry') refresh() }),
      ctx.on('connection/reset', refresh),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-tool-registry: pushed invalidations')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'tool-registry', order: 30,
    label: () => t('nav'), inject: injected,
  }, ToolRegistrySection))
}
