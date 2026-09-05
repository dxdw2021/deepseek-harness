// Voice-to-text (STT) for the Reasonix composer with a two-engine strategy:
//
//  1. Web Speech API first — the browser's own recognition engine (Edge uses
//     Microsoft's online service, accurate for zh-CN, live interim results).
//  2. Backend Whisper fallback — if the browser exposes SpeechRecognition but
//     its engine is unusable (Doubao's Chromium ships no recognition service
//     and rejects start() with `not-allowed`), or the API is absent, we fall
//     back to recording with getUserMedia and transcribing locally on the host
//     via the `audio.transcribe` RPC (offline, less accurate, no live interim).
//
// The manager exposes the same `SpeechRecognizer` interface to the composer and
// swaps engines transparently. Stop is race-safe: a stop issued while the mic is
// still being acquired is honored via `stopRequested`.

export interface SttHooks {
  /** Live partial transcript (unused by the backend engine; kept for parity). */
  onInterim: (text: string) => void;
  /** The committed transcript; append it to the field. */
  onFinal: (text: string) => void;
  /** Recording/recognition state changed (true while busy). */
  onState: (listening: boolean) => void;
  /** Fatal/actionable error (mic denied, host unreachable, recognition failed). */
  onError: (message: string) => void;
}

export interface SpeechRecognizer {
  start(): void;
  stop(): void;
  readonly listening: boolean;
}

/** STT availability: the browser can use its own engine or capture mic audio. */
export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  const webSpeech = typeof w.SpeechRecognition !== "undefined" || typeof w.webkitSpeechRecognition !== "undefined";
  const mic = typeof navigator.mediaDevices?.getUserMedia === "function";
  return webSpeech || mic;
}

type SpeechResultList = {
  readonly length: number;
  [index: number]: { readonly isFinal: boolean; readonly 0: { readonly transcript: string } };
};

type AnySpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function getSpeechRecognition(): AnySpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => AnySpeechRecognition; webkitSpeechRecognition?: new () => AnySpeechRecognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

// ---------------------------------------------------------------------------
// Engine 2: backend Whisper (getUserMedia recording → audio.transcribe RPC)
// ---------------------------------------------------------------------------

/** Encode Float32 PCM to base64 16-bit little-endian mono. */
function pcmToBase64(pcm: Float32Array): Promise<string> {
  const int16 = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  return new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] ?? "");
    fr.onerror = () => reject(fr.error ?? new Error("FileReader failed"));
    fr.readAsDataURL(new Blob([bytes]));
  });
}

