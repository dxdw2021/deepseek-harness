/** `settings.theme` namespace dictionaries (the Appearance row's copy). */

import type { ThemeStyle } from '../theme-settings.ts'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'appearance.title': '外观',
  'appearance.light': '浅色',
  'appearance.dark': '深色',
  'appearance.system': '跟随系统',
  'appearance.style.title': '风格',
  'appearance.style.graphite': '石墨',
  'appearance.style.aurora': '极光',
  'appearance.style.slate': '板岩',
  'appearance.style.carbon': '炭黑',
  'appearance.style.nocturne': '夜曲',
  'appearance.style.amber': '琥珀',
} satisfies Record<string, string>

/** The settings.theme namespace key union. */
export type ThemeKey = keyof typeof zh

/** Style key for localization. */
export type StyleKey = `appearance.style.${ThemeStyle}`

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'appearance.title': 'Appearance',
  'appearance.light': 'Light',
  'appearance.dark': 'Dark',
  'appearance.system': 'System',
  'appearance.style.title': 'Style',
  'appearance.style.graphite': 'Graphite',
  'appearance.style.aurora': 'Aurora',
  'appearance.style.slate': 'Slate',
  'appearance.style.carbon': 'Carbon',
  'appearance.style.nocturne': 'Nocturne',
  'appearance.style.amber': 'Amber',
} satisfies Record<ThemeKey, string>
