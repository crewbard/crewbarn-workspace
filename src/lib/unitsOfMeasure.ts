/**
 * Unit-of-measure presets for catalog items.
 *
 * Catalog items have a free-text `unit_label` field. This file groups the
 * common picks into a typeable dropdown and exposes helpers for the qty
 * inputs that consume that label (does it allow decimals? what suffix to
 * print?).
 *
 *   - "each" / "pair" / "set" → countable. Integer qty only.
 *   - lbs / oz / kg / g       → weight. Decimal qty allowed.
 *   - gal / qt / pt / fl oz   → US volume. Decimal qty allowed.
 *   - L / mL                  → metric volume. Decimal qty allowed.
 *   - ft / in / m / cm        → length. Decimal qty allowed.
 *   - "Custom…"               → free text, mostly stays as-typed.
 */

export interface UnitOfMeasureGroup {
  label: string
  units: string[]
}

export const UOM_GROUPS: UnitOfMeasureGroup[] = [
  { label: 'Count', units: ['each', 'pair', 'set'] },
  { label: 'Weight', units: ['lbs', 'oz', 'kg', 'g'] },
  { label: 'Volume (US)', units: ['gal', 'qt', 'pt', 'fl oz'] },
  { label: 'Volume (metric)', units: ['L', 'mL'] },
  { label: 'Length', units: ['ft', 'in', 'm', 'cm'] },
]

/** Flat list of all preset units (for membership tests). */
export const UOM_PRESETS: string[] = UOM_GROUPS.flatMap((g) => g.units)

/** Countable units use integer qty. Everything else allows decimals. */
const COUNTABLE = new Set(['each', 'pair', 'set'])

export function isCountableUnit(unitLabel: string | null | undefined): boolean {
  if (!unitLabel) return true // empty defaults to count behavior
  return COUNTABLE.has(unitLabel.trim().toLowerCase())
}

/** HTML number-input step. "1" for countable, "any" for measured. */
export function qtyStepFor(unitLabel: string | null | undefined): string {
  return isCountableUnit(unitLabel) ? '1' : 'any'
}

/**
 * Format a qty for display, optionally with the unit suffix.
 * Strips trailing zeros on decimals so "5.0000" reads as "5".
 */
export function formatQty(qty: number, unitLabel?: string | null, opts?: { showUnit?: boolean }): string {
  const showUnit = opts?.showUnit ?? true
  const isCountable = isCountableUnit(unitLabel)
  const num = isCountable
    ? String(Math.round(qty))
    : Number(qty).toFixed(4).replace(/\.?0+$/, '')
  if (!showUnit || !unitLabel) return num
  return `${num} ${unitLabel}`
}
