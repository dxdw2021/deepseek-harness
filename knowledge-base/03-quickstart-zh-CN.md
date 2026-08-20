# DeepSeek Harness 快速启动手册（用户向）

本文说明如何在本机把 deepseek-harness 跑起来并开始对话，重点覆盖 WebUI 界面、模型选择、OpenCode Zen 免费模型和账号登录。所有命令均在项目根目录 `.\` 的 PowerShell 或 `cmd` 中执行；仓库源码路径示例为 `D:\DEV\tool\AI\deepseek-harness`。

## 一、环境准备

- Node.js `^22.19 || >=24` 与 pnpm。
- 首次：`pnpm install`（安装工作区依赖）。
- 订阅可省略；匿名免费模型不需要任何 API Key。

首次构建前端（页面空白时用）：`pnpm run build:web`。

## 二、快速启动（推荐：一键批处理）

双击项目根目录的 `start-dsh-web.bat`，或命令行运行：

```bat
start-dsh-web.bat
```

脚本进入项目目录并启动 WebUI：`pnpm dsh --profile web --host 127.0.0.1 --port 3080`。

打开浏览器访问 `http://127.0.0.1:3080`，新建会话即可对话。

## 三、手动命令启动（等价方式）

```powershell
pnpm dsh --profile web --host 127.0.0.1 --port 3080
```

- 出现 `dsh web: http://127.0.0.1:3080` 即启动成功。
- 换端口：把 `--port` 改成其它数字，如 `--port 8080`。
- 保持该终端窗口开启；关闭即停止服务。

启动失败排查：

- `pnpm: command not found`：先安装并启用 Node/pnpm。
- 页面空白：运行 `pnpm run build:web` 后重启。
- 端口占用：换一个 `--port`。

## 四、WebUI 会话使用

1. 顶部模型选择器选择一个模型，Enter 发送问题。
2. 模型目录来自“设置 → Models”，免费模型包括：

   - `deepseek-v4-flash-free`（DeepSeek）
   - `mimo-v2.5-free`（小米 MiMo）
   - `hy3-free`（腾讯混元）
   - `nemotron-3-ultra-free` / `nemotron-3.5-lightning-free`（NVIDIA）
   - `laguna-s-2.1-free`（Poolside）

3. “Models”页的 `OpenCode Zen` 提供方卡片上有 **“从 opencode 登录导入”** 按钮：把本机已登录的 opencode（opencodeai）账号凭据导入 harness（键名 `OPENCODE_ZEN_API_KEY`）。

## 五、命令行快速问答（无界面）

```powershell
pnpm dsh --profile headless "Reply with exactly one short word."
```

输出为模型回答文本后进程退出，适合脚本与自动化。

## 六、账号登录入口

两种等效方式：

- WebUI：Models 页 → OpenCode Zen 提供方 → “从 opencode 登录导入”。
- 命令行：`pnpm run login:opencode`（读取 `~/.local/share/opencode/auth.json` 中已登录的 opencode 凭据写入 `$DSH_HOME/.credentials.yaml`）。

导入后如需以账号身份走请求，在组合的 `llm-opencode-zen` 条目加 `apiKeyEnv: OPENCODE_ZEN_API_KEY`。详见包文档 `packages/llm/llm-opencode-zen/README.md`。

## 七、常见问题

**问：某些免费模型提示“本轮运行失败 / QUOTA / Rate limit exceeded”？**

免费层按会话与客户端识别限流，热门模型（`deepseek-v4-flash-free`、`mimo-v2.5-free`）会在匿名通道间歇被限。当前默认模型已选较稳定的 `nemotron-3-ultra-free`；必要时切换到 5 这节列出的其它免费模型，或过一会重试。

**问：切换模型后感觉仍是同一个模型？**

模型按会话记录：确认切换后新建会话、并在发送后查看模型选择器显示的名字；旧会话仍沿用切换前的模型。

**问：为什么 opencode CLI 能用而这里 429？**

两者请求相同：都走 `https://opencode.ai/zen/v1`、匿名 `Bearer public`。免费层限制按来源会话/IP 计量，偶发受限属正常；换模型或稍候即可。

**问：需要真正的 API Key 吗？**

免费匿名模型不需要。账号级额度或付费档才需要 `OPENCODE_ZEN_API_KEY`（见第六节）。其余自有提供方（如 DeepSeek 官方模型）按其页面提示填写各自 Key。

## 八、补充：模型偏好持久化（本机默认）

本机默认组合可在 `$DSH_HOME/cordis.patch.yml`（默认 `~/.dsh/cordis.patch.yml`）调整，例如改默认模型：

```yaml
- id: agent-default-model
  config:
    provider: opencode-zen
    model: laguna-s-2.1-free
```

修改后重启 WebUI 生效。
