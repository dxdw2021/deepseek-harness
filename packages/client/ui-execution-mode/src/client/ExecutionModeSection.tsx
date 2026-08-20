/**
 * Execution Mode settings section — displays mode cards and configuration.
 *
 * @module ExecutionModeSection
 */

import { useMemo } from 'react'
import type { ExecutionModeController, ExecutionModeState, ExecutionMode } from './store.ts'
import type { ExecutionModeKey } from './locales.ts'
import type { SettingsSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client'

/** Injected dependencies */
export interface ExecutionModeSectionInjected {
  controller: ExecutionModeController
  useSnapshot: () => ExecutionModeState
  t: (key: ExecutionModeKey) => string
}

/** Component props — owner props merged with injected */
export type ExecutionModeSectionProps = SettingsSectionOwnerProps & ExecutionModeSectionInjected

/**
 * Execution Mode settings section component.
 */
export function ExecutionModeSection({ controller, useSnapshot, t, close }: ExecutionModeSectionProps): React.ReactElement {
  const state = useSnapshot()

  const handleModeSwitch = (mode: ExecutionMode): void => {
    void controller.setMode(mode)
  }

  if (state.status === 'loading') {
    return <div className="execution-mode-section loading">{t('status.loading')}</div>
  }

  if (state.status === 'error') {
    return <div className="execution-mode-section error">{t('status.error')}: {state.error}</div>
  }

  const modes = ['light', 'balanced', 'delivery'] as const

  return (
    <div className="execution-mode-section">
      <h2>{t('title')}</h2>
      <p className="description">{t('description')}</p>

      <div className="current-mode">
        <span>{t('currentMode')}: </span>
        <strong>{t(`mode.${state.currentMode}`)}</strong>
      </div>

      <div className="mode-cards">
        {modes.map((mode) => (
          <div key={mode} className={`mode-card ${state.currentMode === mode ? 'active' : ''}`}>
            <h3>{t(`mode.${mode}`)}</h3>
            <p>{t(`mode.${mode}.description`)}</p>
            <div className="mode-config">
              <span>{t('config.maxToolCalls')}: {state.configs[mode].maxToolCalls}</span>
              <span>{t('config.enableStreaming')}: {state.configs[mode].enableStreaming ? '✓' : '✗'}</span>
              <span>{t('config.enablePlanMode')}: {state.configs[mode].enablePlanMode ? '✓' : '✗'}</span>
              <span>{t('config.enableGoalMode')}: {state.configs[mode].enableGoalMode ? '✓' : '✗'}</span>
            </div>
            <button
              className="mode-switch-button"
              onClick={() => handleModeSwitch(mode)}
              disabled={!state.enableModeSwitching || state.currentMode === mode}
            >
              {state.currentMode === mode ? '当前模式' : t('actions.switch')}
            </button>
          </div>
        ))}
      </div>

      <div className="settings-footer">
        <button className="close-button" onClick={close}>{t('actions.cancel')}</button>
      </div>
    </div>
  )
}
