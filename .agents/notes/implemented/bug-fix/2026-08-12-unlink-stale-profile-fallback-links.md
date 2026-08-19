# Agent Note: Repair stale profile fallback entries without deleting them

Status: implemented

English | [中文](2026-08-12-unlink-stale-profile-fallback-links.zh.md)

## Problem

`healProfilesModuleFallback` maintains `$DSH_HOME/profiles/node_modules` entries as junctions on Windows. A wrong or dangling link crashed every launch from a moved installation or a second worktree: `ensureSymlink` removed a stale entry with `rmSync(link)`, but Node treats a junction as a directory for removal, so without `recursive` it threw `ERR_FS_EISDIR`. A real directory at a link path was left deliberately fatal ("is not a symlink") so dsh never deleted it, which left the packaged desktop app unable to start (卡在加载页 / 启动失败) when residual state from an interrupted boot, a pnpm materialization, or the Electron-as-node junction handling left a real directory in the fallback.

## Decision

`ensureSymlink` removes a stale link with `unlinkSync(link)`: `unlink` deletes the reparse point or symlink itself on every platform and never descends into the target. A real directory or file at a link path is never deleted: it is moved aside in place to `<name>.stale-<n>` and the entry is re-linked to the installation closure, so profile boot recovers without destroying anything. The [profile-plugin-bundles decision](../architecture/2026-08-05-profile-plugin-bundles.md) keeps owning the fallback's two-anchor resolution; this note owns the removal/move primitive.

## Alternatives considered

**`rmSync(link, { recursive: true })`.** On Node 24 this deletes the junction without following its target, but `recursive` would silently delete a real directory that replaced the link between the `lstat` guard and the removal, weakening the fail-loud contract that motivates the guard.

**`rmdirSync(link)`.** Removes a junction on Windows as well, but it reads as directory removal for a link, and `unlinkSync` is the repository's existing junction-cleanup idiom.

**`rmSync(actualDirectory, { recursive: true })`.** Deletes a real residue outright; rejected because the prior no-deletion guarantee is the failure this change repairs, and moving the residue aside preserves it.

**Delete and recreate every entry unconditionally.** Correct but churns unchanged links on every launch and widens the concurrent-heal race window.

## Consequences

Windows launches heal moved or second-checkout installations instead of crashing with `ERR_FS_EISDIR`; POSIX behavior is unchanged because `unlinkSync` also unlinks plain symlinks. A real directory or file at a managed fallback path no longer bricks boot: it is moved aside (never deleted) and re-linked, at the cost of stale `.stale-<n>` residue accumulating in `$DSH_HOME/profiles/node_modules` until removed manually. The packaged desktop app bundles a real Node runtime (`resources/node`) so production installs run `dsh web` under known-good Node and never hit the Electron-as-node junction misbehavior that could leave such residue. The `replaces a wrong symlink` test now passes on Windows where it previously reproduced the crash. Two concurrent healers deleting the same stale link still surface the second deletion as `ENOENT`, unchanged from the previous implementation.
