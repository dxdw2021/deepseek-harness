/**
 * Dual Model settings section — displays model configuration and strategy selection.
 *
 * @module DualModelSection
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type { DualModelStore, DualModelState, ModelConfig, CollaborationStrategy } from './store.ts'
import type { DualModelKey } from './locales.ts'

/** Injected dependencies */
export interface DualModelSectionInjected {
  /** Store controller */
  controller: DualModelStore
  /** Snapshot selector hook */
  useSnapshot: () => DualModelState
  /** API connection */
  api: ConnectionHandle['api']
  /** Translation function */
  t: (key: DualModelKey) => string
}

/** Component props */
export interface DualModelSectionProps {
  /** Injected dependencies */
  injected: DualModelSectionInjected
  /** Close settings panel */
  close: () => void
}

/**
 * Dual Model settings section component.
 */
export function DualModelSection({ injected, close }: DualModelSectionProps): React.ReactElement {
  const { controller, useSnapshot, t } = injected
  const state = useSnapshot()
  
  const handleToggleEnabled = async (enabled: boolean): Promise<void> => {
    try {
      await controller.toggleEnabled(enabled)
    } catch (error) {
      console.error('Failed to toggle dual model:', error)
    }
  }
  
  const handleExecutorUpdate = async (config: Partial<ModelConfig>): Promise<void> => {
    try {
      await controller.updateExecutor(config)
    } catch (error) {
      console.error('Failed to update executor:', error)
    }
  }
  
  const handlePlannerUpdate = async (config: Partial<ModelConfig>): Promise<void> => {
    try {
      await controller.updatePlanner(config)
    } catch (error) {
      console.error('Failed to update planner:', error)
    }
  }
  
  const handleStrategyChange = async (strategy: CollaborationStrategy): Promise<void> => {
    try {
      await controller.updateStrategy(strategy)
    } catch (error) {
      console.error('Failed to update strategy:', error)
    }
  }
  
  if (state.status === 'loading') {
    return <div className="dual-model-section loading">{t('status.loading')}</div>
  }
  
  if (state.status === 'error') {
    return <div className="dual-model-section error">{t('status.error')}: {state.error}</div>
  }
  
  return (
    <div className="dual-model-section">
      <h2>{t('title')}</h2>
      <p className="description">{t('description')}</p>
      
      <div className="toggle-enabled">
        <label>
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(e) => handleToggleEnabled(e.target.checked)}
          />
          {t('enabled')}
        </label>
      </div>
      
      {state.enabled && (
        <>
          <div className="model-configs">
            <div className="model-card">
              <h3>{t('executor')}</h3>
              
              <div className="config-item">
                <label>{t('config.provider')}</label>
                <select
                  value={state.executor.provider}
                  onChange={(e) => handleExecutorUpdate({ provider: e.target.value })}
                >
                  {state.availableProviders.map((provider) => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </div>
              
              <div className="config-item">
                <label>{t('config.model')}</label>
                <select
                  value={state.executor.model}
                  onChange={(e) => handleExecutorUpdate({ model: e.target.value })}
                >
                  {(state.availableModels[state.executor.provider] || []).map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
              
              <div className="config-item">
                <label>{t('config.maxTokens')}</label>
                <input
                  type="number"
                  value={state.executor.maxTokens ?? 4096}
                  onChange={(e) => handleExecutorUpdate({ maxTokens: parseInt(e.target.value) || 4096 })}
                />
              </div>
              
              <div className="config-item">
                <label>{t('config.temperature')}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={state.executor.temperature ?? 0.7}
                  onChange={(e) => handleExecutorUpdate({ temperature: parseFloat(e.target.value) || 0.7 })}
                />
              </div>
            </div>
            
            <div className="model-card">
              <h3>{t('planner')}</h3>
              
              <div className="config-item">
                <label>{t('config.provider')}</label>
                <select
                  value={state.planner.provider}
                  onChange={(e) => handlePlannerUpdate({ provider: e.target.value })}
                >
                  {state.availableProviders.map((provider) => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </div>
              
              <div className="config-item">
                <label>{t('config.model')}</label>
                <select
                  value={state.planner.model}
                  onChange={(e) => handlePlannerUpdate({ model: e.target.value })}
                >
                  {(state.availableModels[state.planner.provider] || []).map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
              
              <div className="config-item">
                <label>{t('config.maxTokens')}</label>
                <input
                  type="number"
                  value={state.planner.maxTokens ?? 4096}
                  onChange={(e) => handlePlannerUpdate({ maxTokens: parseInt(e.target.value) || 4096 })}
                />
              </div>
              
              <div className="config-item">
                <label>{t('config.temperature')}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={state.planner.temperature ?? 0.7}
                  onChange={(e) => handlePlannerUpdate({ temperature: parseFloat(e.target.value) || 0.7 })}
                />
              </div>
            </div>
          </div>
          
          <div className="strategy-section">
            <h3>{t('strategy')}</h3>
            
            <div className="strategy-options">
              {(['sequential', 'parallel', 'iterative', 'adaptive'] as CollaborationStrategy[]).map((strategy) => (
                <div
                  key={strategy}
                  className={`strategy-option ${state.strategy === strategy ? 'active' : ''}`}
                  onClick={() => handleStrategyChange(strategy)}
                >
                  <h4>{t(`strategy.${strategy}`)}</h4>
                  <p>{t(`strategy.${strategy}.description`)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      
      <div className="settings-footer">
        <button className="close-button" onClick={close}>
          {t('actions.cancel')}
        </button>
      </div>
    </div>
  )
}