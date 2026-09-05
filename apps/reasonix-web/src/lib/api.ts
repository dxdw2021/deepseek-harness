// Live DeepSeek-Harness backend adapter.
//
// The harness web host exposes a generic unary RPC over HTTP POST to
// `/api/<method>` (method = dotted name from the host ApiProxy RpcMethodMap,
// e.g. `session.list`), with a JSON envelope:
//
//   request:  { type: "client-request", rpcId, method: <dotted method>, payload }
//   response: { type: "server-response", rpcId, result: { ok: true, value } | { ok: false, error } }
//
// Server -> client events arrive over a downlink WebSocket at `/api/events.mux`
// carrying MuxFrame messages (`{ type: "session/event", sessionId, event, view? }`
// inside an RpcRequest envelope). Without a backend the app defaults to MockApi
// so the UI stays demonstrable.
//
// The Reasonix UI model (Message / ReasoningSummary / ToolCall) is lighter than
// the harness SessionEvent stream. The shared translation lives in `./fold.ts`
// (`foldSessionHistory` rebuilds an opened session's transcript; `LiveStreamFolder`
// maps live downlink events onto the store's vocabulary).

import type {
  ApiClient,
  DirectoryListing,
  FileListing,
  ListSessionsResult,
  Message,
  ModelSelection,
  OpenSessionResult,
  PromptAttachment,
  PromptResult,
  Session,
  SessionEvent,
  SessionModelsResult,
  SessionSearchItem,
  SettingsDescribeResult,
  SettingsNamespaceView,
  SkillEntry,
} from "../types";
import { MockApi } from "./mock";
import {
  foldSessionHistory,
  LiveStreamFolder,
  type HistoryEnvelope,
  type RawWireEvent,
} from "./fold";

/** Harness ServerResponse wire form (see rpc.schema.ts serverResponseSchema). */
interface ServerResponse {
  type: "server-response";
  rpcId: string;
  result:
    | { ok: true; value: unknown }
    | { ok: false; error: { code: string; message: string; details: unknown } };
}

/** `session.list` value: one SessionSummary row from the host sessions domain. */
interface SessionSummaryRow {
  sessionId: string;
  updatedAt: number;
  running: boolean;
  blank: boolean;
  parentSessionId?: string;
  cwd?: string;
  agentPreset?: string;
  projections?: {
    asOfSeq: number;
    values: {
      // Projection rows are keyed by the projection registry's identifiers;
      // a "title" value is present when the deployment mounts a title projection.
      [key: string]: unknown;
    };
  };
}

/** `session.list` value envelope. */
interface SessionListValue {
  items: SessionSummaryRow[];
}

/** `session.create` value envelope. */
interface SessionCreateValue {
  sessionId: string;
  agentPreset?: string;
}

/** `session.prompt` value envelope (accepted keeps the caller unblocked). */
interface PromptAcceptedValue {
  accepted: true;
  command?: { kind: "success"; text?: string };
}

/** `session.history` value envelope: one raw SessionEvent per row. */
type SessionHistoryValue = HistoryEnvelope;

