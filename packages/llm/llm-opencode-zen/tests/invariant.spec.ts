import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import * as invariant from '../src/invariant.ts'

describe('llm-opencode-zen invariant companion', () => {
  it('keeps the plugin namespace shape and registers the package-owned empty invariant', () => {
    expect(invariant.name).toBe('llm-opencode-zen-invariant')
    expect(invariant.inject).toEqual(['invariants'])
  })

  it('registers the package name with an installable no-op check', async () => {
    const dispose = vi.fn()
    const register = vi.fn((
      _packageName: string,
      _installer: InvariantInstaller,
    ) => dispose)
    const ctx = { invariants: { register } } as unknown as Context
    await expect(invariant.apply(ctx)).resolves.toBe(dispose)
    expect(register).toHaveBeenCalledWith(
      '@deepseek-ai/dsh-llm-opencode-zen',
      expect.any(Function),
    )
    const install = register.mock.calls[0]![1]
    await install(new Context(), (message) => { throw new Error(message) })
  })
})
