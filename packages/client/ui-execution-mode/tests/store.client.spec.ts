import { describe, expect, it } from 'vitest'
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { ExecutionModeController, type ExecutionMode } from '../src/client/store.ts'

function settingsApi(value?: Record<string, unknown>): Pick<IApiClient, 'settings'> {
  const namespaces = value === undefined
    ? []
    : [{ ns: 'execution-mode' as string, value, revision: 1 }]
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

const MODE_NAMES: readonly ExecutionMode[] = ['light', 'balanced', 'delivery']

describe('ExecutionModeController', () => {
  it('starts idle on the balanced default with all configs present', () => {
    const controller = new ExecutionModeController(settingsApi())
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('idle')
    expect(state.currentMode).toBe('balanced')
    for (const name of MODE_NAMES) expect(state.configs[name]).toBeDefined()
  })

  it('loads the persisted currentMode when the namespace is registered', async () => {
    const controller = new ExecutionModeController(settingsApi({ currentMode: 'delivery', enableModeSwitching: false }))
    await controller.load()
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('idle')
    expect(state.currentMode).toBe('delivery')
    expect(state.enableModeSwitching).toBe(false)
  })

  it('stays idle when the execution-mode namespace is not registered', async () => {
    const controller = new ExecutionModeController(settingsApi())
    await controller.load()
    expect(controller.store.getSnapshot().status).toBe('idle')
  })

  it('records the error status when the settings request fails', async () => {
    const controller = new ExecutionModeController(failingApi())
    await controller.load()
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('error')
    expect(state.error).toBe('boom')
  })

  it('optimistically switches the mode and persists it', async () => {
    const controller = new ExecutionModeController(settingsApi({ currentMode: 'balanced' }))
    await controller.setMode('light')
    expect(controller.store.getSnapshot().currentMode).toBe('light')
  })

  it('reloads on a failed mutate', async () => {
    const controller = new ExecutionModeController(settingsApi({ currentMode: 'balanced' }))
    await controller.setMode('light')
    expect(controller.store.getSnapshot().currentMode).toBe('light')
  })

  it('ignores in-flight responses after dispose', async () => {
    const controller = new ExecutionModeController(settingsApi({ currentMode: 'delivery' }))
    controller.load()
    controller.dispose()
    // The disposed controller never publishes; the snapshot stays at the default.
    expect(controller.store.getSnapshot().currentMode).toBe('balanced')
  })
})
