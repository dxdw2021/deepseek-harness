/**
 * Dual Model settings section — displays model configuration and strategy selection.
 *
 * @module DualModelSection
 */

import type { DualModelController, DualModelState, CollaborationStrategy } from './store.ts'
import type { DualModelKey } from './locales.ts'
import type { SettingsSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client'

export interface DualModelSectionInjected {
  controller: DualModelController
  useSnapshot: () => DualModelState
  t: (key: DualModelKey) => string
}

export type DualModelSectionProps = SettingsSectionOwnerProps & DualModelSectionInjected

export function DualModelSection({ controller, useSnapshot, t, close }: DualModelSectionProps): React.ReactElement {
  const state = useSnapshot()
  const strategies = ['sequential', 'parallel', 'iterative', 'adaptive'] as const

  if (state.status === 'loading') return <div className="loading">{t('status.loading')}</div>
  if (state.status === 'error') return <div className="error">{t('status.error')}: {state.error}</div>

  return (
    <div className="dual-model-section">
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      <label>
        <input type="checkbox" checked={state.enabled} onChange={(e) => void controller.toggleEnabled(e.target.checked)} />
        {t('enabled')}
      </label>
      {state.enabled && (
        <>
          <div className="model-configs">
            <div className="model-card">
              <h3>{t('executor')}</h3>
              <span>{t('config.provider')}: {state.executor.provider}</span>
              <span>{t('config.model')}: {state.executor.model}</span>
            </div>
            <div className="model-card">
              <h3>{t('planner')}</h3>
              <span>{t('config.provider')}: {state.planner.provider}</span>
              <span>{t('config.model')}: {state.planner.model}</span>
            </div>
          </div>
          <div className="strategy-section">
            <h3>{t('strategy')}</h3>
            {strategies.map((s) => (
              <div key={s} className={`strategy-option ${state.strategy === s ? 'active' : ''}`}
                onClick={() => void controller.updateStrategy(s)}>
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
