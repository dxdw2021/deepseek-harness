/**
 * Execution Mode settings section.
 */

import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-web-react'
import type { ExecutionModeState, ExecutionMode } from './store.ts'
import type { ExecutionModeKey } from './locales.ts'

export interface ExecutionModeSectionInjected {
  useSnapshot: SnapshotSelectorHook<ExecutionModeState>
  setMode: (mode: ExecutionMode) => Promise<void>
  t: (key: ExecutionModeKey) => string
}

export type ExecutionModeSectionProps = Partial<ExecutionModeSectionInjected>

export function ExecutionModeSection({ useSnapshot, setMode, t }: ExecutionModeSectionProps): React.ReactElement | null {
  const state = useSnapshot?.(snapshot => snapshot)
  if (!state || !t) return null

  if (state.status === 'loading') return <div>{t('status.loading')}</div>
  if (state.status === 'error') return <div>{t('status.error')}: {state.error}</div>

  return (
    <div>
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      <div><span>{t('currentMode')}: </span><strong>{t(`mode.${state.currentMode}` as ExecutionModeKey)}</strong></div>
      {(['light', 'balanced', 'delivery'] as const).map((mode) => (
        <div key={mode}>
          <h3>{t(`mode.${mode}` as ExecutionModeKey)}</h3>
          <p>{t(`mode.${mode}.description` as ExecutionModeKey)}</p>
          <button onClick={() => void setMode?.(mode)} disabled={state.currentMode === mode}>
            {state.currentMode === mode ? '当前' : t('actions.switch')}
          </button>
        </div>
      ))}
    </div>
  )
}
