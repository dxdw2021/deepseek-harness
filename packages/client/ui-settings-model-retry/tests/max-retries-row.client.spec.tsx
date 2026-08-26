// @vitest-environment jsdom
/** MaxRetriesRow behavior: shows the current value, and a valid non-negative
 * integer input drives setMaxRetries; out-of-range or non-integer input does not. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { MaxRetriesRow } from '../src/client/MaxRetriesRow.tsx'
import type { MaxRetriesRowComponentProps } from '../src/client/MaxRetriesRow.tsx'
import { createMaxRetriesStore } from '../src/client/store.ts'

afterEach(cleanup)

/** Empty global standard-kit hooks (the row reads neither). */
function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  return bindSnapshotSelector(store)
}
function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  return bindSnapshotSelector(store)
}

function mount(value: number | undefined = 2) {
  const store = createMaxRetriesStore().create()
  store.actions.sync(value, 0)
  const setMaxRetries = vi.fn()
  const props: MaxRetriesRowComponentProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    t: (key: string) => key,
    setMaxRetries,
  }
  render(<MaxRetriesRow {...props} />)
  return { store, setMaxRetries }
}

describe('createMaxRetriesStore', () => {
  it('starts empty and mirrors a sync', () => {
    const h = createMaxRetriesStore().create()
    expect(h.getSnapshot()).toEqual({ value: undefined, revision: 0 })
    h.actions.sync(3, 7)
    expect(h.getSnapshot()).toEqual({ value: 3, revision: 7 })
  })
})

describe('MaxRetriesRow', () => {
  it('renders the title and the current value', () => {
    mount(2)
    expect(screen.getByText('maxRetries.title')).toBeDefined()
    expect(screen.getByDisplayValue('2')).toBeDefined()
  })

  it('writes a valid non-negative integer', () => {
    const b = mount(2)
    const input = screen.getByDisplayValue('2') as HTMLInputElement
    fireEvent.change(input, { target: { value: '5' } })
    expect(b.setMaxRetries).toHaveBeenCalledWith(5)
  })

  it('ignores non-integer and out-of-range input', () => {
    const b = mount(2)
    const input = screen.getByDisplayValue('2') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.change(input, { target: { value: '1.5' } })
    fireEvent.change(input, { target: { value: '-1' } })
    expect(b.setMaxRetries).not.toHaveBeenCalled()
  })

  it('follows a store update', () => {
    const b = mount(2)
    act(() => { b.store.actions.sync(9, 1) })
    expect(screen.getByDisplayValue('9')).toBeDefined()
  })
})
