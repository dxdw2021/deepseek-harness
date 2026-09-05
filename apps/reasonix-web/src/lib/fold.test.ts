// Unit tests for the harness↔Reasonix event fold (see ./fold.ts).
// Run via the repo root test runner: `vitest run reasonix-frontend/src/lib/fold.test.ts`.

import { describe, it, expect } from "vitest";
import { foldSessionHistory, LiveStreamFolder, type RawWireEvent } from "./fold";
import type { SessionEvent } from "../types";

const ev = (type: string, data: Record<string, unknown>, time: number, seq = 1): RawWireEvent => ({
  type,
  seq,
  time,
  data,
});

function textBlocks(text: string) {
  return [{ type: "text", text }];
}

function history(events: RawWireEvent[]) {
    return { events: events.map((e) => ({ event: e })) };
}

describe("foldSessionHistory", () => {
  it("folds a tool-using assistant turn", () => {
    const T = 1000;
    const events = [
      ev("user/message", { id: "u1", content: textBlocks("list files") }, T),
      ev("assistant/chunk", { turn: 0, step: 0, chunk: { type: "text-delta", text: "Hel" } }, T + 10),
      ev("assistant/chunk", { turn: 0, step: 0, chunk: { type: "text-delta", text: "lo" } }, T + 20),
      ev("tool/call", { turn: 0, step: 0, callId: "c1", name: "shell", arguments: '{"cmd":"ls"}' }, T + 30),
      ev("tool/result", {
        turn: 0, step: 0,
        message: { source: { callId: "c1" }, content: [{ type: "tool-result", toolCallId: "c1", content: textBlocks("a b c.txt"), isError: false }] },
      }, T + 40),
      ev("assistant/message", {
        turn: 0, step: 0,
        message: { id: "m1", content: [...textBlocks("Hello"), { type: "tool-call", id: "c1", name: "shell", arguments: '{"cmd":"ls"}' }] },
      }, T + 50),
      ev("turn/end", { turn: 0, reason: { kind: "complete" } }, T + 60),
    ];

    const msgs = foldSessionHistory(history(events));
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].content).toBe("list files");
    const a = msgs[1];
    expect(a.role).toBe("assistant");
    expect(a.content).toBe("Hello");
    expect(a.streaming).toBe(false);
    expect(a.tools).toHaveLength(1);
        expect(a.tools?.[0]).toMatchObject({ id: "c1", name: "shell", status: "success", result: "a b c.txt" });
    expect(a.reasoning).toBeUndefined();
    });

  it("reassembles a streamed-then-assembled turn with reasoning", () => {
    const T = 2000;
    const events = [
      ev("assistant/chunk", { turn: 0, step: 0, chunk: { type: "reasoning-delta", text: "thinking…" } }, T),
      ev("assistant/chunk", { turn: 0, step: 0, chunk: { type: "text-delta", text: "Hi" } }, T + 10),
      ev("assistant/message", {
        turn: 0, step: 0,
        message: { id: "m2", content: [...textBlocks("Hi"), { type: "reasoning", text: "thinking…" }] },
      }, T + 20),
      ev("turn/end", { turn: 0, reason: { kind: "complete" } }, T + 30),
    ];

    const msgs = foldSessionHistory(history(events));
    expect(msgs).toHaveLength(1);
    const a = msgs[0];
    expect(a.content).toBe("Hi");
    expect(a.streaming).toBe(false);
    expect(a.reasoning).toHaveLength(1);
    expect(a.reasoning?.[0].detail).toBe("thinking…");
  });

  it("keeps streamed text for a turn that never assembled", () => {
    const T = 3000;
    const events = [
      ev("assistant/chunk", { turn: 0, step: 0, chunk: { type: "text-delta", text: "partial" } }, T),
      ev("turn/end", { turn: 0, reason: { kind: "canceled" } }, T + 5),
    ];
    const msgs = foldSessionHistory(history(events));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("partial");
    expect(msgs[0].streaming).toBe(false);
  });

  it("drops steps that produced no surface output", () => {
    const T = 4000;
    const events = [
      ev("turn/start", { turn: 0 }, T),
      ev("step/start", { turn: 0, step: 0 }, T),
      ev("step/end", { turn: 0, step: 0 }, T),
      ev("turn/end", { turn: 0, reason: { kind: "empty" } }, T),
      ev("user/message", { id: "u2", content: textBlocks("ping") }, T + 10),
    ];
    const msgs = foldSessionHistory(history(events));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("ping");
  });

  it("handles null history gracefully", () => {
    expect(foldSessionHistory(undefined)).toEqual([]);
        expect(foldSessionHistory(null)).toEqual([]);
  });
});

describe("LiveStreamFolder", () => {
  it("maps a streamed turn into store events", () => {
    const emitted: SessionEvent[] = [];
    const folder = new LiveStreamFolder((e) => emitted.push(e));
    const T = 5000;
    folder.accept(ev("user/message", { id: "u3", content: textBlocks("hi") }, T));
    folder.accept(ev("assistant/chunk", { turn: 0, step: 0, chunk: { type: "text-delta", text: "A" } }, T + 1));
    folder.accept(ev("assistant/chunk", { turn: 0, step: 0, chunk: { type: "text-delta", text: "B" } }, T + 2));
    folder.accept(ev("assistant/message", { turn: 0, step: 0, message: { id: "m3", content: textBlocks("AB") } }, T + 3));

    expect(emitted).toHaveLength(5);
    expect(emitted[0].kind).toBe("message.append");
    expect((emitted[0].payload as { role: string }).role).toBe("user");
    expect(emitted.map((e) => e.kind)).toEqual([
      "message.append",
      "message.append",
      "message.update",
      "message.update",
      "message.update",
    ]);
    // Final assistant mutation lands streaming=false with merged text.
    const final = emitted[4];
    expect(final.kind).toBe("message.update");
    expect((final.payload as { patch: { content: string; streaming: boolean } }).patch).toEqual({ content: "AB", streaming: false });
  });

  it("translates tool call/result lifecycle", () => {
    const emitted: SessionEvent[] = [];
    const folder = new LiveStreamFolder((e) => emitted.push(e));
    const T = 6000;
    folder.accept(ev("assistant/chunk", { turn: 0, step: 0, chunk: { type: "text-delta", text: "x" } }, T));
    folder.accept(ev("tool/call", { turn: 0, step: 0, callId: "c4", name: "shell", arguments: "{}" }, T + 1));
    folder.accept(ev("tool/result", {
      turn: 0, step: 0,
      message: { source: { callId: "c4" }, content: [{ type: "tool-result", toolCallId: "c4", content: textBlocks("done"), isError: false }] },
    }, T + 2));

    const toolStarts = emitted.filter((e) => e.kind === "tool.start");
    const toolUpdates = emitted.filter((e) => e.kind === "tool.update");
    expect(toolStarts).toHaveLength(1);
    expect(toolStarts[0].payload).toMatchObject({ tool: expect.objectContaining({ id: "c4", name: "shell", status: "running" }) });
    expect(toolUpdates).toHaveLength(1);
    expect(toolUpdates[0].payload).toMatchObject({ toolId: "c4", patch: { status: "success", result: "done" } });
  });
});
