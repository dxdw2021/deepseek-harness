/** Theme preferences stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Built-in preferences accepted at the registry and settings boundaries. */
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const

/** Built-in theme styles (visual directions) — orthogonal to light/dark. */
export const THEME_STYLES = [
  'graphite',
  'aurora',
  'slate',
  'carbon',
  'nocturne',
  'amber',
] as const

/** Settings namespace owned by the theme plugin. */
export const THEME_SETTINGS_NAMESPACE = 'ui-theme'

/** Field carrying the selected built-in theme preference. */
export const THEME_PREFERENCE_FIELD = 'preference'

/** Field carrying the selected theme style (base style). */
export const THEME_STYLE_FIELD = 'style'

/** Theme preference persisted by the product Appearance row. */
export type ThemePreference = typeof THEME_PREFERENCES[number]

/** Theme style (visual direction) persisted by the product Appearance row. */
export type ThemeStyle = typeof THEME_STYLES[number]

/** Default preference when the user-settings document has no override. */
export const DEFAULT_PREFERENCE: ThemePreference = 'system'

/** Default theme style when the user-settings document has no override. */
export const DEFAULT_STYLE: ThemeStyle = 'graphite'

/** Durable theme section shared by the Host schema and the browser scope. */
export interface ThemeSettings {
  /** Selected built-in preference (light/dark/system). */
  preference: ThemePreference
  /** Selected base visual style. */
  style: ThemeStyle
}

/** Durable theme schema; also the wire envelope the browser scope validates against. */
export const ThemeSettingsSchema: z<ThemeSettings> = z.object({
  [THEME_PREFERENCE_FIELD]: z.union([...THEME_PREFERENCES]).default(DEFAULT_PREFERENCE),
  [THEME_STYLE_FIELD]: z.union([...THEME_STYLES]).default(DEFAULT_STYLE),
})

/**
 * Narrow one wire or registry value to a persistable preference.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value is a built-in preference.
 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.some(preference => preference === value)
}

/**
 * Check if a value is a valid theme style.
 * @param value - value to check.
 * @returns whether the value is a valid theme style.
 */
export function isThemeStyle(value: unknown): value is ThemeStyle {
  return typeof value === 'string' && (THEME_STYLES as readonly string[]).includes(value)
}

/**
 * Normalize a legacy or unknown style value to a valid theme style.
 * @param value - value to normalize.
 * @returns valid theme style.
 */
export function normalizeThemeStyle(value: unknown): ThemeStyle {
  if (isThemeStyle(value)) return value
  return DEFAULT_STYLE
}

/**
 * Legacy style name mapping (for backwards compatibility).
 * Maps old style names to new theme styles.
 */
export const LEGACY_STYLE_MAP: Record<string, ThemeStyle> = {
  ember: 'carbon',
  midnight: 'nocturne',
  sandstone: 'amber',
  porcelain: 'nocturne',
  linen: 'amber',
  glacier: 'slate',
}

/**
 * Normalize a legacy style name to a valid theme style.
 * @param value - legacy style name.
 * @returns valid theme style.
 */
export function normalizeLegacyStyle(value: string): ThemeStyle {
  return LEGACY_STYLE_MAP[value] ?? DEFAULT_STYLE
}
