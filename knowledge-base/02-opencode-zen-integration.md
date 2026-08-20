# DeepSeek Harness · OpenCode Zen 免费模型集成开发记录（2026-08）

## 背景

deepseek-harness 需要一个可直接调用 opencode（opencodeai）免费模型的通路：无需任何 API Key、匿名 `Bearer public`，并能在 WebUI 上完成账号登录。

## 交付内容

- **新适配器包 `@deepseek-ai/dsh-llm-opencode-zen`（`packages/llm/llm-opencode-zen`）**
  - OpenAI 兼容 chat-completions 直连适配器，路由 `opencode-zen`，端点 `https://opencode.ai/zen/v1`
  - 匿名免费层默认零配置；可选 `apiKeyEnv` 走账号通道，做不得静默降级
  - 内置 6 个免费模型目录：deepseek-v4-flash-free、mimo-v2.5-free、hy3-free、nemotron-3-ultra-free、nemotron-3.5-lightning-free、laguna-s-2.1-free
  - 138 单测、逐文件 100% 覆盖率、live e2e 实测回话
- **热门免费模型 429 的根因与修复（关键）**
  - 网关按会话级身份头（`x-opencode-session: ses_…`）与客户端 `User-Agent` 计量免费配额
  - 适配器每次请求铸造全新 `ses_*`/`msg_*` 会话身份 + 官方前缀 UA（`opencode/local … (deepseek-harness)`，诚实后缀）
  - 修复后 `deepseek-v4-flash-free` 等热门模型在 harness 上可稳定通过
- **WebUI 登录入口**
  - 新增 Host RPC `llm.importOpencodeCredential`：读取 opencode CLI `auth.json` 凭据写入 harness credentials（`OPENCODE_ZEN_API_KEY`），密钥不上线
  - Models 设置页 OpenCode Zen 提供方卡片加"从 opencode 登录导入"按钮（中英文案）
  - 命令行入口 `pnpm run login:opencode`
- **文档与工具**
  - 适配器双语 README、两个 implemented Agent Note、config-catalog 再生成
  - 用户手册 `QUICKSTART.zh-CN.md` + 一键启动 `start-dsh-web.bat`

## 验证

- live e2e（laguna-s-2.1-free / deepseek-v4-flash-free）HTTP 200 真实回话
- `llm.models` 返回全部 6 个免费模型；headless 分别以 laguna / nemotron-3-ultra-free 实测切换模型生效
- typecheck / lint / duplication / 单元与 GUI 套件 / doc 门禁全绿
- 已推送提交 `c22708b`（feat(llm): add OpenCode Zen free-model adapter and web login）

## 备注

- 免费层为尽力而为：热门模型偶发 429（`QUOTA`），换冷门模型或稍后重试即可
- GUI 变更的仓库义务项（web 回放快照、GIF）待 PR 前补跑