/**
 * Browser theme registry over the `--dsw-*` token stylesheets. The service
 * owns the live theme preference (light/dark/system), resolves `system` through
 * `prefers-color-scheme`, and publishes immutable snapshots; it never touches
 * the DOM — ui-layout's presenter consumes the resolved snapshot. The Host
 * settings scope loads and stores the preference in the user-settings
 * document. The plugin also registers the Appearance preference row into the
 * settings General section — the theme feature owns its own settings surface.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { ClientContext, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the ctx.settingsScope Context merge. Cross-plugin collaboration
// goes through the service, never a value import (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { AppearanceRowInjected } from './AppearanceRow.tsx'
import { AppearanceRow } from './AppearanceRow.tsx'
import { createAppearanceRowStore } from './settings-store.ts'
import { en, zh, type ThemeKey } from './locales.ts'
import {
  DEFAULT_PREFERENCE, DEFAULT_STYLE, THEME_PREFERENCE_FIELD, THEME_STYLE_FIELD, THEME_SETTINGS_NAMESPACE,
  THEME_STYLES, isThemePreference, isThemeStyle,
  type ThemePreference, type ThemeStyle, type ThemeSettings,
} from '../theme-settings.ts'

export type { AppearanceRowComponentProps, AppearanceRowInjected } from './AppearanceRow.tsx'
export type { AppearanceRowState } from './settings-store.ts'
export type { ThemeKey } from './locales.ts'
export type { ThemePreference, ThemeStyle, ThemeSettings } from '../theme-settings.ts'
export { THEME_STYLES } from '../theme-settings.ts'

/** Namespace owning this feature's settings-row copy. */
export const SETTINGS_NS = 'settings.theme'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Appearance settings row's copy. */
    'settings.theme': ThemeKey
  }
}

/** Theme token dictionary: --dsw-alias-* overrides keyed by variable name. */
export type ThemeTokens = Record<string, string>

/**
 * One override-layer token value: both palette modes are mandatory (repeat
 * the same value when the token is scheme-invariant) so an override never
 * goes illegible when the user switches to the other scheme.
 */
export interface ThemeTokenModes {
  /** Value applied while the light base palette is active. */
  light: string
  /** Value applied while the dark base palette is active. */
  dark: string
}

/** Override-layer dictionary: token names to per-mode value pairs. */
export type ThemeTokenOverrides = Record<string, ThemeTokenModes>

/** One selectable theme: id, dark/light semantics, and alias-token overrides. */
export interface ThemeDefinition {
  /** Theme id (the setTheme argument for concrete themes). */
  id: string
  /**
   * Which base palette this theme builds on. The presenter switches
   * `body[data-ds-dark-theme]` from this field — never from the id.
   */
  colorScheme: 'light' | 'dark'
  /** Base visual style (graphite, aurora, slate, carbon, nocturne, amber). */
  style: ThemeStyle
  /** Alias-layer overrides applied as inline CSS variables over the base palette. */
  tokens: ThemeTokenOverrides
}

/** Resolved active theme with tokens already picked for the current color scheme. */
export interface ResolvedThemeDefinition extends Omit<ThemeDefinition, 'tokens'> {
  /** Resolved tokens for the active color scheme. */
  tokens: ThemeTokens
}

/** Immutable theme state published on every change. */
export interface ThemeSnapshot {
  /** The persisted preference (may be `system`). */
  preference: ThemePreference
  /** The persisted base visual style. */
  style: ThemeStyle
  /**
   * The resolved active theme (`system` resolved via prefers-color-scheme)
   * with override layers folded into its tokens (seq order, later layers win
   * per-token; each value picked for the active color scheme).
   */
  active: ResolvedThemeDefinition
  /** Registered themes in registration order. */
  themes: readonly ThemeDefinition[]
  /** Monotonic change counter (registry or active changes). */
  revision: number
}

