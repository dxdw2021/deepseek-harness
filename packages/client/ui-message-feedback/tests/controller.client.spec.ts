import { describe, expect, it } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {
  MessageFeedbackDeleteResult,
  MessageFeedbackItem,
  MessageFeedbackListResult,
  MessageFeedbackPutResult,
  MessageFeedbackRating,
} from '@deepseek-ai/dsh-message-feedback/types'
import { MessageFeedbackController, type MessageFeedbackRemote } from '../src/client/controller.ts'

const sessionId = 'sess-1' as never
const messageId = 'msg-1' as never

function item(partial: Partial<MessageFeedbackItem>): MessageFeedbackItem {
  return {
    messageId,
    rating: 'positive',
    version: 'v1' as never,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  }
}

interface FakeRemote {
  remote: MessageFeedbackRemote
  putCalls: number
  deleteCalls: number
  listCalls: number
}

function fakeRemote(responses: {
  list?: RemoteResult<MessageFeedbackListResult>[]
  put?: RemoteResult<MessageFeedbackPutResult>[]
  delete?: RemoteResult<MessageFeedbackDeleteResult>[]
} = {}): FakeRemote {
  const state: FakeRemote = { remote: {} as MessageFeedbackRemote, putCalls: 0, deleteCalls: 0, listCalls: 0 }
  const listQueue = [...(responses.list ?? [])]
  const putQueue = [...(responses.put ?? [])]
  const deleteQueue = [...(responses.delete ?? [])]
  state.remote = {
    list: () => {
      state.listCalls += 1
      const next = listQueue.shift()
      return next === undefined
        ? Promise.resolve({ ok: true as const, value: { ok: true as const, value: { items: [] } } })
        : Promise.resolve(next)
    },
    put: (request) => {
      state.putCalls += 1
      const next = putQueue.shift()
      return next === undefined
        ? Promise.resolve({
          ok: true as const,
          value: {
            ok: true as const,
            value: item({
              rating: request.rating,
              ...(request.note === undefined ? {} : { note: request.note }),
              version: `v${state.putCalls}` as never,
              updatedAt: state.putCalls,
            }),
          },
        })
        : Promise.resolve(next)
    },
    delete: () => {
      state.deleteCalls += 1
      const next = deleteQueue.shift()
      return next === undefined
        ? Promise.resolve({ ok: true as const, value: { ok: true as const, value: { absent: true } } })
        : Promise.resolve(next)
    },
  }
  return state
}

describe('MessageFeedbackController', () => {
  it('starts cold with no items', () => {
    const controller = new MessageFeedbackController(fakeRemote().remote, sessionId)
    const view = controller.getSnapshot()
    expect(view.status).toBe('cold')
    expect(view.items.size).toBe(0)
  })

  it('seeds from list on ensure and publishes the ready view', async () => {
    const seeded = item({ rating: 'negative' })
    const { remote } = fakeRemote({
      list: [{ ok: true as const, value: { ok: true as const, value: { items: [seeded] } } }],
    })
    const controller = new MessageFeedbackController(remote, sessionId)
    const result = await controller.ensure()
    expect(result).toEqual({ ok: true })
    const view = controller.getSnapshot()
    expect(view.status).toBe('ready')
    expect(view.items.get(messageId)).toEqual(seeded)
  })

  it('rates an unknown message through put and commits the reply', async () => {
    const fake = fakeRemote()
    const controller = new MessageFeedbackController(fake.remote, sessionId)
    const result = await controller.rate(messageId, 'positive' as MessageFeedbackRating, 'good')
    expect(result).toEqual({ ok: true })
    expect(fake.putCalls).toBe(1)
    expect(controller.getSnapshot().items.get(messageId)?.rating).toBe('positive')
    expect(controller.getSnapshot().items.get(messageId)?.note).toBe('good')
  })

  it('toggles to delete when the committed rating already matches', async () => {
    const existing = item({ rating: 'positive' })
    const fake = fakeRemote({
      list: [{ ok: true as const, value: { ok: true as const, value: { items: [existing] } } }],
    })
    const controller = new MessageFeedbackController(fake.remote, sessionId)
    await controller.ensure()
    const result = await controller.toggle(messageId, 'positive')
    expect(result).toEqual({ ok: true })
    expect(fake.deleteCalls).toBe(1)
    expect(controller.getSnapshot().items.has(messageId)).toBe(false)
  })

  it('clears without a call when the message has no feedback', async () => {
    const { remote, deleteCalls } = fakeRemote()
    const controller = new MessageFeedbackController(remote, sessionId)
    const result = await controller.clear(messageId)
    expect(result).toEqual({ ok: true })
    expect(deleteCalls).toBe(0)
  })

  it('reconciles a version conflict from the authoritative reply', async () => {
    const authoritative = item({ rating: 'negative', version: 'v9' as never })
    const { remote } = fakeRemote({
      put: [{ ok: true as const, value: { ok: false as const, error: { code: 'version-conflict' as const, current: authoritative } } }],
    })
    const controller = new MessageFeedbackController(remote, sessionId)
    const result = await controller.rate(messageId, 'positive')
    expect(result).toEqual({ ok: false, error: { code: 'version-conflict', message: 'feedback changed elsewhere' } })
    expect(controller.getSnapshot().items.get(messageId)).toEqual(authoritative)
  })

  it('publishes the error status when the list fails with a business code', async () => {
    const { remote } = fakeRemote({
      list: [{ ok: true as const, value: { ok: false as const, error: { code: 'session-not-found' as const, sessionId } } }],
    })
    const controller = new MessageFeedbackController(remote, sessionId)
    const result = await controller.ensure()
    expect(result).toEqual({ ok: false, error: { code: 'session-not-found', message: 'this session is no longer persisted' } })
    const view = controller.getSnapshot()
    expect(view.status).toBe('error')
    expect(view.error).toBe('this session is no longer persisted')
  })

  it('maps a transport rejection to the error status', async () => {
    const remote: MessageFeedbackRemote = {
      list: () => Promise.reject(new Error('offline')),
      put: () => Promise.reject(new Error('offline')),
      delete: () => Promise.reject(new Error('offline')),
    }
    const controller = new MessageFeedbackController(remote, sessionId)
    const result = await controller.ensure()
    expect(result).toEqual({ ok: false, error: { code: 'transport', message: 'offline' } })
    const view = controller.getSnapshot()
    expect(view.status).toBe('error')
    expect(view.error).toBe('offline')
  })

  it('refuses operations after dispose', async () => {
    const { remote } = fakeRemote()
    const controller = new MessageFeedbackController(remote, sessionId)
    controller.dispose()
    const result = await controller.rate(messageId, 'positive')
    expect(result).toEqual({ ok: false, error: { code: 'disposed', message: 'feedback controller is disposed' } })
  })

  it('notifies subscribers on publish', async () => {
    const { remote } = fakeRemote()
    const controller = new MessageFeedbackController(remote, sessionId)
    let notified = 0
    const unsubscribe = controller.subscribe(() => { notified += 1 })
    await controller.ensure()
    expect(notified).toBeGreaterThan(0)
    unsubscribe()
    const before = notified
    await controller.ensure()
    expect(notified).toBe(before)
  })
})
