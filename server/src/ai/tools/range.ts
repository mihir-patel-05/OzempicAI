import { z } from 'zod'
import { resolveRange } from '../dates.js'
import type { DateRange, RangePreset } from '../dates.js'

/** Presets for looking back at logged data. */
export const PAST_PRESETS = ['today', 'this_week', 'last_week', 'last_7_days', 'last_30_days', 'custom'] as const
/** Presets for planned meals, which are usually in the future. */
export const PLAN_PRESETS = ['today', 'this_week', 'next_week', 'next_7_days', 'custom'] as const

/** JSON-schema properties for a range preset plus optional custom dates. */
export function rangeProperties(presets: readonly RangePreset[]) {
  return {
    range: {
      type: 'string',
      enum: [...presets],
      description: 'Date range in the user\'s timezone. Weeks run Monday to Sunday; this_week ends today.',
    },
    start_date: {
      type: ['string', 'null'],
      description: 'YYYY-MM-DD, only for range=custom; otherwise null.',
    },
    end_date: {
      type: ['string', 'null'],
      description: 'YYYY-MM-DD inclusive, only for range=custom; otherwise null.',
    },
  }
}

export function rangeSchema<const P extends readonly [RangePreset, ...RangePreset[]]>(presets: P) {
  return z.object({
    range: z.enum(presets),
    start_date: z.string().nullish(),
    end_date: z.string().nullish(),
  })
}

export function rangeFromInput(
  input: { range: RangePreset; start_date?: string | null; end_date?: string | null },
  tz: string,
): DateRange {
  return resolveRange(input.range, tz, input)
}