/** One theme token exposed to pre-definition Cordis inspection. */
export interface ThemeTokenInspection {
  /** Token name accepted by {@link ThemeService.overrideTokens}. */
  name: string
  /** Intended visual role. */
  description: string
  /** CSS value category. */
  valueType: string
  /** Whether override layers must supply both palette modes. */
  requiresLightAndDark: boolean
  /** CSS custom property consumed by UI styles. */
  cssVariable?: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    theme: ThemeRuntime
  }
  interface Events {
    /**
     * Theme state changed (preference switched, registry updated, style changed,
     * or the OS color scheme changed while the preference is `system`).
     * @param snapshot - Current immutable theme snapshot.
     * @mode emit
     */
    'theme/change'(snapshot: ThemeSnapshot): void
  }
}

/** Theme style token overrides — each style defines its own alias-token palette. */
const STYLE_TOKEN_OVERRIDES: Record<ThemeStyle, ThemeTokenOverrides> = {
  graphite: {
    '--dsw-alias-bg-base': { light: '#f4f3ef', dark: '#090a0c' },
    '--dsw-alias-bg-layer-1': { light: '#ffffff', dark: '#111316' },
    '--dsw-alias-bg-layer-2': { light: '#f0efe9', dark: '#1a1d21' },
    '--dsw-alias-bg-overlay': { light: '#ffffff', dark: '#16191d' },
    '--dsw-alias-border-l1': { light: '#e0ded6', dark: '#2a2e33' },
    '--dsw-alias-border-l2': { light: '#d0cdc3', dark: '#3a3f46' },
    '--dsw-alias-brand-primary': { light: '#2563eb', dark: '#60a5fa' },
    '--dsw-alias-label-primary': { light: '#111316', dark: '#f4f3ef' },
    '--dsw-alias-label-secondary': { light: '#525960', dark: '#a8adb5' },
    '--dsw-alias-state-error-primary': { light: '#dc2626', dark: '#f87171' },
    '--dsw-alias-state-success-primary': { light: '#16a34a', dark: '#4ade80' },
    '--dsw-alias-state-warn-primary': { light: '#d97706', dark: '#fbbf24' },
    '--dsw-specific-sidebar-fill': { light: '#faf9f5', dark: '#0d0f12' },
  },
  aurora: {
    '--dsw-alias-bg-base': { light: '#f0f9ff', dark: '#0c1a2a' },
    '--dsw-alias-bg-layer-1': { light: '#ffffff', dark: '#11263a' },
    '--dsw-alias-bg-layer-2': { light: '#e0f2fe', dark: '#163048' },
    '--dsw-alias-bg-overlay': { light: '#ffffff', dark: '#14283c' },
    '--dsw-alias-border-l1': { light: '#bae6fd', dark: '#1e3a5f' },
    '--dsw-alias-border-l2': { light: '#7dd3fc', dark: '#2a4a6f' },
    '--dsw-alias-brand-primary': { light: '#0284c7', dark: '#38bdf8' },
    '--dsw-alias-label-primary': { light: '#0c1a2a', dark: '#f0f9ff' },
    '--dsw-alias-label-secondary': { light: '#475569', dark: '#93c5fd' },
    '--dsw-alias-state-error-primary': { light: '#dc2626', dark: '#f87171' },
    '--dsw-alias-state-success-primary': { light: '#16a34a', dark: '#4ade80' },
    '--dsw-alias-state-warn-primary': { light: '#d97706', dark: '#fbbf24' },
    '--dsw-specific-sidebar-fill': { light: '#f8fbff', dark: '#0a1625' },
  },
  slate: {
    '--dsw-alias-bg-base': { light: '#f8fafc', dark: '#0f172a' },
    '--dsw-alias-bg-layer-1': { light: '#ffffff', dark: '#1e293b' },
    '--dsw-alias-bg-layer-2': { light: '#f1f5f9', dark: '#263244' },
    '--dsw-alias-bg-overlay': { light: '#ffffff', dark: '#1e293b' },
    '--dsw-alias-border-l1': { light: '#e2e8f0', dark: '#334155' },
    '--dsw-alias-border-l2': { light: '#cbd5e1', dark: '#475569' },
    '--dsw-alias-brand-primary': { light: '#475569', dark: '#94a3b8' },
    '--dsw-alias-label-primary': { light: '#0f172a', dark: '#f8fafc' },
    '--dsw-alias-label-secondary': { light: '#64748b', dark: '#94a3b8' },
    '--dsw-alias-state-error-primary': { light: '#dc2626', dark: '#f87171' },
    '--dsw-alias-state-success-primary': { light: '#16a34a', dark: '#4ade80' },
    '--dsw-alias-state-warn-primary': { light: '#d97706', dark: '#fbbf24' },
    '--dsw-specific-sidebar-fill': { light: '#fafbfc', dark: '#0c1422' },
  },
  carbon: {
    '--dsw-alias-bg-base': { light: '#fafafa', dark: '#121212' },
    '--dsw-alias-bg-layer-1': { light: '#ffffff', dark: '#1e1e1e' },
    '--dsw-alias-bg-layer-2': { light: '#f5f5f5', dark: '#262626' },
    '--dsw-alias-bg-overlay': { light: '#ffffff', dark: '#1a1a1a' },
    '--dsw-alias-border-l1': { light: '#e0e0e0', dark: '#333333' },
    '--dsw-alias-border-l2': { light: '#d0d0d0', dark: '#404040' },
    '--dsw-alias-brand-primary': { light: '#666666', dark: '#a0a0a0' },
    '--dsw-alias-label-primary': { light: '#121212', dark: '#fafafa' },
    '--dsw-alias-label-secondary': { light: '#666666', dark: '#a0a0a0' },
    '--dsw-alias-state-error-primary': { light: '#dc2626', dark: '#f87171' },
    '--dsw-alias-state-success-primary': { light: '#16a34a', dark: '#4ade80' },
    '--dsw-alias-state-warn-primary': { light: '#d97706', dark: '#fbbf24' },
    '--dsw-specific-sidebar-fill': { light: '#fcfcfc', dark: '#0f0f0f' },
  },
  nocturne: {
    '--dsw-alias-bg-base': { light: '#fefbff', dark: '#1a0c1a' },
    '--dsw-alias-bg-layer-1': { light: '#ffffff', dark: '#261226' },
    '--dsw-alias-bg-layer-2': { light: '#faf0fa', dark: '#2e1a2e' },
    '--dsw-alias-bg-overlay': { light: '#ffffff', dark: '#221222' },
    '--dsw-alias-border-l1': { light: '#f0dbf0', dark: '#3d243d' },
    '--dsw-alias-border-l2': { light: '#e8c8e8', dark: '#4a2e4a' },
    '--dsw-alias-brand-primary': { light: '#a21caf', dark: '#d064e0' },
    '--dsw-alias-label-primary': { light: '#1a0c1a', dark: '#fefbff' },
    '--dsw-alias-label-secondary': { light: '#6b4e6b', dark: '#c896c8' },
    '--dsw-alias-state-error-primary': { light: '#dc2626', dark: '#f87171' },
    '--dsw-alias-state-success-primary': { light: '#16a34a', dark: '#4ade80' },
    '--dsw-alias-state-warn-primary': { light: '#d97706', dark: '#fbbf24' },
    '--dsw-specific-sidebar-fill': { light: '#fdf5fd', dark: '#150a15' },
  },
  amber: {
    '--dsw-alias-bg-base': { light: '#fffbeb', dark: '#1a1306' },
    '--dsw-alias-bg-layer-1': { light: '#ffffff', dark: '#231a08' },
    '--dsw-alias-bg-layer-2': { light: '#fef3c7', dark: '#2d220a' },
    '--dsw-alias-bg-overlay': { light: '#ffffff', dark: '#1f1807' },
    '--dsw-alias-border-l1': { light: '#fde68a', dark: '#3d2f09' },
    '--dsw-alias-border-l2': { light: '#fcd34d', dark: '#5a420c' },
    '--dsw-alias-brand-primary': { light: '#b45309', dark: '#fbbf24' },
    '--dsw-alias-label-primary': { light: '#1a1306', dark: '#fffbeb' },
    '--dsw-alias-label-secondary': { light: '#78550c', dark: '#fde68a' },
    '--dsw-alias-state-error-primary': { light: '#dc2626', dark: '#f87171' },
    '--dsw-alias-state-success-primary': { light: '#16a34a', dark: '#4ade80' },
    '--dsw-alias-state-warn-primary': { light: '#d97706', dark: '#fbbf24' },
    '--dsw-specific-sidebar-fill': { light: '#fefcf5', dark: '#151005' },
  },
}

