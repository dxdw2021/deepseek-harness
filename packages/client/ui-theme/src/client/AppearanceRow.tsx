/**
 * Appearance preference row registered into the General section item slot
 * (figma 501:30012 'Frame 2117131228'): title + three preference cubes.
 * Registered by this package — the theme feature owns its own settings
 * surface. Selection follows the persisted preference, never the resolved
 * active theme.
 */
import clsx from 'clsx'
import {
  IconDarkOutline16, IconFollowsystemOutline16, IconLightOutline16,
  IconPersonalizationOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { ThemePreference, ThemeStyle } from '../theme-settings.ts'
import type { ThemeKey, StyleKey } from './locales.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createAppearanceRowStore } from './settings-store.ts'
import css from './AppearanceRow.module.css'

/** Injected business face: the preference write (t rides the standard locale seat). */
export interface AppearanceRowInjected {
  /** Switch the theme preference. */
  setTheme: (id: ThemePreference) => void
  /** Switch the base visual style. */
  setStyle: (style: ThemeStyle) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type AppearanceRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createAppearanceRowStore>>
  & PropsLocale<'settings.theme'> & AppearanceRowInjected

/** Cube order and icons (figma 501:30015-30017: Light, Dark, System). */
const CUBES: readonly { id: ThemePreference; labelKey: ThemeKey; Icon: typeof IconLightOutline16 }[] = [
  { id: 'light', labelKey: 'appearance.light', Icon: IconLightOutline16 },
  { id: 'dark', labelKey: 'appearance.dark', Icon: IconDarkOutline16 },
  { id: 'system', labelKey: 'appearance.system', Icon: IconFollowsystemOutline16 },
]

/** Style cards: style id, label key, and accent icon. */
const STYLE_CARDS: readonly { id: ThemeStyle; labelKey: StyleKey; Icon: typeof IconPersonalizationOutline16 }[] = [
  { id: 'graphite', labelKey: 'appearance.style.graphite', Icon: IconPersonalizationOutline16 },
  { id: 'aurora', labelKey: 'appearance.style.aurora', Icon: IconPersonalizationOutline16 },
  { id: 'slate', labelKey: 'appearance.style.slate', Icon: IconPersonalizationOutline16 },
  { id: 'carbon', labelKey: 'appearance.style.carbon', Icon: IconPersonalizationOutline16 },
  { id: 'nocturne', labelKey: 'appearance.style.nocturne', Icon: IconPersonalizationOutline16 },
  { id: 'amber', labelKey: 'appearance.style.amber', Icon: IconPersonalizationOutline16 },
]

/**
 * Render the Appearance row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function AppearanceRow({ t, setTheme, setStyle, useStore }: AppearanceRowComponentProps) {
  const preference = useStore(s => s.preference)
  const style = useStore(s => s.style)
  return (
    <div className={css.group}>
      <div className={css.title}>{t('appearance.title')}</div>
      <div className={css.cubeRow}>
        {CUBES.map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            type="button"
            className={clsx(css.themeCube, preference === id && css.selected)}
            aria-pressed={preference === id}
            onClick={() => { setTheme(id) }}
          >
            <Icon />
            {t(labelKey)}
          </button>
        ))}
      </div>
      <div className={css.styleSection}>
        <div className={css.styleTitle}>{t('appearance.style.title')}</div>
        <div className={css.styleRow}>
          {STYLE_CARDS.map(({ id, labelKey, Icon }) => (
            <button
              key={id}
              type="button"
              className={clsx(css.styleCard, style === id && css.selected)}
              aria-pressed={style === id}
              onClick={() => { setStyle(id) }}
            >
              <Icon />
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
