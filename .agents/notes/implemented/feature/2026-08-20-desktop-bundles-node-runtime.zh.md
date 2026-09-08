# Agent Note: 桌面安装包内置一个 Node 运行时

Status: implemented

[English](2026-08-20-desktop-bundles-node-runtime.md) | 中文

## 问题

打包后的桌面应用把 `dsh web`（`lib/bin.js web --port 0`）当作普通 Node 子进程运行。宿主机缺少 Node 或版本低于 22.6 时，外壳回退到 Electron-as-node，而它对运行时并不可靠：koffi 的 FFI 调用与 junction 处理行为异常，实际的首装现场显示 `dsh web` 在 profile 回退修复处退出（`bin.js` 报错）。结果是终端用户机器上启动页一直停在 “Loading plugins…”（或闪现一次启动错误），因为无 Node 或旧 Node 的主机在回退模式下永远无法把服务拉起来。

## 决策

Windows 安装包以内置资源（`extraResource`）形式携带真实 Node 运行时（`resources/node`，由 `scripts/ensure-node.mjs` 从 `nodejs.org` / `DSH_NODE_MIRROR` 拉取，固定到 `v24.12.0` / `DSH_NODE_VERSION`）。`resolveNodeCommand` 的优先级现在是：`DSH_RUNTIME_NODE` 显式指定、内置的 `resources/node/node.exe`、PATH 上满足 `>= 22.6` 的 Node、最后才是 Electron-as-node。因此生产安装始终用已知良好的 Node 运行 `dsh web`，永不进入 Electron-as-node 路径；内置二进制被 Git 忽略，并在每次 `build:dsh` 时用 `--version` 校验。

## 考虑过的替代方案

**仍把 Electron-as-node 作为唯一回退。** 被否：运行时的 koffi 与 junction 代码在该模式下已被文档标注不可靠，而它造成的失败形态（启动页卡住、无控制台日志）正是已安装构建难以诊断的原因。

**要求用户自行安装 Node。** 被否：普通 Windows 用户不是 Node 开发者，打包产品不应依赖宿主工具链。

**无条件嵌入 Electron 自带的 Node。** 被否：即使版本相同，Electron-as-node 的 fs/junction 语义仍不同于真实 Node 进程，且 code-runtime worker 需要 `node:module` 的 `stripTypeScriptTypes`，真实 Node 才是受支持的契约。

## 后果

安装包增加压缩后的 Node 产物（下载约 30 MB，解压约 90 MB），`build:dsh` 需要一次网络访问来拉取（之后复用）。生产启动在不同宿主（有无 Node）上现在是确定的；`dsh web` 启动也比 Electron-as-node 路径更快。目前只接通了 Windows `win-x64` 下载；macOS/Linux 构建在补齐各自的下载前，仍从 PATH 解析 Node 并回退到 Electron-as-node。