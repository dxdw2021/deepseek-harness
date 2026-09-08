/**
 * Host-side speech-to-text backed by @xenova/transformers Whisper (ONNX
 * runtime via WASM — no native addon build step). The model loads lazily on
 * the first transcription and is cached for the process lifetime; model
 * artifacts are fetched from a HuggingFace mirror on first use and cached
 * under the standard HuggingFace cache directory. This module is host-plane
 * only (Node runtime); the api/ contract layer never touches it.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

/** Whisper input rate; caller audio is resampled to it before recognition. */
const TARGET_RATE = 16000
/** Default quantized Chinese-capable model (offline, CPU-friendly). */
const DEFAULT_MODEL = 'Xenova/whisper-base'
/** HuggingFace mirror reachable from mainland networks. */
const DEFAULT_HF_MIRROR = 'https://hf-mirror.com/'

/** Narrow shape of the @xenova/transformers surface used here. */
interface TransformersModule {
  env: {
    remoteHost: string
    remotePathTemplate: string
    allowRemoteModels: boolean
    cacheDir: string
  }
  pipeline(
    task: string,
    model: string,
    options: { quantized: boolean },
  ): Promise<
    (audio: Float32Array, options?: { language?: string; task?: string }) => Promise<{ text: string }>
  >
}

/** A ready recognizer plus the model id that produced it. */
interface LoadedTranscriber {
  recognize: (audio: Float32Array, options?: { language?: string; task?: string }) => Promise<{ text: string }>
  model: string
}

export interface AudioTranscribeConfig {
  /** HuggingFace model id (quantized ONNX Whisper). */
  model?: string
  /** HuggingFace mirror base URL (override the mainland default). */
  hfMirror?: string
}

export interface AudioTranscribeResult {
  /** Recognized text, whitespace-trimmed. */
  text: string
  /** Model id used for this transcription. */
  model: string
  /** Wall-clock recognition time in milliseconds (model load excluded). */
  durationMs: number
}

let transcribePromise: Promise<LoadedTranscriber> | undefined

/** Lazy, process-lifetime singleton loader for the Whisper pipeline. */
function loadTranscriber(config: AudioTranscribeConfig): Promise<LoadedTranscriber> {
  if (transcribePromise !== undefined) return transcribePromise
  const model = config.model ?? process.env.REASONIX_STT_MODEL ?? DEFAULT_MODEL
  const mirror = config.hfMirror ?? process.env.REASONIX_STT_HF_MIRROR ?? DEFAULT_HF_MIRROR
  transcribePromise = (async () => {
    const mod = (await import('@xenova/transformers')) as unknown as TransformersModule
    mod.env.remoteHost = mirror
    mod.env.remotePathTemplate = '{model}/resolve/{revision}/'
    mod.env.allowRemoteModels = true
    // Isolate the model cache from the default HF CLI cache dir.
    const cacheDir = join(homedir(), '.cache', 'dsh-huggingface')
    mkdirSync(cacheDir, { recursive: true })
    mod.env.cacheDir = cacheDir
    const recognize = await mod.pipeline('automatic-speech-recognition', model, { quantized: true })
    return { recognize, model }
  })()
  return transcribePromise
}

/** Linear-interpolation resample of mono PCM to the target rate. */
function resample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples
  const ratio = toRate / fromRate
  const out = new Float32Array(Math.max(1, Math.floor(samples.length * ratio)))
  for (let i = 0; i < out.length; i++) {
    const pos = i / ratio
    const i0 = Math.floor(pos)
    const i1 = Math.min(i0 + 1, samples.length - 1)
    const frac = pos - i0
    // i0 is always in [0, samples.length-1] by construction
    out[i] = (samples[i0] ?? 0) * (1 - frac) + (samples[i1] ?? 0) * frac
  }
  return out
}

/**
 * Transcribes mono PCM audio (any sample rate; resampled to 16 kHz internally).
 * @param pcm - normalized float samples in [-1, 1].
 * @param sampleRate - capture rate of `pcm`.
 * @param config - model / mirror overrides (falls back to env, then defaults).
 * @returns the recognized text and recognition timing.
 */
export async function transcribePcm(
  pcm: Float32Array,
  sampleRate: number,
  config: AudioTranscribeConfig = {},
): Promise<AudioTranscribeResult> {
  const { recognize, model } = await loadTranscriber(config)
  const audio = resample(pcm, sampleRate, TARGET_RATE)
  const started = Date.now()
  const out = await recognize(audio, { language: 'chinese', task: 'transcribe' })
  return { text: out.text.trim(), model, durationMs: Date.now() - started }
}
