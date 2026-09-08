/**
 * Durable model-request settings owned by the `llm-retry` plugin and surfaced
 * through the Settings UI. The `maxRetries` field overrides the resolver
 * default for every provider that did not declare its own retry policy.
 *
 * @module @deepseek-ai/dsh-llm-retry/model-settings
 */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owning model-request behavior configurable from Settings UI. */
export const MODEL_SETTINGS_NAMESPACE = 'model'

/** Durable model-request settings. */
export interface ModelSettings {
  /** Default maximum model-request retries after the first attempt (range 0+). */
  maxRetries: number
}

/** Durable model-settings schema; also the wire envelope the client scope validates against. */
export const ModelSettingsSchema: z<ModelSettings> = z.object({
  maxRetries: z.number().min(0).step(1).default(2),
})
