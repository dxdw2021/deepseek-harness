/**
 * Permission Management UI plugin, browser half.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { PermissionManagementSection } from './PermissionManagementSection.tsx'
import type { PermissionManagementSectionInjected } from './PermissionManagementSection.tsx'
import { PermissionManagementController, refreshIfLoaded } from './store.ts'
import { en, zh, type PermissionManagementKey } from './locales.ts'

export type { PermissionManagementSectionInjected, PermissionManagementSectionProps } from './PermissionManagementSection.tsx'
export type { PermissionManagementKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.permission-management': PermissionManagementKey }
}

const NS = 'settings.permission-management'
export const inject = ['slots', 'locale', 'connection', 'remote']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-permission-management: copy dictionaries')
  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new PermissionManagementController(connection.api)
  const load = (): Promise<void> => controller.load()
  const t = ctx.locale.bind(NS) as PermissionManagementSectionInjected['t'] & ((key: PermissionManagementKey, params?: Record<string, string | number>) => string)
  const injected = (): PermissionManagementSectionInjected => ({
    hooks: { permissionManagement: controller.store },
    load,
  })

  ctx.effect(() => {
    const refresh = (): void => { refreshIfLoaded(controller) }
    const disposers = [
      ctx.remote.$on('settings/document-updated', (ns: string) => { if (ns === 'permission-management') refresh() }),
      ctx.on('connection/reset', refresh),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-permission-management: pushed invalidations')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'permission-management', order: 40,
    label: () => t('nav'), inject: injected,
  }, PermissionManagementSection))
}
