// Fold the DeepSeek-Harness session event stream into the Reasonix UI model.
//
// The harness records a session as an append-only log of `SessionEvent` rows
// (`user/message`, `assistant/chunk`, `assistant/message`, `tool/call`,
// `tool/result`, `turn/*`, `step/*`, ...). This module is the single translator
// used twice by `api.ts`: once to rebuild an opened session's `Message[]`
// from `session.history` (`foldSessionHistory`), and once to stream live
// `events.mux` frames into store-friendly events (`LiveStreamFolder`).
//
// It is deliberately free of DOM/browser globals so it runs unchanged under a
// unit runner; all wire shapes use the thin `RawWireEvent` view of the core
// `SessionEvent` envelope (`{ type, seq, time, data }`).

import type {
  Message,
  MessageImage,
  ReasoningSummary,
  SessionEvent,
  ToolCall,
} from "../types";

/** The wire view of one core `SessionEvent`: a `type` key plus an opaque `data` payload. */
export interface RawWireEvent {
  type: string;
  seq: number;
  time: number;
  data: Record<string, unknown>;
}

/** The `session.history` envelope: a `HistoryEntry[]` where each row wraps one raw event. */
export interface HistoryEnvelope {
  events: Array<{ event: RawWireEvent; view?: unknown }>;
}

interface ContentBlock {
  type: string;
  text?: string;
}

/** Plain text visible to the user (all `text` content blocks). */
function blockText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  return (blocks as ContentBlock[])
    .filter((b) => b && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
}

/** Hidden chain-of-thought content (`reasoning` content blocks). */
function blockReasoning(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  return (blocks as ContentBlock[])
    .filter((b) => b && b.type === "reasoning" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
}

interface ToolCallBlock {
  id: string;
  name: string;
  arguments: string;
}

/** Tool invocations the model requested inside an `assistant/message` content list. */
function blockToolCalls(blocks: unknown): ToolCallBlock[] {
  if (!Array.isArray(blocks)) return [];
  return (blocks as ContentBlock[])
    .filter((b) => b && b.type === "tool-call")
        .map((b) => {
      const raw = b as unknown as { id?: unknown; name?: unknown; arguments?: unknown };
      return {
        id: String(raw.id ?? ""),
        name: String(raw.name ?? ""),
        arguments: String(raw.arguments ?? ""),
      };
    });
}

/** Durable image references inside a message content list (`image` blocks). */
function blockImages(blocks: unknown): MessageImage[] {
  if (!Array.isArray(blocks)) return [];
  return (blocks as ContentBlock[])
    .filter((b) => b && b.type === "image")
    .map((b) => {
      const raw = b as unknown as { attachment?: { attachmentId?: unknown; mediaType?: unknown; width?: unknown; height?: unknown; name?: unknown } };
      const a = raw.attachment;
      return {
        attachmentId: String(a?.attachmentId ?? ""),
        mediaType: String(a?.mediaType ?? "image/png"),
        ...(typeof a?.width === "number" ? { width: a.width } : {}),
        ...(typeof a?.height === "number" ? { height: a.height } : {}),
        ...(a?.name ? { name: String(a.name) } : {}),
      };
    })
    .filter((img) => img.attachmentId !== "");
}
/** Text-attachment markers written by the composer (`<attachment name=...>…</attachment>`). */
const ATTACH_RE = /<attachment name="([^"]*)">[\s\S]*?<\/attachment>/g;

/** Remove text-attachment markers from a text block's display body. */
function stripAttachments(text: string): string {
  return text.replace(ATTACH_RE, "").replace(/\n{3,}/g, "\n\n");
}

