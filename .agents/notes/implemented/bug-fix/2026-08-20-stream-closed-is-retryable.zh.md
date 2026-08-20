# Agent Note: 被中断的 STREAM_CLOSED 流默认会重试

Status: implemented

[English](2026-08-20-stream-closed-is-retryable.md) | 中文

## 问题

长时间运行的目标任务可能在模型流中途被中断时永久停止。没有终止标记（没有 `[DONE]` / done 事件）就结束的 SSE payload 会让各适配器以 code `STREAM_CLOSED` 抛出 `LlmError`。既有默认提供方重试策略排除了该 code，因此 `dsh-llm-retry` 直接委托而不重试；步骤失败，轮次以错误结束，goal-round-driver 在 `agent/error` 时卸下（disarm）目标。部分流式输出被丢弃，但整个被中断的任务停止，而不是恢复。

## 决策

`STREAM_CLOSED` 加入了 `EMPTY_RESPONSE`、`RATE_LIMIT`、`SERVER`、`TIMEOUT` 与 `TRANSPORT`，成为默认 normal mode 的可重试 code（`dsh-llm/src/retry-policy.ts` 中的 `DEFAULT_RETRYABLE_CODES`）。缺少终止标记的正常截断是一次瞬时协议线中断：失败尝试从不被视为完整，其部分分片从不进入派生消息（不会提交 `assistant/message`），因此重试会重建完全相同的持久表层并在有界退避预算下重复该请求。`dsh-llm` 导出规范的 `STREAM_CLOSED_CODE` 常量，deepseek、opencode-zen 与 pi-ai 适配器都抛出它。

这是[可脚本控制的 LLM 协议层故障服务器](../../implemented/testing/2026-07-25-scriptable-llm-wire-fault-server.md)旁记录的、被推迟的"需单独决策，权衡成本、延迟与重复生成风险"的决定：长时间自主任务应能扛过一次被中断的流，并由默认的两次重试上限约束。

## 曾考虑的替代方案

**在目标驱动器中重试**：goal-round-driver 可以在任何错误后重新武装并重新驱动一个轮次。不予采纳，因为它重复了请求恢复缝：驱动器刻意不分类活动（提供方错误不是提示词层面的目标结果），而请求级重试已经重建相同的持久历史，既不消耗额外的轮次预算，也不改变模型可见输入。

**把 STREAM_CLOSED 留在默认之外，要求显式 `retryableCodes`**：配置接口本就支持按部署添加该 code，但报告的失败恰恰是那种省略 `retryPolicy`、依赖默认值的部署。保持默认不变就意味着保留停止行为，未交付任何恢复能力。

**把该决定并入 mock server 包**：与变更前相同的理由不予采纳——协议线故障服务器只揭示语义，不应成为决定重试策略的地方。默认值随策略本身存在，mock server 只执行调用方配置的策略。

## 验证

`retry-policy.spec.ts` 套件断言扩展后的默认 code 集合。`transport-recovery.spec.ts` 让 `partial_eof`（没有 `[DONE]` 的正常 EOF）依次经过真实 HTTP/SSE 适配器、`dsh-llm-deepseek`、`dsh-agent-loop` 与 `dsh-llm-retry`，断言两次请求、请求体一致、`llm/retry` 记录的失败 code 为 `STREAM_CLOSED`、只提交一条助手消息以及恢复后的文本。`retry.spec.ts` 证明在没有 `retryableCodes` 覆盖的情况下，抛出的 `STREAM_CLOSED` 流错误会按默认策略重试。

## 后果

单一一次被中断的流不再终止长任务：循环带退避重试，恢复的尝试完成后目标继续。代价是被推迟的权衡——反复正常截断的提供方现在会消耗有界重试预算（默认两次）并带来相应的重复生成延迟，而不是立即让该轮失败。希望保留之前严格行为的部署可在自己的 `retryableCodes` 中排除 `STREAM_CLOSED`。