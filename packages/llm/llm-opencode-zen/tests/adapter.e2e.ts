import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Message } from '@deepseek-ai/dsh-llm'
import { LocalCredentialProvider } from '@deepseek-ai/dsh-credentials-local'
import * as LlmOpenCodeZen from '@deepseek-ai/dsh-llm-opencode-zen'
import type { Config } from '@deepseek-ai/dsh-llm-opencode-zen'
import { assemble, type AssembledResult } from './assemble.ts'

/**
 * Real-API e2e for the direct-fetch adapter against the live OpenCode Zen
 * gateway. The anonymous free tier needs no credential, but it is rate-limited
 * per source IP and best-effort, so the whole suite is opt-in — skipped unless
 * `OPENCODE_ZEN_E2E` is set (a with-key workflow sets OPENCODE_ZEN_API_KEY for
 * the authenticated case, mirroring vitest.e2e.config.ts's gating policy).
 */

const FREE_MODEL = process.env.OPENCODE_ZEN_E2E_MODEL ?? 'deepseek-v4-flash-free'
const contexts: Context[] = []
let identityHome: string

beforeEach(async () => {
  identityHome = await mkdtemp(join(tmpdir(), 'dsh-e2e-zen-'))
  vi.stubEnv('DSH_HOME', identityHome)
})

async function harness(config: Partial<Config> = {}) {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(LlmOpenCodeZen, config)
  return ctx
}

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  vi.unstubAllEnvs()
  await rm(identityHome, { recursive: true, force: true })
})

function ask(text: string): Message[] {
  return [createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'plugin', plugin: 'test' },
  })]
}

function textOf(result: AssembledResult): string {
  return result.message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
}

describe.skipIf(!process.env.OPENCODE_ZEN_E2E)('llm-opencode-zen e2e (real API, anonymous free tier)', () => {
  it('serves a keyless request through the anonymous bearer', async () => {
    const ctx = await harness({})
    const result = await assemble(ctx, {
      model: FREE_MODEL,
      messages: ask('Reply with exactly the word: pong'),
      maxTokens: 64,
    })
    expect(result.finish.kind).toBe('stop')
    expect(textOf(result).toLowerCase()).toContain('pong')
  })

  it('streams raw chunks in protocol order', async () => {
    const ctx = await harness({})
    const kinds: string[] = []
    for await (const chunk of ctx.llm.stream({
      provider: 'opencode-zen',
      model: FREE_MODEL,
      messages: ask('Count from 1 to 5, digits only.'),
      maxTokens: 64,
    })) {
      kinds.push(chunk.type)
    }
    // A model may answer entirely in its reasoning channel — then the stream
    // opens no content block and the terminal usage/precedence contract above
    // is what still holds. Content, when present, must open before anything else.
    const startAt = kinds.findIndex(kind => kind === 'block-start')
    if (startAt !== -1) expect(startAt).toBe(0)
    expect(kinds.at(-1)).toBe('finish')
    expect(kinds.filter(kind => kind === 'finish')).toHaveLength(1)
    // usage precedes finish whenever the upstream reports it (some do not).
    const usageAt = kinds.indexOf('usage')
    if (usageAt !== -1) expect(usageAt).toBeLessThan(kinds.indexOf('finish'))
  })
})

describe.skipIf(!process.env.OPENCODE_ZEN_E2E || !process.env.OPENCODE_ZEN_API_KEY)(
  'llm-opencode-zen e2e (real API, authenticated)',
  () => {
    it('serves a request with the key held only by a credentials-local document', async () => {
      const key = process.env.OPENCODE_ZEN_API_KEY
      if (key === undefined) throw new Error('e2e ran without OPENCODE_ZEN_API_KEY')
      const dir = await mkdtemp(join(tmpdir(), 'dsh-e2e-zen-credentials-'))
      try {
        // JSON.stringify quotes the value: YAML is a JSON superset, so a real
        // key survives whatever characters it happens to carry.
        await writeFile(join(dir, '.credentials.yaml'), `OPENCODE_ZEN_API_KEY: ${JSON.stringify(key)}\n`, { mode: 0o600 })
        // Scrub the ambient variable so only the credential seam can supply
        // the key: this request proves the per-request resolution path.
        vi.stubEnv('OPENCODE_ZEN_API_KEY', '')
        const ctx = new Context()
        contexts.push(ctx)
        await ctx.plugin(LlmRuntime)
        await ctx.plugin(LocalCredentialProvider, { path: join(dir, '.credentials.yaml'), watch: false })
        await ctx.plugin(LlmOpenCodeZen, { apiKeyEnv: 'OPENCODE_ZEN_API_KEY' })

        const result = await assemble(ctx, {
          model: FREE_MODEL,
          messages: ask('Reply with exactly the word: pong'),
          maxTokens: 64,
        })
        expect(result.finish.kind).toBe('stop')
        expect(textOf(result).toLowerCase()).toContain('pong')
      } finally {
        vi.unstubAllEnvs()
        await rm(dir, { recursive: true, force: true })
      }
    })
  },
)
