/**
 * Dual Model settings section.
 */

import { useEffect } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { DualModelState } from './store.ts'
import type { DualModelKey } from './locales.ts'

export interface DualModelSectionInjected {
  hooks: { dualModel: SnapshotStore<DualModelState> }
  load: () => Promise<void>
  toggleEnabled: (enabled: boolean) => Promise<void>
}

export type DualModelSectionProps =
  PropsRuntime<'settings.section'>
  & InjectFace<DualModelSectionInjected>
  & { t: (key: DualModelKey) => string; close: () => void }

export function DualModelSection({ hooks, load, toggleEnabled, t, close }: DualModelSectionProps): React.ReactElement {
  const state = hooks.useDualModel(snapshot => snapshot)

  useEffect(() => { void load() }, [load])

  if (state.status === 'loading') return <div>{t('status.loading')}</div>
  if (state.status === 'error') return <div>{t('status.error')}: {state.error}</div>

  return (
    <div>
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      <label>
        <input type="checkbox" checked={state.enabled} onChange={(e) => void toggleEnabled(e.target.checked)} />
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
                <h4>{t(`strategy.${s}`)}</h4>
                <p>{t(`strategy.${s}.description`)}</p>
              </div>
            ))}
          </div>
        </>
      )}
      <button onClick={close}>{t('actions.cancel')}</button>
    </div>
  )
}
