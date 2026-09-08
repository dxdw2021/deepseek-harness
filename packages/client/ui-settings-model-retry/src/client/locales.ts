/** Copy dictionaries for the Model Requests settings section. */

/** English strings (the key-set source of truth for this pair). */
export const en = {
  'nav': 'Model Requests',
  'maxRetries.title': 'Max retries',
  'maxRetries.description': 'Default retries for failed model requests (0 or more, default 2).',
} satisfies Record<string, string>

/** The settings.model-request namespace key union. */
export type ModelRequestKey = keyof typeof en

/** Simplified Chinese dictionary (mirrors the English key set). */
export const zh: Record<ModelRequestKey, string> = {
  'nav': '模型请求',
  'maxRetries.title': '最大重试次数',
  'maxRetries.description': '模型请求失败时的默认重试次数（0 及以上，默认 2）。',
}
