# Agent Note: Interrupted STREAM_CLOSED streams retry by default

Status: implemented

English | [中文](2026-08-20-stream-closed-is-retryable.zh.md)

## Problem

A long-running goal task can stop permanently when a model stream is interrupted mid-flight. An SSE payload that ends without its terminal marker — no `[DONE]` / done event — makes the adapters throw `LlmError` with code `STREAM_CLOSED`. The default provider retry policy excluded that code, so `dsh-llm-retry` delegated without retrying; the step failed, the turn ended in error, and goal-round-driver disarmed the goal on `agent/error`. Partially streamed output was discarded, but the whole interrupted task stopped instead of recovering.

## Decision

`STREAM_CLOSED` joins `EMPTY_RESPONSE`, `RATE_LIMIT`, `SERVER`, `TIMEOUT`, and `TRANSPORT` in the default normal-mode retryable codes (`DEFAULT_RETRYABLE_CODES` in `dsh-llm/src/retry-policy.ts`). A clean truncation without the terminal marker is a transient wire interruption: the failed attempt is never trusted as complete, its partial chunks never enter derived messages (no `assistant/message` is committed), so the retry reconstructs the identical durable surface and repeats the request under the bounded backoff budget. `dsh-llm` exports the canonical `STREAM_CLOSED_CODE` constant, and the deepseek, opencode-zen, and pi-ai adapters throw it.

This is the deferred "separate decision with its own cost, latency, and duplicate-generation trade-offs" recorded alongside [the scriptable LLM wire fault server](../../implemented/testing/2026-07-25-scriptable-llm-wire-fault-server.md): long autonomous tasks should outlive a single interrupted stream, bounded by the normal default of two retries.

## Alternatives considered

**Retry at the goal driver** — goal-round-driver could re-arm and re-drive a round after any error. Rejected because it duplicates the request-recovery seam: the driver deliberately does not classify activity (provider errors are not prompt-level goal outcomes), and request-level retry already reconstructs the same durable history without consuming additional round budget or changing model-visible input.

**Leave STREAM_CLOSED out of the default and require explicit `retryableCodes`** — the configuration surface already supports adding the code per deployment, but the reported failure is exactly a deployment that omitted `retryPolicy` and relied on the default. Keeping the default unchanged preserves the stop and ships no recovery.

**Fold the decision into the mock-server package** — rejected for the same reason as before the change: the wire fault server reveals semantics and must not be the place that decides retry policy. The default lives with the policy, and the mock server only exercises whichever policy the caller configures.

## Verification

The `retry-policy.spec.ts` suite asserts the extended default code set. `transport-recovery.spec.ts` routes `partial_eof` (a clean EOF without `[DONE]`) through the real HTTP/SSE adapter, `dsh-llm-deepseek`, `dsh-agent-loop`, and `dsh-llm-retry`, asserting two requests, identical request bodies, an `llm/retry` record whose failure code is `STREAM_CLOSED`, exactly one committed assistant message, and the recovered text. `retry.spec.ts` proves a thrown `STREAM_CLOSED` stream error retries under the default policy with no `retryableCodes` override.

## Consequences

A single interrupted stream no longer kills a long task: the loop retries with backoff, and the goal continues after the recovered attempt. The cost is the deferred trade-off — a provider that repeatedly truncates cleanly now spends a bounded retry budget (two retries by default) and the associated duplicate-generation latency instead of failing the turn immediately. Deployments that prefer the previous strict behavior list their own `retryableCodes` without `STREAM_CLOSED`.