/** Built-in theme definitions for each style (light/dark pairs). */
const BUILTIN_THEMES: readonly ThemeDefinition[] = Object.freeze(
  THEME_STYLES.flatMap(style => [
    Object.freeze({
      id: `${style}-light`,
      colorScheme: 'light' as const,
      style,
      tokens: Object.freeze(STYLE_TOKEN_OVERRIDES[style]),
    }),
    Object.freeze({
      id: `${style}-dark`,
      colorScheme: 'dark' as const,
      style,
      tokens: Object.freeze(STYLE_TOKEN_OVERRIDES[style]),
    }),
  ]),
)

const BUILTIN_INSPECT_TOKENS: readonly ThemeTokenInspection[] = Object.freeze([
  { name: '--dsw-alias-bg-base', description: 'Application base background.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-bg-base' },
  { name: '--dsw-alias-bg-layer-1', description: 'Primary raised surface background.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-bg-layer-1' },
  { name: '--dsw-alias-bg-layer-2', description: 'Secondary nested surface background.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-bg-layer-2' },
  { name: '--dsw-alias-bg-overlay', description: 'Overlay and popover background.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-bg-overlay' },
  { name: '--dsw-alias-border-l1', description: 'Primary subtle border.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-border-l1' },
  { name: '--dsw-alias-border-l2', description: 'Secondary stronger border.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-border-l2' },
  { name: '--dsw-alias-brand-primary', description: 'Primary brand accent.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-brand-primary' },
  { name: '--dsw-alias-label-primary', description: 'Primary text color.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-label-primary' },
  { name: '--dsw-alias-label-secondary', description: 'Secondary text color.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-label-secondary' },
  { name: '--dsw-alias-state-error-primary', description: 'Primary error state color.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-state-error-primary' },
  { name: '--dsw-alias-state-success-primary', description: 'Primary success state color.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-state-success-primary' },
  { name: '--dsw-alias-state-warn-primary', description: 'Primary warning state color.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-alias-state-warn-primary' },
  { name: '--dsw-specific-sidebar-fill', description: 'Sidebar column and title-row background.', valueType: 'CSS color', requiresLightAndDark: true, cssVariable: '--dsw-specific-sidebar-fill' },
])

