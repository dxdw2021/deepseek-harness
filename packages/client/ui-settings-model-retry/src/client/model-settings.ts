/** Client-side shape of the host `model` settings namespace. */

/** Durable model-request settings read/written through the settings scope. */
export interface ModelSettings {
  /** Default maximum model-request retries after the first attempt (range 0+). */
  maxRetries: number
}
