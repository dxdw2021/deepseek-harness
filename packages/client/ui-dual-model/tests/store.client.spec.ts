import { describe, expect, it } from 'vitest'
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { DualModelController, type ModelConfig } from '../src/client/store.ts'

function settingsApi(value?: Record<string, unknown>): Pick<IApiClient, 'settings'> {
  const namespaces = value === undefined
    ? []
    : [{ ns: 'dual-model' as string, value, revision: 1 }]
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

describe('DualModelController', () => {
  it('starts idle with dual-model disabled and the sequential default', () => {
    const controller = new DualModelController(settingsApi())
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('idle')
    expect(state.enabled).toBe(false)
    expect(state.strategy).toBe('sequential')
    expect(state.executor.model).toBe('deepseek-chat')
    expect(state.planner.model).toBe('deepseek-reasoner')
  })

  it('loads persisted executor, planner, and strategy when the namespace is registered', async () => {
    const executor: ModelConfig = { provider: 'openai', model: 'gpt-4' }
    const planner: ModelConfig = { provider: 'anthropic', model: 'claude-3-opus' }
    const controller = new DualModelController(settingsApi({
      enabled: true,
      executor,
      planner,
      strategy: 'parallel',
    }))
    await controller.load()
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('idle')
    expect(state.enabled).toBe(true)
    expect(state.executor).toEqual(executor)
    expect(state.planner).toEqual(planner)
    expect(state.strategy).toBe('parallel')
  })

  it('stays idle when the dual-model namespace is not registered', async () => {
    const controller = new DualModelController(settingsApi())
    await controller.load()
    expect(controller.store.getSnapshot().status).toBe('idle')
  })

  it('records the error status when the settings request fails', async () => {
    const controller = new DualModelController(failingApi())
    await controller.load()
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('error')
    expect(state.error).toBe('boom')
  })

  it('updates enabled and strategy locally', async () => {
    const controller = new DualModelController(settingsApi())
    await controller.toggleEnabled(true)
    await controller.updateStrategy('iterative')
    const state = controller.store.getSnapshot()
    expect(state.enabled).toBe(true)
    expect(state.strategy).toBe('iterative')
  })

  it('ignores in-flight responses after dispose', async () => {
    const controller = new DualModelController(settingsApi({ enabled: true }))
    controller.load()
    controller.dispose()
    expect(controller.store.getSnapshot().enabled).toBe(false)
  })
})
