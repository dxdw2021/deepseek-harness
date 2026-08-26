/** The Model Requests section: one column rendering the feature-owned item contributions. */
import type { PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './ModelRetrySection.module.css'

/** Full component props: section owner share plus item render share. */
export type ModelRetrySectionComponentProps =
  PropsRuntime<'settings.section'> & PropsRenderSlots<'settings.model-request.item'>

/**
 * Render the Model Requests section content column.
 * @param props - composed slot props (contract/slots.ts).
 * @returns the section element tree.
 */
export function ModelRetrySection({ renderSlot }: ModelRetrySectionComponentProps) {
  return (
    <div className={css.section}>
      {renderSlot('settings.model-request.item', {})}
    </div>
  )
}