// Throwaway sessions (e.g. prompt-enhance runs) are archived on the host but
// `session.list` still returns them, so the sidebar hides them by id across
// reloads. The registry lives in localStorage and is additive only.
const HIDDEN_SESSIONS_KEY = "reasonix:hidden-sessions";
function loadHiddenSessions(): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(HIDDEN_SESSIONS_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
const hiddenSessionIds = loadHiddenSessions();
function hideSession(id: string): void {
  hiddenSessionIds.add(id);
  try {
    globalThis.localStorage?.setItem(HIDDEN_SESSIONS_KEY, JSON.stringify([...hiddenSessionIds]));
  } catch {
    // best-effort persistence
  }
}
function origin(): string {
  const loc = globalThis.location;
  return loc && loc.origin && loc.origin !== "null" ? loc.origin : "http://127.0.0.1:7890";
}

function wsOrigin(): string {
  const loc = globalThis.location;
  if (loc && loc.origin && loc.origin !== "null") {
    return loc.protocol === "https:" ? loc.origin.replace(/^https:/, "wss:") : loc.origin.replace(/^http:/, "ws:");
  }
  return "ws://127.0.0.1:7890";
}

/** Extract a display title from a session row's projection values, if any. */
function rowTitle(row: SessionSummaryRow): string {
  const values = row.projections?.values;
  if (values === undefined) return "";
  // The session-title projection publishes under its unit key ("title");
  // tolerate the string overload the projection cache may emit.
  const candidate = values["title"] ?? values["sessionTitle"];
  return typeof candidate === "string" ? candidate : "";
}

/** Derive a display project name from a session's workspace cwd (its last path segment). */
function projectNameOf(cwd: string | undefined): string {
  if (cwd === undefined || cwd === "") return "未分组";
  const trimmed = cwd.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] ?? "未分组";
}

function toSession(row: SessionSummaryRow, projectName: string): Session {
  return {
    id: row.sessionId,
    title: rowTitle(row) || (row.blank ? "新会话" : row.sessionId),
    projectName,
    cwd: row.cwd,
    updatedAt: row.updatedAt,
    };
}
export class HarnessApi implements ApiClient {
  private rpcSeq = 0;
  private bodyOrigin: string;
  private socketOrigin: string;

  constructor(humanOrigin?: string, humanSocketOrigin?: string) {
    this.bodyOrigin = humanOrigin ?? origin();
    this.socketOrigin = humanSocketOrigin ?? wsOrigin();
  }

