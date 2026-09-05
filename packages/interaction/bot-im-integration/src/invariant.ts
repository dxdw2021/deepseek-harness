/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-bot-im-integration`.
 * @module @deepseek-ai/dsh-bot-im-integration/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-bot-im-integration'

/** Cordis companion plugin name. */
export const name = 'bot-im-integration-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this service is not mounted in any shipped
 * composition; its platform adapter registry is in-memory and no messaging
 * backend has been wired into a live harness session.
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
