# completion/summary 会话事件

- 日期：2026-08-28
- 领域：`packages/core/session`（持久化事件词表）
- 类型：基础（foundation）

## 动机

一次交付需要在会话日志里留下结构化、可重建的裁决。当前 harness 记录
turn、step 与工具调用对，却没有捕获「交付结果」本身的状态（目标完成、
子代理回交、或显式总结步骤）：跑过的检查、做出的变更、以及审阅结论。下游
界面（桌面端「概览」面板、交付报告）目前没有这一摘要的持久来源。

参考桌面应用将其建模为 `WireCompletionSummary`，渲染在 workspace 面板的交付
卡片里。本笔记补齐这类界面所需的持久词表，遵循 harness「模型可见 ⟺ 已记录」
的规则：任何值得展示的交付裁决都必须能从日志重建。

## 改动

- 在 `packages/core/session/src/types.ts` 的 `SessionEventMap` 新增成员
  `'completion/summary'`（属于拥有词表的主接口，而非插件 `declare module`
  合并）。
- 在既有 `TodoItem` 定义旁新增 `CompletionSummaryEventData` 及其值联合类型
  `CompletionVerdict`、`CompletionReview`、`CompletionChecks`。
- 新增 `validateCompletionSummaryData(data)`——一个纯断言函数，校验语义边界
  （非空 `preset`、封闭枚举的 `verdict`/`review`、非负的 `mutations` 与各项
  检查计数、可选字段类型）。它在生产者边界失败即报错；`Session.append`
  已通过 `isJsonValue` 单独强制 JSON 可序列化性。
- `completion/summary` 为 **log-only**：不产生派生历史消息，也不携带
  `surfaceOp`。会话不变量中 merge-extensible 的 `default` 分支在无 turn 封闭
  约束下接受它，因此生产者可在 turn 结束后独立追加。
- 通过 `scripts/gen-persistence-catalog.ts` 重新生成
  `packages/core/session/src/known-event-types.ts` 与
  `docs/persistence-catalog.md`（`completion/summary` 条目现位于生成的
  `completion/*` 区段）。未 bump `SESSION_FORMAT_VERSION`：这是普通词表增长，
  由每个事件的 `ignorable` 守卫覆盖。
- 新增 `packages/core/session/tests/completion-summary.spec.ts`，覆盖词表集合、
  独立追加、重放、JSON 不可序列化拒绝，以及 `validateCompletionSummaryData`
  的全部拒绝路径。

## 契约

```ts
'completion/summary': CompletionSummaryEventData
```

```ts
interface CompletionSummaryEventData {
  preset: string
  verdict: 'success' | 'partial' | 'failure'
  mutations: number
  checks: { passed: number; failed: number; suppressed: number; skipped: number }
  review: 'approved' | 'changes_requested' | 'pending' | 'not_required'
  gapKinds?: string[]
  constraintDegraded?: boolean
  note?: string
}
```

- 生产者拥有 `preset` 与 `gapKinds` 的词表；读者将其视为不透明值。
- 任何投影以「最近一次写入获胜」为准；旧摘要仍保留在日志中供审计。
- 形态为 JSON 可序列化；`Session.append` 独立于
  `validateCompletionSummaryData` 拒绝不可序列化负载。

## 明确不在范围内

- **生产者**：尚无任何 capability 追加 `completion/summary`。agent loop、目标
  完成或子代理回交在具备交付摘要时应负责产出。本笔记仅落地词表与校验。
- **投影**：`session-projection` 单元（最近写入获胜的
  `completionSummary`）属独立改动；事件本身已可重放。
- **Agent Note 双语**：`.zh.md` 本文件记录相同事实。

## 验证

`node node_modules/.pnpm/vitest@*/node_modules/vitest/vitest.mjs run packages/core/session/tests/completion-summary.spec.ts`
——10/10 通过。`pnpm run gen-persistence-catalog` 与源码合并一致地重新生成
`known-event-types.ts` 与目录。
