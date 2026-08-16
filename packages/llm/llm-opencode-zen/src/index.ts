/**
 * Register an {@link OpenCodeZenAdapter} for the `opencode-zen` provider route on
 * `ctx.llm`, with connection facts resolved per request instead of frozen at
 * load: the plugin layers its `cordis.yml` entry config under the optional
 * `llm-opencode-zen` user-settings section (`ctx.settings`) and resolves an
 * explicit API key through the optional credential seam (`ctx.credentials`),
 * so a changed base URL, catalog, or key reaches the very next request without
 * restarting anything, while an in-flight stream keeps the facts it started
 * with. The one registration-captured fact — the retry policy — re-registers
 * the route in place when it changes.
 *
 * OpenCode Zen serves a keyless anonymous free tier from
 * `https://opencode.ai/zen/v1`: without a configured `apiKeyEnv` the adapter
 * authenticates with the literal bearer `public`, so the wire request needs no
 * credential anywhere. A configured reference that resolves to nothing fails
 * the request with `MISSING_CREDENTIAL` rather than silently downgrading a
 * deployment that asked for a real key.
 * @module @deepseek-ai/dsh-llm-opencode-zen
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { assertUsableApiKey, LlmError, resolveRetryPolicy, RetryPolicySchema } from '@deepseek-ai/dsh-llm'
import type { RetryPolicyConfig } from '@deepseek-ai/dsh-llm'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { deepEqualJson, installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import {
  ANONYMOUS_BEARER,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  OpenCodeZenAdapter,
} from './adapter.ts'
import type { ZenCatalogModel, ZenConnectionOptions } from './adapter.ts'

export {
  ANONYMOUS_BEARER,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  OpenCodeZenAdapter,
  ZEN_CLIENT_USER_AGENT,
} from './adapter.ts'
export type { OpenCodeZenAdapterOptions, ZenCatalogModel, ZenConnectionOptions } from './adapter.ts'
export type * from './types.ts'

export const name = 'llm-opencode-zen'
export const inject = ['llm']

/* jscpd:ignore-start */
const NS = settingsNamespace('llm-opencode-zen')
/** The single provider route this plugin owns. */
const PROVIDER = 'opencode-zen'

/** Default free-tier models advertised by the anonymous OpenCode Zen catalog (`https://opencode.ai/zen/v1/models`). */
const DEFAULT_MODELS: ZenCatalogModel[] = [
  { id: 'deepseek-v4-flash-free', name: 'DeepSeek-V4-Flash Free', contextWindow: 128_000 },
  { id: 'mimo-v2.5-free', name: 'MiMo V2.5 Free', contextWindow: 262_144 },
  { id: 'hy3-free', name: 'Hunyuan 3 Free', contextWindow: 256_000 },
  { id: 'nemotron-3-ultra-free', name: 'Nemotron 3 Ultra Free', contextWindow: 131_072 },
  { id: 'nemotron-3.5-lightning-free', name: 'Nemotron 3.5 Lightning Free', contextWindow: 131_072 },
  { id: 'laguna-s-2.1-free', name: 'Laguna S 2.1 Free', contextWindow: 262_144 },
]

/**
 * Plugin config, validated by the same-named schemastery schema and doubling
 * as the `llm-opencode-zen` settings-section shape. Every field is optional in
 * yml: omitting `apiKeyEnv` uses the keyless anonymous free tier, omitted
 * capacity fields use the advisory defaults below, and `models` defaults to
 * the curated free-tier catalog.
 */
export interface Config {
  /**
   * Optional credential reference (environment-variable name) resolved per
   * request. Omit it to authenticate anonymously with the `public` bearer; a
   * reference that resolves to nothing fails the request with
   * `MISSING_CREDENTIAL` instead of downgrading to anonymous.
   */
  apiKeyEnv?: string
  /** Endpoint base; defaults to {@link PUBLIC_BASE_URL}. */
  baseURL?: string
  /** Default per-request output cap (default 32,768); a model's own cap and explicit request values win. */
  maxTokens?: number
  /** Positive context capacity used when the selected model has no exact value (default 262,144). */
  defaultContextWindow?: number
  /** Advisory free-tier models shown by discovery consumers; defaults to the curated catalog. */
  models?: ZenCatalogModel[]
  /** Maximum provider idle time while one stream read is outstanding (default five minutes). */
  streamIdleTimeoutMs?: number
  /** Provider-owned model-request retry policy; omission uses normal defaults. */
  retryPolicy?: RetryPolicyConfig
}

