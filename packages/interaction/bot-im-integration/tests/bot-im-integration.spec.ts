import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { BotImIntegrationService, type BotMessage } from '../src/index.ts'

function message(overrides: Partial<BotMessage> = {}): BotMessage {
  return {
    id: 'm1',
    platform: 'feishu',
    senderId: 'u1',
    senderName: 'User',
    chatId: 'c1',
    type: 'text',
    content: 'hello',
    timestamp: new Date(),
    ...overrides,
  }
}

describe('BotImIntegrationService', () => {
  it('starts enabled with the / prefix and auto-reply on', () => {
    const service = new BotImIntegrationService(new Context())
    const config = service.getConfig()
    expect(config.enabled).toBe(true)
    expect(config.commandPrefix).toBe('/')
    expect(config.enableAutoReply).toBe(true)
  })

  it('configures, lists and removes platforms', () => {
    const service = new BotImIntegrationService(new Context())
    service.configurePlatform({ type: 'feishu', appId: 'a', appSecret: 's' })
    expect(service.getConfiguredPlatforms()).toEqual(['feishu'])
    expect(service.getPlatformConfig('feishu')?.appId).toBe('a')
    expect(service.removePlatform('feishu')).toBe(true)
    expect(service.getConfiguredPlatforms()).toEqual([])
    expect(service.removePlatform('feishu')).toBe(false)
  })

  it('falls back to the auto-reply when no handler answers', async () => {
    const service = new BotImIntegrationService(new Context())
    const response = await service.processMessage(message())
    expect(response?.content).toBe('I received your message.')
  })

  it('routes commands through command handlers', async () => {
    const service = new BotImIntegrationService(new Context())
    service.on('command', async () => ({ content: 'status ok', type: 'text' }))
    const response = await service.processMessage(message({ content: '/status' }))
    expect(response?.content).toBe('status ok')
  })

  it('returns an unknown-command reply when no command handler matches', async () => {
    const service = new BotImIntegrationService(new Context())
    const response = await service.processMessage(message({ content: '/nope' }))
    expect(response?.content).toBe('Unknown command: nope')
  })

  it('returns null for messages while disabled', async () => {
    const service = new BotImIntegrationService(new Context())
    service.updateConfig({ enabled: false })
    expect(await service.processMessage(message())).toBeNull()
  })

  it('refuses to send without a platform configuration', async () => {
    const service = new BotImIntegrationService(new Context())
    expect(await service.sendMessage('feishu', 'c1', { content: 'hi', type: 'text' })).toBe(false)
  })

  it('keeps a bounded message history', async () => {
    const service = new BotImIntegrationService(new Context())
    service.updateConfig({ enableAutoReply: false })
    await service.processMessage(message({ id: 'm1' }))
    await service.processMessage(message({ id: 'm2' }))
    expect(service.getMessageHistory()).toHaveLength(2)
    expect(service.getMessageHistory(1)[0]?.id).toBe('m2')
    service.clearMessageHistory()
    expect(service.getMessageHistory()).toEqual([])
  })
})
