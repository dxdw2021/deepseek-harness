# @deepseek-ai/dsh-llm-opencode-zen

English | [中文](README.zh.md)

OpenCode Zen chat-completions adapter for the harness LLM seam: direct `fetch` + SSE (framed by `eventsource-parser`) translating the OpenAI-compatible wire format of the [OpenCode Zen gateway](https://opencode.ai/zen) into the `StreamChunk` protocol. The anonymous free tier needs no credential anywhere — the adapter sends the literal bearer `public` by default, so a composition reaches free models with no key, no credentials seam, and no environment variable.

This package owns the `opencode-zen` provider route, distinct from `deepseek-official` (dsh-llm-deepseek) and the pi-ai catalog routes, so one composition can mount every LLM path side by side; registering another adapter for `opencode-zen` itself still throws `LlmError('DUPLICATE_ADAPTER')`.

The package root exposes the Cordis plugin contract and `OpenCodeZenAdapter`; wire serialization, SSE parsing, and chunk translation helpers are not part of that root contract.

## Config

```yaml
- id: llm-opencode-zen
  name: '@deepseek-ai/dsh-llm-opencode-zen'
  config:
    apiKeyEnv: OPENCODE_ZEN_API_KEY  # optional; omit → anonymous `public` free tier
    baseURL: https://opencode.ai/zen/v1 # optional; this is the default
    maxTokens: 32768                # optional positive per-request output cap; this is the default
    streamIdleTimeoutMs: 300000     # optional; positive finite Node timer delay; five-minute default
    retryPolicy:                    # optional; omission uses bounded normal defaults
      mode: always                  # normal | always
      backoff:
        initialDelayMs: 500
        maxDelayMs: 10000
        jitterRatio: 0.1
    defaultContextWindow: 262144    # optional positive-integer fallback; this is the default
    models:                         # optional; defaults to the curated free-tier catalog
      - id: deepseek-v4-flash-free
        name: DeepSeek-V4-Flash Free
      - id: private-free-corridor
        description: Company-hosted free gateway model
        contextWindow: 512000
```

The plugin registers the single provider route `opencode-zen` together with its resolved `retryPolicy`. A request selects it with `provider: opencode-zen`; its `model` is passed through as the wire `model` string, so changing models does not require lifecycle-time registration. Omitting `models` advertises the curated free-tier catalog served by the anonymous endpoint (`deepseek-v4-flash-free`, `mimo-v2.5-free`, `hy3-free`, `nemotron-3-ultra-free`, `nemotron-3.5-lightning-free`, `laguna-s-2.1-free`); an explicit list replaces those defaults, while `models: []` advertises none. Catalog entries are exposed through `ctx.llm.listModels('opencode-zen')` for clients such as ACP editors and the Web selector, but remain advisory: unlisted model ids still pass through unchanged. An omitted entry name defaults to its id.

`contextWindow` is optional per configured model. `ctx.llm.resolveModelInfo('opencode-zen', model).context` returns an exact model value first, then `defaultContextWindow` for an entry without capacity or an unlisted pass-through id. The advertised capacities are estimates from the models.dev catalog, not authoritative provider limits — pressure-sensitive plugins treat them as deployment-owned, never as a hard contract.

`maxTokens` is the adapter-configured output cap for conversation requests and defaults to 32,768. A catalog entry may carry its own `maxTokens`, which wins for that model; an entry without one, and any unlisted pass-through id, resolve to the profile value. Exact-model resolution exposes the winner as `defaultMaxTokens`; `LlmRuntime` materializes that value into `GenerateOptions.maxTokens` before the agent loop writes `request/header`, so the wire request remains reconstructable. An explicit request or `AgentOptions.maxTokens` value wins and is serialized as `max_tokens`. The adapter does not clamp this request budget against `contextWindow`.

### Logging in with an existing opencode account

An account you already logged into on this machine through the opencode CLI (`opencode auth login opencode`) can back the route: `pnpm run login:opencode` imports its stored credential into `$DSH_HOME/.credentials.yaml` under `OPENCODE_ZEN_API_KEY` (no password prompt; nothing is echoed), then add `apiKeyEnv: OPENCODE_ZEN_API_KEY` to the entry. The web Models page offers the same action as an "Import from opencode login" button on the opencode-zen provider card (it drives `llm.importOpencodeCredential`, which reads the opencode CLI's `auth.json` and writes the credential through the harness credentials seam, never crossing the wire). The imported key does NOT unlock the anonymous tier's popular-model quotas — those are keyed on the client `User-Agent`, which the adapter sends regardless; the account key is for account-scoped allowances and paid tiers.

Exactly one aspect is deliberately not configurable: reasoning effort. The free catalog spans providers with different, mutually incompatible effort vocabularies, so this adapter sends no `reasoning_effort` and advertises no `reasoning` capability — every model answers with the provider's own default behavior, and an explicit `GenerateOptions.reasoningEffort` fails with `UNSUPPORTED_REASONING_EFFORT` before network I/O. A deployment that needs a specific dialect wire field uses the pi-ai `openai-completions` route instead.

`streamIdleTimeoutMs` bounds each outstanding provider read, including the initial `fetch`, without counting time the consumer spends between chunks. SSE comments rearm an outstanding read as transport activity but never become `StreamChunk` values or session-log events. One stable abort signal reaches the request and body reader for the whole call; expiry stops the transport and throws `LlmError('TIMEOUT')`, while an earlier caller abort throws `LlmError('ABORTED')`. The adapter makes exactly one provider request per `stream()` call; it registers the configured policy as provider metadata, and `dsh-llm-retry` separately executes it at durable agent-step boundaries.

## Dynamic configuration (settings + credentials)

Connection facts are not frozen at load. `resolveAdapterOptions` is the one explicit resolve step from raw config to validated facts, and the adapter re-reads them through a thunk **once per operation**: base URL, catalog, output cap, and idle budget all take effect on the next request, while an in-flight stream keeps the facts it started with. Two optional seams feed that thunk:

- **`ctx.settings`** — the plugin registers the `llm-opencode-zen` namespace with this same `Config` schema and its `cordis.yml` entry as the composition `base`, so a `llm-opencode-zen:` section in the user settings document overrides any field — including switching between anonymous and authenticated by adding or removing `apiKeyEnv` — without a restart. Without a mounted settings service the entry config alone drives the adapter, unchanged. A live settings snapshot that passes the schema but fails a beyond-schema bound (a duplicate catalog id) keeps the last good facts and logs the failure; the entry config itself still fails plugin load.
- **`ctx.credentials`** — an explicit key resolves per stream call, from the *same* resolved snapshot that supplies the endpoint. Configuration carries only `apiKeyEnv`, never a literal key: the reference resolves through the credential seam, and without a mounted seam through the process environment. Because credential facts travel with the connection facts, a settings snapshot the resolver rejects contributes neither its endpoint nor its key: the whole previous generation keeps serving. Every resolved key is format-checked before use, so a value no HTTP header can carry is refused with `LlmError('INVALID_CREDENTIAL')` naming the failing entry point — never any part of the key — instead of surfacing as an opaque `fetch` `TypeError`. Omitting `apiKeyEnv` entirely is the anonymous free tier: requests carry the literal bearer `public` and no credential is required anywhere. A configured reference that resolves to nothing fails with `MISSING_CREDENTIAL` naming every configuration entry point — never a silent downgrade to anonymous for a deployment that asked for a real key — while the route stays registered and the catalog stays browsable.

The one registration-captured fact is the retry policy: when its resolved value changes, the plugin re-registers the route in place (same adapter instance, one synchronous section), so `ctx.llm.providerRetryPolicy('opencode-zen')` always reports the current policy.

The plugin also declares its route in the configurable-provider directory (`ctx.llm.listConfigurableProviders()`): provider `opencode-zen`, settings namespace `llm-opencode-zen`, empty settings path — the whole section is the profile. Configuration surfaces use that entry to offer this adapter alongside dormant pi-ai providers.

## App attribution

Every request carries OpenCode Zen's session-scoped identity headers, mirroring the shape of the official opencode CLI so the gateway rates the request the same way. Each request mints a fresh well-formed `x-opencode-session` (`ses_<hex>`), `x-opencode-request` (`msg_<hex>`), `x-opencode-project` (`<hex>`), and a constant `x-opencode-client: dsh`. The gateway keys its free tier on these ids rather than the raw source IP, so a fresh session id per request rides the same session-scoped allowance as the official client instead of exhausting a shared per-IP bucket; the ids are opaque wire identities, never user data.

The `User-Agent` replaces the dsh-llm `attributionHeaders()` default (a white-label replacement the attribution contract allows, never a suppression): the request sends the opencode-client prefix `opencode/local ai-sdk/provider-utils/4.0.23 runtime/bun/1.4.0 (deepseek-harness)`. Live A/B against the gateway showed that the anonymous free tier 429-limits the popular free models (`deepseek-v4-flash-free`, `mimo-v2.5-free`) for requests it does not recognize as opencode-ecosystem clients, while the official-prefixed User-Agent (with any `x-opencode-client`) passes; the `(deepseek-harness)` suffix keeps the wire honestly labeled. The anonymous tier authenticates by the bearer alone (the literal `public`).

## Wire-format notes

- One request per provider call mints a fresh OpenCode Zen session identity (`x-opencode-session` and siblings, see [App attribution](#app-attribution)) — the same shape the opencode CLI sends, so free-tier quota is session-scoped rather than drained from the shared per-IP bucket.
- Streaming only (`stream_options.include_usage` always on). `usage` may arrive attached to the finish chunk, as a trailing usage-only chunk, or not at all (some upstream providers omit it) — the translator defers what arrives to `[DONE]`, so `usage` always precedes `finish`, nothing follows `finish`, and an absent usage simply emits no `usage` chunk.
- No `reasoning_effort` and no `thinking` field ever crosses the wire; the first reasoning chunk carries `reasoning_content: ""` — handled (no spurious reasoning block).
- **Reasoning passback rule**: on assistant turns that carried tool calls, `reasoning_content` is serialized back in history; on tool-call-free turns it is dropped (ignored anyway — saves tokens).
- Cache accounting: `cacheReadTokens` ← `prompt_cache_hit_tokens` / `prompt_tokens_details.cached_tokens`; cached reads are subtracted from `inputTokens` to keep TokenUsage counts disjoint.

## Errors

Non-2xx responses throw `LlmError` with stable codes: `AUTH` (401/403), `QUOTA` (429s whose provider code, type, or message identifies exhausted free/go quota — including the anonymous tier's `FreeUsageLimitError`/`GoUsageLimitError` per-IP daily cap — plus any detail matching the shared quota classifier), `RATE_LIMIT` (other 429s), `CONTEXT_WINDOW_EXCEEDED` (a 400 whose provider code, type, or message identifies context overflow), `INVALID_REQUEST` (other 400s), `SERVER` (5xx), `HTTP_<status>` otherwise. Its serializable `failure` retains the HTTP status plus a valid positive `Retry-After` seconds/date delay and `x-request-id` when present. A pre-response transport failure (DNS, refused connection, TLS, proxy) throws `TRANSPORT` naming the configured endpoint and chaining the original rejection as `cause`; caller aborts throw `ABORTED`, and the loop's cancellation signal remains authoritative. Protocol violations throw `STREAM_CLOSED` (no `[DONE]`) or `MALFORMED_RESPONSE` (bad JSON payload). Unknown wire `finish_reason`s (e.g. `content_filter`) become `finish {kind: 'error', failure}` chunks, and a completed stream whose `stop` (or absent) finish opened no content blocks becomes a `finish {kind: 'error'}` with code `EMPTY_RESPONSE` (retried by default policy).

## Model Experience

### OpenCode Zen request

#### What the model sees

The selected OpenCode Zen model receives the harness system prompt, message history, tool schemas, stop sequences, and call config without adapter-authored prompt prose. On a prior assistant turn with tool calls, its reasoning content is passed back as required; reasoning from tool-call-free turns is omitted. No reasoning effort is configured: the model answers with its provider's default behavior.

#### Token effect

Provider tokenization governs exact input. Conditional reasoning passback increases tool-round-trip context while dropping other reasoning avoids paying those tokens again; cache-read usage is reported when available.

#### KV Cache effect

An unchanged assembled prefix is eligible for OpenCode Zen's upstream cache reuse, which this adapter reports in usage. A model-route change or any upstream prompt, schema, prefix, or history change may prevent reuse from the first changed token; reasoning passback appends during tool round trips.

### OpenCode Zen response

#### What the model sees

Reasoning, text, and raw-string tool arguments are translated into harness chunks for the loop to log and assemble.

#### Token effect

Generated tokens follow the request's `maxTokens`; only loop-retained blocks affect later input. Upstream providers that do not report stream usage leave the session without a `usage` chunk for that call.

#### KV Cache effect

Loop-retained response blocks append to the next request and preserve its earlier reusable prefix; dropped blocks have no later cache effect. Changing the provider or model selects a different cache domain.

## Known Limitations and Deferred Work

- **The anonymous free tier is best-effort, session-scoped, and intermittently limited** — the gateway keys free availability on the session identity this adapter mints per request and on the opencode-client `User-Agent` it sends (popular models pass for recognized clients). Exhaustion may still answer HTTP 429 `FreeUsageLimitError`, classified as `QUOTA_EXCEEDED`, or an empty stream for some models/prompts; availability is shared and not guaranteed, and the tier's limits sit entirely outside this package.
- **No reasoning-effort control** — the free catalog has no single effort vocabulary, so explicit efforts are refused and no `reasoning_effort` is sent; a deployment that needs a specific dialect uses the pi-ai `openai-completions` route.
- **`tool_choice` is not mapped** — not part of the core vocabulary (MVP cut, shared with the DeepSeek twin).
- **Advertised context windows are catalog estimates** — the curated entries carry round approximate capacities from models.dev, not authoritative provider limits; pressure-sensitive deployments should configure their own per-model `contextWindow`.
- **A settings `models` list replaces the composition list wholesale** — settings-layer merging is per-field, and arrays are one field; per-entry catalog merging would need a keyed shape.
- **Requests use raw `fetch`, not `@cordisjs/plugin-http`** — no shared proxy/interception configuration; adoption is deferred until a second adapter wants it (`TODO(http)`, the same debt as the DeepSeek twin).
- **The OpenAI-compatible wire modules intentionally twin dsh-llm-deepseek** — `parseSse`, `translate`, and the message serializer match the DeepSeek adapter's protocol code byte-for-byte except for the missing thinking/effort fields; the shared-transport extraction is the deferred refactor this duplication awaits, and jscpd ignore markers bound the allowed surface.