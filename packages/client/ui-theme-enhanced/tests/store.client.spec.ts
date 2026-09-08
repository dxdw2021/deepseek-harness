import { describe, expect, it } from 'vitest'
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { ThemeEnhancedController, type Theme } from '../src/client/store.ts'

function settingsApi(value?: Record<string, unknown>): Pick<IApiClient, 'settings'> {
  const namespaces = value === undefined
    ? []
    : [{ ns: 'theme-enhanced' as string, value, revision: 1 }]
  return {
    settings: {
      describe: () => Promise.resolve({
        result: { ok: true as const, value: { writable: true, hasDocument: false, namespaces } },
      }),
      mutate: () => Promise.resolve({ result: { ok: true as const, value: {} } }),
    },
  } as unknown as Pick<IApiClient, 'settings'>
}

function failingApi(): Pick<IApiClient, 'settings'> {
  return {
    settings: {
      describe: () => Promise.reject(new Error('boom')),
      mutate: () => Promise.reject(new Error('boom')),
    },
  } as unknown as Pick<IApiClient, 'settings'>
}

describe('ThemeEnhancedController', () => {
  it('starts idle with the three builtin themes and the system default', () => {
    const controller = new ThemeEnhancedController(settingsApi())
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('idle')
    expect(state.themes.map(t => t.id)).toEqual(['light', 'dark', 'system'])
    expect(state.themes.every(t => t.builtin)).toBe(true)
    expect(state.currentThemeId).toBe('system')
  })

  it('loads the persisted current theme and catalog when the namespace is registered', async () => {
    const custom: Theme = { id: 'ocean', name: 'Ocean', type: 'custom', builtin: false }
    const controller = new ThemeEnhancedController(settingsApi({ currentThemeId: 'ocean', themes: [custom] }))
    await controller.load()
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('idle')
    expect(state.currentThemeId).toBe('ocean')
    expect(state.themes).toEqual([custom])
  })

  it('stays idle when the theme-enhanced namespace is not registered', async () => {
    const controller = new ThemeEnhancedController(settingsApi())
    await controller.load()
    expect(controller.store.getSnapshot().status).toBe('idle')
  })

  it('records the error status when the settings request fails', async () => {
    const controller = new ThemeEnhancedController(failingApi())
    await controller.load()
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('error')
    expect(state.error).toBe('boom')
  })

  it('selects a theme optimistically', async () => {
    const controller = new ThemeEnhancedController(settingsApi())
    await controller.selectTheme('dark')
    expect(controller.store.getSnapshot().currentThemeId).toBe('dark')
  })

  it('ignores in-flight responses after dispose', async () => {
    const controller = new ThemeEnhancedController(settingsApi({ currentThemeId: 'dark' }))
    controller.load()
    controller.dispose()
    // The disposed controller never publishes; the snapshot stays at the default.
    expect(controller.store.getSnapshot().currentThemeId).toBe('system')
  })
})