/**
 * Theme registry and preference owner. `light`/`dark` are built in (the base
 * stylesheets carry both palettes); third-party themes register alias-layer
 * overrides. Reads go through {@link getTheme}; preference writes only
 * through {@link setTheme}; continuous sync only through the `theme/change`
 * event. {@link overrideTokens} stacks partial token layers over the active
 * theme without touching the registry.
 * The service holds the `prefers-color-scheme` media query (environment
 * sensing, not presentation) and re-emits when the OS scheme flips while the
 * preference is `system`.
 */
export class ThemeRuntime {
  private readonly ctx: Context
  private readonly host: SettingsScope<ThemeSettings>
  private themes: ThemeDefinition[] = [...BUILTIN_THEMES]
  private preference: ThemePreference
  private style: ThemeStyle
  private revision = 0
  private snapshot: ThemeSnapshot
  private readonly media: MediaQueryList | undefined
  /** Override layers by source; seq (monotonic) is the stacking order. */
  private readonly overrides = new Map<string, { seq: number; tokens: ThemeTokenOverrides }>()
  private overrideSeq = 0

  /**
   * @param ctx - owning context (change events are emitted on it; the
   * media-query and scope listeners are released through ctx.effect on dispose).
   * @param host - durable preference scope owned by the same plugin.
   */
  constructor(ctx: Context, host: SettingsScope<ThemeSettings>) {
    this.ctx = ctx
    this.host = host
    this.preference = DEFAULT_PREFERENCE
    this.style = DEFAULT_STYLE
    // Non-browser runs (node e2e booting the client tree) have no matchMedia.
    this.media = typeof matchMedia === 'undefined' ? undefined : matchMedia('(prefers-color-scheme: dark)')
    this.snapshot = this.buildSnapshot()
    if (this.media !== undefined) {
      const media = this.media
      const onChange = (): void => {
        if (this.preference !== 'system') return
        this.publish()
      }
      ctx.effect(() => {
        media.addEventListener('change', onChange)
        return () => { media.removeEventListener('change', onChange) }
      }, 'ui-theme: prefers-color-scheme listener')
    }
    ctx.effect(() => host.subscribe(() => { this.adopt() }), 'ui-theme: settings scope adoption')
    this.adopt()
  }

