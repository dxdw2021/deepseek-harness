import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ExecutionModeService } from '../src/index.ts'

describe('ExecutionModeService', () => {
  it('defaults to the balanced mode', () => {
    const service = new ExecutionModeService(new Context())
    expect(service.getCurrentMode()).toBe('balanced')
  })

  it('records each previous mode in history as it switches', () => {
    const service = new ExecutionModeService(new Context())
    service.setMode('light')
    service.setMode('delivery')
    expect(service.getCurrentMode()).toBe('delivery')
    expect(service.getHistory()).toEqual(['balanced', 'light'])
  })

  it('resetToDefault returns to the balanced default', () => {
    const service = new ExecutionModeService(new Context())
    service.setMode('light')
    service.resetToDefault()
    expect(service.getCurrentMode()).toBe('balanced')
  })
})
