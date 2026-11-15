import Anthropic from '@anthropic-ai/sdk'
import { HttpError } from '../http.js'

/** Switch to claude-sonnet-5-5 with AI_MODEL if cost or latency becomes a problem. */
export const AI_MODEL = process.env.AI_MODEL?.trim() || 'claude-opus-5-5'

/** Per-user messages sent to the coach per hour. */
export const AI_MAX_TURNS_PER_HOUR = positiveInt(process.env.AI_MAX_TURNS_PER_HOUR, 40)

/** Without a key the coach is off and every other route keeps working. */
export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

let client: Anthropic | null = null

export function getClient(): Anthropic {
  if (!isConfigured()) throw new HttpError(503, 'AI coach is not configured')
  // The SDK retries 408/409/429/5xx and connection errors twice by default.
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}
