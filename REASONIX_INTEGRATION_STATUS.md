# Reasonix ↔ DeepSeek Harness 集成状态

基于真实代码核对（非规划愿景），记录 DeepSeek-Reasonix 功能在 deepseek-harness 中的落地情况与未覆盖缺口。本文件仅作为参考基线与后续工作清单，不参与 doc-sync 门禁。

核对日期：本仓库当前工作区。状态含义：✅ 已落地（有实现+构建）／🔶 部分（有骨架或未接入）／❌ 缺口（无对应）。

## 一、Reasonix 内置工具 ↔ harness 工具包

Reasonix 的 29 个内置工具分散在 `internal/tool/builtin/*.go`。harness 以 Cordis 插件 `tool-*` 包提供工具，均可配置启停。

| Reasonix 工具 | harness 对应 | 状态 | 说明 |
| --- | --- | --- | --- |
| bash | `shell/tool-bash` / `tool-bash-persistent` | ✅ | 含持久 PTY 后端（node-pty） |
| write_file / editfile / editsource | `fs/tool-str-replace-editor` / `tool-fs` | ✅ | 策略替换编辑器 |
| read_file / ls / grep / glob | `fs/tool-fs` / `fs/tool-fs-search` | ✅ | |
| movefile / delete_range / delete_symbol | `fs/tool-str-replace-editor` + `tool-fs` | 🔶 | 部分，按串替换能力而非符号删除 |
| multiedit / notebookedit | — | ❌ | 无对应（REPL 类核心技术未迁） |
| codeindex | — | ❌ | 符号索引/语义搜索未落地 |
| webfetch | `web/tool-web`（search/fetch） | ✅ | |
| todo | `todo/tool-todo` | ✅ | |
| updategoal | `goal/tool-goal` | ✅ | |
| bgjobs | `jobs/tool-jobs` | ✅ | |
| preview / clientio / confine / managed_config / session_guard / post_write_receipt / workspace | —（部分） | 🔶 | UI 呈现/审批/配置侧各有部分或缺失 |
| compress | `compaction/*` + `context/context-engine-v2` | 🔶 | 基础压缩在，Reasonix 风格摘要压缩未对齐 |

## 二、Reasonix 核心能力 ↔ harness

| Reasonix 能力 | harness 现状 | 状态 |
| --- | --- | --- |
| 传输无关控制器（TUI/桌面/HTTP/ACP 共享 controller） | host webserver + client-connection + apiproxy 统一 RPC | ✅ |
| Cache-aware context maintenance | session/session-projection + session-stats + context-engine-v2 | 🔶 |
| 单二进制分发（CGO=0） | Node 运行时 + desktop 打包，非单静态二进制 | 🔶 |
| 配置驱动（TOML） | `settings/settings-toml`（cordis.yml + TOML overlay） | 🔶 |
| 双模型 executor+planner | `core/dual-model` | ✅ 接入 LLM 路由（planner→TaskPlan→executor 执行） |
| 执行模式 Light/Balanced/Delivery | `core/execution-mode` | ✅ getConstraints() 返回 per-mode 约束 |
| 检查点 / per-turn 回退 | `session/session-checkpoint-policy` + `compaction/*` | ✅ |
| 子代理（task/fleet/parallel） | `subagent/*`（tool-subagent 等） | ✅ |
| 计划模式 + 任务契约 | `plan/*` + `goal/*` + plan-mode | ✅ |
| 权限 / 审批 / 沙箱 | `interaction/*` + `sandbox/*`（含 landlock-run） | ✅ |
| 技能（skill） | `skill/*`（catalog/loader 工具） | ✅ |
| Extension Protocol v1/v2 | `extensions/*`（cordis-host-runner、plugin-package-manager） | ✅（协议不同但能力对齐） |
| 自动记忆 / context 维护 | `context/context-engine-v2` + `session-reference` | ✅ 接入 compaction/prune + summary 事件 |

