// Demo provider that simulates the DeepSeek-Harness backend so the UI is fully
// usable without a live server. It mirrors the ApiClient contract and streams
// synthetic SessionEvents (reasoning, tool calls, context updates) the same way
// the real harness WebSocket would, so the rendering path is identical.

import type {
  ApiClient,
  ContextUsage,
  DirectoryListing,
  FileListing,
  ListSessionsResult,
  Message,
  ModelSelection,
  OpenSessionResult,
  PromptResult,
  Session,
  SessionEvent,
  SessionMetrics,
  SessionModelsResult,
  SessionSearchItem,
  SettingsDescribeResult,
  SettingsNamespaceView,
  SkillEntry,
  TokenUsage,
} from "../types";

const NOW = Date.now();

const DEMO_SESSIONS: Session[] = [
  { id: "s1", title: "清理临时构建产物（syso 与 desktop.exe）", projectName: "deepseek-harness", updatedAt: NOW - 1000 * 60 * 4 },
  { id: "s2", title: "修复 auth.go 的登录竞态", projectName: "deepseek-harness", updatedAt: NOW - 1000 * 60 * 42 },
  { id: "s3", title: "重构支付模块", projectName: "deepseek-harness", updatedAt: NOW - 1000 * 60 * 60 * 3 },
  { id: "s4", title: "讲解插件宿主设计", projectName: "deepseek-harness", updatedAt: NOW - 1000 * 60 * 60 * 26 },
];

const DEMO_TOKEN_USAGE: TokenUsage = {
  bySource: [
    { label: "系统提示", tokens: 18420, color: "#e58a3a" },
    { label: "工具结果", tokens: 9250, color: "#5b8def" },
    { label: "对话历史", tokens: 6400, color: "#3fae6b" },
    { label: "本次输入", tokens: 1180, color: "#c061d6" },
  ],
  byType: [
    { label: "输入", tokens: 35250, color: "#5b8def" },
    { label: "输出", tokens: 4210, color: "#3fae6b" },
    { label: "缓存读", tokens: 22140, color: "#e58a3a" },
  ],
};

const DEMO_CONTEXT: ContextUsage = {
  usedPct: 80,
  usedTokens: 384000,
  capacityTokens: 480000,
  compactionThresholdPct: 80,
};

const DEMO_METRICS: SessionMetrics = {
  cacheHitPct: 99.51,
  cost: 0.0008,
  runTimeMs: 142000,
  requestCount: 87,
  totalTokens: 1004437757,
  turns: 87,
};

function seedMessages(): Message[] {
  return [
    {
      id: "m1",
      role: "user",
      content: "清理我生成的临时构建产物（syso 与 desktop.exe）：",
      createdAt: NOW - 1000 * 60 * 6,
    },
    {
      id: "m2",
      role: "assistant",
      createdAt: NOW - 1000 * 60 * 5,
      content:
        "已分三轮完成清理、推送前校验与产物签署，下面是各阶段的判断与结果。",
      reasoning: [
        {
          id: "r1",
          headline: "临时产物已清理。签署阶段四验证了步骤（先确认列表项）：",
          detail:
            "先枚举工作区中的 *.syso 与 desktop.exe 临时文件，确认它们都不是用户源码。删除前逐一回显路径，避免误删。",
          toolsCount: 1,
          thinkingCount: 1,
        },
        {
          id: "r2",
          headline: "推送前确认工作区改动归属（区分我的改动与用户既有残留）：",
          detail: "调用 git status 区分本次清理产生的改动与用户进行中的工作，避免把用户改动一并提交。",
          toolsCount: 2,
          thinkingCount: 1,
        },
        {
          id: "r3",
          headline: "Composer.tsx 混合了我的改动与用户进行中的 STT 改动。先查分支/远端/PR 状态：",
          detail: "发现 Composer.tsx 同时包含本任务改动与用户进行中的 STT 改动，先查分支、远端与 PR 状态再决定是否提交。",
          toolsCount: 5,
          thinkingCount: 3,
        },
      ],
      tools: [
        { id: "t1", name: "shell", args: 'glob **/*.syso **/desktop.exe', status: "success", durationMs: 210 },
        { id: "t2", name: "shell", args: "git status --short", status: "success", durationMs: 140 },
        { id: "t3", name: "shell", args: "git log --oneline -n 5", status: "success", durationMs: 180 },
      ],
      statusLine: "Ran for 12s · 3 tools",
    },
  ];
}

let counter = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

