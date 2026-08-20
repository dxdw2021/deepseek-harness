/**
 * Bot/IM Integration settings store — manages the bot/IM configuration state
 * and communicates with the Host through the settings API.
 *
 * @module store
 */

/** Platform types */
export type PlatformType = 'feishu' | 'lark' | 'wechat' | 'qq' | 'telegram' | 'slack' | 'discord'

/** Platform configuration */
export interface PlatformConfig {
  type: PlatformType
  enabled: boolean
  appId: string
  appSecret: string
  verificationToken?: string
  webhookUrl?: string
  botName?: string
  connected: boolean
  lastConnected?: Date
}

/** Bot/IM state */
export interface BotImState {
  /** Current status */
  status: 'idle' | 'loading' | 'error'
  /** Platform configurations */
  platforms: PlatformConfig[]
  /** Global bot settings */
  commandPrefix: string
  enableAutoReply: boolean
  autoReplyMessage: string
  /** Error message if failed */
  error?: string
}

/** API interface for settings operations */
export interface SettingsApi {
  /** Read settings namespace */
  read(namespace: string): Promise<Record<string, unknown>>
  /** Write settings namespace */
  write(namespace: string, data: Record<string, unknown>): Promise<void>
}

/**
 * Bot/IM store — manages configuration state and settings operations.
 */
export class BotImStore {
  /** Store state */
  private _state: BotImState = {
    status: 'idle',
    platforms: [
      { type: 'feishu', enabled: false, appId: '', appSecret: '', connected: false },
      { type: 'lark', enabled: false, appId: '', appSecret: '', connected: false },
      { type: 'wechat', enabled: false, appId: '', appSecret: '', connected: false },
      { type: 'qq', enabled: false, appId: '', appSecret: '', connected: false },
      { type: 'telegram', enabled: false, appId: '', appSecret: '', connected: false },
      { type: 'slack', enabled: false, appId: '', appSecret: '', connected: false },
      { type: 'discord', enabled: false, appId: '', appSecret: '', connected: false },
    ],
    commandPrefix: '/',
    enableAutoReply: true,
    autoReplyMessage: 'I am currently busy, please try again later.',
  }
  
  /** Listeners */
  private _listeners = new Set<() => void>()
  
  /** API reference */
  private _api: SettingsApi
  
  constructor(api: SettingsApi) {
    this._api = api
  }
  
  /** Get current snapshot */
  getSnapshot(): BotImState {
    return this._state
  }
  
  /** Subscribe to changes */
  subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => { this._listeners.delete(listener) }
  }
  
  /** Notify listeners */
  private _notify(): void {
    for (const listener of this._listeners) listener()
  }
  
  /** Load settings from Host */
  async load(): Promise<void> {
    this._state = { ...this._state, status: 'loading' }
    this._notify()
    
    try {
      const data = await this._api.read('bot-im')
      this._state = {
        ...this._state,
        status: 'idle',
        platforms: (data.platforms as PlatformConfig[]) || this._state.platforms,
        commandPrefix: (data.commandPrefix as string) || '/',
        enableAutoReply: (data.enableAutoReply as boolean) ?? true,
        autoReplyMessage: (data.autoReplyMessage as string) || this._state.autoReplyMessage,
      }
    } catch (error) {
      this._state = {
        ...this._state,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to load bot/IM settings',
      }
    }
    this._notify()
  }
  
  /** Toggle platform enabled state */
  async togglePlatform(platformType: PlatformType, enabled: boolean): Promise<void> {
    const previousPlatforms = this._state.platforms
    this._state = {
      ...this._state,
      platforms: this._state.platforms.map(platform =>
        platform.type === platformType ? { ...platform, enabled } : platform
      ),
    }
    this._notify()
    
    try {
      await this._api.write('bot-im', { platforms: this._state.platforms })
    } catch (error) {
      this._state = { ...this._state, platforms: previousPlatforms }
      this._notify()
      throw error
    }
  }
  
  /** Update platform configuration */
  async updatePlatformConfig(platformType: PlatformType, config: Partial<PlatformConfig>): Promise<void> {
    const previousPlatforms = this._state.platforms
    this._state = {
      ...this._state,
      platforms: this._state.platforms.map(platform =>
        platform.type === platformType ? { ...platform, ...config } : platform
      ),
    }
    this._notify()
    
    try {
      await this._api.write('bot-im', { platforms: this._state.platforms })
    } catch (error) {
      this._state = { ...this._state, platforms: previousPlatforms }
      this._notify()
      throw error
    }
  }
  
  /** Update global bot settings */
  async updateGlobalSettings(settings: Partial<Pick<BotImState, 'commandPrefix' | 'enableAutoReply' | 'autoReplyMessage'>>): Promise<void> {
    const previous = {
      commandPrefix: this._state.commandPrefix,
      enableAutoReply: this._state.enableAutoReply,
      autoReplyMessage: this._state.autoReplyMessage,
    }
    this._state = { ...this._state, ...settings }
    this._notify()
    
    try {
      await this._api.write('bot-im', {
        commandPrefix: this._state.commandPrefix,
        enableAutoReply: this._state.enableAutoReply,
        autoReplyMessage: this._state.autoReplyMessage,
      })
    } catch (error) {
      this._state = { ...this._state, ...previous }
      this._notify()
      throw error
    }
  }
}