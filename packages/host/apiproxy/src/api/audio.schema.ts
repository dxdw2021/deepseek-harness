/**
 * audio domain zod schemas (names derived from map keys: audioTranscribeRequestSchema /
 * audioTranscribeValueSchema).
 */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'

/** audio.transcribe request payload: base64 16-bit mono PCM + capture rate. */
export const audioTranscribeRequestSchema = z.object({
  audio: z.string().min(1),
  sampleRate: z.number().int().min(8000).max(96000),
}) satisfies z.ZodType<Wire<RequestPayload<'audio.transcribe'>>>

/** audio.transcribe response value. */
export const audioTranscribeValueSchema = z.object({
  text: z.string(),
  model: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
}) satisfies z.ZodType<Wire<ResponseValue<'audio.transcribe'>>>
