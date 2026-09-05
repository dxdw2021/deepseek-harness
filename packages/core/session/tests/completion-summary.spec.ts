import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, {
  KNOWN_SESSION_EVENT_TYPES,
  Session,
  SessionId,
  validateCompletionSummaryData,
  type CompletionSummaryEventData,
} from '@deepseek-ai/dsh-session'
import * as SessionInvariant from '@deepseek-ai/dsh-session/invariant'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'

async function setup(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(InvariantRegistry)
  await ctx.plugin(SessionInvariant)
  return ctx
}

/** A well-formed delivery summary payload. */
const VALID_SUMMARY: CompletionSummaryEventData = {
  preset: 'feature',
  verdict: 'success',
  mutations: 3,
  checks: { passed: 4, failed: 0, suppressed: 0, skipped: 1 },
  review: 'approved',
  gapKinds: [],
  constraintDegraded: false,
  note: 'delivered',
}

describe('completion/summary event', () => {
  it('is part of the known durable event vocabulary', () => {
    expect(KNOWN_SESSION_EVENT_TYPES.has('completion/summary')).toBe(true)
  })

  it('append outside any open turn (log-only, standalone) succeeds', async () => {
    const ctx = await setup()
    const session = ctx.sessions.create(SessionId('standalone-summary'))
    expect(() => session.append('completion/summary', VALID_SUMMARY)).not.toThrow()
    const last = session.events.at(-1)
    expect(last?.type).toBe('completion/summary')
    expect(last?.data).toEqual(VALID_SUMMARY)
  })

  it('survives replay from a seeded log', async () => {
    await setup()
    const seed = [{
      type: 'completion/summary' as const,
      seq: 0,
      time: 1,
      data: VALID_SUMMARY,
    }]
    const session = Session.create(SessionId('replay-summary'), seed)
    const appended = session.events.find(e => e.type === 'completion/summary')
    expect(appended?.data).toEqual(VALID_SUMMARY)
  })

  it('rejects a non-JSON-serializable payload at append', async () => {
    const ctx = await setup()
    const session = ctx.sessions.create(SessionId('non-json-summary'))
    const withBigInt = {
      ...VALID_SUMMARY,
      // BigInt is not lossless-JSON serializable; Session.append runtime-validates.
      mutations: 3n,
    } as unknown as CompletionSummaryEventData
    expect(() => { session.append('completion/summary', withBigInt) }).toThrow()
  })

  it('validateCompletionSummaryData accepts a minimal valid payload', () => {
    expect(() => {
      validateCompletionSummaryData({
        preset: 'default',
        verdict: 'failure',
        mutations: 0,
        checks: { passed: 0, failed: 1, suppressed: 0, skipped: 0 },
        review: 'pending',
      })
    }).not.toThrow()
  })

  it('validateCompletionSummaryData rejects a bad verdict', () => {
    expect(() => {
      validateCompletionSummaryData({
        ...VALID_SUMMARY,
        verdict: 'maybe' as CompletionSummaryEventData['verdict'],
      })
    }).toThrow(/verdict/)
  })

  it('validateCompletionSummaryData rejects negative mutations', () => {
    expect(() => {
      validateCompletionSummaryData({ ...VALID_SUMMARY, mutations: -1 })
    })
      .toThrow(/mutations/)
  })

  it('validateCompletionSummaryData rejects a negative check count', () => {
    expect(() => {
      validateCompletionSummaryData({
        ...VALID_SUMMARY,
        checks: { passed: -1, failed: 0, suppressed: 0, skipped: 0 },
      })
    }).toThrow(/checks\.passed/)
  })

  it('validateCompletionSummaryData rejects a bad review', () => {
    expect(() => {
      validateCompletionSummaryData({
        ...VALID_SUMMARY,
        review: 'ok' as CompletionSummaryEventData['review'],
      })
    }).toThrow(/review/)
  })

  it('validateCompletionSummaryData rejects non-string gapKinds entries', () => {
    expect(() => {
      validateCompletionSummaryData({
        ...VALID_SUMMARY,
        gapKinds: ['missing-tests', 7] as unknown as string[],
      })
    }).toThrow(/gapKinds/)
  })
})
