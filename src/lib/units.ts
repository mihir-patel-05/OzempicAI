// Unit-system helpers.
//
// Everything is stored in metric in Postgres (kg, cm, km) so history stays
// comparable across devices. These helpers convert to/from whatever the user
// picked in their profile, and are the only place conversion factors live.

export type UnitSystem = 'metric' | 'imperial'

const LB_PER_KG = 2.2046226218
const IN_PER_CM = 0.3937007874
const MI_PER_KM = 0.6213711922

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG
}

export function cmToIn(cm: number): number {
  return cm * IN_PER_CM
}

export function inToCm(inches: number): number {
  return inches / IN_PER_CM
}

export function kmToMi(km: number): number {
  return km * MI_PER_KM
}

export function miToKm(mi: number): number {
  return mi / MI_PER_KM
}

/** Short suffix for body/lifted weight in the given system. */
export function weightUnit(system: UnitSystem): string {
  return system === 'imperial' ? 'lb' : 'kg'
}

/** Short suffix for height in the given system. */
export function heightUnit(system: UnitSystem): string {
  return system === 'imperial' ? 'in' : 'cm'
}

/** Short suffix for distance in the given system. */
export function distanceUnit(system: UnitSystem): string {
  return system === 'imperial' ? 'mi' : 'km'
}

/** Stored kg → the number shown to the user. */
export function weightFromKg(kg: number, system: UnitSystem): number {
  return system === 'imperial' ? kgToLb(kg) : kg
}

/** A number the user typed → kg for storage. */
export function weightToKg(value: number, system: UnitSystem): number {
  return system === 'imperial' ? lbToKg(value) : value
}

/** Stored cm → the number shown to the user. */
export function heightFromCm(cm: number, system: UnitSystem): number {
  return system === 'imperial' ? cmToIn(cm) : cm
}

/** A number the user typed → cm for storage. */
export function heightToCm(value: number, system: UnitSystem): number {
  return system === 'imperial' ? inToCm(value) : value
}

/** Stored km → the number shown to the user. */
export function distanceFromKm(km: number, system: UnitSystem): number {
  return system === 'imperial' ? kmToMi(km) : km
}

/** A number the user typed → km for storage. */
export function distanceToKm(value: number, system: UnitSystem): number {
  return system === 'imperial' ? miToKm(value) : value
}

/**
 * Round for display. Lifted and body weights only ever need one decimal, and
 * trailing ".0" reads as noise on a dashboard, so drop it.
 */
export function roundForDisplay(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** e.g. formatWeight(72.5, 'imperial') === '159.8 lb' */
export function formatWeight(
  kg: number,
  system: UnitSystem,
  decimals = 1,
): string {
  return `${roundForDisplay(weightFromKg(kg, system), decimals)} ${weightUnit(system)}`
}

/** e.g. formatHeight(180, 'imperial') === '70.9 in' */
export function formatHeight(
  cm: number,
  system: UnitSystem,
  decimals = 1,
): string {
  return `${roundForDisplay(heightFromCm(cm, system), decimals)} ${heightUnit(system)}`
}

/** e.g. formatDistance(5, 'imperial') === '3.1 mi' */
export function formatDistance(
  km: number,
  system: UnitSystem,
  decimals = 2,
): string {
  return `${roundForDisplay(distanceFromKm(km, system), decimals)} ${distanceUnit(system)}`
}
