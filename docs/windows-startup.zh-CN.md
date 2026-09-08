# Windows 启动指南（Dsh Web + 桌面窗口）

本页说明如何在 Windows 上启动 DeepSeek Harness 的 Web 界面和原生桌面窗口，以及这两个启动器曾经的故障根因。

## 启动方式

### Web 界面

在仓库根目录执行，或双击 `start-dsh-web.bat`：

```bat
cd /d D:\\\\DEV\\\\tool\\\\AI\\\\deepseek-harness
pnpm dsh --profile web --host 127.0.0.1 --port 3080
```

启动后访问 http://127.0.0.1:3080 。`--host` 与 `--port` 是 web 启动 provider 支持的合法参数，配置值通过插件式 `webStartup` 服务注入 `webserver` 行。

### 桌面窗口

桌面窗口本身不内置可自举的 Web 服务，它只是加载 Web GUI 的原生外壳。

```bat
cd /d D:\\\\DEV\\\\tool\\\\AI\\\\deepseek-harness\\\\packages\\\\desktop
pnpm run dev -- --external
```

`dev.mjs --external` 会检测 127.0.0.1:3080：端口在监听就直接挂到现有界面，否则等待后仍启动。因此必须先有 `dsh web` 在 3080 运行。

`start-desktop.bat` 封装了这一流程：检测 3080 → 未运行时提示先启动 Web（指向 `start-dsh-web.bat`），运行中则拉起桌面窗口。

## 曾经的故障根因

### 1\. profiles fallback 里的残留目录

`dsh web` 启动时会维护 `%USERPROFILE%\\\\.dsh\\\\profiles\\\\node\\\_modules`：为安装的 CLI 依赖闭包内的每个包建一个 junction（符号链接）。若某个名字对应的是真实目录而非 junction，`healProfilesModuleFallback` 会 fail-loud 中止（`packages/boot/app-boot/src/profile.ts`）。本机上 `@deepseek-ai\\\\dsh-fs-local`、`@deepseek-ai\\\\dsh-headless` 是空目录残留，导致所有 profile 启动（web、headless、desktop 内嵌）全部报错。

修复：把这两个空目录移走，下次启动自动重建 junction。`start-dsh-web.bat` 与 `start-desktop.bat` 的 `:repair-fallback` 会把 `@deepseek-ai` 下名为 junction 却为空目录的残留移到 `%TEMP%\\\\dsh-stale-\\\*`（有内容的目录不自动处理，会提示人工处置）。

### 2\. OpenCode Zen provider 不是打包版 CLI 的运行时依赖

`%USERPROFILE%\\\\.dsh\\\\cordis.patch.yml`（本机 home 层）把 `@deepseek-ai/dsh-llm-opencode-zen` 注入所有 profile。从源码用 tsx 启动时，tsconfig `paths` 能解析它；但打包的 dsh 在纯 Node 下只能经由 profiles fallback 解析，而 fallback 只链接 `dependencies`/`peerDependencies` 闭包里的包。`dsh-llm-opencode-zen` 原来只在 `apps/cli/package.json` 的 `devDependencies`，不在闭包中，于是 `ERR\\\_MODULE\\\_NOT\\\_FOUND`。

修复：把 `@deepseek-ai/dsh-llm-opencode-zen` 移入 `apps/cli/package.json` 的 `dependencies`，同步更新 `pnpm-lock.yaml` 及 `packages/desktop` 的两份 `resources/dsh/package.json`。

### 3\. 打包 exe 的内嵌 dsh 缺少 web profile 插件闭包（待办）

`packages\\\\desktop\\\\dist\\\\installers\\\\win-unpacked\\\\DeepSeek Harness.exe` 内嵌的 dsh（`resources\\\\dsh`，是 `apps/cli/node\\\_modules` 的拷贝）无法在纯 Node 下引导 web profile：`dsh-web-app` bundle 引用的 `dsh-client-ui-\\\*`、`dsh-host-\\\*`、`dsh-code-runtime-\\\*` 等约几十个插件包不在 `apps/cli` 的运行时依赖里，devDependencies 也不齐全，故加载即失败。源码启动（tsx + tsconfig paths）不受此限，所以桌面窗口走 dev 流程即可运行。

若要修复打包路径，需要把 web profile 的完整插件名册纳入 `apps/cli` 的 `dependencies`，然后重新 `pnpm run build:dsh` 并 `electron-builder`。此仓库处于预发布阶段，建议先以 dev 流程为准。

## 已应用的改动

* `apps/cli/package.json`：`@deepseek-ai/dsh-llm-opencode-zen` 从 devDependencies 移至 dependencies。
* `packages/desktop/resources/dsh/package.json` 与 win-unpacked 内嵌副本：同步同一改动。
* `pnpm-lock.yaml`：随依赖重分类更新。

## 常见问题

* 端口 3080 被占用：`netstat -ano | findstr :3080` 找到 PID，`Stop-Process -Id <PID> -Force` 后重试；先确认 3080 上是否已有 dsh web 在服务。
* 360 等杀软拦截 `zucchini.exe`：`zucchini` 是 Chromium 的二进制差分工具，非本项目脚本产生（本仓库构建物不含该文件，见下）。
* 桌面窗口出现即退出：确认 3080 已真实监听；纯 Node 的内嵌 dsh 无法引导 web profile，属于第 3 条。

