import { useMemo } from 'react'

/**
 * A year of rhythms, as twelve months you can look at.
 *
 * "Every week April to October, every other week November to March" is
 * two rows in a form and nearly impossible to check. Drawn across a year it
 * takes a second to see that the seasons meet, and — more usefully — a
 * second to see when they DON'T.
 *
 * Two things it is here to catch:
 *
 *   a gap      a month nothing covers, so the customer is not visited and
 *              nobody notices until they ring
 *   an overlap two rhythms claiming the same month, where which one wins
 *              depends on priority and is easy to get backwards
 *
 * A wrapping season — November to March — draws as two bands, because that
 * is what it is on a calendar. The same wrap that breaks a naive month
 * comparison in code reads perfectly well as a picture.
 */

export type Rhythm = {
  id?: string
  label?: string | null
  interval_count: number
  interval_unit: 'day' | 'week' | 'month' | 'year'
  season_start_month?: number | null
  season_start_day?: number | null
  season_end_month?: number | null
  season_end_day?: number | null
  priority?: number
  year_round?: boolean
}

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Rotating, so two rhythms never share a colour by accident. */
const BANDS = ['#0f766e', '#b45309', '#1d4ed8', '#7c3aed', '#be123c', '#047857']

export function isYearRound(r: Rhythm): boolean {
  return !r.season_start_month || !r.season_end_month
}

/** Which months a rhythm covers, 0-indexed, handling a wrap past December. */
export function monthsCovered(r: Rhythm): number[] {
  if (isYearRound(r)) return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  const start = (r.season_start_month as number) - 1
  const end = (r.season_end_month as number) - 1
  const out: number[] = []
  // Walks forward from the start and wraps, so November to March is
  // Nov, Dec, Jan, Feb, Mar rather than nothing at all.
  for (let i = start; ; i = (i + 1) % 12) {
    out.push(i)
    if (i === end) break
    if (out.length > 12) break
  }
  return out
}

export function rhythmInWords(r: Rhythm): string {
  const n = r.interval_count
  const unit = r.interval_unit
  if (n === 1) {
    return { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[unit] ?? `Every ${unit}`
  }
  if (n === 2 && unit === 'week') return 'Every other week'
  return `Every ${n} ${unit}s`
}

export function seasonInWords(r: Rhythm): string {
  if (isYearRound(r)) return 'All year'
  return `${MONTH_NAMES[(r.season_start_month as number) - 1]} to ${MONTH_NAMES[(r.season_end_month as number) - 1]}`
}

export function SeasonStrip({ rhythms }: { rhythms: Rhythm[] }) {
  const { coverage, gaps, overlaps } = useMemo(() => {
    const coverage: number[][] = Array.from({ length: 12 }, () => [])
    rhythms.forEach((r, index) => {
      for (const month of monthsCovered(r)) coverage[month].push(index)
    })
    return {
      coverage,
      gaps: coverage.map((c, m) => (c.length === 0 ? m : -1)).filter((m) => m >= 0),
      overlaps: coverage.map((c, m) => (c.length > 1 ? m : -1)).filter((m) => m >= 0),
    }
  }, [rhythms])

  if (rhythms.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">
        No rhythm yet. Add one and the year will show here.
      </p>
    )
  }

  return (
    <div>
      <div className="flex gap-px overflow-hidden rounded-md">
        {MONTHS.map((m, i) => (
          <div key={i} className="flex-1 text-center">
            <div
              className={
                coverage[i].length === 0
                  ? 'bg-rose-50 py-1 text-[10px] font-bold text-rose-400'
                  : 'bg-slate-100 py-1 text-[10px] font-bold text-slate-500'
              }
            >
              {m}
            </div>
            {/* One band per rhythm, in its own colour, so a month covered
                twice is visibly covered twice. */}
            <div className="flex flex-col gap-px">
              {rhythms.map((_, ri) => (
                <div
                  key={ri}
                  className="h-2"
                  style={{
                    background: coverage[i].includes(ri) ? BANDS[ri % BANDS.length] : '#f1f5f9',
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {rhythms.map((r, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="size-2.5 rounded-sm" style={{ background: BANDS[i % BANDS.length] }} />
            {rhythmInWords(r)}
            <span className="text-slate-400">· {seasonInWords(r)}</span>
          </span>
        ))}
      </div>

      {gaps.length > 0 && (
        <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700">
          Nothing covers {gaps.map((m) => MONTH_NAMES[m]).join(', ')}. No visits will be booked
          {gaps.length === 1 ? ' that month' : ' those months'}.
        </p>
      )}

      {overlaps.length > 0 && (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800">
          Two rhythms both cover {overlaps.map((m) => MONTH_NAMES[m]).join(', ')}. The one highest in
          the list wins there.
        </p>
      )}
    </div>
  )
}
