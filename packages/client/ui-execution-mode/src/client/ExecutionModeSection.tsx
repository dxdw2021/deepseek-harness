/**
 * Execution Mode settings section.
 */

import { useEffect } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ExecutionModeState, ExecutionMode } from './store.ts'
import type { ExecutionModeKey } from './locales.ts'

export interface ExecutionModeSectionInjected {
  hooks: { executionMode: SnapshotStore<ExecutionModeState> }
  load: () => Promise<void>
  setMode: (mode: ExecutionMode) => Promise<void>
}

export type ExecutionModeSectionProps =
  PropsRuntime<'settings.section'>
  & InjectFace<ExecutionModeSectionInjected>
  & { t: (key: ExecutionModeKey) => string; close: () => void }

export function ExecutionModeSection({ hooks, load, setMode, t, close }: ExecutionModeSectionProps): React.ReactElement {
  const state = hooks.useExecutionMode(snapshot => snapshot)

  useEffect(() => { void load() }, [load])

  if (state.status === 'loading') return <div>{t('status.loading')}</div>
  if (state.status === 'error') return <div>{t('status.error')}: {state.error}</div>

  return (
    <div>
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      <div><span>{t('currentMode')}: </span><strong>{t(`mode.${state.currentMode}`)}</strong></div>
      {(['light', 'balanced', 'delivery'] as const).map((mode) => (
        <div key={mode}>
          <h3>{t(`mode.${mode}`)}</h3>
          <p>{t(`mode.${mode}.description`)}</p>
          <button onClick={() => void setMode(mode)} disabled={state.currentMode === mode}>
            {state.currentMode === mode ? '当前' : t('actions.switch')}
          </button>
        </div>
      ))}
      <button onClick={close}>{t('actions.cancel')}</button>
    </div>
  )
}
