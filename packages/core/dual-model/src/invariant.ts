/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-dual-model`.
 * @module @deepseek-ai/dsh-dual-model/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-dual-model'

/** Cordis companion plugin name. */
export const name = 'dual-model-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this service is not mounted in any shipped
 * composition and owns only in-memory planner/executor state selected from a
 * settings namespace with no durable or model-visible counterpart.
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