const catalogModel: z<ZenCatalogModel> = z.object({
  id: z.string().required(),
  name: z.string(),
  description: z.string(),
  contextWindow: z.number().step(1).min(1),
  maxTokens: z.number().step(1).min(1),
})

export const Config: z<Config> = z.object({
  apiKeyEnv: z.string().role('credential-ref'),
  baseURL: z.string(),
  maxTokens: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_TOKENS),
  defaultContextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW),
  models: z.array(catalogModel).default(DEFAULT_MODELS),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  retryPolicy: RetryPolicySchema,
})

/** Public OpenCode Zen endpoint for the anonymous free tier. */
export const PUBLIC_BASE_URL = 'https://opencode.ai/zen/v1'

/**
 * One resolution's complete request facts. Connection and credential facts
 * are one value on purpose: a snapshot the resolver rejects keeps the whole
 * previous generation, so a request can never pair a stale endpoint with a
 * newer key.
 */
export type ResolvedOpenCodeZenOptions = ZenConnectionOptions

/** Resolve, validate, and detach the advisory model catalog. */
function resolveModels(models: readonly ZenCatalogModel[] | undefined): ZenCatalogModel[] {
  const seen = new Set<string>()
  return (models ?? DEFAULT_MODELS).map((model) => {
    if (model.id.length === 0) throw new Error('llm-opencode-zen: catalog model ids must be non-empty')
    if (model.name !== undefined && model.name.length === 0) {
      throw new Error(`llm-opencode-zen: catalog model "${model.id}" has an empty name`)
    }
    if (model.contextWindow !== undefined
      && (!Number.isInteger(model.contextWindow) || model.contextWindow <= 0)) {
      throw new Error(
        `llm-opencode-zen: catalog model "${model.id}" contextWindow must be a positive integer`,
      )
    }
    if (model.maxTokens !== undefined
      && (!Number.isInteger(model.maxTokens) || model.maxTokens <= 0)) {
      throw new Error(
        `llm-opencode-zen: catalog model "${model.id}" maxTokens must be a positive integer`,
      )
    }
    if (seen.has(model.id)) throw new Error(`llm-opencode-zen: duplicate catalog model "${model.id}"`)
    seen.add(model.id)
    return {
      id: model.id,
      ...model.name === undefined ? {} : { name: model.name },
      ...model.description === undefined ? {} : { description: model.description },
      ...model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow },
      ...model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens },
    }
  })
}

/**
 * The one explicit resolve step from raw config to validated connection
 * facts. Programmatic construction may bypass Schemastery normalization, so
 * every default and bound is re-judged here — for the composition entry at
 * load (fail loud) and for each settings snapshot at its first use.
 * @param config - raw plugin config or resolved settings snapshot.
 * @returns validated connection facts; the credential reference is absent when the route is anonymous.
 */
export function resolveAdapterOptions(config: Config): ResolvedOpenCodeZenOptions {
  if (config.defaultContextWindow !== undefined
    && (!Number.isInteger(config.defaultContextWindow) || config.defaultContextWindow <= 0)) {
    throw new Error('llm-opencode-zen: defaultContextWindow must be a positive integer')
  }
  if (config.maxTokens !== undefined
    && (!Number.isSafeInteger(config.maxTokens) || config.maxTokens <= 0)) {
    throw new Error('llm-opencode-zen: maxTokens must be a positive safe integer')
  }
  const streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS
  if (!Number.isFinite(streamIdleTimeoutMs)
    || streamIdleTimeoutMs <= 0
    || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) {
    throw new Error(
      `llm-opencode-zen: streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`,
    )
  }
  return {
    ...config.apiKeyEnv === undefined
      ? {}
      : { apiKeyEnv: credentialRef(config.apiKeyEnv) },
    baseURL: config.baseURL ?? PUBLIC_BASE_URL,
    maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
    defaultContextWindow: config.defaultContextWindow ?? DEFAULT_CONTEXT_WINDOW,
    models: resolveModels(config.models),
    streamIdleTimeoutMs,
    retryPolicy: resolveRetryPolicy(config.retryPolicy, 'llm-opencode-zen: retryPolicy'),
  }
}

