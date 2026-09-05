import { create } from "zustand";
import { createApi } from "./api";
import type {
  ComposerMode,
  ContextUsage,
  DirectoryListing,
  FileListing,
  Message,
  ModelProviderGroup,
  ModelSelection,
  PromptAttachment,
  Session,
  SessionEvent,
  SessionMetrics,
  SessionSearchItem,
  SettingsNamespaceView,
  SidePanelKind,
  SkillEntry,
  TokenUsage,
} from "../types";

interface AppState {
  // connection
  useLiveBackend: boolean;
  connected: boolean;

  // data
  sessions: Session[];
  activeSessionId: string | null;
  messages: Message[];
  context: ContextUsage;
  metrics: SessionMetrics;
  tokenUsage: TokenUsage;
  /** Sessions currently running a turn (id → true); drives the sidebar indicator. */
  runningSessions: Record<string, boolean>;

  // ui
  theme: "dark" | "light";
  /** Backend ui-theme preference: system / dark / light. */
  themePref: "system" | "dark" | "light";
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  inspectorTab: "overview" | "files" | "changes";
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  updateAvailable: boolean;
  /** Which side panel is open (null = none). */
  sidePanel: SidePanelKind | null;
  openSidePanel: (k: SidePanelKind) => void;
  closeSidePanel: () => void;

  // composer
  mode: ComposerMode;
  /** Last submit failure message (backend rejection), shown by the composer; null when clean. */
  submitError: string | null;
  clearSubmitError: () => void;

  // actions
  init: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  newSession: (cwd?: string) => Promise<void>;
  /** Open the host native folder picker for choosing a project directory; null when cancelled. */
  pickDirectory: () => Promise<string | null>;
  submitPrompt: (text: string, attachments?: PromptAttachment[]) => Promise<boolean>;
  /** Enhance a draft prompt through the backend; resolves to the enhanced text ("" on failure). */
  enhancePrompt: (text: string) => Promise<string>;
  setTheme: (t: "dark" | "light") => void;
  /** Resolve a ui-theme preference (system/dark/light) and apply it live. */
  applyThemePref: (pref: "system" | "dark" | "light") => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  setInspectorTab: (t: "overview" | "files" | "changes") => void;
  setMode: (m: ComposerMode) => void;
  setUseLiveBackend: (v: boolean) => void;
  openCommandPalette: (v: boolean) => void;
  openSettings: (v: boolean) => void;
  dismissUpdate: () => void;

  // model selection (session.models / session.selectModel)
  currentModel: ModelSelection | null;
  modelGroups: ModelProviderGroup[];
  loadModels: () => Promise<void>;
  selectModel: (provider: string, model: string, reasoningEffort?: string) => Promise<void>;

  // skills (skill.list)
  skills: SkillEntry[];
  loadSkills: () => Promise<void>;

  // host directory browser (@ file reference)
  listDirectory: (path?: string) => Promise<DirectoryListing>;
  listFiles: (path?: string) => Promise<FileListing>;

  // full-text session search
  searchSessions: (query: string) => Promise<SessionSearchItem[]>;

  /** Resolve one durable image by attachment id; resolves to a data URL (or null on failure). */
  readAttachment: (attachmentId: string) => Promise<string | null>;

  // side panel data (history / memory / mcp-skills / settings)
  historyAll: Session[];
  memoryResults: SessionSearchItem[];
  settingsNamespaces: SettingsNamespaceView[];
  settingsWritable: boolean;
  loadHistory: () => Promise<void>;
  searchMemory: (query: string) => Promise<void>;
  loadSettings: () => Promise<void>;
  saveSetting: (ns: string, patch: Record<string, unknown>, expectedRevision?: number) => Promise<boolean>;
}

