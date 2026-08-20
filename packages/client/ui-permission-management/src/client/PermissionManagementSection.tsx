/**
 * Permission Management settings section — displays permission rules and audit logs.
 *
 * @module PermissionManagementSection
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type { PermissionManagementStore, PermissionManagementState, PermissionRule, ResourceType, PermissionAction } from './store.ts'
import type { PermissionManagementKey } from './locales.ts'

/** Injected dependencies */
export interface PermissionManagementSectionInjected {
  /** Store controller */
  controller: PermissionManagementStore
  /** Snapshot selector hook */
  useSnapshot: () => PermissionManagementState
  /** API connection */
  api: ConnectionHandle['api']
  /** Translation function */
  t: (key: PermissionManagementKey, params?: Record<string, string | number>) => string
}

/** Component props */
export interface PermissionManagementSectionProps {
  /** Injected dependencies */
  injected: PermissionManagementSectionInjected
  /** Close settings panel */
  close: () => void
}

/** Resource type options */
const RESOURCE_TYPES: ResourceType[] = ['file', 'directory', 'tool', 'session', 'agent', 'plugin', 'system']

/** Permission action options */
const PERMISSION_ACTIONS: PermissionAction[] = ['read', 'write', 'execute', 'admin', 'create', 'delete', 'update']

/**
 * Permission Management settings section component.
 */
export function PermissionManagementSection({ injected, close }: PermissionManagementSectionProps): React.ReactElement {
  const { controller, useSnapshot, t } = injected
  const state = useSnapshot()
  
  const handleToggleRule = async (ruleId: string, enabled: boolean): Promise<void> => {
    try {
      await controller.toggleRule(ruleId, enabled)
    } catch (error) {
      console.error('Failed to toggle rule:', error)
    }
  }
  
  const handleDeleteRule = async (ruleId: string): Promise<void> => {
    try {
      await controller.deleteRule(ruleId)
    } catch (error) {
      console.error('Failed to delete rule:', error)
    }
  }
  
  const handleCreateRule = async (): Promise<void> => {
    try {
      await controller.createRule({
        description: 'New permission rule',
        resourceType: 'file',
        resourcePattern: '*',
        actions: ['read'],
        priority: 0,
        enabled: true,
      })
    } catch (error) {
      console.error('Failed to create rule:', error)
    }
  }
  
  const handleTabChange = (tab: 'rules' | 'audit'): void => {
    controller.setActiveTab(tab)
  }
  
  if (state.status === 'loading') {
    return <div className="permission-management-section loading">{t('status.loading')}</div>
  }
  
  if (state.status === 'error') {
    return <div className="permission-management-section error">{t('status.error')}: {state.error}</div>
  }
  
  return (
    <div className="permission-management-section">
      <h2>{t('title')}</h2>
      <p className="description">{t('description')}</p>
      
      <div className="tabs">
        <button
          className={`tab ${state.activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => handleTabChange('rules')}
        >
          {t('tabs.rules')}
        </button>
        <button
          className={`tab ${state.activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => handleTabChange('audit')}
        >
          {t('tabs.audit')}
        </button>
      </div>
      
      {state.activeTab === 'rules' && (
        <div className="rules-tab">
          <div className="rules-header">
            <span>{t('status.rulesCount', { count: state.rules.length })}</span>
            <button className="create-button" onClick={handleCreateRule}>
              {t('rules.create')}
            </button>
          </div>
          
          <div className="rules-list">
            {state.rules.length === 0 ? (
              <div className="empty-state">{t('status.empty')}</div>
            ) : (
              state.rules.map((rule) => (
                <div key={rule.id} className={`rule-card ${rule.enabled ? 'enabled' : 'disabled'}`}>
                  <div className="rule-header">
                    <h3>{rule.description}</h3>
                    <span className="rule-status">
                      {rule.enabled ? t('rules.enabled') : t('rules.disabled')}
                    </span>
                  </div>
                  
                  <div className="rule-details">
                    <div className="rule-item">
                      <label>{t('rules.resourceType')}:</label>
                      <span>{rule.resourceType}</span>
                    </div>
                    
                    <div className="rule-item">
                      <label>{t('rules.resourcePattern')}:</label>
                      <span>{rule.resourcePattern}</span>
                    </div>
                    
                    <div className="rule-item">
                      <label>{t('rules.actions')}:</label>
                      <span>{rule.actions.join(', ')}</span>
                    </div>
                    
                    <div className="rule-item">
                      <label>{t('rules.priority')}:</label>
                      <span>{rule.priority}</span>
                    </div>
                  </div>
                  
                  <div className="rule-actions">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) => handleToggleRule(rule.id, e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                    
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      {t('rules.delete')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {state.activeTab === 'audit' && (
        <div className="audit-tab">
          <div className="audit-header">
            <span>{t('status.auditCount', { count: state.auditLog.length })}</span>
          </div>
          
          <div className="audit-list">
            {state.auditLog.length === 0 ? (
              <div className="empty-state">{t('status.empty')}</div>
            ) : (
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>{t('audit.timestamp')}</th>
                    <th>{t('audit.user')}</th>
                    <th>{t('audit.resource')}</th>
                    <th>{t('audit.action')}</th>
                    <th>{t('audit.granted')}</th>
                    <th>{t('audit.reason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.auditLog.map((entry) => (
                    <tr key={entry.id} className={entry.granted ? 'granted' : 'denied'}>
                      <td>{new Date(entry.timestamp).toLocaleString()}</td>
                      <td>{entry.userId}</td>
                      <td>{entry.resource}</td>
                      <td>{entry.action}</td>
                      <td>{entry.granted ? t('audit.granted') : t('audit.denied')}</td>
                      <td>{entry.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      
      <div className="settings-footer">
        <button className="close-button" onClick={close}>
          关闭
        </button>
      </div>
    </div>
  )
}