// Scripted assistant reply used for every submitted prompt so the UI can show
// the full reasoning + tool + text streaming flow.
function buildAssistantReply(prompt: string) {
  const assistantId = uid("a");
  const base = {
    id: assistantId,
    role: "assistant" as const,
    content: "",
    createdAt: Date.now(),
    streaming: true,
    reasoning: [] as Message["reasoning"],
    tools: [] as Message["tools"],
  };
  return { assistantId, base, prompt };
}

export class MockApi implements ApiClient {
  private listeners = new Set<(e: SessionEvent) => void>();
  private statusListeners = new Set<(c: boolean) => void>();
  private timers: ReturnType<typeof setTimeout>[] = [];

  listSessions(): Promise<ListSessionsResult> {
    return Promise.resolve({ sessions: DEMO_SESSIONS });
  }

  openSession(): Promise<OpenSessionResult> {
    return Promise.resolve({
      session: DEMO_SESSIONS[0],
      messages: seedMessages(),
      context: { ...DEMO_CONTEXT },
      metrics: { ...DEMO_METRICS },
      tokenUsage: JSON.parse(JSON.stringify(DEMO_TOKEN_USAGE)),
    });
  }

  newSession(cwd?: string): Promise<OpenSessionResult> {
    const session: Session = {
      id: uid("s"),
      title: "新建会话",
      projectName: cwd ? cwd.split(/[\\/]/).filter(Boolean).pop() ?? "未分组" : "deepseek-harness",
      cwd,
      updatedAt: Date.now(),
    };
    return Promise.resolve({
      session,
      messages: [],
      context: { usedPct: 4, usedTokens: 19000, capacityTokens: 480000, compactionThresholdPct: 80 },
      metrics: { cacheHitPct: 0, cost: 0, runTimeMs: 0, requestCount: 0, totalTokens: 0, turns: 0 },
      tokenUsage: JSON.parse(JSON.stringify(DEMO_TOKEN_USAGE)),
    });
  }

