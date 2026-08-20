/**
 * Tool Registry settings section — displays tool list and management controls.
 *
 * @module ToolRegistrySection
 */

import type { ToolRegistryController, ToolRegistryState, ToolCategory } from './store.ts'
import type { ToolRegistryKey } from './locales.ts'
import type { SettingsSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client'

export interface ToolRegistrySectionInjected {
  controller: ToolRegistryController
  useSnapshot: () => ToolRegistryState
  t: (key: ToolRegistryKey, params?: Record<string, string | number>) => string
}

export type ToolRegistrySectionProps = SettingsSectionOwnerProps & ToolRegistrySectionInjected

const CATEGORY_OPTIONS: (ToolCategory | 'all')[] = ['all', 'file', 'shell', 'task', 'network', 'search', 'code', 'memory', 'mcp', 'skill', 'subagent', 'workflow', 'custom']

export function ToolRegistrySection({ controller, useSnapshot, t, close }: ToolRegistrySectionProps): React.ReactElement {
  const state = useSnapshot()

  if (state.status === 'loading') return <div className="loading">{t('status.loading')}</div>
  if (state.status === 'error') return <div className="error">{t('status.error')}: {state.error}</div>

  const filtered = state.tools.filter(tool => {
    if (state.categoryFilter !== 'all' && tool.category !== state.categoryFilter) return false
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase()
      if (!tool.name.toLowerCase().includes(q) && !tool.description.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="tool-registry-section">
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      <input type="text" placeholder={t('search.placeholder')} value={state.searchQuery}
        onChange={(e) => controller.setSearchQuery(e.target.value)} />
      <div className="category-filters">
        {CATEGORY_OPTIONS.map((cat) => (
          <button key={cat} className={state.categoryFilter === cat ? 'active' : ''}
            onClick={() => controller.setCategoryFilter(cat)}>{t(`filter.${cat}`)}</button>
        ))}
      </div>
      <div className="tools-stats">{t('status.toolsCount', { count: filtered.length })}</div>
      <div className="tools-list">
        {filtered.length === 0 ? <div className="empty">{t('status.empty')}</div> :
          filtered.map((tool) => (
            <div key={tool.name} className={`tool-card ${tool.enabled ? 'enabled' : 'disabled'}`}>
              <h3>{tool.name}</h3>
              <p>{tool.description}</p>
              <span className="category">{t(`filter.${tool.category}`)}</span>
              <span>{t('tool.usage')}: {tool.usageCount}</span>
            </div>
          ))
        }
      </div>
      <button onClick={close}>关闭</button>
    </div>
  )
}
