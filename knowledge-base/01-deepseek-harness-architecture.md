# DeepSeek Harness 项目架构技术文档

## 一句话定位

DeepSeek Harness（dsh）是一个**插件式 Agent 运行时框架**：在 vendored Cordis 之上，产品的一切——模型适配器、会话日志、工具注册表、Agent 循环本身——都是插件，可替换、可随配置卸载。预发布阶段奉行"先立正确的底座，再考虑兼容垫片"（foundation over blast radius）。

## 仓库与工作区

- `vendor/`：vendored Cordis 源码副本（含同步清单）
- `packages/<group>/<pkg>/`：约 60 个 `@deepseek-ai/dsh-*` 工作区包，按能力分组：
  - `core/` 产品 API 主干（session、system-prompt、tools、agent、agent-loop）
  - `llm/` LLM 能力族（抽象服务 + 适配器）
  - `shell/fs/web/subprocess/terminal/code-runtime/sandbox/lsp/skill/compaction/jobs/workflow/subagent/attachment/spill` 等逐个能力族（Service Definition / Provider / Consumer 三角色常分独立包）
  - `session/` 持久会话数据面（JSONL/SQLite、投影、标题）、`session-query/` 检索族
  - `settings/`、`credentials/`、`identity/`、`workspace/` 支撑接缝
  - `host/`（Web 主机半：API 网关 + HTTP 服务器）、`client/`（浏览器半：wire、对象层、slots、ui-*）
  - `bundle/`（base/headless/web-app profile 补丁层）、`boot/` 应用启动胶水、`acp/` ACP 协议、`sdk/` 外部 JSON-RPC SDK
  - `util/` 零依赖工具（Branded id、home 路径、timeout…）、`test-support/` 测试基建
- `apps/cli/`：提供 `dsh` bin；`examples/` 可运行组合；`docs/` 架构/子系统/手册；`scripts/` 门禁与生成器；`python/` Python SDK；`native/` 沙箱原生套件

## 组合模型：剖面(bundle/profile) + 分层补丁

- 一个运行中的 `dsh` 是一棵插件树，按序叠加：profile 列出的 bundles → profile 的 `cordis.patch.yml` → 用户层 `$DSH_HOME/cordis.patch.yml` → `--patch` 覆写层。
- 补丁按行 id 整体替换该行 config 或插入新行；`dsh --profile web --dump-config` 可查看实际启动树，任何一行都可被自己的补丁替换。
- 内置剖面：`base`（模型/工具/持久化/审批/凭证等，每个剖面的第一层）、`web-app`（浏览器界面）、`headless`（无服务器的一次性任务）。

## 核心事件模型

- **注册即效果**：一切贡献经 `ctx.effect()` / `ctx.on()`，`register()` 返回 disposer。
- **事件即扩展点**：会话事件（持久化事实，`session/event`）、Agent 事件（`agent/*` 携带活 Agent）、能力事件（`tools/*`、`telemetry/*` 等）；水位线(waterfall)监听器必须 `next()` 委托，否则短路链路。
- 闭环类型守卫：跨包 id 用 `Branded<B>`；判别联合以 `assertNever` 收口。

## LLM 能力族（典型能力接缝）

- `ctx.llm`（`LlmRuntime`）= Service Definition：适配器注册表 + streaming 调用，`llm/stream` 为 waterfall。
- 提供方（Provider）：`dsh-llm-deepseek`（直连 fetch+SSE）、`dsh-llm-pi-ai`（多提供方库）、`dsh-llm-opencode-zen`（OpenCode Zen 匿名免费层，新增）。
- 调用链：agent-loop → `llm.prepareCall()`（解析精确模型+接缝配置+绑定注册）→ 适配器序列化 → SSE 解析 → `StreamChunk` 折叠（text/reasoning/tool-call/usage/finish）→ `BlockAssembler` 组装持久化消息。
- 模型可见 ⟺ 已记录：任何到达模型的输入都可由会话日志重建。

## 会话与持久化

- `ctx.sessions`：append-only 会话事件日志（JSONL 后端，zstd 压缩；SQLite 可选），会话事件是唯一可重放的真实来源。
- 配套：token-meter（按上下文窗口与用量）、compaction（阈值触发摘要）、会话投影/标题/检索。

## 设置与凭据

- `ctx.settings`（命名空间+文件提供方，热重载）：组合 base 与用户文档按节合并。
- `ctx.credentials`（凭据引用接缝）：配置只存引用名（如 `apiKeyEnv`），每次请求解析，绝不内联密钥。

## Web UI 分层（host / client）

- Host 半：`dsh-host-apiproxy` 定义统一 API（RPC 四象限）、HTTP/SSE 载体；`dsh-host-webserver` 路由与静态托管。
- Client 半：连接载体的对象层 → 会话管理器 → slots/组件（`ui-*` 插件），每层职责单向、渲染层纯展示。
- 业务状态在对象层，跨显示状态用 store；道具来自四个 share；组件不见 ctx。

## 质量与门禁

- 测试三层：逐文件 100% 覆盖率（`test:coverage`）、真实 API e2e（`test:e2e`，无 key 自跳）、键无关回放快照（`test:snapshot`）。
- `doc-sync`：文档层级/预算/链接/双语配对/Agent Note 格式；`hygiene`：knip/publint/约束/依赖结构。
- 非平凡改动必须配 Agent Note；文档与代码同改同版本。

## OpenCode Zen 免费模型集成（本仓库近期新增）

- 新包 `dsh-llm-opencode-zen`：匿名 `Bearer public`、OpenAI 兼容，默认目录含 6 个免费模型。
- 免费层机制：按会话身份头（`x-opencode-session: ses_…`）+ 客户端 UA 计量；适配器每次请求铸造新会话身份并带官方前缀+诚实后缀 UA。
- WebUI 提供"从 opencode 登录导入"（Host RPC `llm.importOpencodeCredential`）与命令行 `pnpm run login:opencode`。
- 快速启动：`start-dsh-web.bat` / `pnpm dsh --profile web --host 127.0.0.1 --port 3080`；入口文档 `QUICKSTART.zh-CN.md`。