## 三、前端形态

| Reasonix 前端 | harness | 状态 |
| --- | --- | --- |
| 浏览器 HTTP/SSE | `apps/web`（官方 React 前端，接入 `/api` RPC） | ✅ 可构建、已连后端 |
| Reasonix 风格浏览器皮肤 | `apps/reasonix-web`（`@deepseek-ai/dsh-reasonix-web`，wire 对齐 `session.list/create/prompt` + `events.mux`） | ✅ workspace 成员，`pnpm run build:reasonix-web` / `dev:reasonix-web` 可构建、可运行 |
| 桌面 | `packages/desktop`（Electron） | ✅ 可构建（独立 electron-builder 流） |
| 终端 TUI / 斜杠命令 | `interaction/terminal-tui`（复刻包）+ `ui-commands` | 🔶 |
| ACP 编辑器桥 | `acp/*` + `interaction/*` | ✅ |

## 四、已确认缺口（后续工作优先级排序）

1. ✅ **reasonix-frontend 会话渲染**：已实现 `foldSessionHistory`（session.history 事件日志→Message[]）和 `LiveStreamFolder`（events.mux 帧→store 事件），含工具调用/推理/流式内容完整翻译，通过 vitest 单元测试验证。
2. ✅ **dual-model / execution-mode 真实化**：`packages/core/dual-model` 已接入 LLM 路由（planner 模型生成 TaskPlan，executor 模型执行步骤）；`packages/core/execution-mode` 新增 `getConstraints()` 返回 per-mode 约束（light=5 工具调用/无 plan，balanced=10，delivery=20+证据收集），均编译通过。
3. **REPL/符号索引类工具**：multiedit、notebookedit、codeindex 无 harness 对应（需原生实现，优先级较低）。
4. **单二进制分发**：harness 是 Node 运行时 + 包管理，非 Reasonix 的 CGO=0 单静态二进制（需重大架构改动）。
5. ✅ **permission-system / bot-im / theme-enhanced 接入**：`packages/bundle/web-app/cordis.patch.yml` 已注册 `permission-system` 和 `bot-im-integration`，均已导出 Cordis 插件（name/inject/apply），类型检查通过。
6. ✅ **记忆/上下文摘要压缩**：`context-engine-v2` 已实现 ContextEntry 存储（add/remove/search/update），接入 `compaction/summary` 和 `compaction/prune` 事件实现 stale 条目清除和压缩摘要写入，类型检查通过。

## 五、后端 wire 契约（已核对，供前端接入）

- unary：`POST /api/<dotted-method>`，body `{type:'client-request', rpcId, method, payload}`，响应 `{type:'server-response', rpcId, result:{ok:true,value}|{ok:false,error}}`。
- method 注册：`packages/host/apiproxy/src/api/rpc-map.ts`（`session.list/create/prompt/history`、`goals.*`、`settings.*`、`llm.providers` 等）。
- 事件：`/api/events.mux` 下行 WebSocket，帧为 `MuxFrame`（`{type:'session/event', sessionId, event, view?}` 等在 `RpcRequest` envelope 内）。
- 会话投影：`session.list` 每行含 `projections.values.title`（标题）、`sessionStats`、`tokenUsage`、`contextPressure` 等，前端可直接渲染。

## 六、阶段 B 集成实录（reasonix 替换官方界面 + 接真实后端）

> 阶段 B 已全部落地并通过浏览器实测（`http://127.0.0.1:7890`）。

### B1 入口替换（已生效）
- `packages/bundle/web-app/src/index.ts` 的 `resolveDistIndex()`：优先 `require.resolve('@deepseek-ai/dsh-reasonix-web/dist/index.html')`，失败回退官方 `dsh-web-frontend`。tsc + 单测 14/14 通过。
- `packages/bundle/web-app/package.json` 声明 `"@deepseek-ai/dsh-reasonix-web": "workspace:^"`；局部 junction 链接 `packages/bundle/web-app/node_modules/@deepseek-ai/dsh-reasonix-web → apps/reasonix-web`（缺链接会 MODULE_NOT_FOUND 回退官方界面）。
- 后端 `pnpm dsh --profile web --port 7890` 直接输出 reasonix 界面。