  /**
   * Read the current immutable theme snapshot.
   * @returns the current snapshot (stable reference until the next change).
   */
  getTheme(): ThemeSnapshot {
    return this.snapshot
  }

  /**
   * Export the current token directory without reading DOM or computed styles.
   * @returns stable JSON-safe token descriptions, including registered and override-only names.
   */
  exportInspectTokens(): ThemeTokenInspection[] {
    const tokens = new Map(BUILTIN_INSPECT_TOKENS.map(token => [token.name, token]))
    for (const theme of this.themes) {
      for (const name of Object.keys(theme.tokens)) {
        if (!tokens.has(name)) tokens.set(name, dynamicToken(name))
      }
    }
    for (const layer of this.overrides.values()) {
      for (const name of Object.keys(layer.tokens)) {
        if (!tokens.has(name)) tokens.set(name, dynamicToken(name))
      }
    }
    return [...tokens.values()].map(token => ({ ...token })).sort((left, right) => left.name.localeCompare(right.name))
  }

  /**
   * Switch the theme preference — the only user preference write entry.
   * Built-in preferences are written through the settings scope and every
   * accepted value emits `theme/change`.
   * @param id - a registered theme id or `system`; unknown ids throw.
   */
  setTheme(id: string): void {
    if (id !== 'system' && !this.themes.some(t => t.id === id)) {
      throw new Error(`theme "${id}" is not registered`)
    }
    if (this.preference === id) return
    this.preference = id as ThemePreference
    if (isThemePreference(id)) void this.host.set(THEME_PREFERENCE_FIELD, id)
    this.publish()
  }

  /** Adopt the scope's accepted durable preference without writing it back. */
  private adopt(): void {
    const section = this.host.getSnapshot().value
    if (section === undefined) return
    let changed = false
    if (this.preference !== section.preference) {
      this.preference = section.preference
      changed = true
    }
    if (this.style !== section.style) {
      this.style = section.style
      changed = true
    }
    if (changed) this.publish()
  }

  /**
   * Switch the base visual style — the only user style write entry.
   * Styles are written through the settings scope and emit `theme/change`.
   * @param style - a valid theme style; unknown values throw.
   */
  setStyle(style: string): void {
    if (!isThemeStyle(style)) {
      throw new Error(`theme style "${style}" is not valid`)
    }
    if (this.style === style) return
    this.style = style
    void this.host.set(THEME_STYLE_FIELD, style)
    this.publish()
  }

