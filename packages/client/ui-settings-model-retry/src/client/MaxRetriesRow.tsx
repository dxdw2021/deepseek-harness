/**
 * Max-retries row registered into the Model Requests section (figma
 * 'Setting-Cell'): title + description + a number input bound to the host
 * `model` settings namespace. Registered by this package — the model-request
 * retry feature owns its own settings surface.
 */
import { useEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createMaxRetriesStore } from './store.ts'
import css from './MaxRetriesRow.module.css'

/** Injected business face: the preference write through the settings scope. */
export interface MaxRetriesRowInjected {
  /** Persist a new max-retries value to the host `model` namespace. */
  setMaxRetries: (value: number) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type MaxRetriesRowComponentProps =
  PropsRuntime<'settings.model-request.item'> & PropsStore<ReturnType<typeof createMaxRetriesStore>>
  & PropsLocale<'settings.model-request'> & MaxRetriesRowInjected

/**
 * Render the Max-retries row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function MaxRetriesRow({ t, setMaxRetries, useStore }: MaxRetriesRowComponentProps) {
  const value = useStore(s => s.value)
  const [draft, setDraft] = useState<string>(value === undefined ? '' : String(value))

  // Keep the local draft in step with host-driven changes (other tab, reset).
  useEffect(() => {
    if (value !== undefined) setDraft(String(value))
  }, [value])

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('maxRetries.title')}</div>
        <div className={css.description}>{t('maxRetries.description')}</div>
      </div>
      <input
        type="number"
        min={0}
        step={1}
        className={css.input}
        value={draft}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          if (next === '') return
          const parsed = Number(next)
          if (Number.isInteger(parsed) && parsed >= 0) setMaxRetries(parsed)
        }}
      />
    </div>
  )
}

export type { BoundActions }
