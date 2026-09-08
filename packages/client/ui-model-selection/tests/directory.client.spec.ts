import { describe, expect, it } from 'vitest'
import type {
  IApiClient, ModelSelection, SessionId, SessionModels,
} from '@deepseek-ai/dsh-api-remotes/client'
import { ModelDirectory } from '../src/client/directory.ts'

const sessionId = 'sess-1' as SessionId

function sessionsApi(value: SessionModels): Pick<IApiClient['sessions'], 'models' | 'selectModel'> {
  return {
    models: () => Promise.resolve({ result: { ok: true as const, value } }),
    selectModel: (request: ModelSelection) => Promise.resolve({
      result: {
        ok: true as const,
        value: {
          selected: { provider: request.provider, model: request.model },
        },
      },
    }),
  } as unknown as Pick<IApiClient['sessions'], 'models' | 'selectModel'>
}

const SESSION_MODELS: SessionModels = {
  current: { provider: 'deepseek', model: 'deepseek-chat' },
  routable: true,
  groups: [{
    id: 'deepseek', name: 'DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
    ],
  }],
  failures: [],
}

describe('ModelDirectory', () => {
  it('starts idle with no current selection', () => {
    const directory = new ModelDirectory(sessionsApi(SESSION_MODELS), sessionId, () => true)
    const state = directory.store.getSnapshot()
    expect(state.status).toBe('idle')
    expect(state.current).toBeNull()
    expect(state.routable).toBeNull()
    expect(state.groups).toEqual([])
  })

  it('loads the directory into the ready state', async () => {
    const directory = new ModelDirectory(sessionsApi(SESSION_MODELS), sessionId, () => true)
    const value = await directory.load()
    expect(value).toEqual(SESSION_MODELS)
    const state = directory.store.getSnapshot()
    expect(state.status).toBe('ready')
    expect(state.current).toEqual(SESSION_MODELS.current)
    expect(state.routable).toBe(true)
    expect(state.groups).toEqual(SESSION_MODELS.groups)
  })

  it('throws and records the error when the model request fails', async () => {
    const sessions = {
      models: () => Promise.resolve({ result: { ok: false as const, error: { code: 'E_SESSION', message: 'gone' } } }),
    } as unknown as Pick<IApiClient['sessions'], 'models' | 'selectModel'>
    const directory = new ModelDirectory(sessions, sessionId, () => true)
    await expect(directory.load()).rejects.toThrow('session.models failed: E_SESSION: gone')
    const state = directory.store.getSnapshot()
    expect(state.status).toBe('error')
    expect(state.error).toBe('E_SESSION: gone')
  })

  it('selects a model and publishes it as the current choice', async () => {
    const directory = new ModelDirectory(sessionsApi(SESSION_MODELS), sessionId, () => true)
    await directory.load()
    await directory.select({ provider: 'openai', model: 'gpt-4' })
    const state = directory.store.getSnapshot()
    expect(state.status).toBe('ready')
    expect(state.current).toEqual({ provider: 'openai', model: 'gpt-4' })
    expect(state.routable).toBe(true)
  })

  it('resetConnected repulls when available', async () => {
    const directory = new ModelDirectory(sessionsApi(SESSION_MODELS), sessionId, () => true)
    await directory.load()
    directory.resetConnected()
    expect(directory.store.getSnapshot().status).toBe('loading')
  })

  it('resetConnected clears state but does not repull when unavailable', async () => {
    let modelsCalls = 0
    const sessions = {
      models: () => {
        modelsCalls += 1
        return Promise.resolve({ result: { ok: true as const, value: SESSION_MODELS } })
      },
    } as unknown as Pick<IApiClient['sessions'], 'models' | 'selectModel'>
    const directory = new ModelDirectory(sessions, sessionId, () => false)
    directory.resetConnected()
    const state = directory.store.getSnapshot()
    expect(state.status).toBe('idle')
    expect(state.current).toBeNull()
    expect(state.groups).toEqual([])
    // The unavailable path never repulls, so no models request is issued.
    await Promise.resolve()
    expect(modelsCalls).toBe(0)
  })

  it('does not publish a late select after dispose', async () => {
    const directory = new ModelDirectory(sessionsApi(SESSION_MODELS), sessionId, () => true)
    await directory.load()
    directory.dispose()
    await directory.select({ provider: 'openai', model: 'gpt-4' })
    const state = directory.store.getSnapshot()
    expect(state.current).toEqual(SESSION_MODELS.current)
    expect(state.status).toBe('selecting')
  })

  it('throws when unavailable for a subagent-addressed session', async () => {
    const directory = new ModelDirectory(sessionsApi(SESSION_MODELS), sessionId, () => false)
    await expect(directory.load()).rejects.toThrow('model selection is unavailable for addressed subagent sessions')
  })
})
