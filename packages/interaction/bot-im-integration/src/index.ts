/**
 * Bot/IM integration service for DeepSeek Harness.
 * Provides integration with messaging platforms like Feishu/Lark, WeChat, QQ.
 *
 * @module @deepseek-ai/dsh-bot-im-integration
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Platform types */
export type PlatformType = 'feishu' | 'lark' | 'wechat' | 'qq' | 'telegram' | 'slack' | 'discord'

/** Message types */
export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'video' | 'location' | 'card'

/** Bot message */
export interface BotMessage {
  /** Message ID */
  id: string
  /** Platform type */
  platform: PlatformType
  /** Sender ID */
  senderId: string
  /** Sender name */
  senderName: string
  /** Chat/group ID */
  chatId: string
  /** Chat/group name */
  chatName?: string
  /** Message type */
  type: MessageType
  /** Message content */
  content: string
  /** Message timestamp */
  timestamp: Date
  /** Reply to message ID */
  replyTo?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/** Bot response */
export interface BotResponse {
  /** Response content */
  content: string
  /** Response type */
  type: MessageType
  /** Reply to message ID */
  replyTo?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/** Platform configuration */
export interface PlatformConfig {
  /** Platform type */
  type: PlatformType
  /** App ID */
  appId: string
  /** App Secret */
  appSecret: string
  /** Verification token */
  verificationToken?: string
  /** Encrypt key */
  encryptKey?: string
  /** Webhook URL */
  webhookUrl?: string
  /** Bot name */
  botName?: string
  /** Bot avatar URL */
  botAvatar?: string
  /** Additional platform-specific config */
  extra?: Record<string, unknown>
}

/** Bot event handler */
export interface BotEventHandler {
  /** Event name */
  event: string
  /** Event handler function */
  handler: (message: BotMessage) => Promise<BotResponse | null>
}

/** Bot IM integration configuration */
export interface BotImIntegrationConfig {
  /** Enable bot integration */
  enabled: boolean
  /** Enabled platforms */
  platforms: PlatformType[]
  /** Bot command prefix */
  commandPrefix: string
  /** Enable auto-reply */
  enableAutoReply: boolean
  /** Auto-reply message */
  autoReplyMessage: string
  /** Maximum message length */
  maxMessageLength: number
  /** Enable message logging */
  enableMessageLogging: boolean
}

/** Bot IM integration service definition */
export class BotImIntegrationService extends Service {
  static inject = ['settings', 'toolRegistry']

  /** Platform configurations */
  private platformConfigs: Map<PlatformType, PlatformConfig> = new Map()

  /** Event handlers */
  private eventHandlers: Map<string, BotEventHandler[]> = new Map()

  /** Message history */
  private messageHistory: BotMessage[] = []

  /** Configuration */
  private config: BotImIntegrationConfig = {
    enabled: true,
    platforms: [],
    commandPrefix: '/',
    enableAutoReply: true,
    autoReplyMessage: 'I received your message.',
    maxMessageLength: 4096,
    enableMessageLogging: true,
  }

  constructor(ctx: Context) {
    super(ctx, 'botImIntegration')
  }

  /** Configure a platform */
  configurePlatform(platformConfig: PlatformConfig): void {
    if (!this.config.enabled) {
      throw new Error('Bot IM integration is disabled')
    }

    this.platformConfigs.set(platformConfig.type, platformConfig)
    this.ctx.emit('bot-im-integration/platform-configured', platformConfig.type)
  }

  /** Remove platform configuration */
  removePlatform(platform: PlatformType): boolean {
    const removed = this.platformConfigs.delete(platform)
    if (removed) {
      this.ctx.emit('bot-im-integration/platform-removed', platform)
    }
    return removed
  }

  /** Get platform configuration */
  getPlatformConfig(platform: PlatformType): PlatformConfig | undefined {
    return this.platformConfigs.get(platform)
  }

