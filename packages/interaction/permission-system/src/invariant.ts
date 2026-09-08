/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-permission-system`.
 * @module @deepseek-ai/dsh-permission-system/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-permission-system'

/** Cordis companion plugin name. */
export const name = 'permission-system-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this service is not mounted in any shipped
 * composition; its role/rule evaluation is pure in-memory and is not wired
 * into a live session enforcement path in this repository.
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
