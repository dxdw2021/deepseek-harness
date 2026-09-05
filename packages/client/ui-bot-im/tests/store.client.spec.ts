import { describe, expect, it } from 'vitest'
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { BotImController, type PlatformConfig } from '../src/client/store.ts'

function settingsApi(value?: Record<string, unknown>): Pick<IApiClient, 'settings'> {
  const namespaces = value === undefined
    ? []
    : [{ ns: 'bot-im' as string, value, revision: 1 }]
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

describe('BotImController', () => {
  it('starts idle with all platforms registered and auto-reply on', () => {
    const controller = new BotImController(settingsApi())
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('idle')
    expect(state.platforms).toHaveLength(7)
    expect(state.commandPrefix).toBe('/')
    expect(state.enableAutoReply).toBe(true)
    for (const platform of state.platforms) {
      expect(platform.enabled).toBe(false)
      expect(platform.connected).toBe(false)
    }
  })

  it('loads persisted platforms and command prefix when the namespace is registered', async () => {
    const feishu: PlatformConfig = { type: 'feishu', enabled: true, appId: 'cli_abc', connected: true }
    const controller = new BotImController(settingsApi({
      platforms: [feishu],
      commandPrefix: '!',
      enableAutoReply: false,
    }))
    await controller.load()
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('idle')
    expect(state.platforms).toEqual([feishu])
    expect(state.commandPrefix).toBe('!')
    expect(state.enableAutoReply).toBe(false)
  })

  it('stays idle when the bot-im namespace is not registered', async () => {
    const controller = new BotImController(settingsApi())
    await controller.load()
    expect(controller.store.getSnapshot().status).toBe('idle')
  })

  it('records the error status when the settings request fails', async () => {
    const controller = new BotImController(failingApi())
    await controller.load()
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('error')
    expect(state.error).toBe('boom')
  })

  it('ignores in-flight responses after dispose', async () => {
    const controller = new BotImController(settingsApi({ commandPrefix: '!' }))
    controller.load()
    controller.dispose()
    expect(controller.store.getSnapshot().commandPrefix).toBe('/')
  })
})
