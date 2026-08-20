/**
 * Bot/IM Integration settings section.
 */

import { useEffect } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { BotImState, PlatformType } from './store.ts'
import type { BotImKey } from './locales.ts'

export interface BotImSectionInjected {
  hooks: { botIm: SnapshotStore<BotImState> }
  load: () => Promise<void>
}

export type BotImSectionProps =
  PropsRuntime<'settings.section'>
  & InjectFace<BotImSectionInjected>
  & { t: (key: BotImKey) => string; close: () => void }

const PLATFORMS: PlatformType[] = ['feishu', 'lark', 'wechat', 'qq', 'telegram', 'slack', 'discord']

export function BotImSection({ hooks, load, t, close }: BotImSectionProps): React.ReactElement {
  const state = hooks.useBotIm(snapshot => snapshot)

  useEffect(() => { void load() }, [load])

  if (state.status === 'loading') return <div>{t('status.loading')}</div>
  if (state.status === 'error') return <div>{t('status.error')}: {state.error}</div>

  return (
    <div>
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      {PLATFORMS.map((pt) => {
        const platform = state.platforms.find(p => p.type === pt)
        if (!platform) return null
        return (
          <div key={pt}>
            <h3>{t(`platform.${pt}`)}</h3>
            <span>{platform.connected ? t('platform.connected') : t('platform.disconnected')}</span>
          </div>
        )
      })}
      <button onClick={close}>关闭</button>
    </div>
  )
}
