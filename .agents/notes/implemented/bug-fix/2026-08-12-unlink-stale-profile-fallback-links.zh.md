# Agent Note: 修复过期的 profile 回退条目而不删除它们

Status: implemented

[English](2026-08-12-unlink-stale-profile-fallback-links.md) | 中文

## 问题

`healProfilesModuleFallback` 维护的 `$DSH_HOME/profiles/node_modules` 条目在 Windows 上是 junction。错误或悬空的链接会让每次从迁移后的安装或第二个 worktree 启动都崩溃：`ensureSymlink` 原先用 `rmSync(link)` 删除过期条目，但 Node 在删除时把 junction 当作目录处理，不带 `recursive` 会抛 `ERR_FS_EISDIR`。而链接位置上出现真实目录时，该函数刻意大声失败（“is not a symlink”），绝不删除——这使打包后的桌面应用在回退目录里残留真实目录（中断的启动、pnpm 实例化，或 Electron-as-node 的 junction 处理异常留下）时无法启动（卡在加载页 / 启动失败）。

## 决策

`ensureSymlink` 用 `unlinkSync(link)` 删除过期链接：`unlink` 在所有平台上都只删除重解析点或符号链接本身、绝不进入目标目录。链接位置上的真实目录或文件永远不会被删除：它会原地移到 `<name>.stale-<n>` 之后，条目重新链接到安装闭包，从而在不破坏任何内容的前提下让 profile 启动恢复。[profile-plugin-bundles 决策](../architecture/2026-08-05-profile-plugin-bundles.md)继续拥有回退目录的双锚点解析；本 note 拥有“用哪个删除/迁移原语”这一决定。

## 考虑过的替代方案

**`rmSync(link, { recursive: true })`。** Node 24 上它只删 junction、不跟随目标，但 `recursive` 会在 `lstat` 守卫与删除之间链接被替换成真实目录时静默删除该目录，削弱守卫存在所依据的大声失败契约。

**`rmdirSync(link)`。** Windows 上同样能删 junction，但它读起来像“删目录”，而 `unlinkSync` 才是仓库现有的 junction 清理惯例。

**`rmSync(真实目录, { recursive: true })`。** 直接删除残留的真实目录；被否因为旧的“绝不删除”保证正是本次要修复的失败形态，把残留移到一旁即可保留该保证。

**无条件删除并重建所有条目。** 正确，但每次启动都翻动未变化的链接，并扩大并发修复的竞态窗口。

## 后果

Windows 启动现在可以修复迁移后的安装或第二个 checkout，而不是以 `ERR_FS_EISDIR` 崩溃；POSIX 行为不变，因为 `unlinkSync` 同样能 unlink 普通符号链接。真实目录或文件出现在受管回退路径上不再阻断启动：它被移到一旁（绝不删除）并重新链接，代价是 `$DSH_HOME/profiles/node_modules` 中会积累 `.stale-<n>` 残留，直到手动清理。打包后的桌面应用内置真实 Node 运行时（`resources/node`），生产安装用已知良好的 Node 运行 `dsh web`，不会再触发 Electron-as-node 那类会留下残留的 junction 异常路径。现有的 `replaces a wrong symlink` 测试在 Windows 上从复现崩溃变为通过。两个并发 healer 删除同一过期链接时，第二次删除仍会以 `ENOENT` 浮现，与原先的实现一致。