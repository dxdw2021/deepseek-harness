import { describe, expect, it } from 'vitest'
import { PromptHistory } from '../../../src/client/input/history.ts'

describe('PromptHistory', () => {
  it('push empty draft is a no-op', () => {
    const history = new PromptHistory()
    history.push('')
    expect(history.up('current')).toBe(null)
  })

  it('push whitespace-only draft is a no-op', () => {
    const history = new PromptHistory()
    history.push('   ')
    history.push('\t\n')
    expect(history.up('current')).toBe(null)
  })

  it('push non-empty draft adds to front', () => {
    const history = new PromptHistory()
    history.push('hello')
    expect(history.up('current')).toBe('hello')
  })

  it('push duplicates are skipped', () => {
    const history = new PromptHistory()
    history.push('hello')
    history.push('hello')
    expect(history.up('current')).toBe('hello')
    // After consuming the one entry, next up should be null
    expect(history.up('current')).toBe(null)
  })

  it('up from empty history returns null', () => {
    const history = new PromptHistory()
    expect(history.up('current')).toBe(null)
  })

  it('up from empty history while currently has content returns null and does not capture pending', () => {
    const history = new PromptHistory()
    expect(history.up('something')).toBe(null)
    // down should also be null (index never moved)
    expect(history.down()).toBe(null)
  })

  it('up captures current draft as pending and returns first entry', () => {
    const history = new PromptHistory()
    history.push('first')
    const result = history.up('current-draft')
    expect(result).toBe('first')
  })

  it('up navigates through multiple entries newest-first', () => {
    const history = new PromptHistory()
    history.push('oldest')
    history.push('middle')
    history.push('newest')
    expect(history.up('current')).toBe('newest')
    expect(history.up('current')).toBe('middle')
    expect(history.up('current')).toBe('oldest')
    expect(history.up('current')).toBe(null)
  })

  it('down from not-navigating returns null', () => {
    const history = new PromptHistory()
    history.push('first')
    expect(history.down()).toBe(null)
  })

  it('down after one up restores pending', () => {
    const history = new PromptHistory()
    history.push('first')
    expect(history.up('my-draft')).toBe('first')
    expect(history.down()).toBe('my-draft')
    expect(history.down()).toBe(null)
  })

  it('down navigates through entries newest-to-oldest then pending', () => {
    const history = new PromptHistory()
    history.push('oldest')
    history.push('middle')
    history.push('newest')
    expect(history.up('current')).toBe('newest')
    expect(history.up('current')).toBe('middle')
    expect(history.up('current')).toBe('oldest')
    // now at deepest, going back
    expect(history.down()).toBe('middle')
    expect(history.down()).toBe('newest')
    expect(history.down()).toBe('current')
    expect(history.down()).toBe(null)
  })

  it('push after navigation starts does not affect current navigation index', () => {
    const history = new PromptHistory()
    history.push('old')
    expect(history.up('current')).toBe('old')
    // Push a new entry while navigating (simulating user submits during nav)
    history.push('newer')
    // Down should still work based on previous navigation state
    expect(history.down()).toBe('current')
    expect(history.down()).toBe(null)
  })

  it('push after navigation does not add duplicate to front', () => {
    const history = new PromptHistory()
    history.push('same')
    history.push('same')
    expect(history.up('current')).toBe('same')
    expect(history.up('current')).toBe(null)
  })
})