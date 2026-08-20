/**
 * Theme Enhanced settings section.
 */

import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-web-react'
import type { ThemeEnhancedState } from './store.ts'
import type { ThemeEnhancedKey } from './locales.ts'

export interface ThemeEnhancedSectionInjected {
  useSnapshot: SnapshotSelectorHook<ThemeEnhancedState>
  selectTheme: (id: string) => Promise<void>
  t: (key: ThemeEnhancedKey) => string
}

export type ThemeEnhancedSectionProps = Partial<ThemeEnhancedSectionInjected>

export function ThemeEnhancedSection({ useSnapshot, selectTheme, t }: ThemeEnhancedSectionProps): React.ReactElement | null {
  const state = useSnapshot?.(snapshot => snapshot)
  if (!state || !t) return null

  if (state.status === 'loading') return <div>{t('status.loading')}</div>
  if (state.status === 'error') return <div>{t('status.error')}: {state.error}</div>

  return (
    <div>
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      <div><span>{t('currentTheme')}: </span><strong>{state.themes.find(th => th.id === state.currentThemeId)?.name ?? 'Unknown'}</strong></div>
      {state.themes.map((theme) => (
        <div key={theme.id}>
          <h3>{theme.name}</h3>
          <span>{theme.type}</span>
          <button onClick={() => void selectTheme?.(theme.id)} disabled={state.currentThemeId === theme.id}>
            {state.currentThemeId === theme.id ? '当前' : '选择'}
          </button>
        </div>
      ))}
    </div>
  )
}
