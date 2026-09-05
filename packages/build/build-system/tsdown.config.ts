/**
 * Reasonix demo package: not part of the shipped harness build. This
 * package-level config removes the package from the tsdown workspace
 * scan so its un-emitted lib never breaks `pnpm build` / `pnpm typecheck`.
 */
export default () => [{ entry: '' }]