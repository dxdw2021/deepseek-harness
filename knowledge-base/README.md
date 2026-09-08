# Knowledge Base（本地知识库）

DeepSeek Harness 的知识归档，面向日常查阅：架构总览、关键集成记录与快速启动。

| 文档 | 内容 |
|---|---|
| [01-deepseek-harness-architecture.md](01-deepseek-harness-architecture.md) | 项目架构技术文档：仓库布局、组合模型、事件模型、LLM 能力族、会话/持久化、Web UI 分层、质量门禁 |
| [02-opencode-zen-integration.md](02-opencode-zen-integration.md) | OpenCode Zen 免费模型集成开发记录：适配器、429 根因与修复、WebUI 登录入口、验证结果 |
| [03-quickstart-zh-CN.md](03-quickstart-zh-CN.md) | 快速启动用户手册：环境、启动命令、WebUI 使用、模型选择、账号登录、FAQ |

相关源码入口：`packages/`（按能力分组的 `@deepseek-ai/dsh-*` 包）、`docs/architecture.md`（官方架构文档）、`packages/llm/llm-opencode-zen/`（OpenCode Zen 适配器）。