  private async call<T>(method: string, payload: unknown): Promise<T> {
    const rpcId = `rx-${(this.rpcSeq++).toString(36)}`;
    const res = await fetch(`${this.bodyOrigin}/api/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "client-request", rpcId, method, payload }),
    });
    if (!res.ok) throw new Error(`transport failure ${method}: HTTP ${res.status}`);
    const body = (await res.json()) as ServerResponse;
    if (body.type !== "server-response" || body.rpcId !== rpcId) {
      throw new Error(`rpcId/type mismatch for ${method}`);
    }
    if (!body.result.ok) {
      throw new Error(body.result.error.message ?? `rpc error ${body.result.error.code}`);
    }
    return body.result.value as T;
  }

  async listSessions(): Promise<ListSessionsResult> {
    const value = await this.call<SessionListValue>("session.list", {});

    return { sessions: value.items.filter((row) => !hiddenSessionIds.has(row.sessionId)).map((row) => toSession(row, projectNameOf(row.cwd))) };
  }

  async openSession(id: string): Promise<OpenSessionResult> {
    const all = await this.listSessions();
    const session = all.sessions.find((s) => s.id === id);
    const history = await this.call<SessionHistoryValue>("session.history", {
      sessionId: id,
      maxMessages: 100,
    });
    const messages = foldSessionHistory(history);
    return {
      session: session ?? { id, title: id, projectName: "deepseek-harness", updatedAt: Date.now() },
      messages,
      context: { usedPct: 0, usedTokens: 0, capacityTokens: 480000, compactionThresholdPct: 80 },
      metrics: { cacheHitPct: 0, cost: 0, runTimeMs: 0, requestCount: 0, totalTokens: 0, turns: 0 },
      tokenUsage: { bySource: [], byType: [] },
    };
  }

  async newSession(cwd?: string): Promise<OpenSessionResult> {
    const created = await this.call<SessionCreateValue>("session.create", cwd ? { cwd } : {});
    const session: Session = {
      id: created.sessionId,
      title: "新会话",
      projectName: cwd ? projectNameOf(cwd) : "deepseek-harness",
      cwd,
      updatedAt: Date.now(),
    };
    return {
      session,
      messages: [],
      context: { usedPct: 0, usedTokens: 0, capacityTokens: 480000, compactionThresholdPct: 80 },
      metrics: { cacheHitPct: 0, cost: 0, runTimeMs: 0, requestCount: 0, totalTokens: 0, turns: 0 },
      tokenUsage: { bySource: [], byType: [] },
    };
  }
  async submit(
    sessionId: string,
    text: string,
    mode: string,
    attachments?: PromptAttachment[],
  ): Promise<PromptResult> {
    // The host prompt contract takes structured content and a queue/steer mode;
    // the Reasonix composer treats every commit as a queued turn. The Reasonix
    // ComposerMode (normal/delivery/ask/auto/yolo) expresses execution intent, not
    // queue placement, so it does not map onto the host mode field.
    void mode;
    const content: Array<{ type: string; text?: string; mediaType?: string; data?: string; name?: string }> =
      [{ type: "text", text }];
    if (attachments !== undefined) {
      for (const a of attachments) {
        if (a.kind === "text" && a.textContent !== undefined) {
          // Text files (markdown/log/etc.) ride as text blocks with a labelled header.
          content.push({
            type: "text",
            text: `\n\n<attachment name="${a.name}">\n${a.textContent}\n</attachment>\n`,
          });
        } else {
          content.push({ type: "image", mediaType: a.mediaType, data: a.data, ...(a.name ? { name: a.name } : {}) });
        }
      }
    }
    await this.call<PromptAcceptedValue>("session.prompt", {
      sessionId,
      mode: "queue",
      content,
    });
    return { messages: [] };
  }
  /** Resolve one durable image by attachment id (`session.attachment`); data is base64. */
  async readAttachment(
    sessionId: string,
    attachmentId: string,
  ): Promise<{ attachment: { mediaType: string; name?: string }; data: string }> {
    return await this.call<{ attachment: { mediaType: string; name?: string }; data: string }>("session.attachment", { sessionId, attachmentId });
  }
  async settingsDescribe(): Promise<SettingsDescribeResult> {
    return await this.call<SettingsDescribeResult>("settings.describe", {});
  }
  async settingsUpdate(ns: string, patch: Record<string, unknown>, expectedRevision?: number): Promise<SettingsNamespaceView> {
    return await this.call<SettingsNamespaceView>("settings.update", { ns, patch, ...(expectedRevision !== undefined ? { expectedRevision } : {}) });
  }
  async listModels(sessionId: string): Promise<SessionModelsResult> {
    return await this.call<SessionModelsResult>("session.models", { sessionId });
  }
  async selectModel(sessionId: string, selection: ModelSelection): Promise<ModelSelection> {
    const value = await this.call<{ selected: ModelSelection }>("session.selectModel", {
      sessionId,
      provider: selection.provider,
      model: selection.model,
      ...(selection.reasoningEffort ? { reasoningEffort: selection.reasoningEffort } : {}),
    });
    return value.selected;
  }
  async listDirectory(path?: string): Promise<DirectoryListing> {
    return await this.call<DirectoryListing>("host.listDirectory", path ? { path } : {});
  }
  async pickDirectory(): Promise<string | null> {
    const value = await this.call<{ path: string | null }>("host.pickDirectory", {});
    return value.path;
  }
  async listFiles(path?: string): Promise<FileListing> {
    return await this.call<FileListing>("host.listFiles", path ? { path } : {});
  }
  async listSkills(sessionId: string): Promise<SkillEntry[]> {
    const value = await this.call<{ skills: SkillEntry[] }>("skill.list", { sessionId });
    return value.skills;
  }
  async searchSessions(query: string): Promise<SessionSearchItem[]> {
    const value = await this.call<{ items: SessionSearchItem[] }>("session.search", { query });
    return value.items;
  }
  /**
   * Enhance a draft prompt through the backend model. The host exposes no
   * standalone text-completion RPC (the desktop skin reached one via its Go
   * bridge), so this runs a throwaway session: create → prompt with a strict
   * no-tools instruction → poll history until the assistant turn settles →
   * archive the temp session so it never shows in the sidebar. Returns the
   * enhanced text, or "" when the run fails or times out.
   */
  async enhancePrompt(text: string): Promise<string> {
    const trimmed = text.trim();
    if (!trimmed) return "";
    const created = await this.call<SessionCreateValue>("session.create", {});
    const tempId = created.sessionId;
    try {
      const instruction = [
        "You are a prompt optimizer. Rewrite and enhance the following user instruction.",
        "Preserve the original intent and language. Make it clearer, more specific, and more actionable.",
        "Output ONLY the enhanced instruction text, with no preface, no markdown fences, and no explanation.",
        "Do NOT use any tools. Do NOT call any tools. Do NOT read or write files.",
        "",
        "USER INSTRUCTION:",
        trimmed,
      ].join("\n");
      await this.call<PromptAcceptedValue>("session.prompt", {
        sessionId: tempId,
        mode: "queue",
        content: [{ type: "text", text: instruction }],
      });

      const deadline = Date.now() + 90_000;
      let last = "";
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 700));
        const history = await this.call<SessionHistoryValue>("session.history", {
          sessionId: tempId,
          maxMessages: 40,
        });
        const messages = foldSessionHistory(history);
        // The final assistant text is the last message the run produced; a
        // settled turn leaves an assistant message that no longer grows.
        const assistant = [...messages].reverse().find((m) => m.role === "assistant");
        const next = (assistant?.content ?? "").trim();
        if (next && next === last) return next;
        if (next) last = next;
      }
      return last;
    } finally {
      try {
        hideSession(tempId);
        await this.call<{ archivedSessionIds: string[] }>("workspace.archiveSession", {
          sessionId: tempId,
        });
      } catch {
        // best-effort cleanup; an unarchived temp session is harmless
      }
    }
  }


  subscribe(
    onEvent: (event: SessionEvent) => void,
    onStatus: (connected: boolean) => void,
  ): () => void {
    // Downlink: a single MuxFrame WebSocket at /api/events.mux. Each text
    // message is one ServerRequest envelope whose payload is a MuxFrame:
    //   { type: "server-request", rpcId, method: "events.mux", payload: <MuxFrame> }
    // A LiveStreamFolder translates each `session/event` frame into the store
    // events the UI renders (content, reasoning, tool lifecycle).
    const sockets: WebSocket[] = [];
    let alive = true;
    let folder: LiveStreamFolder | null = null;

    const connect = (): void => {
      if (!alive) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(`${this.socketOrigin}/api/events.mux`);
      } catch {
        onStatus(false);
        return;
      }
      sockets.push(ws);
      ws.onopen = () => {
        folder = new LiveStreamFolder(onEvent);
        onStatus(true);
      };
      ws.onmessage = (ev) => {
        if (!alive) return;
        try {
          const envelope = JSON.parse(ev.data as string) as unknown;
          const frame = envelope as {
            type?: string;
            payload?: {
              type?: string;
                sessionId?: string;
              event?: RawWireEvent;
            };
          };
          const payload = frame?.payload;
          if (frame?.type !== "server-request" || payload === undefined) return;
          if (payload.type === "session/event" && payload.event !== undefined) {
            folder?.accept(payload.event, payload.sessionId);
            return;
          }
          // session/subscribed, approval/*, question/*, host frames are not
          // rendered by the standalone shell.
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (alive) onStatus(false);
      };
      ws.onerror = () => {
        if (alive) onStatus(false);
      };
    };

    connect();

    return () => {
      alive = false;
      sockets.forEach((s) => {
        try {
          s.close();
        } catch {
          /* noop */
        }
      });
    };
  }
}

// Factory: default to the demo provider; switch to the live harness backend
// when the user opts in (or when an env flag is present).
export function createApi(useLive: boolean): ApiClient {
  if (useLive) {
    return new HarnessApi();
  }
  return new MockApi();
}

export type { Message };