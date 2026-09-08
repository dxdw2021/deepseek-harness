import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolRegistryService, type ToolDefinition, type ToolExecutionContext } from '../src/index.ts'

function makeTool(name = 'echo'): ToolDefinition {
  return {
    name,
    description: `${name} tool`,
    category: 'shell',
    permissions: ['execute'],
    schema: {},
    execute: async () => `${name}:ok`,
    readOnly: false,
    streaming: false,
  }
}

function makeContext(): ToolExecutionContext {
  return { sessionId: 's', agentId: 'a', cwd: '/tmp', callId: 'c', signal: new AbortController().signal }
}

describe('ToolRegistryService', () => {
  it('starts with the registry enabled and no tools', () => {
    const service = new ToolRegistryService(new Context())
    expect(service.getConfig().enabled).toBe(true)
    expect(service.getAll()).toEqual([])
  })

  it('registers, retrieves and unregisters a tool through the disposer', () => {
    const service = new ToolRegistryService(new Context())
    const dispose = service.register(makeTool('echo'))
    expect(service.get('echo')?.description).toBe('echo tool')
    dispose()
    expect(service.get('echo')).toBeUndefined()
  })

  it('rejects duplicate registration', () => {
    const service = new ToolRegistryService(new Context())
    service.register(makeTool('echo'))
    expect(() => service.register(makeTool('echo'))).toThrow('already registered')
  })

  it('groups tools by category, permission and read-only-ness', () => {
    const service = new ToolRegistryService(new Context())
    const readOnly: ToolDefinition = { ...makeTool('grep'), category: 'search', readOnly: true, permissions: ['read'] }
    service.register(makeTool('echo'))
    service.register(readOnly)
    expect(service.getByCategory('shell').map(t => t.name)).toEqual(['echo'])
    expect(service.getByCategory('search').map(t => t.name)).toEqual(['grep'])
    expect(service.getReadOnlyTools().map(t => t.name)).toEqual(['grep'])
    expect(service.getWritableTools().map(t => t.name)).toEqual(['echo'])
    expect(service.getByPermission('read').map(t => t.name)).toEqual(['grep'])
  })

  it('fails fast for an unknown tool', async () => {
    const service = new ToolRegistryService(new Context())
    const result = await service.execute('nope', {}, makeContext())
    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('executes a registered tool and records metrics', async () => {
    const service = new ToolRegistryService(new Context())
    service.register({ ...makeTool('echo'), timeoutMs: 1 })
    const result = await service.execute('echo', { text: 'hi' }, makeContext())
    expect(result.success).toBe(true)
    expect(result.value).toBe('echo:ok')
    expect(service.getMetrics('echo')).toMatchObject({ totalExecutions: 1, successfulExecutions: 1, failedExecutions: 0 })
  })

  it('serves read-only tools from cache', async () => {
    const service = new ToolRegistryService(new Context())
    const calls = vi.fn()
    const readOnly = {
      ...makeTool('grep'),
      readOnly: true,
      timeoutMs: 1,
      execute: async () => { calls(); return 'cached' },
    }
    service.register(readOnly)
    const first = await service.execute('grep', { q: 'x' }, makeContext())
    const second = await service.execute('grep', { q: 'x' }, makeContext())
    expect(first.success).toBe(true)
    expect(second.metadata).toEqual({ fromCache: true })
    expect(calls).toHaveBeenCalledOnce()
    expect(service.getCacheSize()).toBe(1)
  })
})
