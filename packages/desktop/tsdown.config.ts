/**
 * Desktop Electron app: not part of the shipped harness library build. Its own
 * electron-builder + tsc flow (see package.json scripts) emits dist/, not a
 * harness lib. This empty entry removes the package from the tsdown workspace
 * scan so its absent lib/types/{index,invariant,startup}.js never breaks
 * `pnpm build` / `pnpm typecheck`.
 */
export default () => [{ entry: '' }]