function applyEvent(state: AppState, event: SessionEvent): Partial<AppState> {
  switch (event.kind) {
    case "message.append": {
      const msg = event.payload as Message;
      if (state.messages.some((m) => m.id === msg.id)) return {};
      return { messages: [...state.messages, msg] };
    }
    case "message.update": {
      const { messageId, patch } = event.payload as { messageId: string; patch: Partial<Message> };
      return {
        messages: state.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
      };
    }
    case "reasoning.append": {
      const { messageId, summary } = event.payload as { messageId: string; summary: NonNullable<Message["reasoning"]>[number] };
      return {
        messages: state.messages.map((m) =>
          m.id === messageId
            ? m.reasoning?.some((r) => r.id === summary.id)
              ? m
              : { ...m, reasoning: [...(m.reasoning ?? []), summary] }
            : m,
        ),
      };
    }
    case "tool.start": {
      const { messageId, tool } = event.payload as { messageId: string; tool: NonNullable<Message["tools"]>[number] };
      return {
        messages: state.messages.map((m) =>
          m.id === messageId ? { ...m, tools: [...(m.tools ?? []), tool] } : m,
        ),
      };
    }
    case "tool.update": {
      const { messageId, toolId, patch } = event.payload as {
        messageId: string;
        toolId: string;
        patch: Partial<NonNullable<Message["tools"]>[number]>;
      };
      return {
        messages: state.messages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                tools: (m.tools ?? []).map((t) => (t.id === toolId ? { ...t, ...patch } : t)),
              }
            : m,
        ),
      };
    }
    case "context.update": {
      return { context: { ...(state.context as ContextUsage), ...(event.payload as Partial<ContextUsage>) } };
    }
    case "metrics.update": {
      return { metrics: { ...(state.metrics as SessionMetrics), ...(event.payload as Partial<SessionMetrics>) } };
    }
    default:
      return {};
  }
}

let unsubscribe: (() => void) | null = null;
let apiInstance: ReturnType<typeof createApi> | null = null;

// A session is considered "running" from the moment a prompt is accepted until
// its turn produces no further events for a while. The harness push stream has
// no explicit "turn done" marker we can rely on, so we mark running on submit
// and on every produced event, then clear it after RUNNING_IDLE_MS of silence.
const RUNNING_IDLE_MS = 8000;
const runningTimers: Record<string, ReturnType<typeof setTimeout>> = {};
function markRunning(set: (fn: (s: AppState) => Partial<AppState>) => void, id: string): void {
  set((s) => (s.runningSessions[id] ? {} : { runningSessions: { ...s.runningSessions, [id]: true } }));
  if (runningTimers[id]) globalThis.clearTimeout(runningTimers[id]);
  runningTimers[id] = globalThis.setTimeout(() => {
    set((s) => {
      if (!s.runningSessions[id]) return {};
      const next = { ...s.runningSessions };
      delete next[id];
      return { runningSessions: next };
    });
    delete runningTimers[id];
  }, RUNNING_IDLE_MS);
}
function clearRunning(set: (fn: (s: AppState) => Partial<AppState>) => void, id: string): void {
  if (runningTimers[id]) {
    globalThis.clearTimeout(runningTimers[id]);
    delete runningTimers[id];
  }
  set((s) => {
    if (!s.runningSessions[id]) return {};
    const next = { ...s.runningSessions };
    delete next[id];
    return { runningSessions: next };
  });
}

// Persist the active session across reloads so a refresh restores the
// conversation (and its model selection) instead of starting empty.
const ACTIVE_SESSION_KEY = "reasonix:active-session";
function loadActiveSessionId(): string | null {
  try {
    return globalThis.localStorage?.getItem(ACTIVE_SESSION_KEY) ?? null;
  } catch {
    return null;
  }
}
function saveActiveSessionId(id: string): void {
  try {
    globalThis.localStorage?.setItem(ACTIVE_SESSION_KEY, id);
  } catch {
    // best-effort persistence
  }
}

