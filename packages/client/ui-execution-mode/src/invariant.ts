/**
 * Package invariant companion — registers the manifest name and provides
 * the package-specific invariant check.
 *
 * @module invariant
 */

export const manifest = '@deepseek-ai/dsh-client-ui-execution-mode'

/**
 * No runtime invariant: this package is a browser-only settings UI plugin
 * that registers execution mode settings. It manages UI state and settings
 * operations through the Host API, with no model-visible or durable data
 * requiring runtime invariants.
 */
export function check(): void {}