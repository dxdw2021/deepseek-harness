/**
 * Tool Registry settings section — displays tool list and management controls.
 *
 * @module ToolRegistrySection
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type { ToolRegistryStore, ToolRegistryState, ToolCategory } from './store.ts'
import type { ToolRegistryKey } from './locales.ts'

/** Injected dependencies */
export interface ToolRegistrySectionInjected {
  /** Store controller */
  controller: ToolRegistryStore
  /** Snapshot selector hook */
  useSnapshot: () => ToolRegistryState
  /** API connection */
  api: ConnectionHandle['api']
  /** Translation function */
  t: (key: ToolRegistryKey, params?: Record<string, string | number>) => string
}

/** Component props */
export interface ToolRegistrySectionProps {
  /** Injected dependencies */
  injected: ToolRegistrySectionInjected
  /** Close settings panel */
  close: () => void
}

/** Category filter options */
const CATEGORY_OPTIONS: (ToolCategory | 'all')[] = [
  'all', 'file', 'shell', 'task', 'network', 'search', 'code',
  'memory', 'mcp', 'skill', 'subagent', 'workflow', 'custom',
]

/**
 * Tool Registry settings section component.
 */
export function ToolRegistrySection({ injected, close }: ToolRegistrySectionProps): React.ReactElement {
  const { controller, useSnapshot, t } = injected
  const state = useSnapshot()
  
  const handleToggleTool = async (toolName: string, enabled: boolean): Promise<void> => {
    try {
      await controller.toggleTool(toolName, enabled)
    } catch (error) {
      console.error('Failed to toggle tool:', error)
    }
  }
  
  const handleCategoryFilter = (category: ToolCategory | 'all'): void => {
    controller.setCategoryFilter(category)
  }
  
  const handleSearch = (query: string): void => {
    controller.setSearchQuery(query)
  }
  
  if (state.status === 'loading') {
    return <div className="tool-registry-section loading">{t('status.loading')}</div>
  }
  
  if (state.status === 'error') {
    return <div className="tool-registry-section error">{t('status.error')}: {state.error}</div>
  }
  
  return (
    <div className="tool-registry-section">
      <h2>{t('title')}</h2>
      <p className="description">{t('description')}</p>
      
      <div className="toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder={t('search.placeholder')}
            value={state.searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        
        <div className="category-filters">
          {CATEGORY_OPTIONS.map((category) => (
            <button
              key={category}
              className={`filter-button ${state.categoryFilter === category ? 'active' : ''}`}
              onClick={() => handleCategoryFilter(category)}
            >
              {t(`filter.${category}`)}
            </button>
          ))}
        </div>
      </div>
      
      <div className="tools-stats">
        {t('status.toolsCount', { count: state.filteredTools.length })}
      </div>
      
      <div className="tools-list">
        {state.filteredTools.length === 0 ? (
          <div className="empty-state">{t('status.empty')}</div>
        ) : (
          state.filteredTools.map((tool) => (
            <div key={tool.name} className={`tool-card ${tool.enabled ? 'enabled' : 'disabled'}`}>
              <div className="tool-header">
                <h3>{tool.name}</h3>
                <span className="tool-category">{t(`filter.${tool.category}`)}</span>
              </div>
              
              <p className="tool-description">{tool.description}</p>
              
              <div className="tool-meta">
                <span className={`tool-status ${tool.enabled ? 'enabled' : 'disabled'}`}>
                  {tool.enabled ? t('tool.enabled') : t('tool.disabled')}
                </span>
                
                {tool.readOnly && (
                  <span className="tool-badge readonly">{t('tool.readOnly')}</span>
                )}
                
                {tool.streaming && (
                  <span className="tool-badge streaming">{t('tool.streaming')}</span>
                )}
              </div>
              
              <div className="tool-permissions">
                <label>{t('tool.permissions')}:</label>
                <span>{tool.permissions.join(', ')}</span>
              </div>
              
              <div className="tool-usage">
                <span>{t('tool.usage')}: {tool.usageCount}</span>
                {tool.lastUsed && (
                  <span>{t('tool.lastUsed')}: {new Date(tool.lastUsed).toLocaleDateString()}</span>
                )}
              </div>
              
              <div className="tool-actions">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={tool.enabled}
                    onChange={(e) => handleToggleTool(tool.name, e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="settings-footer">
        <button className="close-button" onClick={close}>
          关闭
        </button>
      </div>
    </div>
  )
}