/**
 * Host registration for the browser model-request settings preference.
 *
 * The `model` namespace is owned here (the client package's host half) so
 * the provider persists it to `settings.yaml` and the client sees it on the
 * very first `describe()` call — before any browser tab connects.  The
 * consumer plugin `llm-retry` reads the value through the provider's
 * `get()` method without re-registering.
 */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { MODEL_SETTINGS_NAMESPACE, ModelSettingsSchema } from '@deepseek-ai/dsh-llm-retry'

export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      settingsNamespace(MODEL_SETTINGS_NAMESPACE),
      ModelSettingsSchema,
    )
  })
}
