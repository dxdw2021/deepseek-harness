/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-execution-mode`.
 * @module @deepseek-ai/dsh-execution-mode/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-execution-mode'

/** Cordis companion plugin name. */
export const name = 'execution-mode-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this service is not mounted in any shipped
 * composition; it only registers a settings namespace and emits its own
 * `execution-mode/changed` event, neither of which is observable in a live
 * harness session until a provider consumer mounts it.
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