/** Text-attachment file names inside a message content list. */
function blockAttachments(blocks: unknown): { name: string }[] {
  if (!Array.isArray(blocks)) return [];
  const names: string[] = [];
  for (const b of blocks as ContentBlock[]) {
    if (b && b.type === "text" && typeof (b as { text?: unknown }).text === "string") {
      const text = (b as { text: string }).text;
      ATTACH_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = ATTACH_RE.exec(text)) !== null) names.push(m[1]);
    }
  }
  return names.map((name) => ({ name }));
}
/** Normalize a raw tool `arguments` payload into a display string. */
function argsOf(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (typeof raw === "string") return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

/** Extract the correlated call id, body text, and error flag of a `tool/result` event. */
function toolResultInfo(data: Record<string, unknown>): {
  callId?: string;
  text: string;
  isError: boolean;
} {
  const message = data.message as
    | { source?: { callId?: string }; content?: unknown[] }
    | undefined;
  const block = message?.content?.[0] as
    | { type?: string; content?: unknown; isError?: boolean }
    | undefined;
  return {
    callId: message?.source?.callId,
    text: block && block.type === "tool-result" ? blockText(block.content) : "",
    isError: block?.isError === true || data.error !== undefined,
  };
}

/** One assistant step whose message is under construction during a fold. */
interface OpenStep {
  key: string;
  turn: number;
  step: number;
    /** Latest event time seen for the step; backfills the assistant message time. */
  createdAt?: number;
  /** Stable display id for the step's assistant message. The harness message
   * id may arrive only in the final `assistant/message`, so streaming rows are
   * keyed by (turn, step) position, not by the eventual id. */
  msgId: string;
  /** Streamed plus final text; `assistant/message` overwrites the streamed tail. */
  text: string;
  hasFinal: boolean;
  reasoningDeltas: string[];
  reasoningFinal: string | null;
  tools: Map<string, ToolCall>;
  streamed: boolean;
  /** Whether this step's reasoning summary has been emitted (append-once). */
  reasoningEmitted: boolean;
}

/** Build one reasoning summary from a step's accumulated or final reasoning text. */
function reasoningSummary(o: OpenStep): ReasoningSummary[] {
  const text = o.reasoningFinal ?? o.reasoningDeltas.join("");
  const trimmed = text.trim();
  if (!trimmed) return [];
  const headline = trimmed.split(/\n/)[0].slice(0, 60) || "思考";
  return [
    {
      id: `r-${o.msgId}`,
      headline,
      detail: text,
      toolsCount: o.tools.size,
      thinkingCount: o.reasoningDeltas.length || 1,
    },
  ];
}
/**
 * Rebuild a session's `Message[]` from its ordered history log. Turns the
 * harness surface events (user messages, streamed plus assembled assistant
 * turns, tool call/result pairs, turn boundaries) into the Reasonix model:
 * assistant content, reasoning summaries, and tool rows.
 */
export function foldSessionHistory(history: HistoryEnvelope | null | undefined): Message[] {
  const out: Message[] = [];
  const openByStep = new Map<string, OpenStep>();

  const finalize = (o: OpenStep): void => {
    const idx = out.findIndex((m) => m.id === o.msgId);
    if (idx === -1) {
      openByStep.delete(o.key);
      return;
    }
                const msg = out[idx];
    msg.createdAt = Math.max(msg.createdAt, o.createdAt ?? 0);
    msg.content = o.text;
    msg.streaming = false;
    if (msg.reasoning === undefined) {
      const r = reasoningSummary(o);
      if (r.length) msg.reasoning = r;
    }
    if (msg.tools === undefined) msg.tools = [...o.tools.values()];
    // Drop a step that produced nothing visible (no text/tools/reasoning).
    if (!o.streamed && !o.hasFinal && !o.text && msg.tools.length === 0) {
      out.splice(idx, 1);
    }
    openByStep.delete(o.key);
  };

  const closeAll = (): void => {
    for (const o of [...openByStep.values()]) finalize(o);
  };

  const ensureOpen = (turn: number, step: number): OpenStep => {
    const key = `${turn}:${step}`;
    const existing = openByStep.get(key);
    if (existing) return existing;
    const msgId = `t-${turn}:${step}`;
    const o: OpenStep = {
      key,
      turn,
      step,
      msgId,
      text: "",
      hasFinal: false,
      reasoningDeltas: [],
      reasoningFinal: null,
      tools: new Map(),
      streamed: false,
      reasoningEmitted: false,
    };
        openByStep.set(key, o);
    out.push({ id: msgId, role: "assistant", content: "", createdAt: 0, streaming: true, tools: [] });
    return o;
  };

  const upsertTools = (o: OpenStep): void => {
    const msg = out.find((m) => m.id === o.msgId);
    if (msg) msg.tools = [...o.tools.values()];
  };

  for (const { event } of history?.events ?? []) {
    const { type, data, time } = event;
    switch (type) {
      case "user/message": {
        closeAll();
        const images = blockImages(data.content);
        const attachments = blockAttachments(data.content);
        out.push({
          id: typeof data.id === "string" ? data.id : `u-${time}-${out.length}`,
          role: "user",
          content: stripAttachments(blockText(data.content)),
          createdAt: time,
          ...(images.length ? { images } : {}),
          ...(attachments.length ? { attachments } : {}),
        });
        break;
      }
      case "assistant/chunk": {
        const d = data as { turn?: number; step?: number; chunk?: { type?: string; text?: string } };
                const o = ensureOpen(d.turn ?? 0, d.step ?? 0);
        o.streamed = true;
        o.createdAt = time;
        if (d.chunk?.type === "text-delta" && typeof d.chunk.text === "string" && d.chunk.text) {
          o.text += d.chunk.text;
          const msg = out.find((m) => m.id === o.msgId);
          if (msg) { msg.content = o.text; msg.streaming = true; }
        } else if (d.chunk?.type === "reasoning-delta" && typeof d.chunk.text === "string" && d.chunk.text) {
          o.reasoningDeltas.push(d.chunk.text);
        }
        break;
      }
      case "assistant/message": {
        const d = data as { turn?: number; step?: number; message?: { content?: unknown } };
        const o = ensureOpen(d.turn ?? 0, d.step ?? 0);
        o.streamed = true;
        o.hasFinal = true;
        o.text = blockText(d.message?.content);
        o.reasoningFinal = blockReasoning(d.message?.content) || null;
        for (const tc of blockToolCalls(d.message?.content)) {
          if (!o.tools.has(tc.id)) {
            o.tools.set(tc.id, { id: tc.id, name: tc.name, args: tc.arguments, status: "pending" });
          }
        }
        const msg = out.find((m) => m.id === o.msgId);
        if (msg) {
          msg.content = o.text;
          msg.streaming = false;
          const r = reasoningSummary(o);
          if (r.length) msg.reasoning = r;
          msg.tools = [...o.tools.values()];
        }
        break;
      }
      case "tool/call": {
        const d = data as { turn?: number; step?: number; callId?: string; name?: string; arguments?: unknown };
        const o = ensureOpen(d.turn ?? 0, d.step ?? 0);
        o.streamed = true;
        if (d.callId && !o.tools.has(d.callId)) {
          o.tools.set(d.callId, { id: d.callId, name: d.name ?? "", args: argsOf(d.arguments), status: "running" });
          upsertTools(o);
        }
        break;
      }
      case "tool/result": {
        const d = data as { turn?: number; step?: number };
        const o = openByStep.get(`${d.turn ?? 0}:${d.step ?? 0}`);
        const { callId, text, isError } = toolResultInfo(data);
        if (o && callId) {
          const tool = o.tools.get(callId);
          if (tool) {
            tool.status = isError ? "error" : "success";
            if (text) tool.result = text;
            tool.durationMs = tool.durationMs ?? 0;
            upsertTools(o);
          }
        }
        break;
      }
      case "turn/end":
      case "session/end-seed":
        closeAll();
        break;
      default:
        // log-only and UI events (titles, todos, request headers, hooks, ...)
        // do not render in the surface.
        break;
    }
  }

    closeAll();
  return out;
}
/**
 * Fold live `events.mux` frames into the store's `SessionEvent` vocabulary.
 *
 * The harness downlink delivers raw `SessionEvent`s; this class translates the
 * surface subset the shell renders (user/assistant turns, tools, reasoning)
 * into the store reducer's events so a live backend streams identically to the
 * MockApi.
 */
export class LiveStreamFolder {
  private openByStep = new Map<string, OpenStep>();
  private sessionId = "";
  private _emit: (e: SessionEvent) => void;
  /** Attach the current accept() session id to every emitted store event. */
  private emit = (e: SessionEvent): void => {
    this._emit(this.sessionId ? { ...e, sessionId: this.sessionId } : e);
  };

  constructor(emit: (e: SessionEvent) => void) {
    this._emit = emit;
  }

  private ensureOpen(turn: number, step: number): OpenStep {
    const key = `${turn}:${step}`;
    const existing = this.openByStep.get(key);
    if (existing) return existing;
    const msgId = `t-${turn}:${step}`;
    const o: OpenStep = {
      key,
      turn,
      step,
      msgId,
      text: "",
      hasFinal: false,
      reasoningDeltas: [],
      reasoningFinal: null,
      tools: new Map(),
      streamed: false,
      reasoningEmitted: false,
    };
    this.openByStep.set(key, o);
    this.emit({ kind: "message.append", payload: { id: msgId, role: "assistant", content: "", createdAt: Date.now(), streaming: true } });
    return o;
  }

  private closeStep(o: OpenStep): void {
    this.emit({ kind: "message.update", payload: { messageId: o.msgId, patch: { content: o.text, streaming: false } } });
    const r = reasoningSummary(o);
    if (r.length && !o.reasoningEmitted) {
      o.reasoningEmitted = true;
      this.emit({ kind: "reasoning.append", payload: { messageId: o.msgId, summary: r[0] } });
    }
    this.openByStep.delete(o.key);
  }

  private closeAll(): void {
    for (const o of [...this.openByStep.values()]) this.closeStep(o);
  }

  /** Feed one downlink session event; emits translated store events. */
  accept(event: RawWireEvent, sessionId?: string): void {
    this.sessionId = sessionId ?? "";
    const { type, data, time } = event;
    switch (type) {
      case "user/message": {
        this.closeAll();
        const id = typeof data.id === "string" ? data.id : `u-${time}`;
        const images = blockImages(data.content);
        const attachments = blockAttachments(data.content);
        this.emit({ kind: "message.append", payload: { id, role: "user", content: stripAttachments(blockText(data.content)), createdAt: time, ...(images.length ? { images } : {}), ...(attachments.length ? { attachments } : {}) } });
        break;
      }
      case "assistant/chunk": {
        const d = data as { turn?: number; step?: number; chunk?: { type?: string; text?: string } };
        const o = this.ensureOpen(d.turn ?? 0, d.step ?? 0);
        o.streamed = true;
        if (d.chunk?.type === "text-delta" && typeof d.chunk.text === "string" && d.chunk.text) {
          o.text += d.chunk.text;
          this.emit({ kind: "message.update", payload: { messageId: o.msgId, patch: { content: o.text, streaming: true } } });
        } else if (d.chunk?.type === "reasoning-delta" && typeof d.chunk.text === "string" && d.chunk.text) {
          o.reasoningDeltas.push(d.chunk.text);
        }
        break;
      }
      case "assistant/message": {
        const d = data as { turn?: number; step?: number; message?: { content?: unknown } };
        const o = this.ensureOpen(d.turn ?? 0, d.step ?? 0);
        o.streamed = true;
        o.hasFinal = true;
        o.text = blockText(d.message?.content);
        o.reasoningFinal = blockReasoning(d.message?.content) || null;
        this.emit({ kind: "message.update", payload: { messageId: o.msgId, patch: { content: o.text, streaming: false } } });
        const r = reasoningSummary(o);
        if (r.length) {
          o.reasoningEmitted = true;
          this.emit({ kind: "reasoning.append", payload: { messageId: o.msgId, summary: r[0] } });
        }
        for (const tc of blockToolCalls(d.message?.content)) {
          if (!o.tools.has(tc.id)) {
            const tool: ToolCall = { id: tc.id, name: tc.name, args: tc.arguments, status: "pending" };
            o.tools.set(tc.id, tool);
            this.emit({ kind: "tool.start", payload: { messageId: o.msgId, tool } });
          }
        }
        break;
      }
      case "tool/call": {
        const d = data as { turn?: number; step?: number; callId?: string; name?: string; arguments?: unknown };
        if (!d.callId) break;
        const o = this.ensureOpen(d.turn ?? 0, d.step ?? 0);
        o.streamed = true;
        if (!o.tools.has(d.callId)) {
          const tool: ToolCall = { id: d.callId, name: d.name ?? "", args: argsOf(d.arguments), status: "running" };
          o.tools.set(d.callId, tool);
          this.emit({ kind: "tool.start", payload: { messageId: o.msgId, tool } });
        }
        break;
      }
      case "tool/result": {
        const d = data as { turn?: number; step?: number };
        const o = this.openByStep.get(`${d.turn ?? 0}:${d.step ?? 0}`);
        if (!o) break;
        const { callId, text, isError } = toolResultInfo(data);
        if (callId && o.tools.has(callId)) {
          this.emit({
            kind: "tool.update",
            payload: {
              messageId: o.msgId,
              toolId: callId,
              patch: { status: isError ? "error" : "success", ...(text ? { result: text } : {}) },
            },
          });
        }
        break;
      }
      case "turn/end":
      case "session/end-seed":
        this.closeAll();
        break;
      default:
        break;
    }
  }
}