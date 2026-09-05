/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-desktop`.
 * @module @deepseek-ai/dsh-client-ui-desktop/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-desktop'

/** Cordis companion plugin name. */
export const name = 'client-ui-desktop-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: a pure-consumer browser plugin that detects the
 * Electron bridge and composes DOM overlays (status badge, command palette,
 * shortcut handling). It emits no cordis events and owns no cross-plugin
 * durable or model-visible state.
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