function createWhisperEngine(hooks: SttHooks) {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let active = false;
  let stopRequested = false;

  async function transcribeRecording(blobType: string): Promise<void> {
    try {
      const blob = new Blob(chunks, { type: blobType });
      if (blob.size < 2048) {
        hooks.onError("录音太短，请按下麦克风后说话再停止");
        return;
      }
      const arrayBuffer = await blob.arrayBuffer();
      const ctx = new AudioContext();
      let audioBuf: AudioBuffer;
      try {
        audioBuf = await ctx.decodeAudioData(arrayBuffer);
      } finally {
        await ctx.close();
      }
      const pcm = audioBuf.getChannelData(0);
      const base64 = await pcmToBase64(pcm);
      const res = await fetch("/api/audio.transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "client-request",
          rpcId: `stt-${Math.random().toString(36).slice(2)}`,
          method: "audio.transcribe",
          payload: { audio: base64, sampleRate: audioBuf.sampleRate },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const envelope = (await res.json()) as {
        result?: { ok: boolean; value?: { text: string }; error?: { message?: string } };
      };
      const result = envelope.result;
      if (result?.ok && result.value) {
        hooks.onFinal(result.value.text);
      } else {
        hooks.onError(`语音识别失败：${result?.error?.message ?? "未知错误"}`);
      }
    } catch (error: unknown) {
      hooks.onError(`语音识别失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      active = false;
      hooks.onState(false);
    }
  }

  async function acquireAndRecord(): Promise<void> {
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stopRequested) {
        media.getTracks().forEach((t) => t.stop());
        active = false;
        hooks.onState(false);
        return;
      }
      stream = media;
      chunks = [];
      const mime = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : undefined;
      recorder = mime ? new MediaRecorder(media, { mimeType: mime }) : new MediaRecorder(media);
      const blobType = recorder.mimeType || "audio/webm";
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        recorder = null;
        stream?.getTracks().forEach((t) => t.stop());
        stream = null;
        void transcribeRecording(blobType).catch(() => {
          // transcribeRecording handles its own errors
        });
      };
      recorder.start();
    } catch (error: unknown) {
      active = false;
      hooks.onState(false);
      hooks.onError(`无法访问麦克风：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    start() {
      if (active) return;
      active = true;
      stopRequested = false;
      hooks.onState(true);
      void acquireAndRecord();
    },
    stop() {
      stopRequested = true;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
        return;
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      recorder = null;
      chunks = [];
      if (active) {
        active = false;
        hooks.onState(false);
      }
    },
    get listening() {
      return active;
    },
  };
}

// ---------------------------------------------------------------------------
// Engine 1: Web Speech API (browser's own engine; falls back on fatal errors)
// ---------------------------------------------------------------------------

function createWebSpeechEngine(hooks: SttHooks, onFatal: () => void) {
  let rec: AnySpeechRecognition | null = null;
  let active = false;
  let stopping = false;
  // Set once the engine is superseded (fatal error that switched to the Whisper
  // engine, or a deliberate stop). After this every async callback is inert, so
  // a late onend from abort() cannot clobber the fallback engine's onState.
  let dead = false;

  function startRecognition(): void {
    const r = getSpeechRecognition();
    if (!r) {
      active = false;
      hooks.onState(false);
      hooks.onError("语音识别初始化失败");
      return;
    }
    rec = r;
    r.lang = "zh-CN";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onstart = () => {};
    r.onresult = (event) => {
      if (dead) return;
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) final += transcript;
        else interim += transcript;
      }
      if (interim) hooks.onInterim(interim);
      if (final) hooks.onFinal(final);
    };
    r.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        // The browser exposes the API but has no working recognition service
        // (Doubao): supersede this engine and let the manager switch to the
        // local Whisper engine.
        dead = true;
        active = false;
        try { r.abort(); } catch { /* noop */ }
        rec = null;
        hooks.onError("浏览器语音识别不可用，已切换本地离线识别");
        onFatal();
      } else if (event.error === "no-speech") {
        // Keep listening for speech; not fatal.
      } else if (event.error === "aborted") {
        // Deliberate stop; nothing to do.
      } else {
        // network / audio-capture / other: keep listening, the engine retries
        // on next onend.
      }
    };
    r.onend = () => {
      rec = null;
      if (dead) return;
      if (active && !stopping) {
        startRecognition();
      } else if (!stopping) {
        active = false;
        hooks.onState(false);
      }
    };
    try {
      r.start();
    } catch (error: unknown) {
      dead = true;
      active = false;
      rec = null;
      hooks.onState(false);
      hooks.onError(`语音识别启动失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    start() {
      if (active || dead) return;
      active = true;
      stopping = false;
      hooks.onState(true);
      startRecognition();
    },
    stop() {
      stopping = true;
      active = false;
      dead = true;
      if (rec) {
        try { rec.stop(); } catch { /* noop */ }
        rec = null;
      }
      hooks.onState(false);
    },
    get listening() {
      return active;
    },
  };
}

// ---------------------------------------------------------------------------
// Manager: Web Speech first, Whisper fallback
// ---------------------------------------------------------------------------

export function createSpeechRecognizer(hooks: SttHooks): SpeechRecognizer {
  let engine: SpeechRecognizer | null = null;

  const startWhisper = (): void => {
    engine = createWhisperEngine(hooks);
    engine.start();
  };

  const start = (): void => {
    if (engine?.listening) return;
    if (getSpeechRecognition()) {
      const web = createWebSpeechEngine(hooks, () => {
        // Fatal engine error → switch to the local Whisper engine.
        engine = null;
        startWhisper();
      });
      engine = web;
      web.start();
    } else {
      startWhisper();
    }
  };

  const stop = (): void => {
    const e = engine;
    engine = null;
    e?.stop();
  };

  return {
    start,
    stop,
    get listening() {
      return engine?.listening ?? false;
    },
  };
}
