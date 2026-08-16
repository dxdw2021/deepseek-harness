import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import {
  createUserMessage,
  CONTEXT_WINDOW_EXCEEDED_CODE,
  INVALID_CREDENTIAL_CODE,
  ProviderRequestId,
  QUOTA_EXCEEDED_CODE,
  ReasoningEffortId,
} from '@deepseek-ai/dsh-llm'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { LocalCredentialProvider } from '@deepseek-ai/dsh-credentials-local'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import * as LlmOpenCodeZen from '@deepseek-ai/dsh-llm-opencode-zen'
import { ANONYMOUS_BEARER, OpenCodeZenAdapter, resolveAdapterOptions, ZEN_CLIENT_USER_AGENT } from '@deepseek-ai/dsh-llm-opencode-zen'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { httpErrorCode } from '../src/adapter.ts'
import { assemble } from './assemble.ts'
import { closeMockServers, mockServer, textEvents } from './mock-server.ts'
import type { Behavior } from './mock-server.ts'

let testHome: string

beforeEach(() => {
  testHome = mkdtempSync(join(tmpdir(), 'dsh-llm-opencode-zen-'))
  vi.stubEnv('DSH_HOME', testHome)
})

afterEach(async () => {
  await closeMockServers()
  vi.unstubAllEnvs()
  vi.useRealTimers()
  rmSync(testHome, { recursive: true, force: true })
})

async function harness(baseURL: string, config: object = {}) {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(LlmOpenCodeZen, { baseURL, ...config })
  return ctx
}

/** Direct adapter over the plugin's real resolve step, with a static key. */
function adapterOf(config: Partial<LlmOpenCodeZen.Config> & { apiKey?: string } = {}): OpenCodeZenAdapter {
  const { apiKey, ...rest } = config
  return new OpenCodeZenAdapter({
    options: () => resolveAdapterOptions(rest),
    resolveApiKey: () => Promise.resolve(apiKey ?? ANONYMOUS_BEARER),
  })
}

