/**
 * Theme Enhanced settings section.
 */

import { useEffect } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ThemeEnhancedState } from './store.ts'
import type { ThemeEnhancedKey } from './locales.ts'

export interface ThemeEnhancedSectionInjected {
  hooks: { themeEnhanced: SnapshotStore<ThemeEnhancedState> }
  load: () => Promise<void>
  selectTheme: (id: string) => Promise<void>
}

export type ThemeEnhancedSectionProps =
  PropsRuntime<'settings.section'>
  & InjectFace<ThemeEnhancedSectionInjected>
  & { t: (key: ThemeEnhancedKey) => string; close: () => void }

export function ThemeEnhancedSection({ hooks, load, selectTheme, t, close }: ThemeEnhancedSectionProps): React.ReactElement {
  const state = hooks.useThemeEnhanced(snapshot => snapshot)

  useEffect(() => { void load() }, [load])

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
          <button onClick={() => void selectTheme(theme.id)} disabled={state.currentThemeId === theme.id}>
            {state.currentThemeId === theme.id ? '当前' : '选择'}
          </button>
        </div>
      ))}
      <button onClick={close}>关闭</button>
    </div>
  )
}
