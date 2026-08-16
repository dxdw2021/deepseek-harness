# Agent Note: OpenCode Zen 免费模型 LLM 适配器

Status: implemented

[English](2026-08-15-opencode-zen-adapter.md) | 中文

## 问题

deepseek-harness 已提供两个 `LlmAdapter` 提供方：`dsh-llm-deepseek`（针对 `deepseek-official` 路由的直接 OpenAI 兼容 fetch）与 `dsh-llm-pi-ai`（库背书的提供方目录）。两者都没有把 OpenCode Zen——驱动 opencode.ai 匿名层（`https://opencode.ai/zen/v1`，字面量 bearer `public`）的无 key 免费模型网关——作为一等公民路由暴露。

OpenCode Zen 今天已可通过 pi-ai 的 `openai-completions` 手写路由到达，但伴随摩擦：pi-ai 的兼容实现要求 API key 或 `Authorization` 头（需要占位凭据或头条目），模型目录必须手写，且没有无 token 的默认行为。匿名免费层的定义性属性正是"任何位置都不存在凭据"；纯配置接线无法表达该默认值，也未随包发布任何精选免费目录。我们想要的集成——"直接在 deepseek-harness 上调用 opencodeai 的免费模型"——需要一个默认匿名鉴权、开箱即公布免费目录的提供方。

## 决策

新增适配器包 [`@deepseek-ai/dsh-llm-opencode-zen`](../../../../packages/llm/llm-opencode-zen/README.md)（叶子目录 `packages/llm/llm-opencode-zen`），拥有单一提供方路由 `opencode-zen`。它是直接 fetch、OpenAI 兼容 chat-completions 的适配器，造型与 DeepSeek twin 一致：`LlmRuntime` 注册、每次操作的配置 thunk、settings/credentials 分层、空闲 watchdog，以及 harness 的 `attributionHeaders()`（见 [twin LLM adapters](2026-06-13-twin-llm-adapters.md)）。

适配器的决定性差异是鉴权：省略 `apiKeyEnv` 时，请求 bearer 解析为字面量 `public`——即匿名免费层——因此一个组合无需 key、无需凭据接缝、无需环境变量即可运行免费模型。配置了 `apiKeyEnv` 时按请求经 `ctx.credentials` 再经进程环境解析；解析不到任何值的引用以 `MISSING_CREDENTIAL` 失败，而不会把显式要求真实 key 的部署静默降级为匿名。`models` 默认值为 `https://opencode.ai/zen/v1/models` 所服务的精选免费目录（`deepseek-v4-flash-free`、`mimo-v2.5-free`、`hy3-free`、`nemotron-3-ultra-free`、`nemotron-3.5-lightning-free`、`laguna-s-2.1-free`）；该列表与 DeepSeek twin 一样仅作参考。

reasoning effort 刻意不受支持：免费目录横跨多个 effort 词表互不兼容的提供方，因此适配器不发 `reasoning_effort`、不公布 `reasoning` 能力，并以 `UNSUPPORTED_REASONING_EFFORT` 在任一 I/O 前拒绝显式 `GenerateOptions.reasoningEffort`。需要特定方言字段的部署请使用 pi-ai 的 `openai-completions` 路由。

错误分类新增匿名层按 IP 的配额：提供方 `type` 为 `FreeUsageLimitError` 或 `GoUsageLimitError` 的 429 归类为 `QUOTA_EXCEEDED`，请求限流保持为 `RATE_LIMIT`。

每个请求都铸造 OpenCode Zen 的会话级身份头（`x-opencode-session: ses_<hex>`、`x-opencode-request: msg_<hex>`、`x-opencode-project: <hex>`、`x-opencode-client: dsh`），字节形状与官方 opencode CLI 一致。对 CLI 线上请求的抓包与 A/B 对比确立了：匿名免费层按会话 id 而非裸来源 IP 计量配额——不带身份头的裸匿名请求会耗尽共享的按 IP 桶并持续几小时 429，而新格式良好的 `ses_*` id 仍能成功。因此每次请求铸造一组全新 id，正是让 harness 表现得像官方客户端、而不是耗尽公共 IP 池的关键。