describe('OpenCodeZenAdapter against a mock server', () => {
  it('streams a text generation end to end through the assembler', async () => {
    const server = await mockServer([{ kind: 'sse', events: textEvents }])
    const ctx = await harness(server.url)

    const result = await assemble(ctx, {
      model: 'deepseek-v4-flash-free',
      messages: [createUserMessage({
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'plugin', plugin: 'test' },
      })],
    })
    expect(result.message.content).toEqual([{ type: 'text', text: 'hello' }])
    expect(result.finish).toEqual({ kind: 'stop' })
    expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 1 })

    // The wire request carries the materialized output cap and no reasoning
    // effort: OpenCode Zen advertises no single effort vocabulary.
    expect(server.requests[0]).toMatchObject({
      model: 'deepseek-v4-flash-free',
      max_tokens: 32_768,
      stream: true,
      stream_options: { include_usage: true },
    })
    expect(server.requests[0]).not.toHaveProperty('reasoning_effort')
    expect(server.requests[0]).not.toHaveProperty('thinking')
    // The anonymous free tier needs no key anywhere.
    expect(server.headers[0]?.authorization).toBe(`Bearer ${ANONYMOUS_BEARER}`)
    expect(server.headers[0]?.['user-agent']).toBe(ZEN_CLIENT_USER_AGENT)
    // Session-scoped wire identity, mirroring the opencode CLI shape: the
    // gateway keys its free tier on these ids, so each request mints a fresh
    // well-formed set instead of riding the shared per-IP bucket.
    expect(server.headers[0]?.['x-opencode-session']).toMatch(/^ses_[0-9a-f]{32}$/)
    expect(server.headers[0]?.['x-opencode-request']).toMatch(/^msg_[0-9a-f]{32}$/)
    expect(server.headers[0]?.['x-opencode-project']).toMatch(/^[0-9a-f]{32}$/)
    expect(server.headers[0]?.['x-opencode-client']).toBe('dsh')
    expect(server.headers[0]).not.toHaveProperty('x-deepseek-harness-user-id')
    expect(server.headers[0]).not.toHaveProperty('http-referer')
    expect(server.headers[0]).not.toHaveProperty('x-openrouter-title')
  })

  it('mints a distinct session identity per request', async () => {
    const server = await mockServer([{ kind: 'sse', events: textEvents }, { kind: 'sse', events: textEvents }])
    const ctx = await harness(server.url)

    await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(server.headers[0]?.['x-opencode-session']).not.toBe(server.headers[1]?.['x-opencode-session'])
    expect(server.headers[0]?.['x-opencode-request']).not.toBe(server.headers[1]?.['x-opencode-request'])
  })

  it('streams raw chunks through ctx.llm.stream', async () => {
    const server = await mockServer([{ kind: 'sse', events: textEvents, delayMs: 2 }])
    const ctx = await harness(server.url)

    const kinds: string[] = []
    for await (const chunk of ctx.llm.stream({
      provider: 'opencode-zen',
      model: 'deepseek-v4-flash-free',
      messages: [createUserMessage({
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'plugin', plugin: 'test' },
      })],
    })) {
      kinds.push(chunk.type)
    }
    expect(kinds).toEqual(['block-start', 'text-delta', 'block-end', 'usage', 'finish'])
  })

  it('authenticates with an ambient credential when apiKeyEnv is configured', async () => {
    vi.stubEnv('OPENCODE_ZEN_API_KEY', 'real-zen-key')
    const server = await mockServer([{ kind: 'sse', events: textEvents }])
    const ctx = await harness(server.url, { apiKeyEnv: 'OPENCODE_ZEN_API_KEY' })

    await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(server.headers[0]?.authorization).toBe('Bearer real-zen-key')
  })

  it('resolves a stored credential through the credentials seam when one is mounted', async () => {
    vi.stubEnv('OPENCODE_ZEN_API_KEY', '')
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(LocalCredentialProvider, { path: join(testHome, '.credentials.yaml'), watch: false })
    const ref = credentialRef('OPENCODE_ZEN_API_KEY')
    await ctx.credentials.set(ref, 'stored-zen-key')
    const server = await mockServer([{ kind: 'sse', events: textEvents }])
    await ctx.plugin(LlmOpenCodeZen, { baseURL: server.url, apiKeyEnv: 'OPENCODE_ZEN_API_KEY' })

    await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(server.headers[0]?.authorization).toBe('Bearer stored-zen-key')
  })

  it('fails loud when a configured reference resolves to nothing, never downgrading to anonymous', async () => {
    vi.stubEnv('OPENCODE_ZEN_API_KEY', '')
    const server = await mockServer([])
    const ctx = await harness(server.url, { apiKeyEnv: 'OPENCODE_ZEN_API_KEY' })

    const result = await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(result.finish).toMatchObject({ kind: 'error', failure: { code: 'MISSING_CREDENTIAL' } })
    expect(server.requests).toHaveLength(0)
    if (result.finish.kind !== 'error') throw new Error('expected an error finish')
    // The guidance names every recovery path and nothing else.
    expect(result.finish.failure.message)
      .toMatch(/store OPENCODE_ZEN_API_KEY.*export OPENCODE_ZEN_API_KEY.*remove apiKeyEnv/s)
  })

  it('treats a configured empty ambient variable as no key', async () => {
    vi.stubEnv('OPENCODE_ZEN_API_KEY', '')
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(LlmOpenCodeZen, { baseURL: 'http://127.0.0.1:1', apiKeyEnv: 'OPENCODE_ZEN_API_KEY' })
    const result = await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(result.finish).toMatchObject({ kind: 'error', failure: { code: 'MISSING_CREDENTIAL' } })
  })

  it('fails loud when the credentials seam is mounted but holds nothing for the reference', async () => {
    vi.stubEnv('OPENCODE_ZEN_API_KEY', '')
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(LocalCredentialProvider, { path: join(testHome, '.credentials.yaml'), watch: false })
    await ctx.plugin(LlmOpenCodeZen, { baseURL: 'http://127.0.0.1:1', apiKeyEnv: 'OPENCODE_ZEN_API_KEY' })
    const result = await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(result.finish).toMatchObject({ kind: 'error', failure: { code: 'MISSING_CREDENTIAL' } })
  })

  it('rejects a credential no header can carry without echoing it', async () => {
    vi.stubEnv('OPENCODE_ZEN_API_KEY', '')
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(LocalCredentialProvider, { path: join(testHome, '.credentials.yaml'), watch: false })
    const ref = credentialRef('OPENCODE_ZEN_API_KEY')
    const secret = 'sk-\u{1F600}supersecret'
    await ctx.credentials.set(ref, secret)
    await ctx.plugin(LlmOpenCodeZen, { baseURL: 'http://127.0.0.1:1', apiKeyEnv: 'OPENCODE_ZEN_API_KEY' })
    const result = await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(result.finish).toMatchObject({ kind: 'error', failure: { code: INVALID_CREDENTIAL_CODE } })
    if (result.finish.kind !== 'error') throw new Error('expected an error finish')
    expect(result.finish.failure.message).not.toContain(secret)
    expect(result.finish.failure.message).not.toContain('supersecret')
  })

  it('rejects an explicit reasoning effort before any I/O', async () => {
    const server = await mockServer([])
    const ctx = await harness(server.url)

    const result = await assemble(ctx, {
      model: 'deepseek-v4-flash-free',
      reasoningEffort: ReasoningEffortId('max'),
      messages: [createUserMessage({
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'plugin', plugin: 'test' },
      })],
    })
    expect(result.finish).toMatchObject({
      kind: 'error',
      failure: { code: 'UNSUPPORTED_REASONING_EFFORT' },
    })
    expect(server.requests).toHaveLength(0)
  })

  it('rejects a direct-adapter effort through the serializer before I/O', async () => {
    const server = await mockServer([])
    const adapter = adapterOf({ baseURL: server.url })
    const stream = adapter.stream({
      provider: 'opencode-zen',
      model: 'deepseek-v4-flash-free',
      reasoningEffort: ReasoningEffortId('max'),
      messages: [createUserMessage({
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'plugin', plugin: 'test' },
      })],
    })
    await expect(async () => {
      for await (const _chunk of stream) { /* drain */ }
    }).rejects.toMatchObject({ code: 'UNSUPPORTED_REASONING_EFFORT' })
    expect(server.requests).toHaveLength(0)
  })

  it('preserves an explicit request output cap without a wire effort', async () => {
    const server = await mockServer([{ kind: 'sse', events: textEvents }])
    const ctx = await harness(server.url)

    await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [], maxTokens: 8_192 })
    expect(server.requests[0]).toMatchObject({ max_tokens: 8_192 })
  })

  it.each([
    [401, 'AUTH'],
    [403, 'AUTH'],
    [429, 'RATE_LIMIT'],
    [400, 'INVALID_REQUEST'],
    [500, 'SERVER'],
    [503, 'SERVER'],
  ])('maps HTTP %d to failure code %s with the body message', async (status, code) => {
    const behavior: Behavior = {
      kind: 'http-error',
      status,
      body: JSON.stringify({ error: { message: `failed with ${status}`, type: 't', code: 'c' } }),
    }
    const server = await mockServer([behavior])
    const ctx = await harness(server.url)
    const result = await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(result.finish).toEqual({
      kind: 'error',
      failure: { message: `failed with ${status}`, code, status },
    })
  })

  it('classifies an HTTP context-window failure with the canonical code', async () => {
    const server = await mockServer([{
      kind: 'http-error',
      status: 400,
      body: JSON.stringify({
        error: {
          message: 'This model maximum context length is 128000 tokens; your input exceeds that limit.',
          type: 'invalid_request_error',
          code: 'context_length_exceeded',
        },
      }),
    }])
    const ctx = await harness(server.url)
    const result = await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(result.finish).toMatchObject({
      kind: 'error',
      failure: { code: CONTEXT_WINDOW_EXCEEDED_CODE },
    })
  })

  it('classifies the anonymous free-tier per-IP quota as QUOTA_EXCEEDED', async () => {
    // Exact live shape from https://opencode.ai/zen/v1/chat/completions when the
    // daily free quota is exhausted.
    const server = await mockServer([{
      kind: 'http-error',
      status: 429,
      body: JSON.stringify({
        type: 'error',
        error: { type: 'FreeUsageLimitError', message: 'Rate limit exceeded. Please try again later.' },
      }),
    }])
    const ctx = await harness(server.url)
    const result = await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(result.finish).toMatchObject({ kind: 'error', failure: { code: QUOTA_EXCEEDED_CODE, status: 429 } })
  })

  it('retains status, Retry-After seconds, and provider request id as structured facts', async () => {
    const server = await mockServer([{
      kind: 'http-error',
      status: 429,
      body: JSON.stringify({ error: { message: 'slow down' } }),
      headers: { 'retry-after': '2', 'x-request-id': 'req-429' },
    }])
    const ctx = await harness(server.url)
    const result = await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(result.finish).toEqual({
      kind: 'error',
      failure: {
        message: 'slow down',
        code: 'RATE_LIMIT',
        status: 429,
        providerRetryAfterMs: 2_000,
        requestId: ProviderRequestId('req-429'),
      },
    })
  })

  it('parses a future Retry-After HTTP date', async () => {
    const now = 1_800_000_000_000
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now)
    try {
      const server = await mockServer([{
        kind: 'http-error',
        status: 503,
        body: JSON.stringify({ error: { message: 'come back later' } }),
        headers: { 'retry-after': new Date(now + 3_000).toUTCString() },
      }])
      const ctx = await harness(server.url)
      const result = await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
      expect(result.finish).toEqual({
        kind: 'error',
        failure: {
          message: 'come back later',
          code: 'SERVER',
          status: 503,
          providerRetryAfterMs: 3_000,
        },
      })
    } finally {
      dateNow.mockRestore()
    }
  })

  it('omits zero, non-finite, invalid, and past Retry-After values', async () => {
    const values = [
      '0',
      '9'.repeat(400),
      'not-a-date',
      new Date(0).toUTCString(),
    ]
    for (const value of values) {
      const server = await mockServer([{
        kind: 'http-error',
        status: 429,
        body: JSON.stringify({ error: { message: 'retry later' } }),
        headers: { 'retry-after': value },
      }])
      const ctx = await harness(server.url)
      const result = await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
      expect(result.finish).toEqual({
        kind: 'error',
        failure: { message: 'retry later', code: 'RATE_LIMIT', status: 429 },
      })
    }
  })

  it('classifies only context-capacity HTTP 400 details as context overflow', () => {
    expect(httpErrorCode(400, { message: 'request too large for model context' }))
      .toBe(CONTEXT_WINDOW_EXCEEDED_CODE)
    expect(httpErrorCode(400, { message: 'invalid input: temperature exceeds maximum allowed value' }))
      .toBe('INVALID_REQUEST')
    expect(httpErrorCode(413, { code: 'context_length_exceeded' })).toBe('HTTP_413')
  })

  it('distinguishes terminal quota exhaustion from transient HTTP 429 throttling', () => {
    expect(httpErrorCode(429, { code: 'insufficient_quota', message: 'account credits exhausted' }))
      .toBe(QUOTA_EXCEEDED_CODE)
    expect(httpErrorCode(429, { type: 'GoUsageLimitError' })).toBe(QUOTA_EXCEEDED_CODE)
    expect(httpErrorCode(429, { message: 'request rate limit exceeded' })).toBe('RATE_LIMIT')
  })

  it('classifies payload-less auth and method statuses', () => {
    expect(httpErrorCode(401)).toBe('AUTH')
    expect(httpErrorCode(403)).toBe('AUTH')
    expect(httpErrorCode(500)).toBe('SERVER')
    expect(httpErrorCode(418)).toBe('HTTP_418')
  })

  it('keeps the status-line message for JSON error bodies without a message', async () => {
    const server = await mockServer([{ kind: 'http-error', status: 500, body: '{"error":{"type":"x"}}' }])
    const ctx = await harness(server.url)
    const result = await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(result.finish.kind).toBe('error')
    if (result.finish.kind !== 'error') throw new Error('expected an error finish')
    expect(result.finish.failure.code).toBe('SERVER')
    expect(result.finish.failure.message).toMatch(/HTTP 500/)
  })

  it('keeps the status-line message for non-JSON error bodies', async () => {
    const server = await mockServer([{ kind: 'http-error', status: 502, body: 'Bad Gateway', contentType: 'text/plain' }])
    const ctx = await harness(server.url)
    const result = await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(result.finish.kind).toBe('error')
    if (result.finish.kind !== 'error') throw new Error('expected an error finish')
    expect(result.finish.failure.code).toBe('SERVER')
    expect(result.finish.failure.message).toMatch(/HTTP 502/)
  })

  it('reports a transport failure with the endpoint in the message', async () => {
    const ctx = await harness('http://127.0.0.1:1')
    const result = await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(result.finish).toMatchObject({
      kind: 'error',
      failure: {
        code: 'TRANSPORT',
        message: 'OpenCode Zen API request to http://127.0.0.1:1 failed',
      },
    })
  })

  it('classifies an aborted request as an aborted finish', async () => {
    const controller = new AbortController()
    controller.abort()
    const ctx = await harness('http://127.0.0.1:1')
    const result = await assemble(ctx, {
      model: 'deepseek-v4-flash-free',
      messages: [],
      signal: controller.signal,
    })
    expect(result.finish).toMatchObject({ kind: 'aborted', failure: { code: 'ABORTED' } })
  })

  it('throws EMPTY_RESPONSE when the response has no body', async () => {
    const adapter = adapterOf({ baseURL: 'http://127.0.0.1:1' })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    try {
      const iterate = async (): Promise<void> => {
        for await (const _chunk of adapter.stream({ provider: 'opencode-zen', model: 'm', messages: [] })) { /* drain */ }
      }
      await expect(iterate()).rejects.toThrow(/no response body/)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('classifies an abrupt body close as TRANSPORT', async () => {
    const server = await mockServer([{
      kind: 'close-early',
      events: ['{"choices":[{"delta":{"content":"par"}}]}'],
    }])
    const ctx = await harness(server.url)
    const result = await assemble(ctx, { model: 'deepseek-v4-flash-free', messages: [] })
    expect(result.finish.kind).toBe('error')
    if (result.finish.kind !== 'error') throw new Error('expected an error finish')
    expect(result.finish.failure.code).toBe('TRANSPORT')
    expect(result.finish.failure.message).toMatch(/^OpenCode Zen API stream from .* failed$/)
  })

  it('aborts mid-stream via the request signal', async () => {
    const server = await mockServer([{ kind: 'sse', events: textEvents, delayMs: 50 }])
    const ctx = await harness(server.url)
    const controller = new AbortController()

    const pending = (async () => {
      const chunks = []
      for await (const chunk of ctx.llm.stream({
        provider: 'opencode-zen',
        model: 'deepseek-v4-flash-free',
        messages: [],
        signal: controller.signal,
      })) {
        chunks.push(chunk)
      }
      return chunks
    })()

    setTimeout(() => { controller.abort() }, 30)
    const chunks = await pending
    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.type).toBe('finish')
    if (chunks[0]?.type !== 'finish') throw new Error('expected a finish chunk')
    expect(chunks[0].reason.kind).toBe('aborted')
    if (chunks[0].reason.kind !== 'aborted') throw new Error('expected an aborted finish')
    expect(chunks[0].reason.failure.code).toBe('ABORTED')
  })

  it('maps connection failures to TRANSPORT without losing the cause', async () => {
    const cause = new TypeError('connection refused')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(cause)
    const adapter = adapterOf({ baseURL: 'https://example.invalid' })
    try {
      const drain = async (): Promise<void> => {
        for await (const _chunk of adapter.stream({ provider: 'opencode-zen', model: 'm', messages: [] })) { /* drain */ }
      }
      await expect(drain()).rejects.toMatchObject({ code: 'TRANSPORT', cause })
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('renders a non-Error transport rejection without losing its cause', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const failed = Promise.withResolvers<Response>()
      failed.reject('offline')
      return failed.promise
    })
    const adapter = adapterOf({ baseURL: 'https://example.invalid' })
    try {
      const drain = async (): Promise<void> => {
        for await (const _chunk of adapter.stream({ provider: 'opencode-zen', model: 'm', messages: [] })) { /* drain */ }
      }
      await expect(drain()).rejects.toMatchObject({
        message: 'OpenCode Zen API request to https://example.invalid failed',
        code: 'TRANSPORT',
        cause: 'offline',
      })
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('aborts the underlying body when the stream stays idle past its watchdog', async () => {
    vi.useFakeTimers()
    let stopped = false
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      const signal = init?.signal
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          signal?.addEventListener('abort', () => {
            stopped = true
            controller.error(signal.reason)
          }, { once: true })
        },
      })
      return Promise.resolve(new Response(body, { status: 200 }))
    })
    const adapter = adapterOf({ baseURL: 'https://example.invalid', streamIdleTimeoutMs: 100 })
    try {
      const drain = (async () => {
        for await (const _chunk of adapter.stream({ provider: 'opencode-zen', model: 'm', messages: [] })) { /* drain */ }
      })()
      const rejected = expect(drain).rejects.toMatchObject({ code: 'TIMEOUT' })
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)
      await rejected
      expect(stopped).toBe(true)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('keeps an idle provider read alive through SSE comments', async () => {
    vi.useFakeTimers()
    const encoder = new TextEncoder()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          setTimeout(() => { controller.enqueue(encoder.encode(': keep-alive\n\n')) }, 75)
          setTimeout(() => { controller.enqueue(encoder.encode(': keep-alive\n\n')) }, 150)
          setTimeout(() => {
            controller.enqueue(encoder.encode(textEvents.map(event => `data: ${event}\n\n`).join('')))
            controller.close()
          }, 225)
        },
      })
      return Promise.resolve(new Response(body, { status: 200 }))
    })
    const adapter = adapterOf({ baseURL: 'https://example.invalid', streamIdleTimeoutMs: 100 })
    try {
      const chunks: string[] = []
      const drain = (async () => {
        for await (const chunk of adapter.stream({ provider: 'opencode-zen', model: 'm', messages: [] })) {
          chunks.push(chunk.type)
        }
      })()
      await vi.advanceTimersByTimeAsync(75)
      await vi.advanceTimersByTimeAsync(75)
      await vi.advanceTimersByTimeAsync(75)
      await expect(drain).resolves.toBeUndefined()
      expect(chunks).toEqual(['block-start', 'text-delta', 'block-end', 'usage', 'finish'])
    } finally {
      fetchSpy.mockRestore()
    }
  })
})

