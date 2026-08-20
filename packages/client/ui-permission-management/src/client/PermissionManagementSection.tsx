/**
 * Permission Management settings section.
 *
 * @module PermissionManagementSection
 */

import type { PermissionManagementController, PermissionManagementState } from './store.ts'
import type { PermissionManagementKey } from './locales.ts'
import type { SettingsSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client'

export interface PermissionManagementSectionInjected {
  controller: PermissionManagementController
  useSnapshot: () => PermissionManagementState
  t: (key: PermissionManagementKey, params?: Record<string, string | number>) => string
}

export type PermissionManagementSectionProps = SettingsSectionOwnerProps & PermissionManagementSectionInjected

export function PermissionManagementSection({ controller, useSnapshot, t, close }: PermissionManagementSectionProps): React.ReactElement {
  const state = useSnapshot()

  if (state.status === 'loading') return <div className="loading">{t('status.loading')}</div>
  if (state.status === 'error') return <div className="error">{t('status.error')}: {state.error}</div>

  return (
    <div className="permission-management-section">
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      <div className="tabs">
        <button className={state.activeTab === 'rules' ? 'active' : ''} onClick={() => controller.setActiveTab('rules')}>{t('tabs.rules')}</button>
        <button className={state.activeTab === 'audit' ? 'active' : ''} onClick={() => controller.setActiveTab('audit')}>{t('tabs.audit')}</button>
      </div>
      {state.activeTab === 'rules' && (
        <div className="rules-list">
          <span>{t('status.rulesCount', { count: state.rules.length })}</span>
          {state.rules.length === 0 ? <div className="empty">{t('status.empty')}</div> :
            state.rules.map((rule) => (
              <div key={rule.id} className={`rule-card ${rule.enabled ? 'enabled' : 'disabled'}`}>
                <h3>{rule.description}</h3>
                <span>{t('rules.resourceType')}: {rule.resourceType}</span>
                <span>{t('rules.actions')}: {rule.actions.join(', ')}</span>
              </div>
            ))
          }
        </div>
      )}
      <button onClick={close}>关闭</button>
    </div>
  )
}
