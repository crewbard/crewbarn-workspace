import { useDashboardSummary, type ReportPeriod } from '@/hooks/useDashboardSummary'
import type { DashRange } from '@/lib/dashboardTime'

/**
 * Pick WHICH calendar period a report covers.
 *
 * Tax periods are closed units — the tax year is Jan 1→Dec 31, quarters are the
 * fixed Q1–Q4 blocks. A period that has fully elapsed is marked "closed": its
 * numbers are final. The still-running one is marked "to date".
 */
export function PeriodPicker({
  periods,
  selected,
  onChange,
}: {
  periods: ReportPeriod[]
  selected: string
  onChange: (key: string) => void
}) {
  if (periods.length === 0) return null

  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      title="Reporting period — each is a discrete calendar period, closed on its own"
      aria-label="Reporting period"
      className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 focus:border-amber-500 focus:outline-none"
    >
      {periods.map((p) => (
        <option key={p.key} value={p.key}>
          {p.label}
          {p.closed ? '' : ' · to date'}
        </option>
      ))}
    </select>
  )
}

/**
 * Board variant — reads the period list off the same cached summary query the
 * widgets use (so it costs no extra request). MUST render inside the
 * DashboardPeriodContext provider so it sees the current selection.
 */
export function BoardPeriodPicker({
  range,
  onChange,
}: {
  range: DashRange
  onChange: (key: string) => void
}) {
  const q = useDashboardSummary(range)
  return (
    <PeriodPicker
      periods={q.data?.data.cashflow.periods ?? []}
      selected={q.data?.data.cashflow.period.key ?? ''}
      onChange={onChange}
    />
  )
}