  /** Get all configured platforms */
  getConfiguredPlatforms(): PlatformType[] {
    return Array.from(this.platformConfigs.keys())
  }

  /** Register event handler */
  on(event: string, handler: (message: BotMessage) => Promise<BotResponse | null>): () => void {
    const handlers = this.eventHandlers.get(event) || []
    const newHandler: BotEventHandler = { event, handler }
    handlers.push(newHandler)
    this.eventHandlers.set(event, handlers)

    // Return disposer
    return () => {
      const currentHandlers = this.eventHandlers.get(event) || []
      const index = currentHandlers.indexOf(newHandler)
      if (index >= 0) {
        currentHandlers.splice(index, 1)
      }
    }
  }

  /** Process incoming message */
  async processMessage(message: BotMessage): Promise<BotResponse | null> {
    if (!this.config.enabled) {
      return null
    }

    // Log message
    if (this.config.enableMessageLogging) {
      this.messageHistory.push(message)

      // Trim history if needed
      if (this.messageHistory.length > 1000) {
        this.messageHistory = this.messageHistory.slice(-1000)
      }
    }

    // Emit message received event
    this.ctx.emit('bot-im-integration/message-received', message)

    // Check if it's a command
    if (message.content.startsWith(this.config.commandPrefix)) {
      return this.processCommand(message)
    }

    // Process through event handlers
    const handlers = this.eventHandlers.get('message') || []
    for (const { handler } of handlers) {
      try {
        const response = await handler(message)
        if (response) {
          this.ctx.emit('bot-im-integration/message-sent', message.id, response)
          return response
        }
      } catch (error) {
        // Continue with other handlers
      }
    }

    // Auto-reply if enabled
    if (this.config.enableAutoReply) {
      return {
        content: this.config.autoReplyMessage,
        type: 'text',
      }
    }

    return null
  }

  /** Process command */
  private async processCommand(message: BotMessage): Promise<BotResponse | null> {
    const command = message.content.slice(this.config.commandPrefix.length).trim()
    const [commandName, ...args] = command.split(/\s+/)

    // Emit command received event
    if (commandName) {
      this.ctx.emit('bot-im-integration/command-received', message.id, commandName, args)
    }

    // Process through command handlers
    const handlers = this.eventHandlers.get('command') || []
    for (const { handler } of handlers) {
      try {
        const response = await handler(message)
        if (response) {
          if (commandName) {
            this.ctx.emit('bot-im-integration/command-executed', message.id, commandName, true)
          }
          return response
        }
      } catch (error) {
        // Continue with other handlers
      }
    }

    // Unknown command
    return {
      content: commandName ? `Unknown command: ${commandName}` : 'Invalid command',
      type: 'text',
    }
  }

  /** Send message to platform */
  async sendMessage(platform: PlatformType, chatId: string, response: BotResponse): Promise<boolean> {
    const platformConfig = this.platformConfigs.get(platform)
    if (!platformConfig) {
      return false
    }

    // In a real implementation, this would send the message through the platform API
    // For now, emit an event
    this.ctx.emit('bot-im-integration/message-send-requested', platform, chatId, response)

    return true
  }

  /** Get message history */
  getMessageHistory(limit?: number): BotMessage[] {
    if (limit) {
      return this.messageHistory.slice(-limit)
    }
    return [...this.messageHistory]
  }

  /** Clear message history */
  clearMessageHistory(): void {
    this.messageHistory = []
    this.ctx.emit('bot-im-integration/history-cleared')
  }

  /** Update configuration */
  updateConfig(config: Partial<BotImIntegrationConfig>): void {
    this.config = { ...this.config, ...config }
    this.ctx.emit('bot-im-integration/config-changed', this.config)
  }