  submit(_sessionId: string, text: string): Promise<PromptResult> {
    const userMsg: Message = {
      id: uid("u"),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };
    const { assistantId, base } = buildAssistantReply(text);
    this.emit({ kind: "message.append", payload: userMsg });
    this.emit({ kind: "message.append", payload: { ...base } });

    // Stream reasoning + tools over time to mimic the live event channel.
    const steps: Array<() => void> = [
      () => this.emit({ kind: "reasoning.append", payload: { messageId: assistantId, summary: { id: uid("r"), headline: "先列出受影响的文件，确认都是临时产物：", detail: "使用 glob 匹配 *.syso 与 desktop.exe，确认这些不是源码或配置。", toolsCount: 1, thinkingCount: 1 } } }),
      () => this.emit({ kind: "tool.start", payload: { messageId: assistantId, tool: { id: uid("t"), name: "shell", args: 'glob **/*.syso **/desktop.exe', status: "running" } } }),
      () => this.emit({ kind: "tool.update", payload: { messageId: assistantId, toolId: uid("t"), patch: { status: "success", durationMs: 230, result: "found 2 files" } } }),
      () => this.emit({ kind: "reasoning.append", payload: { messageId: assistantId, summary: { id: uid("r"), headline: "删除前回显路径，避免误删用户文件：", detail: "逐个打印待删除路径并确认，再执行 rm。", toolsCount: 1, thinkingCount: 1 } } }),
      () => this.emit({ kind: "tool.start", payload: { messageId: assistantId, tool: { id: uid("t"), name: "shell", args: "rm -f build/*.syso dist/desktop.exe", status: "running" } } }),
      () => this.emit({ kind: "tool.update", payload: { messageId: assistantId, toolId: uid("t"), patch: { status: "success", durationMs: 120, result: "removed 2 files" } } }),
      () => this.emit({ kind: "message.update", payload: { messageId: assistantId, patch: { content: "已清理临时构建产物：删除了 `build/*.syso` 与 `dist/desktop.exe` 共 2 个文件。" } } }),
      () => this.emit({ kind: "context.update", payload: { usedPct: 12, usedTokens: 58000, capacityTokens: 480000, compactionThresholdPct: 80 } }),
      () => this.emit({ kind: "message.update", payload: { messageId: assistantId, patch: { streaming: false, statusLine: "Ran for 3s · 2 tools" } } }),
    ];

    steps.forEach((step, i) => {
      const t = setTimeout(step, 500 + i * 650);
      this.timers.push(t);
    });

    return Promise.resolve({ messages: [userMsg, { ...base, content: "已清理临时构建产物。", streaming: false }] });
  }
  /** Mock enhance: return a lightly polished copy after a short delay. */
  enhancePrompt(text: string): Promise<string> {
    const trimmed = text.trim();
    if (!trimmed) return Promise.resolve("");
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        const polished = "请帮我" + trimmed.replace(/^请(帮我)?/, "")
          + "。请在动手前先确认范围并说明方案，再逐步执行。";
        resolve(polished);
      }, 900);
      this.timers.push(t);
    });
  }
  listModels(_sessionId: string): Promise<SessionModelsResult> {
    return Promise.resolve({
      current: { provider: "deepseek", model: "deepseek-v4-flash-free" },
      routable: true,
      groups: [
        {
          id: "deepseek",
          name: "DeepSeek",
          models: [
            { id: "deepseek-v4-flash-free", name: "deepseek-v4-flash-free" },
            { id: "deepseek-v4-flash", name: "deepseek-v4-flash" },
            { id: "deepseek-v4", name: "deepseek-v4" },
          ],
        },
      ],
      failures: [],
    });
  }

  selectModel(_sessionId: string, selection: ModelSelection): Promise<ModelSelection> {
    return Promise.resolve(selection);
  }

  listDirectory(path?: string): Promise<DirectoryListing> {
    const base = path ?? "D:\\workspace\\demo-project";
    return Promise.resolve({
      path: base,
      home: "C:\\Users\\you",
      crumbs: [
        { name: "D:", path: "D:\\", hidden: false },
        { name: "workspace", path: "D:\\workspace", hidden: false },
        { name: "demo-project", path: base, hidden: false },
      ],
      entries: [
        { name: "src", path: `${base}\\src`, hidden: false },
        { name: "docs", path: `${base}\\docs`, hidden: false },
        { name: "node_modules", path: `${base}\\node_modules`, hidden: true },
      ],
      truncated: false,
    });
  }

  pickDirectory(): Promise<string | null> {
    return Promise.resolve("D:/DEV/mock-project");
  }
  listFiles(path?: string): Promise<FileListing> {
    const base = path ?? "D:/DEV/mock-project";
    const entries = [
      { name: "src", path: `${base}\src`, hidden: false, isDirectory: true },
      { name: "docs", path: `${base}\docs`, hidden: false, isDirectory: true },
      { name: "package.json", path: `${base}\package.json`, hidden: false, isDirectory: false },
      { name: "README.md", path: `${base}\README.md`, hidden: false, isDirectory: false },
    ];
    return Promise.resolve({ path: base, entries, truncated: false });
  }

  listSkills(_sessionId: string): Promise<SkillEntry[]> {
    return Promise.resolve([
      { name: "explore", description: "探索项目结构，生成目录地图", whenToUse: "新接手项目时", modelInvocable: true },
      { name: "research", description: "研究一个主题并输出带来源的综述", whenToUse: "需要调研某个技术或话题时", modelInvocable: true },
      { name: "review", description: "审查最近改动并指出问题", whenToUse: "提交代码前", modelInvocable: true },
    ]);
  }

  searchSessions(query: string): Promise<SessionSearchItem[]> {
    const q = query.toLowerCase();
    return Promise.resolve(
      DEMO_SESSIONS.filter((s) => s.title.toLowerCase().includes(q))
        .slice(0, 5)
        .map((s) => ({ sessionId: s.id, snippet: s.title })),
    );
  }


  readAttachment(): Promise<{ attachment: { mediaType: string; name?: string }; data: string }> {
    // 1x1 transparent PNG so the demo transcript can render an attachment row.
    return Promise.resolve({
      attachment: { mediaType: "image/png", name: "demo.png" },
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    });
  }

  settingsDescribe(): Promise<SettingsDescribeResult> {
    return Promise.resolve({
      writable: true,
      hasDocument: true,
      namespaces: [
        {
          ns: "agent-default-model",
          schema: {},
          value: { provider: "opencode-zen", model: "mimo-v2.5-free" },
          applies: "live",
          secrets: [],
          revision: 1,
        },
        {
          ns: "ui-theme",
          schema: {},
          value: { preference: "system" },
          applies: "live",
          secrets: [],
          revision: 1,
        },
      ],
    });
  }
  settingsUpdate(ns: string, patch: Record<string, unknown>): Promise<SettingsNamespaceView> {
    return Promise.resolve({
      ns,
      schema: {},
      value: patch,
      applies: "live",
      secrets: [],
      revision: Date.now(),
    });
  }

  subscribe(onEvent: (e: SessionEvent) => void, onStatus: (c: boolean) => void): () => void {
    this.listeners.add(onEvent);
    this.statusListeners.add(onStatus);
    onStatus(true);
    return () => {
      this.listeners.delete(onEvent);
      this.statusListeners.delete(onStatus);
    };
  }

  private emit(event: SessionEvent) {
    this.listeners.forEach((l) => l(event));
  }
}