export function apply(ctx: Context, config: Config): void {
  let current: () => Config = () => config
  let lastRaw: Config | undefined
  let lastGood: ResolvedOpenCodeZenOptions | undefined
  const options = (): ResolvedOpenCodeZenOptions => {
    const raw = current()
    if (raw === lastRaw && lastGood !== undefined) return lastGood
    try {
      const next = resolveAdapterOptions(raw)
      lastRaw = raw
      lastGood = next
      return next
    } catch (error) {
      // Static composition resolves before anything registers, so this branch
      // only sees a live settings snapshot failing a beyond-schema bound:
      // keep serving the last good facts and say so once per bad snapshot.
      if (lastGood === undefined) throw error
      lastRaw = raw
      ctx.logger.error('llm-opencode-zen: keeping the last good configuration after an invalid settings section')
      ctx.logger.error(error)
      return lastGood
    }
  }
  options()

  const resolveApiKey = async (connection: ResolvedOpenCodeZenOptions): Promise<string> => {
    // Anonymous route: the free tier's literal `public` bearer, no key anywhere.
    const ref = connection.apiKeyEnv
    if (ref === undefined) return ANONYMOUS_BEARER
    // Authenticated route: every credential fact comes from the caller's
    // snapshot, so a rejected settings generation cannot leak its key onto
    // the previous endpoint — and a configured-but-unresolvable reference
    // fails rather than downgrading a deployment that asked for a real key.
    const credentials = ctx.get('credentials')
    if (credentials !== undefined) {
      const hit = await credentials.resolve(ref)
      if (hit !== undefined) return assertUsableApiKey(hit.value, 'llm-opencode-zen', ref)
    } else {
      // Without the seam the environment is the whole credential plane.
      const ambient = process.env[ref]
      if (ambient !== undefined && ambient.length > 0) {
        return assertUsableApiKey(ambient, 'llm-opencode-zen', ref)
      }
    }
    throw new LlmError(
      `llm-opencode-zen: no API key for provider route "${PROVIDER}"; store ${ref} through the credentials`
      + ` service (the web Models page writes it), or export ${ref} in the launching environment,`
      + ' or remove apiKeyEnv to use the anonymous free tier',
      'MISSING_CREDENTIAL',
    )
  }

  const adapter = new OpenCodeZenAdapter({ options, resolveApiKey })
  ctx.llm.registerConfigurableProviders([
    { provider: PROVIDER, displayName: 'OpenCode Zen', settingsNs: NS, settingsPath: [] },
  ])
  // Route effects bind to this apply fiber via the stable `ctx` reference,
  // even when a swap runs inside the scoped settings callback below.
  const registration = ctx.llm.registerAdapter([PROVIDER], adapter)
  let registeredPolicy = options().retryPolicy
  const ensureRegistrationFacts = (): void => {
    const policy = options().retryPolicy
    if (deepEqualJson(policy, registeredPolicy)) return
    // The registry captures the retry policy at registration, so it is the one
    // fact per-request resolution cannot refresh. `replace` re-reads it in one
    // synchronous registry section: disposing and re-registering instead would
    // publish an empty route set between the two, and an observer that reacted
    // to it would see this provider disappear and come back.
    registration.replace([PROVIDER])
    registeredPolicy = policy
  }

  installSettingsSection(ctx, NS, Config, config, {
    setSource: (source) => {
      current = source
    },
    onChange: ensureRegistrationFacts,
  })
}
/* jscpd:ignore-end */
