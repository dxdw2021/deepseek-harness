# Agent Note: WebUI 一键导入 opencode 账号

Status: implemented

[English](2026-08-15-webui-opencode-login.md) | 中文

## 问题

让 `opencode-zen` 路由落到 OpenCode 账号凭据上曾是一个命令行步骤（`pnpm run login:opencode`）：Web 模型设置页没有任何可见的登录方式。该页甚至不为 `llm-opencode-zen` 命名空间渲染专属编辑器，只显示"其余字段在 settings.yaml 中"的提示，因为 `ui-settings-models` 只为 `deepseek` 与 `pi-ai` 两个家族做策展。

## 决策

把导入做成一等线上方法加一个 Web 按钮。

- **Host API**：`LlmApi.importOpencodeCredential`（`packages/host/apiproxy/src/api/llm.ts`），在 `rpc-map.ts` 注册，配请求/返回值 zod schema（`llm.schema.ts`）、`fetch/handler.ts` 路由与 `fetch/client.ts` 载体方法。实现读取 opencode CLI 的 `auth.json`（候选路径：`~/.local/share/opencode/auth.json`、`%APPDATA%\opencode\auth.json`），取 `opencode` 条目（`api` → `key`，`oauth` → `access`），与 harness 其它凭据同样做格式检查，并写入 harness 凭据接缝、键名为 `OPENCODE_ZEN_API_KEY`。密钥绝不在任何方向跨越线上；回复只报告 `imported` / `alreadyPresent`。无凭据存储、无凭据、或该值已存在时，分别应答 `err('bad-request', …)` / `ok({ alreadyPresent: true })`。
- **Web UI**：`ui-settings-models` 新增 `opencode-zen` 布局（既有的 `deepseek`/`pi-ai` 家族不动）。卡片渲染"从 opencode 登录导入"按钮，驱动新方法并在行内展示成功/已存在/失败文案（`locales.ts` en + zh）；页脚提交保持禁用，因为该卡片没有要应用的东西。

## 备选方案

- **在 harness 内做 device-flow OAuth。** 权威登录要靠 console.opencode.ai 的流程铸造账号 token，但其端点是 opencode CLI/console 的移动契约；且一旦存入有效 API key，账号档的免费额度已被覆盖。推迟：CLI 导入路径现在已覆盖登录入口。
- **仅 settings、无 UI。** 在用户所要求的 Web 面上不可发现。

## 后果

线上多了一个 `llm.importOpencodeCredential` 一元方法；每个实现 `IApiClient['llm']` 的载体与测试替身都携带它。按钮导入的是*已存储*的 CLI 凭据——它仍然不能解锁匿名层热门模型配额，后者依旧按客户端 `User-Agent` 计量（见适配器笔记）；账号 key 服务于账号级额度与付费档。该 GUI 变更携带 PR 的标准义务：`test:gui` 加 Web 回放快照，以及为产品可见行为录制 GIF。