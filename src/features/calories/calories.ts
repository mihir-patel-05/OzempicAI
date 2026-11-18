/** The API's limit on one entry's calories. */
export const MAX_CALORIES = 100_000

/**
 * Whole calories from what was typed, or null when it isn't a usable amount.
 * Fractions round to the nearest calorie, never below 1.
 */
export function parseCalories(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  const rounded = Math.max(1, Math.round(n))
  return rounded > MAX_CALORIES ? null : rounded
}