### B2 后端连接层
- `apps/reasonix-web/vite.config.ts` proxy：`proxyReq`/`proxyReqWs` 钩子改写请求头（去 Origin、设 sec-fetch-site/mode/dest=same-origin）绕过 harness 浏览器信任围栏（`api-request-trust.ts`），否则 403 / WS 1008。
- RPC 信封 `{type:'client-request', rpcId, method, payload}` → `{type:'server-response', rpcId, result:{ok,value}}`；`session.list` 返回 `value.items[]`。
- `store.ts` `useLiveBackend` 默认 true，UI 保留实时后端开关。

### B3 会话按项目分组
- `api.ts`：新增 `projectNameOf(cwd)`（取 cwd 末段，空为"未分组"），`listSessions` 不再硬编码 `deepseek-harness`。
- `Sidebar.tsx` 按 projectName 分组渲染（组标题+计数、组内 updatedAt 降序、组间按最新会话排序）。实测 13 个项目分组正确。

### B4 提示词增强 + 语音输入（从 Reasonix 补齐，原遗漏已确认并实现）
- 对照 `D:\DEV\tool\DeepSeek-Reasonix\desktop\frontend\src\components\Composer.tsx` 确认：原项目 STT（Go bridge `STTStart/STTStop/onSTTTranscript`）与增强（`EnhancePrompt` 大模型润色 + 还原 + 二次增强）均存在，reasonix-web 此前遗漏。
- **STT（初版，已废弃）**：新建 `lib/stt.ts` 纯前端 Web Speech API（zh-CN，continuous+interimResults，onend 自动重启，权限拒绝提示）；Composer 麦克风按钮（聆听态红色高亮 + 状态栏 + sttError 行）。实测 Edge 可识别；豆包浏览器（Chromium，未接厂商在线识别服务）`rec.start()` 仅 `error:not-allowed`，不可用——见 B5 迁移方案。
- **增强**：`HarnessApi.enhancePrompt` 用临时会话方案（session.create → prompt 严格"不调用任何工具"指令 → 轮询 history 700ms/90s 超时 → archiveSession）。Composer 增强按钮（enhancing 转圈 + disabled）+ 还原按钮（Undo2）。
- **临时会话不污染 UI（关键修复）**：
  1. `fold.ts` `LiveStreamFolder` 给事件附加 `sessionId`（`accept(event, sessionId)`）；`api.ts` 从 MuxFrame payload 提取 `sessionId` 传入；`store.ts` subscribe 按 `activeSessionId` 过滤——后台会话（增强临时会话）不再串进当前会话显示。
  2. `workspace.archiveSession` 不影响 `session.list`（归档是 workspace 树概念），故 `api.ts` 增加前端隐藏集（localStorage `reasonix:hidden-sessions`）过滤增强临时会话，侧边栏不再残留。
- **实测结果**：输入"帮我总结这个项目的测试策略"→ 增强回填为 5 维度结构化提示词（约 8s）；还原按钮恢复原文；增强后侧边栏会话数不变（78→78）、当前会话显示无污染。

