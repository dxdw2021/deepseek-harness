/**
 * OpenCode Zen chat-completions wire format (OpenAI-compatible). Types only.
 *
 * The OpenCode Zen gateway (`https://opencode.ai/zen/v1`) accepts the standard
 * OpenAI chat stream, whose payload vocabulary is the same shape DeepSeek's
 * OpenAI-compatible endpoint speaks. The anonymous free tier is keyless: a
 * request authenticates with the literal bearer `public`, and the server answers
 * per-IP quota exhaustion with an HTTP 429 whose error `type` is
 * `FreeUsageLimitError` (paid subscribers get `GoUsageLimitError`). See
 * `https://opencode.ai/zen/v1/models` for the served model list.
 *
 * @module dsh-llm-opencode-zen/types
 */

/* jscpd:ignore-start */
/** Request body for `POST {baseURL}/chat/completions`. */
export interface WireRequest {
  model: string
  messages: WireMessage[]
  stream: true
  stream_options: { include_usage: true }
  tools?: WireTool[]
  temperature?: number
  max_tokens?: number
  /** Stop sequences (OpenAI `stop`): generation halts on any one string. */
  stop?: string[]
}

/** System-role message: a single string of instructions. */
export interface WireSystemMessage {
  role: 'system'
  content: string
}

/** User-role message: a single string of user input. */
export interface WireUserMessage {
  role: 'user'
  content: string
}

/** Tool-role message: the result of one tool call, keyed by its call id. */
export interface WireToolMessage {
  role: 'tool'
  tool_call_id: string
  content: string
}

/** One entry of the request `messages` array, discriminated on `role`. */
export type WireMessage =
  | WireSystemMessage
  | WireUserMessage
  | WireAssistantMessage
  | WireToolMessage

/**
 * Assistant-role history message. The harness replays `content: ""` (never
 * null) on tool-call-only turns — some gateways reject null — and a null-only
 * turn carries `content: ""` as well so a later turn is never poisoned.
 */
export interface WireAssistantMessage {
  role: 'assistant'
  content: string
  /**
   * Chain-of-thought passback. Replayed only on assistant turns that carried
   * tool calls; models that expose reasoning on the chat wire (kimi and
   * others) accept it there, and it is dropped on plain turns to save tokens.
   */
  reasoning_content?: string
  tool_calls?: WireToolCall[]
}

/** A completed tool call replayed on an assistant history message; `arguments` is the raw JSON string. */
export interface WireToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

/** One entry of the request `tools` array; `parameters` is a JSON Schema object. */
export interface WireTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/** One parsed SSE `data:` payload (a chat.completion.chunk). */
export interface WireChunk {
  choices?: WireChoice[]
  /** Arrives attached to the finish chunk and/or as a trailing usage-only chunk. */
  usage?: WireUsage | null
}

/** One streamed choice; `finish_reason` is non-null only on its terminal chunk. */
export interface WireChoice {
  delta?: WireDelta
  finish_reason?: string | null
}

/** The incremental content of one streamed choice; any subset of fields may be present per chunk. */
export interface WireDelta {
  role?: string
  /** Visible text. Null/empty on reasoning/tool-call chunks. */
  content?: string | null
  /**
   * Reasoning chain-of-thought. An absent field means the model is not
   * emitting reasoning on this stream; the FIRST chunk of a reasoning stream
   * carries an empty string (must not open a reasoning block).
   */
  reasoning_content?: string | null
  tool_calls?: WireToolCallDelta[]
}

/** A streamed fragment of one tool call; fragments sharing an `index` concatenate into one call. */
export interface WireToolCallDelta {
  /** Disambiguates parallel tool calls; stable across a call's deltas. */
  index: number
  /** Present on the first delta of each call only. */
  id?: string
  type?: 'function'
  function?: {
    /** Present on the first delta of each call only. */
    name?: string
    /** Argument JSON fragment (concatenate across deltas). */
    arguments?: string
  }
}

/**
 * Wire token accounting. `prompt_tokens` INCLUDES cache hits in the OpenAI
 * convention (`prompt_tokens = cached + uncached`); `mapUsage` subtracts them
 * to keep the harness convention of disjoint counts. Some upstream providers
 * omit usage from the stream entirely; the translator keeps serving and emits
 * no `usage` chunk then.
 */
export interface WireUsage {
  prompt_tokens: number
  completion_tokens: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number }
  completion_tokens_details?: { reasoning_tokens?: number }
}

/** Non-2xx error body. OpenCode Zen uses OpenAI-style `{ error: {...} }`; the error `type` may be `FreeUsageLimitError`. */
export interface WireError {
  error?: { message?: string; type?: string; code?: string }
}
/* jscpd:ignore-end */
