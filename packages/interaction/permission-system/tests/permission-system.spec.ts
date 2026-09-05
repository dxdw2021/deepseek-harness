import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { PermissionSystemService, type PermissionRule } from '../src/index.ts'

function allowRule(overrides: Partial<PermissionRule> = {}): Omit<PermissionRule, 'id'> {
  return {
    description: 'allow read',
    resourceType: 'file',
    resourcePattern: '*',
    actions: ['read'],
    priority: 10,
    enabled: true,
    ...overrides,
  }
}

describe('PermissionSystemService', () => {
  it('defaults to the deny policy', () => {
    const service = new PermissionSystemService(new Context())
    expect(service.getConfig().defaultPolicy).toBe('deny')
  })

  it('denies by default when no rule matches', () => {
    const service = new PermissionSystemService(new Context())
    const result = service.checkPermission('u', 'file', 'x.txt', 'read')
    expect(result.granted).toBe(false)
    expect(result.reason).toBe('Default deny policy')
  })

  it('grants through a matching rule and records the rule id', () => {
    const service = new PermissionSystemService(new Context())
    const rule = service.addRule(allowRule())
    const result = service.checkPermission('u', 'file', 'x.txt', 'read')
    expect(result.granted).toBe(true)
    expect(result.ruleId).toBe(rule.id)
  })

  it('matches resource patterns with glob semantics', () => {
    const service = new PermissionSystemService(new Context())
    service.addRule(allowRule({ resourcePattern: 'src/**' }))
    expect(service.checkPermission('u', 'file', 'src/index.ts', 'read').granted).toBe(true)
    expect(service.checkPermission('u', 'file', 'lib/index.js', 'read').granted).toBe(false)
  })

  it('updates and removes rules', () => {
    const service = new PermissionSystemService(new Context())
    const rule = service.addRule(allowRule({ actions: ['read'] }))
    service.updateRule(rule.id, { actions: ['read', 'write'] })
    expect(service.getRule(rule.id)?.actions).toEqual(['read', 'write'])
    expect(service.removeRule(rule.id)).toBe(true)
    expect(service.getRule(rule.id)).toBeUndefined()
    expect(service.removeRule(rule.id)).toBe(false)
  })

  it('grants everything while disabled', () => {
    const service = new PermissionSystemService(new Context())
    service.updateConfig({ enabled: false })
    expect(service.checkPermission('u', 'file', 'x.txt', 'write').granted).toBe(true)
  })

  it('writes and trims the audit log on permission checks', () => {
    const service = new PermissionSystemService(new Context())
    service.checkPermission('u', 'file', 'x.txt', 'read')
    service.checkPermission('u', 'file', 'y.txt', 'write')
    expect(service.getAuditLogCount()).toBe(2)
    expect(service.getAuditLog(1)).toHaveLength(1)
    service.clearAuditLog()
    expect(service.getAuditLogCount()).toBe(0)
  })
})
