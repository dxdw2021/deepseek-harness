/**
 * Tool Registry settings section.
 */

import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-web-react'
import type { ToolRegistryState } from './store.ts'
import type { ToolRegistryKey } from './locales.ts'

export interface ToolRegistrySectionInjected {
  useSnapshot: SnapshotSelectorHook<ToolRegistryState>
  t: (key: ToolRegistryKey, params?: Record<string, string | number>) => string
}

export type ToolRegistrySectionProps = Partial<ToolRegistrySectionInjected>

export function ToolRegistrySection({ useSnapshot, t }: ToolRegistrySectionProps): React.ReactElement | null {
  const state = useSnapshot?.(snapshot => snapshot)
  if (!state || !t) return null

  if (state.status === 'loading') return <div>{t('status.loading')}</div>
  if (state.status === 'error') return <div>{t('status.error')}: {state.error}</div>

  return (
    <div>
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      <div>{t('status.toolsCount', { count: state.tools.length })}</div>
      {state.tools.length === 0 ? <div>{t('status.empty')}</div> :
        state.tools.map((tool) => (
          <div key={tool.name}>
            <h3>{tool.name}</h3>
            <p>{tool.description}</p>
            <span>{tool.enabled ? '✓' : '✗'}</span>
          </div>
        ))
      }
    </div>
  )
}
