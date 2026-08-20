/**
 * Tool Registry settings section.
 */

import { useEffect } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolRegistryState } from './store.ts'
import type { ToolRegistryKey } from './locales.ts'

export interface ToolRegistrySectionInjected {
  hooks: { toolRegistry: SnapshotStore<ToolRegistryState> }
  load: () => Promise<void>
  setCategoryFilter: (cat: string) => void
  setSearchQuery: (q: string) => void
}

export type ToolRegistrySectionProps =
  PropsRuntime<'settings.section'>
  & InjectFace<ToolRegistrySectionInjected>
  & { t: (key: ToolRegistryKey, params?: Record<string, string | number>) => string; close: () => void }

export function ToolRegistrySection({ hooks, load, t, close }: ToolRegistrySectionProps): React.ReactElement {
  const state = hooks.useToolRegistry(snapshot => snapshot)

  useEffect(() => { void load() }, [load])

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
      <button onClick={close}>关闭</button>
    </div>
  )
}
