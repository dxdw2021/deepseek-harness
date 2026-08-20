/**
 * Bot/IM Integration settings section — displays platform configurations and global settings.
 *
 * @module BotImSection
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type { BotImStore, BotImState, PlatformType, PlatformConfig } from './store.ts'
import type { BotImKey } from './locales.ts'

/** Injected dependencies */
export interface BotImSectionInjected {
  /** Store controller */
  controller: BotImStore
  /** Snapshot selector hook */
  useSnapshot: () => BotImState
  /** API connection */
  api: ConnectionHandle['api']
  /** Translation function */
  t: (key: BotImKey) => string
}

/** Component props */
export interface BotImSectionProps {
  /** Injected dependencies */
  injected: BotImSectionInjected
  /** Close settings panel */
  close: () => void
}

/** Platform display order */
const PLATFORMS: PlatformType[] = ['feishu', 'lark', 'wechat', 'qq', 'telegram', 'slack', 'discord']

/**
 * Bot/IM Integration settings section component.
 */
export function BotImSection({ injected, close }: BotImSectionProps): React.ReactElement {
  const { controller, useSnapshot, t } = injected
  const state = useSnapshot()
  
  const handleTogglePlatform = async (platformType: PlatformType, enabled: boolean): Promise<void> => {
    try {
      await controller.togglePlatform(platformType, enabled)
    } catch (error) {
      console.error('Failed to toggle platform:', error)
    }
  }
  
  const handleUpdatePlatformConfig = async (platformType: PlatformType, config: Partial<PlatformConfig>): Promise<void> => {
    try {
      await controller.updatePlatformConfig(platformType, config)
    } catch (error) {
      console.error('Failed to update platform config:', error)
    }
  }
  
  const handleUpdateGlobalSettings = async (settings: Partial<Pick<BotImState, 'commandPrefix' | 'enableAutoReply' | 'autoReplyMessage'>>): Promise<void> => {
    try {
      await controller.updateGlobalSettings(settings)
    } catch (error) {
      console.error('Failed to update global settings:', error)
    }
  }
  
  if (state.status === 'loading') {
    return <div className="bot-im-section loading">{t('status.loading')}</div>
  }
  
  if (state.status === 'error') {
    return <div className="bot-im-section error">{t('status.error')}: {state.error}</div>
  }
  
  return (
    <div className="bot-im-section">
      <h2>{t('title')}</h2>
      <p className="description">{t('description')}</p>
      
      <div className="platforms-section">
        <h3>平台配置</h3>
        
        <div className="platforms-list">
          {PLATFORMS.map((platformType) => {
            const platform = state.platforms.find(p => p.type === platformType)
            if (!platform) return null
            
            return (
              <div key={platformType} className={`platform-card ${platform.enabled ? 'enabled' : 'disabled'}`}>
                <div className="platform-header">
                  <h4>{t(`platform.${platformType}`)}</h4>
                  <span className={`platform-status ${platform.connected ? 'connected' : 'disconnected'}`}>
                    {platform.connected ? t('platform.connected') : t('platform.disconnected')}
                  </span>
                </div>
                
                <div className="platform-config">
                  <div className="config-item">
                    <label>{t('config.appId')}</label>
                    <input
                      type="text"
                      value={platform.appId}
                      onChange={(e) => handleUpdatePlatformConfig(platformType, { appId: e.target.value })}
                      placeholder="Enter App ID"
                    />
                  </div>
                  
                  <div className="config-item">
                    <label>{t('config.appSecret')}</label>
                    <input
                      type="password"
                      value={platform.appSecret}
                      onChange={(e) => handleUpdatePlatformConfig(platformType, { appSecret: e.target.value })}
                      placeholder="Enter App Secret"
                    />
                  </div>
                  
                  {platformType === 'feishu' || platformType === 'lark' ? (
                    <div className="config-item">
                      <label>{t('config.verificationToken')}</label>
                      <input
                        type="text"
                        value={platform.verificationToken || ''}
                        onChange={(e) => handleUpdatePlatformConfig(platformType, { verificationToken: e.target.value })}
                        placeholder="Enter Verification Token"
                      />
                    </div>
                  ) : null}
                  
                  <div className="config-item">
                    <label>{t('config.webhookUrl')}</label>
                    <input
                      type="text"
                      value={platform.webhookUrl || ''}
                      onChange={(e) => handleUpdatePlatformConfig(platformType, { webhookUrl: e.target.value })}
                      placeholder="Enter Webhook URL"
                    />
                  </div>
                  
                  <div className="config-item">
                    <label>{t('config.botName')}</label>
                    <input
                      type="text"
                      value={platform.botName || ''}
                      onChange={(e) => handleUpdatePlatformConfig(platformType, { botName: e.target.value })}
                      placeholder="Enter Bot Name"
                    />
                  </div>
                </div>
                
                <div className="platform-actions">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={platform.enabled}
                      onChange={(e) => handleTogglePlatform(platformType, e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                  
                  <button
                    className="test-connection-button"
                    disabled={!platform.enabled || !platform.appId || !platform.appSecret}
                  >
                    {t('actions.testConnection')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      
      <div className="global-settings-section">
        <h3>全局设置</h3>
        
        <div className="global-settings">
          <div className="config-item">
            <label>{t('config.commandPrefix')}</label>
            <input
              type="text"
              value={state.commandPrefix}
              onChange={(e) => handleUpdateGlobalSettings({ commandPrefix: e.target.value })}
              placeholder="/"
            />
          </div>
          
          <div className="config-item">
            <label>{t('config.enableAutoReply')}</label>
            <input
              type="checkbox"
              checked={state.enableAutoReply}
              onChange={(e) => handleUpdateGlobalSettings({ enableAutoReply: e.target.checked })}
            />
          </div>
          
          {state.enableAutoReply && (
            <div className="config-item">
              <label>{t('config.autoReplyMessage')}</label>
              <textarea
                value={state.autoReplyMessage}
                onChange={(e) => handleUpdateGlobalSettings({ autoReplyMessage: e.target.value })}
                placeholder="Enter auto reply message"
              />
            </div>
          )}
        </div>
      </div>
      
      <div className="settings-footer">
        <button className="close-button" onClick={close}>
          关闭
        </button>
      </div>
    </div>
  )
}