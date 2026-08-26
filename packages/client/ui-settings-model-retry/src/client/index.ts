/**
 * Model Requests settings plugin, browser half. Registers the Model Requests
 * section (holding the configurable model-request retry count) and binds the
 * Max-retries row to the host `model` settings namespace. The host `llm-retry`
 * plugin reads that namespace to override the resolver default for every
 * provider that did not declare its own retry policy.
 * Export discipline: packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the settings slot declarations plus the ctx.settingsScope Context
// merge. Cross-plugin collaboration goes through the service, never a value import
// (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls ctx.locale into this program.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { createMaxRetriesStore } from './store.ts'
import { MaxRetriesRow } from './MaxRetriesRow.tsx'
import type { MaxRetriesRowInjected } from './MaxRetriesRow.tsx'
import { ModelRetrySection } from './ModelRetrySection.tsx'
import { en, zh, type ModelRequestKey } from './locales.ts'
import type { ModelSettings } from './model-settings.ts'

export type { MaxRetriesRowInjected, MaxRetriesRowComponentProps } from './MaxRetriesRow.tsx'
export type { ModelRetrySectionComponentProps } from './ModelRetrySection.tsx'
export type { ModelRequestKey } from './locales.ts'
export type { ModelSettings } from './model-settings.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** This feature's own settings-row copy (the Model Requests section). */
    'settings.model-request': ModelRequestKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.model-request'

/** Host settings namespace the Max-retries row binds to. */
const MODEL_SETTINGS_NAMESPACE = 'model'

/**
 * Required services (cordis fiber inject). The target slots are declared by
 * ui-settings' apply, whose activation order relative to this one is NOT
 * constrained; registrations depend on their slots through `slots.inject()`.
 */
export const inject = ['slots', 'locale', 'settingsScope']

/**
 * Register the Model Requests dictionaries, section, and Max-retries row.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-model-retry: copy dictionaries')

  const t = ctx.locale.bind(NS)
  const scope = ctx.settingsScope.bind<ModelSettings>({ namespace: MODEL_SETTINGS_NAMESPACE })
  const store = createMaxRetriesStore()
  let bound: BoundActions<typeof store> | undefined
  const sync = (): void => {
    const snapshot = scope.getSnapshot()
    bound?.sync(snapshot.value?.maxRetries, snapshot.revision ?? 0)
  }
  ctx.effect(() => scope.subscribe(sync), 'ui-settings-model-retry: model scope subscription')
  const injected = (actions: BoundActions<typeof store>): MaxRetriesRowInjected => {
    bound = actions
    // Re-sync from the getter so no change is lost between registration and the
    // first render (the store's revision guard drops stale duplicates).
    sync()
    return {
      setMaxRetries: (value: number) => { void scope.set('maxRetries', value) },
    }
  }

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'model-request',
    order: 11,
    label: () => t('nav'),
    locale: NS,
    children: { 'settings.model-request.item': { kind: 'list', scope: 'root' } },
  }, ModelRetrySection))

  ctx.slots.inject('settings.model-request.item', () => ctx.slots.register({
    name: 'settings.model-request.item',
    id: 'max-retries',
    order: 0,
    store,
    locale: NS,
    inject: injected,
  }, MaxRetriesRow))
}
