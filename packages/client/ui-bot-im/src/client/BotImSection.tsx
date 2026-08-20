/**
 * Bot/IM Integration settings section.
 */

import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-web-react'
import type { BotImState } from './store.ts'
import type { BotImKey } from './locales.ts'

export interface BotImSectionInjected {
  useSnapshot: SnapshotSelectorHook<BotImState>
  t: (key: BotImKey) => string
}

export type BotImSectionProps = Partial<BotImSectionInjected>

export function BotImSection({ useSnapshot, t }: BotImSectionProps): React.ReactElement | null {
  const state = useSnapshot?.(snapshot => snapshot)
  if (!state || !t) return null

  if (state.status === 'loading') return <div>{t('status.loading')}</div>
  if (state.status === 'error') return <div>{t('status.error')}: {state.error}</div>

  return (
    <div>
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      {state.platforms.map((platform) => (
        <div key={platform.type}>
          <h3>{t(`platform.${platform.type}` as BotImKey)}</h3>
          <span>{platform.connected ? t('platform.connected') : t('platform.disconnected')}</span>
        </div>
      ))}
    </div>
  )
}
