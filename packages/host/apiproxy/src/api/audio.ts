/**
 * audio domain contract: local speech-to-text via an offline Whisper model.
 * The client uploads 16-bit mono PCM samples with a caller-declared rate; the
 * host transcriber resamples to 16 kHz and returns the transcript. No session
 * is involved — a pure capability call whose model loads lazily on first use.
 */

import type { RpcRequest, RpcResponse } from './rpc.ts'

/** Offline transcription result. */
export interface AudioTranscription {
  /** Recognized text (whitespace-trimmed). */
  readonly text: string
  /** Whisper model id that produced this transcription. */
  readonly model: string
  /** Wall-clock transcription time in milliseconds (model load excluded). */
  readonly durationMs: number
}

/**
 * Audio-domain unary methods (the map key audio.* of RpcMethodMap). The only
 * method, transcribe, performs its heavy model load lazily on first call so
 * hosts without a configured STT model answer an explicit unsupported error
 * instead of paying the load cost up front.
 */
export interface AudioApi {
  /**
   * Transcribes base64-encoded 16-bit little-endian mono PCM audio to text.
   * @param request - payload with base64 `audio` and the capture `sampleRate`.
   */
  transcribe(request: RpcRequest<{ audio: string; sampleRate: number }>): Promise<RpcResponse<AudioTranscription>>
}
