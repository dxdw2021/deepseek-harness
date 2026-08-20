/**
 * Theme Enhanced settings section.
 *
 * @module ThemeEnhancedSection
 */

import type { ThemeEnhancedController, ThemeEnhancedState } from './store.ts'
import type { ThemeEnhancedKey } from './locales.ts'
import type { SettingsSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client'

export interface ThemeEnhancedSectionInjected {
  controller: ThemeEnhancedController
  useSnapshot: () => ThemeEnhancedState
  t: (key: ThemeEnhancedKey) => string
}

export type ThemeEnhancedSectionProps = SettingsSectionOwnerProps & ThemeEnhancedSectionInjected

export function ThemeEnhancedSection({ controller, useSnapshot, t, close }: ThemeEnhancedSectionProps): React.ReactElement {
  const state = useSnapshot()

  if (state.status === 'loading') return <div className="loading">{t('status.loading')}</div>
  if (state.status === 'error') return <div className="error">{t('status.error')}: {state.error}</div>

  return (
    <div className="theme-enhanced-section">
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      <div className="current-theme">
        <span>{t('currentTheme')}: </span>
        <strong>{state.themes.find(th => th.id === state.currentThemeId)?.name ?? 'Unknown'}</strong>
      </div>
      <div className="themes-grid">
        {state.themes.map((theme) => (
          <div key={theme.id} className={`theme-card ${state.currentThemeId === theme.id ? 'active' : ''}`}>
            <h3>{theme.name}</h3>
            <span className="theme-type">{theme.type}</span>
            <button onClick={() => void controller.selectTheme(theme.id)}
              disabled={state.currentThemeId === theme.id}>
              {state.currentThemeId === theme.id ? '当前' : '选择'}
            </button>
          </div>
        ))}
      </div>
      <button onClick={close}>关闭</button>
    </div>
  )
}
