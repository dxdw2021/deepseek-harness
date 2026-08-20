/**
 * Execution Mode UI plugin, browser half.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { ExecutionModeSection } from './ExecutionModeSection.tsx'
import type { ExecutionModeSectionInjected } from './ExecutionModeSection.tsx'
import { ExecutionModeController, refreshIfLoaded } from './store.ts'
import { en, zh, type ExecutionModeKey } from './locales.ts'

export type { ExecutionModeSectionInjected, ExecutionModeSectionProps } from './ExecutionModeSection.tsx'
export type { ExecutionModeKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.execution-mode': ExecutionModeKey }
}

const NS = 'settings.execution-mode'
export const inject = ['slots', 'locale', 'connection', 'remote']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-execution-mode: copy dictionaries')
  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new ExecutionModeController(connection.api)
  const load = (): Promise<void> => controller.load()
  const setMode = (mode: import('./store.ts').ExecutionMode): Promise<void> => controller.setMode(mode)
  const t = ctx.locale.bind(NS) as ExecutionModeSectionInjected['t'] & ((key: ExecutionModeKey) => string)
  const injected = (): ExecutionModeSectionInjected => ({
    hooks: { executionMode: controller.store },
    load,
    setMode,
  })

  ctx.effect(() => {
    const refresh = (): void => { refreshIfLoaded(controller) }
    const disposers = [
      ctx.remote.$on('settings/document-updated', (ns: string) => { if (ns === 'execution-mode') refresh() }),
      ctx.on('connection/reset', refresh),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-execution-mode: pushed invalidations')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'execution-mode', order: 15,
    label: () => t('nav'), inject: injected,
  }, ExecutionModeSection))
}
