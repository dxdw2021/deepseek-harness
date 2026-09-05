import { describe, expect, it } from 'vitest'
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { PermissionManagementController, type PermissionRule } from '../src/client/store.ts'

function settingsApi(value?: Record<string, unknown>): Pick<IApiClient, 'settings'> {
  const namespaces = value === undefined
    ? []
    : [{ ns: 'permission-management' as string, value, revision: 1 }]
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

describe('PermissionManagementController', () => {
  it('starts idle with no rules on the rules tab', () => {
    const controller = new PermissionManagementController(settingsApi())
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('idle')
    expect(state.rules).toEqual([])
    expect(state.activeTab).toBe('rules')
  })

  it('loads persisted rules when the namespace is registered', async () => {
    const rule: PermissionRule = {
      id: 'r1', description: 'allow read on tools', resourceType: 'tool',
      resourcePattern: '**', actions: ['read', 'execute'], priority: 10, enabled: true,
    }
    const controller = new PermissionManagementController(settingsApi({ rules: [rule] }))
    await controller.load()
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('idle')
    expect(state.rules).toEqual([rule])
  })

  it('stays idle when the permission-management namespace is not registered', async () => {
    const controller = new PermissionManagementController(settingsApi())
    await controller.load()
    expect(controller.store.getSnapshot().status).toBe('idle')
  })

  it('records the error status when the settings request fails', async () => {
    const controller = new PermissionManagementController(failingApi())
    await controller.load()
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('error')
    expect(state.error).toBe('boom')
  })

  it('switches the active tab', () => {
    const controller = new PermissionManagementController(settingsApi())
    controller.setActiveTab('audit')
    expect(controller.store.getSnapshot().activeTab).toBe('audit')
  })

  it('ignores in-flight responses after dispose', async () => {
    const controller = new PermissionManagementController(settingsApi({ rules: [{ id: 'r1' }] }))
    controller.load()
    controller.dispose()
    expect(controller.store.getSnapshot().rules).toEqual([])
  })
})
