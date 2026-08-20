/**
 * Permission Management settings section.
 */

import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-web-react'
import type { PermissionManagementState } from './store.ts'
import type { PermissionManagementKey } from './locales.ts'

export interface PermissionManagementSectionInjected {
  useSnapshot: SnapshotSelectorHook<PermissionManagementState>
  t: (key: PermissionManagementKey, params?: Record<string, string | number>) => string
}

export type PermissionManagementSectionProps = Partial<PermissionManagementSectionInjected>

export function PermissionManagementSection({ useSnapshot, t }: PermissionManagementSectionProps): React.ReactElement | null {
  const state = useSnapshot?.(snapshot => snapshot)
  if (!state || !t) return null

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
    </div>
  )
}
