/**
 * Max-retries row store: a mirror of the model-request settings value. The
 * plugin's apply-world subscription is the only writer; the row component
 * reads via props.useStore.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Store state mirrored from the model-request settings snapshot. */
export interface MaxRetriesState {
  /** Current max-retries value (undefined until the scope loads). */
  value: number | undefined
  /** Host revision the value was read at. */
  revision: number
}

/** Declared action shape giving the exported factory a stable return type. */
type MaxRetriesActions = {
  sync: (d: MaxRetriesState, value: number | undefined, revision: number) => void
}

/**
 * Declares the Max-retries row state and write surface.
 * @returns the store handle.
 */
export function createMaxRetriesStore(): EngineStoreHandle<MaxRetriesState, MaxRetriesActions> {
  return defineStore({
    init: (): MaxRetriesState => ({ value: undefined, revision: 0 }),
    actions: {
      sync: (d, value: number | undefined, revision: number) => {
        d.value = value
        d.revision = revision
      },
    },
  })
}
