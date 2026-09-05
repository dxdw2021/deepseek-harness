/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-desktop-enhanced`.
 * @module @deepseek-ai/dsh-desktop-enhanced/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-desktop-enhanced'

/** Cordis companion plugin name. */
export const name = 'desktop-enhanced-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this service is not mounted in any shipped
 * composition; its theme/notification state is in-memory UI preference data
 * with no durable or model-visible counterpart.
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