  /**
   * Register a theme. Duplicate id throws (single occupant per id; the
   * built-in pair counts; `system` is a preference, not a registrable id).
   * @param definition - theme id, colorScheme, and alias-token overrides.
   * @returns disposer. Disposing the theme backing the active preference
   * resets the preference to the default so the UI never keeps tokens of an
   * unregistered theme.
   */
  register(definition: ThemeDefinition): () => void {
    if (definition.id === 'system') throw new Error('"system" is a preference, not a registrable theme id')
    if (this.themes.some(t => t.id === definition.id)) {
      throw new Error(`theme "${definition.id}" is already registered`)
    }
    this.themes = [...this.themes, definition]
    this.publish()
    return () => {
      if (!this.themes.some(t => t.id === definition.id)) return
      this.themes = this.themes.filter(t => t.id !== definition.id)
      if (this.preference === definition.id) {
        this.preference = DEFAULT_PREFERENCE
      }
      this.publish()
    }
  }

  /**
   * Stack a token override layer on top of the active theme — the token-level
   * analogue of slot shading: the base theme stays untouched, layers compose
   * in seq order with later layers winning per-token, and removing a layer
   * restores whatever it covered. Calling again with the same source replaces
   * that source's whole layer and restacks it on top (effect re-registration
   * semantics). Emits `theme/change` with the recomposed snapshot.
   * @param source - layer identity; one layer per source (dynamic packages
   * pass their package id — the façade pins it, so it also names the layer's
   * origin for inspection).
   * @param tokens - token-name → `{ light, dark }` value pairs. Validated at
   * runtime (model-authored callers reach this boundary with untyped JS);
   * a bare string value throws a teaching error.
   * @returns disposer removing exactly the layer this call created; a no-op
   * once the source has re-overridden (the newer layer is not torn down).
   */
  overrideTokens(source: string, tokens: ThemeTokenOverrides): () => void {
    const layer = { seq: this.overrideSeq++, tokens: validateOverrides(source, tokens) }
    this.overrides.set(source, layer)
    this.publish()
    return () => {
      if (this.overrides.get(source) !== layer) return
      this.overrides.delete(source)
      this.publish()
    }
  }

  private buildSnapshot(): ThemeSnapshot {
    const scheme = this.preference === 'system'
      ? (this.media?.matches === true ? 'dark' : 'light')
      : this.preference === 'light' || this.preference === 'dark'
        ? this.preference
        : undefined
    // Bare scheme preferences resolve through the current style; full
    // preference ids (e.g. "graphite-light") match the registry directly.
    const resolvedId = scheme !== undefined ? `${this.style}-${scheme}` : this.preference
    // Both built-ins always exist; a registered preference id resolves or has
    // been reset by its disposer, so the lookup cannot miss.
    const active = this.themes.find(t => t.id === resolvedId)
    /* v8 ignore next 2 -- needs a registry without light/dark, which register()/dispose() cannot produce */
    if (active === undefined) throw new Error(`theme registry lost "${resolvedId}"`)
    return Object.freeze({
      preference: this.preference,
      style: this.style,
      active: this.composeActive(active),
      themes: Object.freeze([...this.themes]),
      revision: this.revision,
    })
  }

