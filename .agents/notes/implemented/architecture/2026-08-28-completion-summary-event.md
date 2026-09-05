# completion/summary session event

- Date: 2026-08-28
- Area: `packages/core/session` (durable event vocabulary)
- Kind: foundation

## Why

A delivery needs a structured, reconstructable verdict in the session log. Today
the harness records turns, steps, and tool pairs, but nothing captures the
*outcome* of a delivered result (a goal completion, a subagent hand-back, or an
explicit summarize step): the checks that ran, the mutations made, and the
review disposition. Downstream surfaces (a desktop "overview" dock, a
delivery report) currently have no durable source for that summary.

The reference desktop app models this as `WireCompletionSummary`, rendered in
the workspace panel's completion card. This note adds the durable vocabulary
that such a surface consumes, following the harness's "model-visible ⟺ logged"
rule: any delivery verdict worth showing must be reconstructable from the log.

## What changed

- Added one `SessionEventMap` member, `'completion/summary'`, in
  `packages/core/session/src/types.ts` (the owning vocabulary; top-level
  interface, not a plugin `declare module` merge).
- Defined `CompletionSummaryEventData` and its value unions
  (`CompletionVerdict`, `CompletionReview`, `CompletionChecks`) next to the
  existing `TodoItem` block.
- Added `validateCompletionSummaryData(data)` — a pure guard asserting the
  semantic bounds (non-empty `preset`, closed `verdict`/`review` enums,
  non-negative `mutations` and per-check counts, optional fields typed). It
  fails loud at the producer boundary; `Session.append` already enforces
  JSON-serializability separately via `isJsonValue`.
- `completion/summary` is **log-only**: it produces no derived-history message
  and carries no `surfaceOp`. The session invariant's merge-extensible
  `default` branch accepts it without turn-enclosure, so a producer may append
  it standalone after a turn closes.
- Regenerated `packages/core/session/src/known-event-types.ts` and
  `docs/persistence-catalog.md` via `scripts/gen-persistence-catalog.ts`
  (the `completion/summary` entry now lives under the generated `completion/*`
  section). No `SESSION_FORMAT_VERSION` bump: this is ordinary vocabulary
  growth, covered by the per-event `ignorable` guard.
- Added `packages/core/session/tests/completion-summary.spec.ts` covering the
  known-vocabulary set, standalone append, replay, JSON-serializability
  rejection, and every `validateCompletionSummaryData` rejection path.

## Contract

```ts
'completion/summary': CompletionSummaryEventData
```

```ts
interface CompletionSummaryEventData {
  preset: string
  verdict: 'success' | 'partial' | 'failure'
  mutations: number
  checks: { passed: number; failed: number; suppressed: number; skipped: number }
  review: 'approved' | 'changes_requested' | 'pending' | 'not_required'
  gapKinds?: string[]
  constraintDegraded?: boolean
  note?: string
}
```

- The producer owns the `preset` and `gapKinds` vocabulary; a reader treats
  them opaquely.
- The latest write wins on any projection; older summaries remain in the log
  for audit.
- The shape is JSON-serializable; `Session.append` rejects non-serializable
  payloads independently of `validateCompletionSummaryData`.

## Deliberately out of scope

- **Producer**: no capability appends `completion/summary` yet. The agent loop,
  a goal completion, or a subagent hand-back will emit it when a delivery
  summary is available. This note only lands the vocabulary + validation.
- **Projection**: a `session-projection` unit (last-write-wins
  `completionSummary`) is a separate change; the event is replayable without it.
- **Agent Note i18n**: a `.zh.md` companion records the same facts.

## Verification

`node node_modules/.pnpm/vitest@*/node_modules/vitest/vitest.mjs run packages/core/session/tests/completion-summary.spec.ts`
— 10/10 passing. `pnpm run gen-persistence-catalog` regenerates
`known-event-types.ts` and the catalog consistently with the source merge.
