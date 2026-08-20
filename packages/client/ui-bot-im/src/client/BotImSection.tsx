/**
 * Bot/IM Integration settings section.
 *
 * @module BotImSection
 */

import type { BotImController, BotImState, PlatformType } from './store.ts'
import type { BotImKey } from './locales.ts'
import type { SettingsSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client'

export interface BotImSectionInjected {
  controller: BotImController
  useSnapshot: () => BotImState
  t: (key: BotImKey) => string
}

export type BotImSectionProps = SettingsSectionOwnerProps & BotImSectionInjected

const PLATFORMS: PlatformType[] = ['feishu', 'lark', 'wechat', 'qq', 'telegram', 'slack', 'discord']

export function BotImSection({ useSnapshot, t, close }: BotImSectionProps): React.ReactElement {
  const state = useSnapshot()

  if (state.status === 'loading') return <div className="loading">{t('status.loading')}</div>
  if (state.status === 'error') return <div className="error">{t('status.error')}: {state.error}</div>

  return (
    <div className="bot-im-section">
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      <div className="platforms-list">
        {PLATFORMS.map((pt) => {
          const platform = state.platforms.find(p => p.type === pt)
          if (!platform) return null
          return (
            <div key={pt} className={`platform-card ${platform.enabled ? 'enabled' : 'disabled'}`}>
              <h3>{t(`platform.${pt}`)}</h3>
              <span>{platform.connected ? t('platform.connected') : t('platform.disconnected')}</span>
              <input type="text" placeholder={t('config.appId')} value={platform.appId} readOnly />
            </div>
          )
        })}
      </div>
      <button onClick={close}>关闭</button>
    </div>
  )
}