  /**
   * Fold the override layers into the active definition: seq order, later
   * layers win per-token, each value picked for the active color scheme (the
   * presenter consumes the composed snapshot and needs no override awareness).
   * Without layers the registered definition passes through by identity.
   */
  private composeActive(active: ThemeDefinition): ResolvedThemeDefinition {
    if (this.overrides.size === 0) {
      // Pick resolved tokens for the active color scheme
      const tokens: ThemeTokens = {}
      for (const [name, modes] of Object.entries(active.tokens)) {
        tokens[name] = modes[active.colorScheme]
      }
      return Object.freeze({ ...active, tokens: Object.freeze(tokens) })
    }
    const tokens: ThemeTokens = {}
    // Start with base theme tokens resolved for active color scheme
    for (const [name, modes] of Object.entries(active.tokens)) {
      tokens[name] = modes[active.colorScheme]
    }
    // Apply override layers
    for (const layer of [...this.overrides.values()].sort((a, b) => a.seq - b.seq)) {
      for (const [name, modes] of Object.entries(layer.tokens)) {
        tokens[name] = modes[active.colorScheme]
      }
    }
    return Object.freeze({ ...active, tokens: Object.freeze(tokens) })
  }

  private publish(): void {
    this.revision += 1
    this.snapshot = this.buildSnapshot()
    this.ctx.emit('theme/change', this.snapshot)
  }
}

/**
 * Runtime shape check for one override layer (model-authored callers pass
 * untyped JS through the dynamic-package façade, so the static type cannot
 * enforce the pair shape there). Returns a defensive per-token copy so later
 * caller mutation cannot reach the stored layer.
 */
function validateOverrides(source: string, tokens: ThemeTokenOverrides): ThemeTokenOverrides {
  const validated: ThemeTokenOverrides = {}
  for (const [name, value] of Object.entries<unknown>(tokens)) {
    if (typeof value === 'string') {
      throw new TypeError(
        `theme override "${name}" from "${source}" is a bare string — pass { light: ${JSON.stringify(value)}, dark: ${JSON.stringify(value)} } `
        + '(repeat the value when it is the same in both palettes); a single value goes illegible when the user switches color scheme',
      )
    }
    if (typeof value !== 'object' || value === null
      || typeof (value as { light?: unknown }).light !== 'string'
      || typeof (value as { dark?: unknown }).dark !== 'string') {
      throw new TypeError(
        `theme override "${name}" from "${source}" must map to a { light, dark } pair of strings — one value per color scheme`,
      )
    }
    const modes = value as ThemeTokenModes
    validated[name] = { light: modes.light, dark: modes.dark }
  }
  return validated
}

function dynamicToken(name: string): ThemeTokenInspection {
  return {
    name,
    description: 'Theme token registered by the current Client composition.',
    valueType: 'CSS value',
    requiresLightAndDark: true,
    ...(name.startsWith('--') ? { cssVariable: name } : {}),
  }
}

/**
 * Required services: settings transport plus slots/locale for the Appearance
 * row. `remote` carries the forwarded settings invalidation that
 * `bindSettingsScope` subscribes to on this context.
 */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

/**
 * Client plugin body: provide the theme service and register the
 * feature-owned Appearance preference row into the General section's item
 * slot (a feature owns its settings surface).
 * @param ctx - client cordis context.
 */
export function apply(ctx: ClientContext): void {
  const host = ctx.settingsScope.bind<ThemeSettings>({ namespace: THEME_SETTINGS_NAMESPACE })
  const theme = new ThemeRuntime(ctx, host)
  ctx.provide('theme', theme)

  ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh, en }), 'ui-theme: settings row dictionaries')

  const store = createAppearanceRowStore()
  let bound: BoundActions<typeof store> | undefined
  const sync = (snapshot: ThemeSnapshot): void => {
    bound?.sync(snapshot.preference, snapshot.style, snapshot.revision)
  }
  ctx.on('theme/change', sync)
  const injected = (actions: BoundActions<typeof store>): AppearanceRowInjected => {
    bound = actions
    // Re-sync from the getter so no event is lost between registration and
    // first render (the store's revision guard drops stale duplicates).
    sync(theme.getTheme())
    return {
      setTheme: (id) => { theme.setTheme(id) },
      setStyle: (style) => { theme.setStyle(style) },
    }
  }
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'appearance',
    order: 10,
    store,
    locale: SETTINGS_NS,
    inject: injected,
  }, AppearanceRow))
}
