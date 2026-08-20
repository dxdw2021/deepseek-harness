/**
 * Execution Mode settings section — displays mode cards and configuration.
 *
 * @module ExecutionModeSection
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type { ExecutionModeStore, ExecutionModeState, ExecutionMode, ModeConfig } from './store.ts'
import type { ExecutionModeKey } from './locales.ts'

/** Injected dependencies */
export interface ExecutionModeSectionInjected {
  /** Store controller */
  controller: ExecutionModeStore
  /** Snapshot selector hook */
  useSnapshot: () => ExecutionModeState
  /** API connection */
  api: ConnectionHandle['api']
  /** Translation function */
  t: (key: ExecutionModeKey) => string
}

/** Component props */
export interface ExecutionModeSectionProps {
  /** Injected dependencies */
  injected: ExecutionModeSectionInjected
  /** Close settings panel */
  close: () => void
}

/**
 * Execution Mode settings section component.
 */
export function ExecutionModeSection({ injected, close }: ExecutionModeSectionProps): React.ReactElement {
  const { controller, useSnapshot, t } = injected
  const state = useSnapshot()
  
  const handleModeSwitch = async (mode: ExecutionMode): Promise<void> => {
    try {
      await controller.setMode(mode)
    } catch (error) {
      console.error('Failed to switch mode:', error)
    }
  }
  
  const handleConfigUpdate = async (mode: ExecutionMode, config: Partial<ModeConfig>): Promise<void> => {
    try {
      await controller.updateConfig(mode, config)
    } catch (error) {
      console.error('Failed to update config:', error)
    }
  }
  
  const handleToggleSwitching = async (enabled: boolean): Promise<void> => {
    try {
      await controller.toggleModeSwitching(enabled)
    } catch (error) {
      console.error('Failed to toggle mode switching:', error)
    }
  }
  
  if (state.status === 'loading') {
    return <div className="execution-mode-section loading">{t('status.loading')}</div>
  }
  
  if (state.status === 'error') {
    return <div className="execution-mode-section error">{t('status.error')}: {state.error}</div>
  }
  
  return (
    <div className="execution-mode-section">
      <h2>{t('title')}</h2>
      <p className="description">{t('description')}</p>
      
      <div className="current-mode">
        <label>{t('currentMode')}:</label>
        <span className={`mode-badge ${state.currentMode}`}>
          {t(`mode.${state.currentMode}`)}
        </span>
      </div>
      
      <div className="mode-cards">
        {(['light', 'balanced', 'delivery'] as ExecutionMode[]).map((mode) => (
          <div
            key={mode}
            className={`mode-card ${state.currentMode === mode ? 'active' : ''}`}
          >
            <h3>{t(`mode.${mode}`)}</h3>
            <p>{t(`mode.${mode}.description`)}</p>
            
            <div className="mode-config">
              <div className="config-item">
                <label>{t('config.maxToolCalls')}:</label>
                <input
                  type="number"
                  value={state.configs[mode].maxToolCalls}
                  onChange={(e) => handleConfigUpdate(mode, { maxToolCalls: parseInt(e.target.value) || 0 })}
                  disabled={!state.enableModeSwitching}
                />
              </div>
              
              <div className="config-item">
                <label>{t('config.enableStreaming')}</label>
                <input
                  type="checkbox"
                  checked={state.configs[mode].enableStreaming}
                  onChange={(e) => handleConfigUpdate(mode, { enableStreaming: e.target.checked })}
                  disabled={!state.enableModeSwitching}
                />
              </div>
              
              <div className="config-item">
                <label>{t('config.enablePlanMode')}</label>
                <input
                  type="checkbox"
                  checked={state.configs[mode].enablePlanMode}
                  onChange={(e) => handleConfigUpdate(mode, { enablePlanMode: e.target.checked })}
                  disabled={!state.enableModeSwitching}
                />
              </div>
              
              <div className="config-item">
                <label>{t('config.enableGoalMode')}</label>
                <input
                  type="checkbox"
                  checked={state.configs[mode].enableGoalMode}
                  onChange={(e) => handleConfigUpdate(mode, { enableGoalMode: e.target.checked })}
                  disabled={!state.enableModeSwitching}
                />
              </div>
              
              {mode !== 'light' && (
                <div className="config-item">
                  <label>{t('config.enableSubagents')}</label>
                  <input
                    type="checkbox"
                    checked={state.configs[mode].enableSubagents ?? false}
                    onChange={(e) => handleConfigUpdate(mode, { enableSubagents: e.target.checked })}
                    disabled={!state.enableModeSwitching}
                  />
                </div>
              )}
              
              {mode === 'delivery' && (
                <>
                  <div className="config-item">
                    <label>{t('config.enableEvidenceCollection')}</label>
                    <input
                      type="checkbox"
                      checked={state.configs[mode].enableEvidenceCollection ?? false}
                      onChange={(e) => handleConfigUpdate(mode, { enableEvidenceCollection: e.target.checked })}
                      disabled={!state.enableModeSwitching}
                    />
                  </div>
                  
                  <div className="config-item">
                    <label>{t('config.enableStrictValidation')}</label>
                    <input
                      type="checkbox"
                      checked={state.configs[mode].enableStrictValidation ?? false}
                      onChange={(e) => handleConfigUpdate(mode, { enableStrictValidation: e.target.checked })}
                      disabled={!state.enableModeSwitching}
                    />
                  </div>
                </>
              )}
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
        <div className="toggle-switching">
          <label>{t('config.enableModeSwitching')}</label>
          <input
            type="checkbox"
            checked={state.enableModeSwitching}
            onChange={(e) => handleToggleSwitching(e.target.checked)}
          />
        </div>
        
        <button className="close-button" onClick={close}>
          {t('actions.cancel')}
        </button>
      </div>
    </div>
  )
}