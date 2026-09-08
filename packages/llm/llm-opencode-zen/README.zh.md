# @deepseek-ai/dsh-llm-opencode-zen

[English](README.md) | 中文

面向 harness LLM 接缝的 OpenCode Zen chat-completions 适配器：直接使用 `fetch` + SSE（由 `eventsource-parser` 分帧）将 [OpenCode Zen 网关](https://opencode.ai/zen) 的 OpenAI 兼容线格式转换为 `StreamChunk` 协议。匿名免费层完全不需要任何凭据——适配器默认发送字面量 bearer `public`，因此一个组合无需 API key、凭据接缝或环境变量即可调用免费模型。

本包拥有 `opencode-zen` 提供方路由，与 `deepseek-official`（dsh-llm-deepseek）及 pi-ai 目录路由相互独立，因此一个组合可以并排挂载所有 LLM 路径；为 `opencode-zen` 再注册其他适配器仍会抛出 `LlmError('DUPLICATE_ADAPTER')`。

包根暴露 Cordis 插件契约与 `OpenCodeZenAdapter`；线序列化、SSE 解析与分块翻译辅助函数不属于该根契约。

## 配置

```yaml
- id: llm-opencode-zen
  name: '@deepseek-ai/dsh-llm-opencode-zen'
  config:
    apiKeyEnv: OPENCODE_ZEN_API_KEY  # optional; omit → anonymous `public` free tier
    baseURL: https://opencode.ai/zen/v1 # optional; this is the default
    maxTokens: 32768                # optional positive per-request output cap; this is the default
    streamIdleTimeoutMs: 300000     # optional; positive finite Node timer delay; five-minute default
    retryPolicy:                    # optional; omission uses bounded normal defaults
      mode: always                  # normal | always
      backoff:
        initialDelayMs: 500
        maxDelayMs: 10000
        jitterRatio: 0.1
    defaultContextWindow: 262144    # optional positive-integer fallback; this is the default
    models:                         # optional; defaults to the curated free-tier catalog
      - id: deepseek-v4-flash-free
        name: DeepSeek-V4-Flash Free
      - id: private-free-corridor
        description: Company-hosted free gateway model
        contextWindow: 512000
```

插件注册单一提供方路由 `opencode-zen` 及其解析后的 `retryPolicy`。请求以 `provider: opencode-zen` 选择它；其 `model` 原样透传为线上的 `model` 字符串，因此更换模型无需生命周期时注册。省略 `models` 时公布匿名端点提供的精选免费层目录（`deepseek-v4-flash-free`、`mimo-v2.5-free`、`hy3-free`、`nemotron-3-ultra-free`、`nemotron-3.5-lightning-free`、`laguna-s-2.1-free`）；显式列表会替换这些默认值，而 `models: []` 不公布任何模型。目录条目通过 `ctx.llm.listModels('opencode-zen')` 暴露给 ACP 编辑器、Web 选择器等客户端，但仅作参考：未列出的模型 id 仍原样通过。省略的条目名称默认为其 id。

`contextWindow` 对每个已配置模型是可选的。`ctx.llm.resolveModelInfo('opencode-zen', model).context` 优先返回精确模型值，其次对无容量的条目或未列出的透传 id 返回 `defaultContextWindow`。公布的容量来自 models.dev 目录的估计，而非提供方权威上限——对压力敏感的插件将其视为部署自有值，绝不作为硬契约。

`maxTokens` 是会话请求的适配器配置输出上限，默认为 32,768。目录条目可携带自己的 `maxTokens`，对该模型生效；未带该字段的条目以及任何未列出的透传 id 回退到配置值。精确模型解析将胜出值暴露为 `defaultMaxTokens`；`LlmRuntime` 会在 agent 循环写入 `request/header` 前将其物化为 `GenerateOptions.maxTokens`，因此线上请求始终可重建。显式的请求或 `AgentOptions.maxTokens` 值优先，序列化为 `max_tokens`。适配器不会针对 `contextWindow` 收敛此请求预算。

### 用已登录的 opencode 账号登录

你在本机 opencode CLI 里已登录的账号（`opencode auth login opencode`）可以为该路由作后端：运行 `pnpm run login:opencode` 会把它存储的凭据导入 `$DSH_HOME/.credentials.yaml`，写入 `OPENCODE_ZEN_API_KEY`（无密码提示、不回显任何内容），然后给条目加 `apiKeyEnv: OPENCODE_ZEN_API_KEY`。Web 的模型设置页在 opencode-zen 提供方卡片上提供了同一动作的"从 opencode 登录导入"按钮（驱动 `llm.importOpencodeCredential`，读取 opencode CLI 的 `auth.json` 并通过 harness 凭据接缝写入，绝不跨越线上）。导入的 key **不会**解锁匿名层热门模型的配额——那按客户端 `User-Agent` 计量、适配器无论如何都会发送；账号 key 服务于账号级额度与付费档。

恰有一个方面刻意不可配置：reasoning effort。免费目录横跨多个提供方，彼此的努力词表互不兼容，因此本适配器不发 `reasoning_effort`，也不公布任何 `reasoning` 能力——每个模型都按提供方自身默认行为作答，显式的 `GenerateOptions.reasoningEffort` 在任一网络 I/O 前以 `UNSUPPORTED_REASONING_EFFORT` 失败。需要特定方言线上字段的部署请改用 pi-ai 的 `openai-completions` 路由。

`streamIdleTimeoutMs` 限制每次未完成的提供方读取（含初始 `fetch`），不计消费者在两个分块之间的思考时间。SSE 注释会让未完成的读取重新武装为传输活动，但绝不会成为 `StreamChunk` 值或会话日志事件。一次调用全程使用同一个稳定中止信号到达请求与正文读取器；到期停止传输并抛出 `LlmError('TIMEOUT')`，更早的调用方中止抛出 `LlmError('ABORTED')`。适配器每次 `stream()` 调用恰好发出一个提供方请求；它把所配置策略注册为提供方元数据，`dsh-llm-retry` 在持久 agent 步骤边界单独执行该策略。

## 动态配置（settings + credentials）

连接事实不会在加载时冻结。`resolveAdapterOptions` 是从原始配置到已验证事实的唯一显式解析步骤，适配器通过 thunk **每次操作**重新读取它们：base URL、目录、输出上限与空闲预算都在下一次请求生效，而进行中的流保持启动时的事实。两个可选接缝为该 thunk 供数：

- **`ctx.settings`** — 插件注册 `llm-opencode-zen` 命名空间，使用同一 `Config` schema，其 `cordis.yml` 条目作为组合 `base`，因此用户设置文档中的 `llm-opencode-zen:` 区块可以不经重启覆盖任意字段——包括通过增删 `apiKeyEnv` 切换匿名与鉴权方式。未挂载 settings 服务时，仅条目配置驱动适配器，行为不变。通过 schema 但违反超 schema 约束（如重复目录 id）的实时设置快照会保留上次良好的事实并记录失败；条目配置本身仍会导致插件加载失败。
- **`ctx.credentials`** — 显式 key 在每次流调用时从不晚于提供该端点的同一解析快照解析。配置只携带 `apiKeyEnv`，绝不含字面量 key：引用经凭据接缝解析，未挂载接缝时经进程环境解析。由于凭据事实与连接事实同行，解析器拒绝的设置快照既不会贡献其端点也不会贡献其 key：上一代配置整体继续服务。每个解析出的 key 在使用前都会做格式检查，因此 HTTP 头无法承载的值以 `LlmError('INVALID_CREDENTIAL')` 拒绝并点名失败入口——绝不包含 key 的任何部分——而不是以不透明的 `fetch` `TypeError` 形式浮出。完全省略 `apiKeyEnv` 即匿名免费层：请求携带字面量 bearer `public`，任何位置都不需要凭据。已配置但解析不到任何值的引用以 `MISSING_CREDENTIAL` 失败并点名每一配置入口——绝不会因部署者要求真实 key 而静默降级为匿名——同时路由保持注册、目录保持可浏览。

唯一注册时捕获的事实是重试策略：其解析值变化时，插件原位重新注册该路由（同一适配器实例、单一同步区块），因此 `ctx.llm.providerRetryPolicy('opencode-zen')` 始终报告当前策略。

插件还在可配置提供方目录中声明其路由（`ctx.llm.listConfigurableProviders()`）：提供方 `opencode-zen`，settings 命名空间 `llm-opencode-zen`，空 settings 路径——整个区块即该 profile。配置界面据此将本适配器与休眠的 pi-ai 提供方并列提供。

<a id="app-attribution"></a>

## 应用归属

每个请求都携带 OpenCode Zen 的会话级身份头，形状与官方 opencode CLI 一致，使网关以相同方式计量请求。每次请求铸造一组全新且格式良好的 `x-opencode-session`（`ses_<hex>`）、`x-opencode-request`（`msg_<hex>`）、`x-opencode-project`（`<hex>`），以及常量 `x-opencode-client: dsh`。网关以这些 id（而非裸来源 IP）计量免费层，因此每次请求的新会话 id 走与官方客户端相同的会话级配额，而不是耗尽共享的按 IP 桶；这些 id 是不透明线上身份，绝非用户数据。

`User-Agent` 替换 dsh-llm `attributionHeaders()` 的默认值（归属契约允许的白标替换，绝非抑制）：请求发送 opencode 客户端前缀 `opencode/local ai-sdk/provider-utils/4.0.23 runtime/bun/1.4.0 (deepseek-harness)`。对网关的实时 A/B 实测表明：匿名免费层会对未被识别为 opencode 生态客户端的请求限流热门免费模型（`deepseek-v4-flash-free`、`mimo-v2.5-free`），而带官方前缀的 `User-Agent`（任意 `x-opencode-client`）即可通过；`(deepseek-harness)` 后缀保持线上如实标注来源。匿名层仅凭 bearer（字面量 `public`）鉴权。

## 线格式说明

- 每次提供方调用铸造一组全新的 OpenCode Zen 会话身份（`x-opencode-session` 及兄弟头，见 [应用归属](#app-attribution)）——与 opencode CLI 发送的形状一致，因此免费层配额按会话计量，而非从共享的按 IP 桶中消耗。
- 仅流式（`stream_options.include_usage` 恒开启）。`usage` 可能附着于结算分块、作为尾部仅用量分块到达，也可能根本不出现（部分上游提供方省略）——翻译器把已到达的用量推迟到 `[DONE]`，因此 `usage` 始终先于 `finish`、`finish` 之后再无内容，而用量缺席时仅是不发出 `usage` 分块。
- 线上永远不会出现 `reasoning_effort` 或 `thinking` 字段；首个 reasoning 分块携带 `reasoning_content: ""`——已被妥善处理（不会打开虚假 reasoning 块）。
- **reasoning 回传规则**：在曾携带工具调用的 assistant 轮次中，`reasoning_content` 会序列化回历史；无工具调用的轮次中丢弃（反正被忽略——省 token）。
- 缓存记账：`cacheReadTokens` ← `prompt_cache_hit_tokens` / `prompt_tokens_details.cached_tokens`；缓存读取从 `inputTokens` 中减去，以保持 TokenUsage 各计数不相交。

## 错误

非 2xx 响应抛出稳定码 `LlmError`：`AUTH`（401/403）、`QUOTA`（429 且提供方 code/type/message 标识免费/go 配额耗尽——包括匿名层按 IP 的每日上限 `FreeUsageLimitError`/`GoUsageLimitError`，以及任何命中共享配额分类器的细节）、`RATE_LIMIT`（其余 429）、`CONTEXT_WINDOW_EXCEEDED`（400 且提供方 code/type/message 标识上下文溢出）、`INVALID_REQUEST`（其余 400）、`SERVER`（5xx）、其余为 `HTTP_<status>`。其可序列化 `failure` 保留 HTTP 状态，外加有效的正 `Retry-After` 秒/日期延迟与存在时的 `x-request-id`。响应前传输失败（DNS、拒绝连接、TLS、代理）抛出 `TRANSPORT`，点名所配置端点并把原始拒绝链为 `cause`；调用方中止抛出 `ABORTED`，循环取消信号保持权威。协议违规抛出 `STREAM_CLOSED`（缺失 `[DONE]`；默认策略会重试）或 `MALFORMED_RESPONSE`（坏 JSON 载荷）。未知线上 `finish_reason`（如 `content_filter`）变成 `finish {kind: 'error', failure}` 分块，而一个已完成且空内容 `stop`（或缺省）结算未打开任何内容块的流变成 code 为 `EMPTY_RESPONSE` 的 `finish {kind: 'error'}`（默认策略会重试）。

## Model Experience

### OpenCode Zen 请求

#### 模型所见

所选 OpenCode Zen 模型收到 harness 系统提示、消息历史、工具 schema、停止序列与调用配置，适配器不自作主张地加入任何提示散文。若此前有携带工具调用的 assistant 轮次，其 reasoning 内容按需回传；无工具调用的轮次则省略。不配置任何 reasoning effort：模型按提供方默认行为作答。

#### Token 影响

确切输入由提供方分词决定。有条件的 reasoning 回传会增加工具往返上下文，而丢弃其余 reasoning 可避免重复为之付费；可用时上报缓存读取用量。

#### KV 缓存影响

未变动的已组装前缀可命中 OpenCode Zen 上游缓存复用，适配器在用量中上报之。模型路由变更或任何上游提示、schema、前缀、历史变化都可能导致自首个变化 token 起无法复用；reasoning 回传在工具往返期间追加。

### OpenCode Zen 响应

#### 模型所见

reasoning、文本与原始字符串工具参数被翻译为 harness 分块供循环记录并组装。

#### Token 影响

生成 token 遵循请求的 `maxTokens`；只有循环保留的块影响后续输入。不报告流用量的上游提供方会使该次调用不产生 `usage` 分块。

#### KV 缓存影响

循环保留的响应块追加到下一次请求并保持其先前的可复用前缀；被丢弃的块无后续缓存影响。更换提供方或模型会选中不同的缓存域。

## 已知限制与待办工作

- **匿名免费层为尽力而为、按会话计量，且间歇性受限** —— 网关以本适配器每次请求铸造的会话身份与所发送的 opencode 客户端 `User-Agent` 计量免费可用性（热门模型对已识别客户端放行）。耗尽可能仍应答 HTTP 429 `FreeUsageLimitError`、归类为 `QUOTA_EXCEEDED`，也可能对某些模型/提示返回空流；可用性共享且不受保证，该层限制完全在本包之外。
- **无 reasoning-effort 控制** —— 免费目录没有单一 effort 词表，因此显式 effort 会被拒绝且不发送 `reasoning_effort`；需要特定方言的部署请使用 pi-ai 的 `openai-completions` 路由。
- **`tool_choice` 未映射** —— 不属于核心词表（MVP 裁剪，与 DeepSeek twin 一致）。
- **公布的上下文窗口是目录估计** —— 精选条目携带来自 models.dev 的近似容量，而非提供方权威上限；对压力敏感的部署应自行配置每个模型的 `contextWindow`。
- **settings 的 `models` 列表整体替换组合列表** —— settings 层合并按字段进行，数组只是单一字段；逐条目目录合并需要键控形状。
- **请求使用原始 `fetch`，而非 `@cordisjs/plugin-http`** —— 无共享代理/拦截配置；在有第二个适配器需要之前推迟采纳（`TODO(http)`，与 DeepSeek twin 同债务）。
- **OpenAI 兼容线模块刻意与 dsh-llm-deepseek 成对孪生** —— `parseSse`、`translate` 与消息序列化器除了缺失 thinking/effort 字段外，与 DeepSeek 适配器的协议代码逐字节一致；共享传输抽取是本重复等待的推迟重构，jscpd ignore 标记限定了允许的表面积。