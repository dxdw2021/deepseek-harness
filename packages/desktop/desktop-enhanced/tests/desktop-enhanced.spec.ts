import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { DesktopEnhancedService, type KeyboardShortcut, type NotificationOptions } from '../src/index.ts'

describe('DesktopEnhancedService', () => {
  it('starts enabled with the system theme and the builtin light/dark themes', () => {
    const service = new DesktopEnhancedService(new Context())
    expect(service.getConfig().themeId).toBe('system')
    expect(service.getThemes().map(t => t.id)).toEqual(['light', 'dark'])
    expect(service.getThemes().every(t => t.builtin)).toBe(true)
  })

  it('sets only known themes', () => {
    const service = new DesktopEnhancedService(new Context())
    expect(service.setTheme('dark')).toBe(true)
    expect(service.getCurrentTheme()?.id).toBe('dark')
    expect(service.setTheme('nope')).toBe(false)
    expect(service.getCurrentTheme()?.id).toBe('dark')
  })

  it('registers and removes custom themes but never builtin ones', () => {
    const service = new DesktopEnhancedService(new Context())
    const custom = { ...service.getThemes()[0]!, id: 'ocean', name: 'Ocean', type: 'custom' as const, builtin: false }
    service.registerTheme(custom)
    expect(service.getThemes().map(t => t.id)).toEqual(['light', 'dark', 'ocean'])
    expect(service.removeTheme('light')).toBe(false)
    expect(service.removeTheme('ocean')).toBe(true)
    expect(service.getThemes().map(t => t.id)).toEqual(['light', 'dark'])
  })

  it('executes enabled shortcuts and ignores missing or disabled ones', () => {
    const service = new DesktopEnhancedService(new Context())
    const action = vi.fn()
    const shortcut: KeyboardShortcut = { id: 'run', description: 'run', keys: 'Ctrl+R', action, enabled: true }
    service.registerShortcut(shortcut)
    expect(service.executeShortcut('run')).toBe(true)
    expect(action).toHaveBeenCalledOnce()
    expect(service.executeShortcut('missing')).toBe(false)
    shortcut.enabled = false
    expect(service.executeShortcut('run')).toBe(false)
    expect(service.removeShortcut('run')).toBe(true)
    expect(service.getShortcuts()).toEqual([])
  })

  it('emits notification events only while notifications are enabled', () => {
    const ctx = new Context()
    const shown: string[] = []
    ctx.on('desktop-enhanced/notification-shown', (options: NotificationOptions) => shown.push(options.title))
    const service = new DesktopEnhancedService(ctx)
    service.showNotification({ title: 't', message: 'm', type: 'info' })
    expect(shown).toEqual(['t'])
    service.updateConfig({ enableNotifications: false })
    service.showNotification({ title: 't2', message: 'm', type: 'info' })
    expect(shown).toEqual(['t'])
  })
})
