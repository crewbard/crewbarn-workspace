/**
 * Time-range helpers for dashboard chart widgets. The dashboard has a
 * global Day / Month / Year selector; these turn a list of dated cents
 * amounts into evenly-spaced buckets for that range.
 *
 * Buckets are DISCRETE calendar periods (a tax year is Jan 1→Dec 31, quarters
 * are the fixed Q1–Q4 blocks) — each bucket is its own closed unit, never a
 * rolling window.
 *
 *   - 'day'     → one bucket per calendar day
 *   - 'month'   → one bucket per calendar month
 *   - 'quarter' → one bucket per calendar quarter (Jan–Mar, Apr–Jun, …)
 *   - 'year'    → one bucket per calendar year
 */
export type DashRange = 'day' | 'month' | 'quarter' | 'year'

export const DASH_RANGE_LABELS: Record<DashRange, string> = {
  day: 'Day',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
}

export interface Bucket {
  /** ISO key for the bucket start (used for matching). */
  key: string
  /** Short axis label, e.g. "May 3", "Apr", "2024". */
  label: string
  /** Summed cents in this bucket. */
  cents: number
}

interface RangeSpec {
  count: number
  startOf: (d: Date) => Date
  step: (d: Date, i: number) => Date
  key: (d: Date) => string
  label: (d: Date) => string
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`
}
function quarterKey(d: Date): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
}
function yearKey(d: Date): string {
  return `${d.getFullYear()}`
}

const SPECS: Record<DashRange, RangeSpec> = {
  day: {
    count: 14,
    startOf: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    step: (start, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
    key: dayKey,
    label: (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  },
  month: {
    count: 12,
    startOf: (d) => new Date(d.getFullYear(), d.getMonth(), 1),
    step: (start, i) => new Date(start.getFullYear(), start.getMonth() + i, 1),
    key: monthKey,
    label: (d) => d.toLocaleDateString('en-US', { month: 'short' }),
  },
  quarter: {
    count: 8,
    startOf: (d) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1),
    step: (start, i) => new Date(start.getFullYear(), start.getMonth() + i * 3, 1),
    key: quarterKey,
    label: (d) => `Q${Math.floor(d.getMonth() / 3) + 1}`,
  },
  year: {
    count: 5,
    startOf: (d) => new Date(d.getFullYear(), 0, 1),
    step: (start, i) => new Date(start.getFullYear() + i, 0, 1),
    key: yearKey,
    label: (d) => `${d.getFullYear()}`,
  },
}

/**
 * Bucket dated amounts into the range's evenly-spaced slots. Items outside
 * the window are ignored. Returns oldest → newest.
 */
export function bucketByRange(
  items: Array<{ at: string | null; cents: number }>,
  range: DashRange,
): Bucket[] {
  const spec = SPECS[range]
  const now = new Date()
  const currentStart = spec.startOf(now)
  // Build empty buckets oldest → newest.
  const buckets: Bucket[] = []
  const byKey = new Map<string, number>()
  for (let i = spec.count - 1; i >= 0; i--) {
    // step backwards: i days/months/years ago
    const d = spec.step(currentStart, -i)
    const b: Bucket = { key: spec.key(d), label: spec.label(d), cents: 0 }
    buckets.push(b)
    byKey.set(b.key, buckets.length - 1)
  }
  for (const it of items) {
    if (!it.at) continue
    const d = new Date(it.at)
    if (Number.isNaN(d.getTime())) continue
    const idx = byKey.get(spec.key(d))
    if (idx != null) buckets[idx].cents += it.cents
  }
  return buckets
}

export interface GroupedBucket {
  label: string
  /** cents per group key in this bucket. */
  byGroup: Record<string, number>
}

/**
 * Like bucketByRange but splits each bucket by a `group` key (e.g. tech or
 * payment method) for stacked charts. Returns the buckets plus the ordered
 * list of group keys seen, sorted by total descending.
 */
export function bucketGrouped(
  items: Array<{ at: string | null; cents: number; group: string }>,
  range: DashRange,
): { buckets: GroupedBucket[]; groups: string[] } {
  const spec = SPECS[range]
  const now = new Date()
  const currentStart = spec.startOf(now)
  const buckets: GroupedBucket[] = []
  const byKey = new Map<string, number>()
  for (let i = spec.count - 1; i >= 0; i--) {
    const d = spec.step(currentStart, -i)
    buckets.push({ label: spec.label(d), byGroup: {} })
    byKey.set(spec.key(d), buckets.length - 1)
  }
  const totals = new Map<string, number>()
  for (const it of items) {
    if (!it.at) continue
    const d = new Date(it.at)
    if (Number.isNaN(d.getTime())) continue
    const idx = byKey.get(spec.key(d))
    if (idx == null) continue
    buckets[idx].byGroup[it.group] = (buckets[idx].byGroup[it.group] ?? 0) + it.cents
    totals.set(it.group, (totals.get(it.group) ?? 0) + it.cents)
  }
  const groups = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g)
  return { buckets, groups }
}
