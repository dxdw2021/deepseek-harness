import { describe, expect, it } from 'vitest'
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { ToolRegistryController, type ToolDefinition } from '../src/client/store.ts'

function settingsApi(value?: Record<string, unknown>): Pick<IApiClient, 'settings'> {
  const namespaces = value === undefined
    ? []
    : [{ ns: 'tool-registry' as string, value, revision: 1 }]
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

describe('ToolRegistryController', () => {
  it('starts idle with an empty registry, the all category filter and no query', () => {
    const controller = new ToolRegistryController(settingsApi())
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('idle')
    expect(state.tools).toEqual([])
    expect(state.categoryFilter).toBe('all')
    expect(state.searchQuery).toBe('')
  })

  it('loads the persisted tool registry when the namespace is registered', async () => {
    const tools: ToolDefinition[] = [
      { name: 'bash', description: 'Run a shell command', category: 'shell', enabled: true, usageCount: 3 },
      { name: 'grep', description: 'Search file contents', category: 'search', enabled: false, usageCount: 0 },
    ]
    const controller = new ToolRegistryController(settingsApi({ tools }))
    await controller.load()
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('idle')
    expect(state.tools).toEqual(tools)
  })

  it('stays idle when the tool-registry namespace is not registered', async () => {
    const controller = new ToolRegistryController(settingsApi())
    await controller.load()
    expect(controller.store.getSnapshot().status).toBe('idle')
  })

  it('records the error status when the settings request fails', async () => {
    const controller = new ToolRegistryController(failingApi())
    await controller.load()
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('error')
    expect(state.error).toBe('boom')
  })

  it('updates the category filter and search query', () => {
    const controller = new ToolRegistryController(settingsApi())
    controller.setCategoryFilter('shell')
    controller.setSearchQuery('bash')
    const state = controller.store.getSnapshot()
    expect(state.categoryFilter).toBe('shell')
    expect(state.searchQuery).toBe('bash')
  })

  it('ignores in-flight responses after dispose', async () => {
    const controller = new ToolRegistryController(settingsApi({ tools: [] }))
    const pending = controller.load()
    controller.dispose()
    await pending
    // The disposed controller never publishes the response; the loading state
    // set synchronously by load() persists without the loaded tools.
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('loading')
    expect(state.tools).toEqual([])
  })
})
