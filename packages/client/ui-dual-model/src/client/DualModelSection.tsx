/**
 * Dual Model settings section.
 */

import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-web-react'
import type { DualModelState } from './store.ts'
import type { DualModelKey } from './locales.ts'

export interface DualModelSectionInjected {
  useSnapshot: SnapshotSelectorHook<DualModelState>
  toggleEnabled: (enabled: boolean) => Promise<void>
  t: (key: DualModelKey) => string
}

export type DualModelSectionProps = Partial<DualModelSectionInjected>

export function DualModelSection({ useSnapshot, toggleEnabled, t }: DualModelSectionProps): React.ReactElement | null {
  const state = useSnapshot?.(snapshot => snapshot)
  if (!state || !t) return null

  if (state.status === 'loading') return <div>{t('status.loading')}</div>
  if (state.status === 'error') return <div>{t('status.error')}: {state.error}</div>

  return (
    <div>
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      <label>
        <input type="checkbox" checked={state.enabled} onChange={(e) => void toggleEnabled?.(e.target.checked)} />
        {t('enabled')}
      </label>
      {state.enabled && (
        <>
          <div><h3>{t('executor')}</h3><span>{state.executor.provider} / {state.executor.model}</span></div>
          <div><h3>{t('planner')}</h3><span>{state.planner.provider} / {state.planner.model}</span></div>
          <div>
            <h3>{t('strategy')}</h3>
            {(['sequential', 'parallel', 'iterative', 'adaptive'] as const).map((s) => (
              <div key={s} className={state.strategy === s ? 'active' : ''}>
                <h4>{t(`strategy.${s}` as DualModelKey)}</h4>
                <p>{t(`strategy.${s}.description` as DualModelKey)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
