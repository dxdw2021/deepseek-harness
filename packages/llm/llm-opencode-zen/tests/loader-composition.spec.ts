/**
 * Real-composition guard for the dynamic-configuration chain: LlmRuntime,
 * settings-file, credentials-local, and llm-opencode-zen boot from a test-only
 * cordis.yml through the actual Loader + Include path, external edits of
 * settings.yaml and the credentials document hot-publish through their
 * providers, and the very next request carries the fresh base URL and
 * credential. The anonymous free tier needs no credential at all: a composition
 * without `apiKeyEnv` authenticates with the `public` bearer out of the box.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { LocalCredentialProvider } from '@deepseek-ai/dsh-credentials-local'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { FileSettingsProvider } from '@deepseek-ai/dsh-settings-file'
import * as LlmOpenCodeZen from '@deepseek-ai/dsh-llm-opencode-zen'
import { assemble } from './assemble.ts'
import { closeMockServers, mockServer, textEvents } from './mock-server.ts'

const NS = settingsNamespace('llm-opencode-zen')
const KEY_REF = credentialRef('OPENCODE_ZEN_API_KEY')

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
  await closeMockServers()
  vi.unstubAllEnvs()
})

async function loadComposition(
  options: { baseURL: string; apiKeyEnv?: string; withAuth: boolean },
): Promise<{ ctx: Context; settingsPath: string; credentialsPath: string }> {
  root = await mkdtemp(join(tmpdir(), 'dsh-llm-zen-composition-'))
  vi.stubEnv('DSH_HOME', root)
  const settingsPath = join(root, 'settings.yaml')
  const credentialsPath = join(root, '.credentials.yaml')
  await writeFile(settingsPath, '# personal settings\n')
  if (options.withAuth) {
    await writeFile(credentialsPath, 'OPENCODE_ZEN_API_KEY: boot-key\n', { mode: 0o600 })
  }

  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    '- id: llm',
    "  name: 'test-llm-service'",
    '- id: settings',
    "  name: '@deepseek-ai/dsh-settings-file'",
    '  config:',
    `    path: ${JSON.stringify(settingsPath)}`,
    '    debounceMs: 10',
    '- id: credentials',
    "  name: '@deepseek-ai/dsh-credentials-local'",
    '  config:',
    `    path: ${JSON.stringify(credentialsPath)}`,
    '    debounceMs: 10',
    '- id: llm-opencode-zen',
    "  name: '@deepseek-ai/dsh-llm-opencode-zen'",
    '  config:',
    `    baseURL: ${JSON.stringify(options.baseURL)}`,
    ...options.apiKeyEnv === undefined
      ? []
      : [`    apiKeyEnv: ${JSON.stringify(options.apiKeyEnv)}`],
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['test-llm-service', LlmRuntime],
    ['@deepseek-ai/dsh-settings-file', FileSettingsProvider],
    ['@deepseek-ai/dsh-credentials-local', LocalCredentialProvider],
    ['@deepseek-ai/dsh-llm-opencode-zen', LlmOpenCodeZen],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await ctx.loader.await()
  return { ctx, settingsPath, credentialsPath }
}

describe('llm-opencode-zen real dynamic composition', () => {
  it('boots anonymously from cordis.yml and routes the next request after an external settings edit', async () => {
    vi.stubEnv('OPENCODE_ZEN_API_KEY', '')
    const serverA = await mockServer([{ kind: 'sse', events: textEvents }])
    const serverB = await mockServer([{ kind: 'sse', events: textEvents }])
    const { ctx, settingsPath } = await loadComposition({ baseURL: serverA.url, withAuth: false })

    expect(ctx.get('settings')!.describe().map(entry => entry.ns)).toEqual([NS])
    await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(serverA.headers[0]?.authorization).toBe('Bearer public')
    expect(serverA.headers[0]).not.toHaveProperty('x-deepseek-harness-user-id')

    // External edit, exactly as a user or the web UI would leave it on disk.
    await writeFile(settingsPath, `llm-opencode-zen:\n  baseURL: ${serverB.url}\n`)
    await vi.waitFor(() => {
      expect((ctx.get('settings')!.get(NS) as { baseURL?: string }).baseURL).toBe(serverB.url)
    }, { timeout: 5000 })

    await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(serverA.requests).toHaveLength(1)
    expect(serverB.headers[0]?.authorization).toBe('Bearer public')
  })

  it('boots authenticated and serves a rotated stored key across a real external credential edit', async () => {
    vi.stubEnv('OPENCODE_ZEN_API_KEY', '')
    const server = await mockServer([{ kind: 'sse', events: textEvents }])
    const { ctx, credentialsPath } = await loadComposition({
      baseURL: server.url,
      apiKeyEnv: 'OPENCODE_ZEN_API_KEY',
      withAuth: true,
    })

    await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(server.headers[0]?.authorization).toBe('Bearer boot-key')

    await writeFile(credentialsPath, 'OPENCODE_ZEN_API_KEY: rotated-key\n', { mode: 0o600 })
    await vi.waitFor(async () => {
      expect(await ctx.get('credentials')!.resolve(KEY_REF)).toEqual({ value: 'rotated-key', source: 'file' })
    }, { timeout: 5000 })

    await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(server.headers[1]?.authorization).toBe('Bearer rotated-key')
  })
})