  /** Get configuration */
  getConfig(): BotImIntegrationConfig {
    return { ...this.config }
  }
}

/** Plugin configuration */
export interface Config {
  /** Enable bot integration */
  enabled?: boolean
  /** Enabled platforms */
  platforms?: PlatformType[]
  /** Bot command prefix */
  commandPrefix?: string
  /** Enable auto-reply */
  enableAutoReply?: boolean
  /** Auto-reply message */
  autoReplyMessage?: string
  /** Maximum message length */
  maxMessageLength?: number
  /** Enable message logging */
  enableMessageLogging?: boolean
}

/**
 * Create bot IM integration plugin.
 * @param config - plugin configuration.
 * @returns the Cordis plugin.
 */
export function createBotImIntegrationPlugin(config: Config = {}): {
  name: string
  inject: string[]
  apply: (ctx: Context) => void
} {
  return {
    name: 'bot-im-integration',
    inject: ['settings', 'toolRegistry'],
    apply(ctx) {
      const service = new BotImIntegrationService(ctx)
      ctx.botImIntegration = service

      // Apply configuration
      if (Object.keys(config).length > 0) {
        service.updateConfig(config)
      }

      // Register settings section
      ctx.effect(() => {
        const scope = ctx.settings.register(
          settingsNamespace('bot-im-integration'),
          z.object({
            enabled: z.boolean().default(true),
            platforms: z.array(z.union([
              z.const('feishu'),
              z.const('lark'),
              z.const('wechat'),
              z.const('qq'),
              z.const('telegram'),
              z.const('slack'),
              z.const('discord'),
            ])).default([]),
            commandPrefix: z.string().default('/'),
            enableAutoReply: z.boolean().default(true),
            autoReplyMessage: z.string().default('I received your message.'),
            maxMessageLength: z.number().min(100).max(10000).default(4096),
            enableMessageLogging: z.boolean().default(true),
          }),
          {
            base: {
              enabled: true,
              platforms: [],
              commandPrefix: '/',
              enableAutoReply: true,
              autoReplyMessage: 'I received your message.',
              maxMessageLength: 4096,
              enableMessageLogging: true,
            },
          },
        )

        // Watch for settings changes
        scope.watch((next) => {
          service.updateConfig(next)
        })

        return () => {
          // Cleanup
        }
      })
    },
  }
}

// Type augmentation for Cordis context
declare module '@deepseek-ai/cordis' {
  interface Context {
    botImIntegration: BotImIntegrationService
  }
}

// Event declarations
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Platform configured.
     * @param platform - platform type.
     * @mode emit
     */
    'bot-im-integration/platform-configured'(platform: PlatformType): void

    /**
     * Platform removed.
     * @param platform - platform type.
     * @mode emit
     */
    'bot-im-integration/platform-removed'(platform: PlatformType): void

    /**
     * Message received.
     * @param message - received message.
     * @mode emit
     */
    'bot-im-integration/message-received'(message: BotMessage): void

    /**
     * Message sent.
     * @param messageId - original message ID.
     * @param response - bot response.
     * @mode emit
     */
    'bot-im-integration/message-sent'(messageId: string, response: BotResponse): void

    /**
     * Command received.
     * @param messageId - message ID.
     * @param command - command name.
     * @param args - command arguments.
     * @mode emit
     */
    'bot-im-integration/command-received'(messageId: string, command: string, args: string[]): void

    /**
     * Command executed.
     * @param messageId - message ID.
     * @param command - command name.
     * @param success - whether command was successful.
     * @mode emit
     */
    'bot-im-integration/command-executed'(messageId: string, command: string, success: boolean): void

    /**
     * Message send requested.
     * @param platform - platform type.
     * @param chatId - chat ID.
     * @param response - bot response.
     * @mode emit
     */
    'bot-im-integration/message-send-requested'(platform: PlatformType, chatId: string, response: BotResponse): void

    /**
     * History cleared.
     * @mode emit
     */
    'bot-im-integration/history-cleared'(): void

    /**
     * Bot IM integration configuration changed.
     * @param config - new configuration.
     * @mode emit
     */
    'bot-im-integration/config-changed'(config: BotImIntegrationConfig): void
  }
}

export { BotImIntegrationService as Service }
