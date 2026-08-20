/**
 * Bot/IM Integration UI plugin, browser half.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { BotImSection } from './BotImSection.tsx'
import type { BotImSectionInjected } from './BotImSection.tsx'
import { BotImController, refreshIfLoaded } from './store.ts'
import { en, zh, type BotImKey } from './locales.ts'

export type { BotImSectionInjected, BotImSectionProps } from './BotImSection.tsx'
export type { BotImKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.bot-im': BotImKey }
}

const NS = 'settings.bot-im'
export const inject = ['slots', 'locale', 'connection', 'remote']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-bot-im: copy dictionaries')
  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new BotImController(connection.api)
  const load = (): Promise<void> => controller.load()
  const t = ctx.locale.bind(NS) as BotImSectionInjected['t'] & ((key: BotImKey) => string)
  const injected = (): BotImSectionInjected => ({
    hooks: { botIm: controller.store },
    load,
  })

  ctx.effect(() => {
    const refresh = (): void => { refreshIfLoaded(controller) }
    const disposers = [
      ctx.remote.$on('settings/document-updated', (ns: string) => { if (ns === 'bot-im') refresh() }),
      ctx.on('connection/reset', refresh),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-bot-im: pushed invalidations')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'bot-im', order: 50,
    label: () => t('nav'), inject: injected,
  }, BotImSection))
}
