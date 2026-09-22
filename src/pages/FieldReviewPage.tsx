import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'

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
  const q = useQuery({
    queryKey: ['field-review'],
    queryFn: () => apiRequest<{ data: FieldReview }>('/v1/dispatch/field-review'),
    refetchInterval: 60_000,
  })
  const review = q.data?.data
  const needs = review?.needs_review ?? []
  const missed = review?.missed_checkins ?? []

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="mb-4 sm:mb-6">
        <Link to="/dispatch" className="inline-flex items-center gap-1 text-sm text-amber-700 hover:underline mb-1">
          ← Back to Dispatch
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Field review</h1>
        <p className="text-sm text-slate-500 mt-1">
          Visits and jobs that need an office touch — open visits with a loose end,
          and scheduled jobs no one checked into.
        </p>
      </div>

      {/* Needs review — open visits with a loose end */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">
          Needs review {needs.length > 0 && <span className="text-slate-400">· {needs.length}</span>}
        </h2>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
          {q.isLoading ? (
            <div className="px-4 py-8 text-center text-slate-500">Loading…</div>
          ) : needs.length === 0 ? (
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
      </section>

      {/* Missed check-ins */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">
          Missed check-ins {missed.length > 0 && <span className="text-slate-400">· {missed.length}</span>}
        </h2>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
          {q.isLoading ? (
            <div className="px-4 py-8 text-center text-slate-500">Loading…</div>
          ) : missed.length === 0 ? (
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
      </section>
    </div>
  )
}
