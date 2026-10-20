import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

type MixRange = 'day' | 'week' | 'month' | 'year'

interface MixCounts {
  new_customers: number
  jobs_new: number
  jobs_returning: number
}

interface CustomerMix extends MixCounts {
  period: { key: string; label: string; closed: boolean }
  previous: MixCounts & { label: string }
  periods: Array<{ key: string; label: string }>
}

const RANGES: Array<{ key: MixRange; label: string }> = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
]

const RANGE_KEY = 'crewbarn_customer_mix_range'

function storedRange(): MixRange {
  try {
    const v = localStorage.getItem(RANGE_KEY)
    return v === 'day' || v === 'week' || v === 'month' || v === 'year' ? v : 'month'
  } catch {
    return 'month'
  }
}

/**
 * New customers, and jobs from new vs returning customers, for a day, week,
 * month or year. A new customer is one whose first job ever falls in the
 * period -- imported history counts, so a long-standing customer is never
 * read as new because an import was run today.
 */
export function CustomerMixCard() {
  const [range, setRange] = useState<MixRange>(storedRange)
  const [period, setPeriod] = useState<string>('')

  const q = useQuery({
    queryKey: ['dashboard', 'customer-mix', range, period || 'current'],
    queryFn: () =>
      apiRequest<{ data: CustomerMix }>(
        `/v1/dashboard/customer-mix?range=${range}${period ? `&period=${encodeURIComponent(period)}` : ''}`,
      ),
    staleTime: 60_000,
  })

  const pickRange = (next: MixRange) => {
    setRange(next)
    setPeriod('')
    try {
      localStorage.setItem(RANGE_KEY, next)
    } catch {
      /* remembered for this visit only */
    }
  }

  const d = q.data?.data
  const jobs = d ? d.jobs_new + d.jobs_returning : 0
  const newShare = jobs > 0 && d ? Math.round((d.jobs_new / jobs) * 100) : 0

  return (
    <section data-tour="dash-customer-mix" className="h-full flex flex-col rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="New and returning customers">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-navy-900">New vs returning customers</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" data-tour="dash-customer-mix-range" aria-label="Period length" className="inline-flex rounded-lg border border-slate-200 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => pickRange(r.key)}
                aria-pressed={range === r.key}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  range === r.key ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {d && d.periods.length > 1 && (
            <select
              data-tour="dash-customer-mix-period"
              aria-label="Which period"
              value={period || d.period.key}
              onChange={(e) => setPeriod(e.target.value === d.periods[0]?.key ? '' : e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
            >
              {d.periods.map((p, i) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                  {i === 0 ? ' · to date' : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : q.isError || !d ? (
        <p role="alert" className="text-sm text-red-700">
          These numbers could not be loaded.{' '}
          <button type="button" className="font-semibold underline" onClick={() => void q.refetch()}>
            Try again
          </button>
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Figure label="New customers" value={d.new_customers} was={d.previous.new_customers} wasLabel={d.previous.label} tone="text-emerald-700" />
            <Figure label="Jobs from new customers" value={d.jobs_new} was={d.previous.jobs_new} wasLabel={d.previous.label} />
            <Figure label="Jobs from returning customers" value={d.jobs_returning} was={d.previous.jobs_returning} wasLabel={d.previous.label} />
          </div>
          {jobs > 0 ? (
            <div className="mt-4">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`${newShare}% of ${d.period.label}'s jobs were from new customers`}>
                <div className="bg-emerald-500" style={{ width: `${newShare}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {newShare}% of {d.period.label}&apos;s {jobs} {jobs === 1 ? 'job' : 'jobs'} came from new customers.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No jobs in {d.period.label}.</p>
          )}
        </>
      )}
    </section>
  )
}

function Figure({ label, value, was, wasLabel, tone = 'text-navy-900' }: {
  label: string
  value: number
  was: number
  wasLabel: string
  tone?: string
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${tone}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-slate-500 tabular-nums">
        {wasLabel}: {was.toLocaleString()}
      </p>
    </div>
  )
}
