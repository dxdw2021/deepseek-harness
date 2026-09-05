/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-execution-mode`.
 * @module @deepseek-ai/dsh-client-ui-execution-mode/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-execution-mode'

/** Cordis companion plugin name. */
export const name = 'client-ui-execution-mode-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: a browser-only settings plugin that registers an
 * execution-mode section and locale dictionaries. It emits no cordis events
 * and owns no cross-plugin durable or model-visible state.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