export const useStore = create<AppState>((set, get) => ({
  // Default to the live harness backend (http://127.0.0.1:7890 via the vite
  // /api proxy). The backend default model is configured in ~/.dsh/settings.yaml
  // (opencode-zen free tier) so prompting works without a DeepSeek key. The UI
  // BackendToggle can still switch back to the mock/demo dataset.
  useLiveBackend: true,
  connected: true,

  sessions: [],
  activeSessionId: null,
  messages: [],
  runningSessions: {},
  context: { usedPct: 0, usedTokens: 0, capacityTokens: 480000, compactionThresholdPct: 80 },
  metrics: { cacheHitPct: 0, cost: 0, runTimeMs: 0, requestCount: 0, totalTokens: 0, turns: 0 },
  tokenUsage: { bySource: [], byType: [] },
  currentModel: null,
  modelGroups: [],
  skills: [],

  theme: "dark",
  themePref: "system",
  sidebarCollapsed: false,
  inspectorOpen: true,
  inspectorTab: "overview",
  commandPaletteOpen: false,
  settingsOpen: false,
  updateAvailable: true,
  sidePanel: null,

  mode: "normal",
  submitError: null,

  historyAll: [],
  memoryResults: [],
  settingsNamespaces: [],
  settingsWritable: false,

  init: async () => {
    apiInstance = createApi(get().useLiveBackend);
    unsubscribe?.();
    unsubscribe = apiInstance.subscribe(
      (e) => {
        // The harness events.mux is a global stream covering every live
        // session; only surface events for the session the user is viewing
        // (background sessions such as a throwaway enhance run stay silent).
        const active = get().activeSessionId;
        if (e.sessionId && e.sessionId !== active) return;
        const sid = e.sessionId ?? active;
        if (sid) {
          if (e.kind === "message.append" || e.kind === "reasoning.append" || e.kind === "tool.start" || e.kind === "tool.update") {
            markRunning(set, sid);
          } else if (e.kind === "message.update") {
            const patch = (e.payload as { patch?: Partial<Message> })?.patch;
            if (patch && patch.streaming === false) clearRunning(set, sid);
          }
        }
        set((s) => applyEvent(s, e));
      },
      (c) => set({ connected: c }),
    );
    const { sessions } = await apiInstance.listSessions();
    set({ sessions });
    // Restore the last-active session across reloads so the conversation and
    // its model selection are available immediately after a refresh.
    const savedId = loadActiveSessionId();
    const target = savedId && sessions.some((s) => s.id === savedId) ? savedId : null;
    if (target) {
      void get().selectSession(target);
    } else if (sessions.length > 0) {
      // No persisted session: still probe the model catalog/current selection
      // from the most recent session so the model chip is populated.
      try {
        const res = await apiInstance.listModels(sessions[0].id);
        set({ currentModel: res.current, modelGroups: res.groups });
      } catch {
        // catalog unavailable (e.g. transient) — stay empty, retried on open
      }
    }
    // Apply the backend ui-theme preference so a saved theme survives reloads.
    try {
      const res = await apiInstance.settingsDescribe();
      const themeNs = res.namespaces.find((n) => n.ns === "ui-theme");
      const pref = (themeNs?.value as { preference?: "system" | "dark" | "light" } | undefined)?.preference;
      if (pref === "dark" || pref === "light" || pref === "system") get().applyThemePref(pref);
    } catch {
      // theme read failure keeps the default dark shell
    }
  },

  selectSession: async (id) => {
    if (!apiInstance) return;
    saveActiveSessionId(id);
    const res = await apiInstance.openSession(id);
    set({ activeSessionId: id, messages: res.messages, context: res.context, metrics: res.metrics, tokenUsage: res.tokenUsage });
    void get().loadModels();
    void get().loadSkills();
  },

  newSession: async (cwd?: string) => {
    if (!apiInstance) return;
    const res = await apiInstance.newSession(cwd);
    saveActiveSessionId(res.session.id);
    set((s) => ({
      activeSessionId: res.session.id,
      messages: res.messages,
      context: res.context,
      metrics: res.metrics,
      tokenUsage: res.tokenUsage,
      sessions: [res.session, ...s.sessions.filter((x) => x.id !== res.session.id)],
    }));
    void get().loadModels();
  },

  pickDirectory: async () => {
    if (!apiInstance) return null;
    try {
      return await apiInstance.pickDirectory();
    } catch {
      return null;
    }
  },

  submitPrompt: async (text, attachments) => {
    const id = get().activeSessionId;
    if (!apiInstance || !id) return false;
    markRunning(set, id);
    try {
      await apiInstance.submit(id, text, get().mode, attachments);
      set({ submitError: null });
      return true;
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const msg = raw.includes("does not support image")
        ? "当前模型不支持图片输入，请切换到支持图片的模型（如 sensenova-6.7-flash-lite / glm-5.2）后再发送"
        : `提交失败：${raw}`;
      set({ submitError: msg });
      return false;
    }
  },

  clearSubmitError: () => set({ submitError: null }),

  enhancePrompt: async (text) => {
    if (!apiInstance) return "";
    try {
      return await apiInstance.enhancePrompt(text);
    } catch {
      return "";
    }
  },

  loadModels: async () => {
    const id = get().activeSessionId;
    if (!apiInstance || !id) return;
    try {
      const res = await apiInstance.listModels(id);
      set({ currentModel: res.current, modelGroups: res.groups });
    } catch {
      // backend catalog unavailable (e.g. transient) — keep last known state
    }
  },

  selectModel: async (provider, model, reasoningEffort) => {
    const id = get().activeSessionId;
    if (!apiInstance || !id) return;
    const selected = await apiInstance.selectModel(id, { provider, model, ...(reasoningEffort ? { reasoningEffort } : {}) });
    set({ currentModel: selected });
    void get().loadModels();
  },

  listDirectory: async (path) => {
    if (!apiInstance) {
      return { path: "", home: "", crumbs: [], entries: [], truncated: false };
    }
    return await apiInstance.listDirectory(path);
  },

  listFiles: async (path) => {
    if (!apiInstance) {
      return { path: "", entries: [], truncated: false };
    }
    return await apiInstance.listFiles(path);
  },

  loadSkills: async () => {
    const id = get().activeSessionId;
    if (!apiInstance || !id) return;
    try {
      const skills = await apiInstance.listSkills(id);
      set({ skills });
    } catch {
      // skill catalog unavailable — keep last known state
    }
  },

  searchSessions: async (query) => {
    if (!apiInstance) return [];
    try {
      return await apiInstance.searchSessions(query);
    } catch {
      return [];
    }
  },

  readAttachment: async (attachmentId) => {
    const id = get().activeSessionId;
    if (!apiInstance || !id) return null;
    try {
      const res = await apiInstance.readAttachment(id, attachmentId);
      return `data:${res.attachment.mediaType};base64,${res.data}`;
    } catch {
      return null;
    }
  },

  setTheme: (t) => {
    document.body.setAttribute("data-theme", t);
    set({ theme: t });
  },
  applyThemePref: (pref) => {
    const dark =
      pref === "dark" ||
      (pref === "system" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);
    const t = dark ? "dark" : "light";
    document.body.setAttribute("data-theme", t);
    set({ theme: t, themePref: pref });
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setInspectorTab: (t) => set({ inspectorTab: t }), setMode: (m) => set({ mode: m }),
  setUseLiveBackend: (v) => {
    set({ useLiveBackend: v });
    // The API instance is created once per init; flip the flag and re-init so
    // the switch takes effect immediately (Mock <-> live harness backend).
    void get().init();
  },
  openCommandPalette: (v) => set({ commandPaletteOpen: v }),
  openSettings: (v) => set({ settingsOpen: v, sidePanel: v ? "settings" : null }),
  dismissUpdate: () => set({ updateAvailable: false }),

  openSidePanel: (k) => set({ sidePanel: k, settingsOpen: false }),
  closeSidePanel: () => set({ sidePanel: null }),

  loadHistory: async () => {
    if (!apiInstance) return;
    try {
      const all = await apiInstance.listSessions();
      set({ historyAll: all.sessions });
    } catch {
      // keep previous list; panel shows an empty-state note
    }
  },

  searchMemory: async (query) => {
    if (!apiInstance) return;
    try {
      const items = await apiInstance.searchSessions(query);
      set({ memoryResults: items });
    } catch {
      set({ memoryResults: [] });
    }
  },

  loadSettings: async () => {
    if (!apiInstance) return;
    try {
      const res = await apiInstance.settingsDescribe();
      set({ settingsNamespaces: res.namespaces, settingsWritable: res.writable });
    } catch {
      set({ settingsNamespaces: [], settingsWritable: false });
    }
  },

  saveSetting: async (ns, patch, expectedRevision) => {
    if (!apiInstance) return false;
    try {
      const updated = await apiInstance.settingsUpdate(ns, patch, expectedRevision);
      set((s) => ({
        settingsNamespaces: s.settingsNamespaces.map((n) => (n.ns === ns ? updated : n)),
      }));
      return true;
    } catch {
      return false;
    }
  },
}));