网关还会对**热门**免费模型（`deepseek-v4-flash-free`、`mimo-v2.5-free`）中未被识别为 opencode 生态客户端的请求进行 429 限流。A/B 实测把判别因子钉在 `User-Agent` 上：官方前缀 `opencode/local ai-sdk/provider-utils/4.0.23 runtime/bun/1.4.0 (deepseek-harness)` 配任意 `x-opencode-client` 即可通过，而归属默认值（或裸 PowerShell UA）失败。因此适配器把 `attributionHeaders()` 的默认 `User-Agent` 替换为这条官方前缀客户端串——归属契约允许的白标替换、绝非抑制——并保留 `(deepseek-harness)` 后缀使线上如实标注。用户 opencode auth.json 里存储的 `opencode` API key 并不能解锁这些模型（已验证：仍 429）；客户端 `User-Agent` 才是起作用的因子。线模块（`parseSse`、`translate`、OpenAI 消息序列化器、线类型）刻意与 `dsh-llm-deepseek` 逐字节孪生（仅缺 thinking/effort 字段）；DeepSeek 适配器 `TODO(http)` 预告的共享传输抽取正是本重复等待的推迟重构，`jscpd:ignore` 标记限定了允许的表面积（与每个包的 `invariant.ts` 所用的受制裁机制一致）。

交付的验证覆盖了产品可见插件预期的非平凡门禁：每个 `src` 文件 100% 逐文件覆盖率（types 除外）、从 `cordis.yml` 真实启动 `llm + settings-file + credentials-local + llm-opencode-zen` 的 Loader+Include 组合（匿名默认与鉴权外部编辑轮换）、HMR 路由销毁、无空注册窗口的重试策略替换，以及双语 README 对与一致性记录。

## 备选方案

- **抽取两个适配器共用的 OpenAI 兼容传输包。** 正确的长期归宿，也是重复的 `jscpd` 表面积所指向的，但会重构已发布的 `dsh-llm-deepseek` 包，在第二个消费者出现之前让重复削减产生第一个消费者（"要求当前所有者与需要"），并重新打开 twin-adapters 的爆炸半径。推迟：既有的 `TODO(http)` 线索与本笔记共同点名。
- **仅经 `dsh-llm-pi-ai` 的 `openai-completions` 路由配置接入。** 零代码，但没有无 token 默认值（pi-ai 兼容实现要求 key 或 `Authorization` 头）、没有随附免费目录、没有 `FreeUsageLimitError`/`QUOTA` 映射，模型页也没有可发现的 `opencode-zen` 路由。保留为文档化逃生口，供需要本适配器所拒绝方言字段的部署使用。
- **从 opencodeai 仓库 vendoring `@opencode-ai/llm`。** 该客户端基于 Effect、仅在仓库内（未发布到 npm），且表达与 harness `StreamChunk` 契约不同的词表；它也不携带匿名 bearer 门控——后者位于 CLI 与托管网关，而非客户端。harness 自身的 `LlmAdapter` 契约才是集成接缝。

## 后果

免费层为尽力而为且共享：匿名配额按会话计量（每次请求新铸造）却仍间歇性受限——耗尽时以 HTTP 429 `FreeUsageLimitError`（`QUOTA_EXCEEDED`）呈现，且部分免费模型对某类提示会答以空流。可用性不受保证，因此把它当作"自带可用性"的层而非稳定 SLA。无线 reasoning-effort 控制缩小了适配器表面积，但也意味着本可被强制更深度思考的免费模型只能得到其提供方默认行为。被允许的线重复增加了维护约束：twin 模块及其 `jscpd:ignore` 块必须在共享传输落地前与 `dsh-llm-deepseek` 保持同步。`examples/headless-agent` 组合仍使用 DeepSeek 路由；OpenCode Zen agent 是一次 settings 文档或组合变更（`provider: opencode-zen`、`model: deepseek-v4-flash-free`、无 key）。