describe('plugin registration and config', () => {
  it('keeps wire helpers off the package root', () => {
    for (const helper of [
      'httpErrorCode',
      'serializeMessages',
      'serializeRequest',
      'DONE',
      'parseSse',
      'mapFinishReason',
      'mapUsage',
      'translate',
    ]) expect(LlmOpenCodeZen).not.toHaveProperty(helper)
  })

  it('registers the opencode-zen provider and unregisters on dispose (HMR safety)', async () => {
    const server = await mockServer([])
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    const fiber = await ctx.plugin(LlmOpenCodeZen, {
      baseURL: server.url,
    })
    expect(ctx.llm.listProviders()).toEqual([{ id: 'opencode-zen', name: 'OpenCode Zen' }])
    expect(ctx.llm.listConfigurableProviders()).toEqual([{
      provider: 'opencode-zen',
      displayName: 'OpenCode Zen',
      settingsNs: 'llm-opencode-zen',
      settingsPath: [],
    }])
    await fiber.dispose()
    expect(ctx.llm.listProviders()).toEqual([])
    expect(ctx.llm.listConfigurableProviders()).toEqual([])
  })

  it('registers retryPolicy from the provider config', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(LlmOpenCodeZen, {
      baseURL: 'http://127.0.0.1:1',
      retryPolicy: {
        mode: 'always',
        backoff: { initialDelayMs: 25, maxDelayMs: 100, jitterRatio: 0.2 },
      },
    })

    expect(ctx.llm.providerRetryPolicy('opencode-zen')).toEqual({
      mode: 'always',
      initialDelayMs: 25,
      maxDelayMs: 100,
      jitterRatio: 0.2,
    })
  })

  it('loads keyless and advertises the default free-model catalog', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(LlmOpenCodeZen, { baseURL: 'http://127.0.0.1:1' })
    expect(ctx.llm.listProviders()).toEqual([{ id: 'opencode-zen', name: 'OpenCode Zen' }])
    await expect(ctx.llm.listModels('opencode-zen')).resolves.toEqual([
      { provider: 'opencode-zen', id: 'deepseek-v4-flash-free', name: 'DeepSeek-V4-Flash Free', inputModalities: ['text'] },
      { provider: 'opencode-zen', id: 'mimo-v2.5-free', name: 'MiMo V2.5 Free', inputModalities: ['text'] },
      { provider: 'opencode-zen', id: 'hy3-free', name: 'Hunyuan 3 Free', inputModalities: ['text'] },
      { provider: 'opencode-zen', id: 'nemotron-3-ultra-free', name: 'Nemotron 3 Ultra Free', inputModalities: ['text'] },
      { provider: 'opencode-zen', id: 'nemotron-3.5-lightning-free', name: 'Nemotron 3.5 Lightning Free', inputModalities: ['text'] },
      { provider: 'opencode-zen', id: 'laguna-s-2.1-free', name: 'Laguna S 2.1 Free', inputModalities: ['text'] },
    ])
    await expect(ctx.llm.resolveModelInfo('opencode-zen', 'deepseek-v4-flash-free'))
      .resolves.toMatchObject({
        provider: 'opencode-zen',
        id: 'deepseek-v4-flash-free',
        name: 'DeepSeek-V4-Flash Free',
        context: { contextWindow: 128_000 },
        defaultMaxTokens: 32_768,
      })
    // No reasoning capability is advertised: an explicit effort is refused at
    // the exact-model resolution (the deployer's own choice of model decides).
    await expect(ctx.llm.resolveModelInfo('opencode-zen', 'deepseek-v4-flash-free'))
      .resolves.not.toHaveProperty('reasoning')
  })

  it('advertises configured models without restricting arbitrary request ids', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(LlmOpenCodeZen, {
      baseURL: 'http://127.0.0.1:1',
      models: [
        { id: 'free-fast', contextWindow: 32_000 },
        {
          id: 'free-reasoner',
          name: 'Free Reasoner',
          description: 'Higher reasoning budget',
          contextWindow: 64_000,
        },
      ],
    })
    await expect(ctx.llm.listModels('opencode-zen')).resolves.toEqual([
      { provider: 'opencode-zen', id: 'free-fast', name: 'free-fast', inputModalities: ['text'] },
      { provider: 'opencode-zen', id: 'free-reasoner', name: 'Free Reasoner', description: 'Higher reasoning budget', inputModalities: ['text'] },
    ])
    await expect(ctx.llm.resolveModelInfo('opencode-zen', 'free-fast'))
      .resolves.toMatchObject({ context: { contextWindow: 32_000 } })
    await expect(ctx.llm.resolveModelInfo('opencode-zen', 'free-reasoner'))
      .resolves.toMatchObject({
        name: 'Free Reasoner',
        description: 'Higher reasoning budget',
      })
    await expect(ctx.llm.resolveModelInfo('opencode-zen', 'arbitrary-unlisted'))
      .resolves.toMatchObject({
        context: { contextWindow: 262_144 },
        defaultMaxTokens: 32_768,
      })
  })

  it('uses exact model capacity before the adapter-wide default', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(LlmOpenCodeZen, {
      baseURL: 'http://127.0.0.1:1',
      defaultContextWindow: 256_000,
      models: [
        { id: 'inherits-default' },
        { id: 'exact-override', contextWindow: 64_000 },
      ],
    })

    await expect(ctx.llm.resolveModelInfo('opencode-zen', 'inherits-default'))
      .resolves.toMatchObject({ context: { contextWindow: 256_000 } })
    await expect(ctx.llm.resolveModelInfo('opencode-zen', 'exact-override'))
      .resolves.toMatchObject({ context: { contextWindow: 64_000 } })
    await expect(ctx.llm.resolveModelInfo('opencode-zen', 'unlisted-pass-through'))
      .resolves.toMatchObject({ context: { contextWindow: 256_000 } })
  })

  it('allows an explicit empty model catalog', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(LlmOpenCodeZen, {
      baseURL: 'http://127.0.0.1:1',
      models: [],
    })
    await expect(ctx.llm.listModels('opencode-zen')).resolves.toEqual([])
  })

  it.each([
    [[{ id: '' }], /ids must be non-empty/],
    [[{ id: 'm', name: '' }], /empty name/],
    [[{ id: 'm', contextWindow: 0 }], /contextWindow/],
    [[{ id: 'm', contextWindow: 1.5 }], /contextWindow/],
    [[{ id: 'm' }, { id: 'm' }], /duplicate catalog model/],
  ] as const)('rejects invalid advisory model config', async (models, message) => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await expect(ctx.plugin(LlmOpenCodeZen, {
      baseURL: 'http://127.0.0.1:1',
      models: [...models],
    })).rejects.toThrow(message)
    expect(ctx.llm.listProviders()).toEqual([])
  })

  it.each([0, 1.5])('rejects a per-model output cap of %s', (maxTokens) => {
    expect(() => resolveAdapterOptions({ models: [{ id: 'bad-cap', maxTokens }] }))
      .toThrow(/maxTokens must be a positive integer/)
  })

  it.each([0, 1.5])('rejects an invalid per-model context capacity %s', (contextWindow) => {
    expect(() => resolveAdapterOptions({ models: [{ id: 'bad-context', contextWindow }] }))
      .toThrow(/contextWindow must be a positive integer/)
  })

  it('prefers a model\'s own output cap over the profile default', async () => {
    const adapter = adapterOf({ maxTokens: 4096, models: [
      { id: 'capped', maxTokens: 512 },
      { id: 'uncapped' },
    ] })
    await expect(adapter.resolveModel('opencode-zen', 'capped'))
      .resolves.toMatchObject({ defaultMaxTokens: 512 })
    await expect(adapter.resolveModel('opencode-zen', 'uncapped'))
      .resolves.toMatchObject({ defaultMaxTokens: 4096 })
    await expect(adapter.resolveModel('opencode-zen', 'not-in-catalog'))
      .resolves.toMatchObject({ defaultMaxTokens: 4096 })
  })

  it.each([0, 1.5])(
    'rejects invalid adapter-wide default context capacity %s',
    async (defaultContextWindow) => {
      expect(() => resolveAdapterOptions({ defaultContextWindow }))
        .toThrow(/defaultContextWindow must be a positive integer/)

      const ctx = new Context()
      await ctx.plugin(LlmRuntime)
      await expect(ctx.plugin(LlmOpenCodeZen, {
        baseURL: 'http://127.0.0.1:1',
        defaultContextWindow,
      })).rejects.toThrow(/defaultContextWindow/)
      expect(ctx.llm.listProviders()).toEqual([])
    },
  )

  it.each([0, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid adapter-wide maxTokens %s',
    async (maxTokens) => {
      expect(() => resolveAdapterOptions({ maxTokens }))
        .toThrow(/maxTokens must be a positive safe integer/)

      const ctx = new Context()
      await ctx.plugin(LlmRuntime)
      await expect(ctx.plugin(LlmOpenCodeZen, {
        baseURL: 'http://127.0.0.1:1',
        maxTokens,
      })).rejects.toThrow(/maxTokens/)
      expect(ctx.llm.listProviders()).toEqual([])
    },
  )

  it('rejects invalid idle watchdog bounds for direct and plugin composition', async () => {
    expect(() => resolveAdapterOptions({ streamIdleTimeoutMs: Number.POSITIVE_INFINITY }))
      .toThrow(/streamIdleTimeoutMs.*positive finite/)
    expect(() => resolveAdapterOptions({ streamIdleTimeoutMs: MAX_TIMER_DELAY_MS + 1 }))
      .toThrow(/streamIdleTimeoutMs.*no greater/)

    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await expect(ctx.plugin(LlmOpenCodeZen, {
      baseURL: 'http://127.0.0.1:1',
      streamIdleTimeoutMs: 0,
    })).rejects.toThrow(/streamIdleTimeoutMs/)
    await expect(ctx.plugin(LlmOpenCodeZen, {
      baseURL: 'http://127.0.0.1:1',
      streamIdleTimeoutMs: MAX_TIMER_DELAY_MS + 1,
    })).rejects.toThrow(/streamIdleTimeoutMs/)
  })

  it('rejects invalid nested retryPolicy before registering the provider', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)

    await expect(ctx.plugin(LlmOpenCodeZen, {
      baseURL: 'http://127.0.0.1:1',
      retryPolicy: { mode: 'normal', maxRetries: -1 },
    })).rejects.toThrow(/retryPolicy/)
    expect(ctx.llm.listProviders()).toEqual([])
  })

  it('defaults to the public OpenCode Zen base URL without config', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    // Registration succeeds; no call is made (would hit opencode.ai).
    await ctx.plugin(LlmOpenCodeZen, {})
    expect(ctx.llm.listProviders()).toEqual([{ id: 'opencode-zen', name: 'OpenCode Zen' }])
    expect(resolveAdapterOptions({}).baseURL).toBe(LlmOpenCodeZen.PUBLIC_BASE_URL)
  })

  it('resolves an explicit apiKeyEnv to a credential reference', () => {
    const resolved = resolveAdapterOptions({ apiKeyEnv: 'ZEN_KEY' })
    expect(resolved.apiKeyEnv).toBe(credentialRef('ZEN_KEY'))
  })

  it('adapter is constructible directly for embedding over the shared resolver', async () => {
    const adapter = adapterOf()
    expect(adapter).toBeInstanceOf(OpenCodeZenAdapter)
    await expect(adapter.listModels('opencode-zen')).resolves.toHaveLength(6)
    expect(adapter.providerInfo('opencode-zen')).toEqual({ id: 'opencode-zen', name: 'OpenCode Zen' })
    expect(adapter.providerRetryPolicy('opencode-zen')).toHaveProperty('mode')
  })

  it('resolves connection facts and the credential exactly once per stream call', async () => {
    const server = await mockServer([{ kind: 'sse', events: textEvents }])
    const options = vi.fn(() => resolveAdapterOptions({ baseURL: server.url }))
    const resolveApiKey = vi.fn(() => Promise.resolve('per-request-key'))
    const adapter = new OpenCodeZenAdapter({ options, resolveApiKey })

    for await (const _chunk of adapter.stream({ provider: 'opencode-zen', model: 'm', messages: [] })) { /* drain */ }

    expect(options).toHaveBeenCalledTimes(1)
    expect(resolveApiKey).toHaveBeenCalledTimes(1)
    expect(server.headers[0]?.authorization).toBe('Bearer per-request-key')
  })

  it('uses the default model catalog when apply is called directly', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    LlmOpenCodeZen.apply(ctx, { baseURL: 'http://127.0.0.1:1' })
    await expect(ctx.llm.listModels('opencode-zen')).resolves.toHaveLength(6)
  })
})
