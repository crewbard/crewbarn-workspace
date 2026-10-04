import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'
import { EasyActionCards } from '@/components/easy/EasyActionCards'

/**
 * Field "Needs Review" queue + missed-checkin report (geofence Phase 3).
 * Surfaces open visits with a loose end (left site / GPS issue / past their
 * scheduled end / open too long) and scheduled jobs the tech never checked
 * into. Read-only triage — click through to the job to resolve.
 */

interface ReviewItem {
  visit_id: string
  work_order_id: string
  work_order_number: number | null
  title: string | null
  customer: string | null
  location: string | null
  tech: string | null
  visit_state: string
  reason: string
  checked_in_at: string | null
  left_site_at: string | null
  gps_issue_at: string | null
}

interface MissedItem {
  work_order_id: string
  work_order_number: number | null
  title: string | null
  customer: string | null
  location: string | null
  tech: string | null
  scheduled_start_at: string | null
}

interface FieldReview {
  needs_review: ReviewItem[]
  missed_checkins: MissedItem[]
  range: { from: string; to: string }
}

const REASON_LABEL: Record<string, { label: string; cls: string }> = {
  left_site: { label: 'Left site', cls: 'bg-rose-100 text-rose-700' },
  gps_issue: { label: 'GPS issue', cls: 'bg-slate-200 text-slate-600' },
  past_end: { label: 'Past scheduled end', cls: 'bg-amber-100 text-amber-800' },
  open_too_long: { label: 'Open too long', cls: 'bg-amber-100 text-amber-800' },
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function FieldReviewPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const [view, setView] = useState<'all' | 'visits' | 'missed'>('all')
  const [dates, setDates] = useState({ from: '', to: '' })
  const [range, setRange] = useState({ from: '', to: '' })
  const invalidRange = Boolean(dates.from && dates.to && dates.from > dates.to)
  const params = new URLSearchParams()
  if (range.from) params.set('from', range.from)
  if (range.to) params.set('to', range.to)
  const q = useQuery({
    queryKey: ['field-review', range.from, range.to],
    queryFn: () => apiRequest<{ data: FieldReview }>(`/v1/dispatch/field-review?${params}`),
    refetchInterval: 60_000,
  })
  const review = q.data?.data
  const needs = review?.needs_review ?? []
  const missed = review?.missed_checkins ?? []

  return (
    <div className={easy ? 'w-full min-w-0 px-3 sm:px-6 py-4 sm:py-6' : 'max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6'}>
      <div className="mb-4 sm:mb-6">
        <Link to="/dispatch" className="inline-flex items-center gap-1 text-sm text-amber-700 hover:underline mb-1">
          ← Back to Dispatch
        </Link>
        {easy ? <EasyPageHeading title="Field review" description="Choose an open visit or missed check-in, then open its job to resolve the issue. Reviewing this list does not approve work or create an invoice." /> : <>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Field review</h1>
        <p className="text-sm text-slate-500 mt-1">
          Visits and jobs that need an office touch — open visits with a loose end,
          and scheduled jobs no one checked into.
        </p>
        </>}
      </div>
      {easy && <EasyActionCards label="Choose what to review" actions={[
        { key: 'all', title: 'Review everything', description: 'Open visits and missed check-ins.', count: q.isSuccess ? needs.length + missed.length : undefined, active: view === 'all', onClick: () => setView('all') },
        { key: 'visits', title: 'Check open visits', description: 'Visits with GPS, timing, or departure issues.', count: q.isSuccess ? needs.length : undefined, active: view === 'visits', onClick: () => setView('visits') },
        { key: 'missed', title: 'Check missed arrivals', description: 'Scheduled jobs with no check-in.', count: q.isSuccess ? missed.length : undefined, active: view === 'missed', onClick: () => setView('missed') },
      ]} />}
      {q.isError && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Field review could not be loaded. <button type="button" onClick={() => void q.refetch()} className="ml-2 underline">Retry</button>
      </div>}

      <form className="mb-5 rounded-lg border border-slate-200 bg-white p-4" onSubmit={e => {
        e.preventDefault(); if (!invalidRange) setRange({ ...dates })
      }}>
        <h2 className="text-sm font-semibold">Missed check-in date range</h2>
        <p className="text-xs text-slate-500 mt-1 mb-3">Filters scheduled job dates only. Open visits needing review remain visible regardless of date. Blank dates use the last seven days through today in your company timezone.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">From<input type="date" value={dates.from} onChange={e => setDates({ ...dates, from: e.target.value })} className="block border rounded px-2 py-1 mt-1" /></label>
          <label className="text-xs">Through<input type="date" value={dates.to} onChange={e => setDates({ ...dates, to: e.target.value })} className="block border rounded px-2 py-1 mt-1" /></label>
          <button type="submit" disabled={invalidRange || q.isFetching} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Apply dates</button>
          <button type="button" onClick={() => { setDates({ from: '', to: '' }); setRange({ from: '', to: '' }) }} className="rounded border px-3 py-1 text-sm">Reset dates</button>
        </div>
        {invalidRange && <p role="alert" className="text-xs text-red-700 mt-2">End date must be on or after start date.</p>}
        {missed.length === 200 && <p className="text-xs text-amber-700 mt-2">Showing up to 200 missed check-ins. Narrow the date range to review more.</p>}
      </form>

      {/* Needs review — open visits with a loose end */}
      {(!easy || view !== 'missed') && <section className="mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">
          Needs review {needs.length > 0 && <span className="text-slate-400">· {needs.length}</span>}
        </h2>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
          {q.isLoading ? (
            <div className="px-4 py-8 text-center text-slate-500">Loading…</div>
          ) : q.isError ? null : needs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">Nothing open needs review. 🎉</div>
          ) : (
            needs.map((r) => {
              const reason = REASON_LABEL[r.reason] ?? { label: r.reason, cls: 'bg-slate-100 text-slate-600' }
              return (
                <Link
                  key={r.visit_id}
                  to={`/jobs/${r.work_order_id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-amber-50/40"
                >
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${reason.cls}`}>
                    {reason.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      <span className="font-mono text-[11px] text-slate-400 mr-1">#{r.work_order_number}</span>
                      {r.title || 'Untitled'}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {r.customer ?? 'No customer'}
                      {r.location && <> · {r.location}</>}
                      {r.tech && <> · {r.tech}</>}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 text-right shrink-0">
                    {r.left_site_at ? `Left ${fmt(r.left_site_at)}` : `In ${fmt(r.checked_in_at)}`}
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </section>}

      {/* Missed check-ins */}
      {(!easy || view !== 'visits') && <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">
          Missed check-ins {missed.length > 0 && <span className="text-slate-400">· {missed.length}</span>}
        </h2>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
          {q.isLoading ? (
            <div className="px-4 py-8 text-center text-slate-500">Loading…</div>
          ) : q.isError ? null : missed.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">No missed check-ins.</div>
          ) : (
            missed.map((m) => (
              <Link
                key={m.work_order_id}
                to={`/jobs/${m.work_order_id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-amber-50/40"
              >
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 shrink-0">
                  No check-in
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    <span className="font-mono text-[11px] text-slate-400 mr-1">#{m.work_order_number}</span>
                    {m.title || 'Untitled'}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {m.customer ?? 'No customer'}
                    {m.location && <> · {m.location}</>}
                    {m.tech && <> · {m.tech}</>}
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 text-right shrink-0">
                  Sched {fmt(m.scheduled_start_at)}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>}
    </div>
  )
}