### B5 STT 迁移：双引擎（Web Speech 优先 + 本地 Whisper 兜底，已实测）
- **根因**（已证实）：Web Speech API 依赖浏览器厂商在线识别服务（Edge 内置 Bing speech.platform.bing.com，大陆可达且识别准确；豆包浏览器未接入该服务），`navigator.mediaDevices.getUserMedia` 权限 granted 但 `rec.start()` 后仅 `error:not-allowed`、无任何 result。**换 Chrome 同样不行**。
- **方案（用户拍板 A + 用户补充偏好）**：以**浏览器自带引擎（Edge Web Speech，准、实时 interim）为优先**；浏览器暴露 SpeechRecognition 但引擎不可用（豆包 not-allowed）或 API 缺失时，**自动回退到后端本地 Whisper**（getUserMedia 录音 → `audio.transcribe` RPC，离线、准确率较低、无实时 interim）。用户明确"新增的 Whisper 识别不准不需要"→ 因此 Edge 走自带引擎，Whisper 仅作兜底。
- **后端**：`packages/host/apiproxy/src/api/audio.ts`（契约）+ `audio.schema.ts`（zod 校验）+ `audio-transcriber.ts`（懒加载单例；`env.remoteHost='https://hf-mirror.com/'`、模型 `Xenova/whisper-base`，可用 `REASONIX_STT_MODEL`/`REASONIX_STT_HF_MIRROR` 覆盖；缓存 `~/.cache/dsh-huggingface`；线性插值重采样 16k）。`fetch/handler.ts` 路由 `audio.transcribe`；`rpc-map.ts`/`api/index.ts`/`api-proxy.ts`（`decodePcm16`）/`fetch/client.ts`（IApiClient.audio + value schema）/`ApiProxyService`/client fixture 全链路补齐 audio 域。payload `{audio: base64 16-bit LE mono PCM, sampleRate: 8000–96000}` → `{text, model, durationMs}`；业务错误走 `err(request,{code:'internal',...})`。
- **依赖**：`@xenova/transformers ^2.17.2`；sharp 0.32.6 为 transformers 传递依赖，需构建——根 `.npmrc` 设 `sharp_binary_host`/`sharp_libvips_binary_host` 指向 npmmirror（GitHub 默认 ECONNREFUSED/证书失败），`pnpm-workspace.yaml` `onlyBuiltDependencies: [sharp]`，手动在 `sharp@0.32.6` 下跑完 `node install/libvips`（libvips 8.14.5 缓存命中）+ `prebuild-install`（`NODE_TLS_REJECT_UNAUTHORIZED=0` 绕过证书验证）+ `dll-copy`，`build/Release/sharp-win32-x64.node` 就位。
- **前端**：`lib/stt.ts` 双引擎管理器——Web Speech 引擎（zh-CN、continuous+interimResults、onend 自动重启、not-allowed 时置 `dead` 后切换）+ Whisper 引擎（getUserMedia + MediaRecorder 录音 → `AudioContext.decodeAudioData` → Int16 PCM base64 → `POST /api/audio.transcribe` → 回填）。关键修复：**引擎被替换（dead 标志）后其异步回调（如 abort 后的 onend）不得再驱动 UI onState**，否则回退后 Whisper 的"聆听中"状态会被旧引擎的 `onState(false)` 覆盖（表现为 UI 显示"可开始"而实际在录音→用户"停不下来/识别不到"）。`SpeechRecognizer` 接口不变，Composer 无需改动；含"录音太短"防御与停止竞态处理（getUserMedia 未就绪时 stop 立即复位）。
- **实测**：① 命令行 E2E `POST /api/audio.transcribe`（SAPI 中文 wav）→ HTTP 200 `"你好世界,欢迎使用语音收入功能"`（whisper-base，durationMs≈1s）；② 浏览器（豆包内核，无语音服务）点麦克风→提示"已切换本地离线识别"→自动切 Whisper 进入聆听→停止→约 8s 内回填识别文本、按钮复位、无错误；③ Edge 走自带 Web Speech 引擎（实时、准），不触发回退。

### B6 待办（阶段 A，未开始）
- reasonix 外观承载官方 40+ 功能插槽（权限审批、MCP 管理、记忆、设置等）；其中"增强"可用 harness 新增 `llm.complete` 纯补全 RPC 取代临时会话方案，彻底消除后端临时会话记录。
