/**
 * Permission Management settings section.
 */

import { useEffect } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PermissionManagementState } from './store.ts'
import type { PermissionManagementKey } from './locales.ts'

export interface PermissionManagementSectionInjected {
  hooks: { permissionManagement: SnapshotStore<PermissionManagementState> }
  load: () => Promise<void>
}

export type PermissionManagementSectionProps =
  PropsRuntime<'settings.section'>
  & InjectFace<PermissionManagementSectionInjected>
  & { t: (key: PermissionManagementKey, params?: Record<string, string | number>) => string; close: () => void }

export function PermissionManagementSection({ hooks, load, t, close }: PermissionManagementSectionProps): React.ReactElement {
  const state = hooks.usePermissionManagement(snapshot => snapshot)

  useEffect(() => { void load() }, [load])

  if (state.status === 'loading') return <div>{t('status.loading')}</div>
  if (state.status === 'error') return <div>{t('status.error')}: {state.error}</div>

  return (
    <div>
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      <div>{t('status.rulesCount', { count: state.rules.length })}</div>
      {state.rules.length === 0 ? <div>{t('status.empty')}</div> :
        state.rules.map((rule) => (
          <div key={rule.id}>
            <h3>{rule.description}</h3>
            <span>{rule.resourceType}: {rule.actions.join(', ')}</span>
          </div>
        ))
      }
      <button onClick={close}>关闭</button>
    </div>
  )
}
