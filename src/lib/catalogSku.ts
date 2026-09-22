import type { PartSource } from '@/types/catalogItem'

/**
 * Generate a SKU from a product's name + part_source.
 *
 * Format:  <PREFIX><SOURCE><RANDOM>
 *   PREFIX = first 3 alphanumeric chars of the name, uppercased
 *            (falls back to "PRD" when name has no alphanumerics).
 *   SOURCE = "A" for aftermarket, "O" for OEM, "X" when unspecified.
 *   RANDOM = 6 random digits.
 *
 * Examples:
 *   ("Ford F150 Key Fob", "aftermarket") -> "FORA582193"
 *   ("F150 Smart Key",    "oem")         -> "F15O748021"
 *   ("Test Lock",         null)          -> "TESX110584"
 *
 * Generated SKUs are intentionally short and predictable. Users can
 * always override the value before saving — this is a starting point,
 * not an enforced format.
 */
export function generateSku(name: string, partSource: PartSource | null): string {
  const cleaned = (name || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const prefix = (cleaned.slice(0, 3) || 'PRD').padEnd(3, 'X')
  const source =
    partSource === 'aftermarket' ? 'A' : partSource === 'oem' ? 'O' : 'X'
  const random = Math.floor(100000 + Math.random() * 900000)
  return `${prefix}${source}${random}`
}
