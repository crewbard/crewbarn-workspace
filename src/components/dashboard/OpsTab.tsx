import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/hooks/useTheme'
import { EasyActionCards } from '@/components/easy/EasyActionCards'
import { useEstimates } from '@/hooks/useEstimates'
import { useJobStatuses } from '@/hooks/useJobStatuses'
import { useIntakePendingCount } from '@/hooks/useIntakePendingCount'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { visibleStatusColor, textColorOn } from '@/lib/statusColor'
import { formatPhone } from '@/lib/comms'
import type { WorkOrder } from '@/types/workOrder'
import type { AttentionItem } from '@/types/dashboard'
import { StickyNoteStrip, StickyNoteContextMenu } from '@/components/dashboard/StickyNoteStrip'
import { CrewRightNowPanel } from '@/components/dashboard/CrewRightNowPanel'
import { SupervisedProjectsPanel } from '@/components/dashboard/SupervisedProjectsPanel'
import { IncomingRequestsPanel } from '@/components/dispatch/IncomingRequestsPanel'
import { IncomingEstimateRequestsPanel } from '@/components/dispatch/IncomingEstimateRequestsPanel'
import {
  useTodayJobs,
  useDashboardSpotlight,
  useUnscheduledCount,
  useStaleSnapshot,
  useReceivables,
  useUnansweredCalls,
  usePendingTimeOffRequests,
  useClearCompletedTodayJobs,
  type DashboardTimeOffRequest,
  type DashboardSpotlightJob,
  deriveTodayStats,
  deriveAttentionItems,
} from '@/hooks/useDashboard'

/** "14:30" / "14:30:00" → "2:30 pm". Falls back to the raw value. */
type NeedsQuoteVisit = {
  work_order_id: string
  job_number: number | null
  title: string | null
  customer: string | null
  property: string
  visited_at: string | null
  /** The fee already covers the visit, so nothing else prompts a look. */
  covered_by_agreement: boolean
  worst_priority: 'critical' | 'high' | 'medium' | 'low'
  item_count: number
  items: {
    entry_id: string
    what: string | null
    priority: string | null
    asset: { id: string; name: string; asset_code: string | null; scan_url: string | null } | null
  }[]
}

function fmtTime(t: string | null | undefined): string {
  if (!t) return ''
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return t
  let h = parseInt(m[1], 10)
  const min = m[2]
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${min} ${ampm}`
}

function customerOf(w: WorkOrder): string {
  return w.service_customer?.display_name ?? 'Customer'
}


function spotlightAddress(job: DashboardSpotlightJob): string {
  const location = job.service_location
  if (!location) return ''
  return [location.street_address, location.city, location.state, location.postal_code]
    .filter(Boolean)
    .join(', ')
}

function overdueLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min late`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (hours < 24) return remaining ? `${hours} hr ${remaining} min late` : `${hours} hr late`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} late`
}
function humanizeTimeOffType(type: string): string {
  return type
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Time off'
}

function formatTimeOffDate(row: DashboardTimeOffRequest): string {
  if (!row.start_date || !row.end_date) return 'date not set'
  const start = new Date(`${row.start_date}T00:00:00`)
  const end = new Date(`${row.end_date}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'date not set'
  const startLabel = start.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const dateLabel = startLabel === endLabel ? startLabel : `${startLabel}-${endLabel}`
  if (row.all_day || !row.start_time || !row.end_time) return dateLabel
  return `${dateLabel}, ${fmtTime(row.start_time)}-${fmtTime(row.end_time)}`
}

function formatPendingTimeOffSummary(rows: DashboardTimeOffRequest[]): string {
  const first = rows[0]
  if (!first) return 'Review time-off requests'
  const who = first.account_name ?? 'Staff member'
  const more = rows.length > 1 ? ` +${rows.length - 1} more` : ''
  return `${who} · ${humanizeTimeOffType(first.type)} · ${formatTimeOffDate(first)}${more}`
}

function StatusPill({ w }: { w: WorkOrder }) {
  const name = w.status?.name ?? '—'
  const hex = visibleStatusColor(w.status?.color)
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: hex, color: textColorOn(hex) }}
    >
      {name}
    </span>
  )
}

export function OpsTab() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const jobsQ = useTodayJobs()
  const spotlightQ = useDashboardSpotlight()
  const unscheduledQ = useUnscheduledCount()
  const staleQ = useStaleSnapshot()
  const rxQ = useReceivables()
  const callsQ = useUnansweredCalls()
  const estQ = useEstimates({ status: 'sent', per_page: 50 })

  /*
   * Visits a tech left work on that nobody has priced.
   *
   * Refetched on the same rhythm as the rest of the board rather than
   * live: a need logged an hour ago is still a need in five minutes, and
   * this is a worklist, not an alert.
   */
  const needsQuoteQ = useQuery({
    queryKey: ['visits-needing-quote'],
    queryFn: () => apiRequest<{ data: NeedsQuoteVisit[]; meta: { visits: number; items: number } }>(
      '/v1/visits-needing-quote',
    ),
    staleTime: 60_000,
  })
  const qc = useQueryClient()
  const [quoteError, setQuoteError] = useState<string | null>(null)

  /*
   * Build the draft from what the tech logged, then open it.
   *
   * This used to drop the user on the job and leave them to work out
   * what to quote from a service log, which is how a need reaches the
   * end of the month unquoted.
   */
  const quote = useMutation({
    mutationFn: (workOrderId: string) =>
      apiRequest<{ data: { estimate_id: string } }>(
        `/v1/work-orders/${workOrderId}/quote-needs`,
        { method: 'POST' },
      ),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['visits-needing-quote'] })
      navigate(`/estimates/${res.data.estimate_id}`)
    },
    onError: (e: Error) => setQuoteError(e.message),
  })

  const needsQuote = needsQuoteQ.data?.data ?? []
  const intakeCount = useIntakePendingCount()
  const permissions = usePermissions()
  const canViewTimeOff = !permissions.isLoading && permissions.has(PERM.STAFF_VIEW)
  const timeOffQ = usePendingTimeOffRequests(canViewTimeOff)
  const clearCompleted = useClearCompletedTodayJobs()

  const jobs = jobsQ.data ?? []
  const stats = useMemo(() => deriveTodayStats(jobs), [jobs])
  const unscheduled = unscheduledQ.data ?? 0
  const calls = callsQ.data ?? []
  const estimatesPending = estQ.data?.data?.length ?? 0
  const unbilled = staleQ.data?.unbilled_completed
  const pendingTimeOff = timeOffQ.data ?? []

  const attention = useMemo<AttentionItem[]>(
    () => [
      ...(pendingTimeOff.length > 0
        ? [{
            key: 'pending-time-off',
            label: 'Time off needs approval',
            value: String(pendingTimeOff.length),
            hint: pendingTimeOff.length === 1 ? 'request waiting' : 'requests waiting',
            detail: formatPendingTimeOffSummary(pendingTimeOff),
            href: '/tool-shed/time-off',
            severity: 'warning' as const,
          }]
        : []),
      ...deriveAttentionItems({
        unscheduled,
        stale: staleQ.data,
        receivables: rxQ.data,
        estimatesPending,
      }),
    ],
    [pendingTimeOff, unscheduled, staleQ.data, rxQ.data, estimatesPending],
  )

  const noMatchCalls = calls.filter((c) => !c.customer_id).length
  const currentJob = stats.current
  const canClearDone = stats.done > 0 && !clearCompleted.isPending
  const goJob = (id: string) => navigate(`/jobs/${id}`)

  const [ctxPos, setCtxPos] = useState<{ x: number; y: number } | null>(null)

  const [spotlightStatus, setSpotlightStatus] = useState('all')
  const spotlightJobs = spotlightQ.data ?? []
  // List EVERY tenant status (workflow order), not just the ones on screen, so
  // you can filter to any status. Falls back to the on-screen statuses until
  // the full list loads.
  const jobStatusesQuery = useJobStatuses({ active: true, per_page: 100 })
  const spotlightStatuses = useMemo(() => {
    const all = jobStatusesQuery.data?.data ?? []
    if (all.length > 0) {
      return all.map((s) => ({ id: s.id, name: s.name }))
    }
    const statuses = new Map<string, string>()
    spotlightJobs.forEach((job) => {
      if (job.status) statuses.set(job.status.id, job.status.name)
    })
    return Array.from(statuses, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [jobStatusesQuery.data, spotlightJobs])
  const visibleSpotlightJobs = useMemo(
    () => spotlightStatus === 'all'
      ? spotlightJobs
      : spotlightJobs.filter((job) => job.status?.id === spotlightStatus),
    [spotlightJobs, spotlightStatus],
  )

  return (
    <div
      className="px-4 sm:px-6 py-5 space-y-4"
      onContextMenu={(e) => {
        e.preventDefault()
        setCtxPos({ x: e.clientX, y: e.clientY })
      }}
    >
      {easy && permissions.has(PERM.JOBS_VIEW) && <EasyActionCards label="Your workday" actions={[
        { key: 'jobs', title: 'Find a job', description: 'Search jobs and open the customer, schedule, and work details.', onClick: () => navigate('/jobs') },
        { key: 'parts', title: 'Waiting on parts', description: 'Review jobs flagged as needing parts.', count: staleQ.isSuccess ? staleQ.data.needs_parts.count : undefined, onClick: () => navigate('/jobs?stale=needs_parts') },
        { key: 'billing', title: 'Ready for billing', description: 'Review completed, unbilled jobs before invoicing.', count: staleQ.isSuccess ? staleQ.data.unbilled_completed.count : undefined, onClick: () => navigate('/jobs?stale=unbilled_completed') },
      ]} />}
      {[jobsQ, unscheduledQ, staleQ, rxQ, callsQ, estQ, spotlightQ].some(query => query.isError) &&
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Some dashboard information could not be loaded. Totals and attention items may be incomplete.
          <button type="button" className="ml-2 underline font-semibold" onClick={() => {
            for (const query of [jobsQ, unscheduledQ, staleQ, rxQ, callsQ, estQ, spotlightQ]) {
              if (query.isError) void query.refetch()
            }
          }}>Retry failed sections</button>
        </div>}
      {/* Stat cards */}
      <div data-tour="dash-stats" className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label="Jobs today"
          value={String(stats.total)}
          sub={`${stats.done} done · ${stats.remaining} remaining`}
          loading={jobsQ.isLoading}
          error={jobsQ.isError}
        />
        <StatCard
          label="Unscheduled"
          value={String(unscheduled)}
          valueClass={unscheduled > 0 ? 'text-red-600' : 'text-navy-900'}
          sub={unscheduled > 0 ? 'Oldest needs a date' : 'All scheduled'}
          action={unscheduled > 0 ? { label: 'Schedule now →', to: '/dispatch' } : undefined}
          onNavigate={navigate}
          loading={unscheduledQ.isLoading}
          error={unscheduledQ.isError}
        />
        <StatCard
          label="Unanswered calls"
          value={String(calls.length)}
          valueClass={calls.length > 0 ? 'text-sky-600' : 'text-navy-900'}
          sub={noMatchCalls > 0 ? `${noMatchCalls} no customer match` : 'All returned'}
          action={{ label: 'Open inbox →', to: '/communications' }}
          onNavigate={navigate}
          loading={callsQ.isLoading}
          error={callsQ.isError}
        />
        <StatCard
          label="Ready to invoice"
          value={String(unbilled?.count ?? 0)}
          valueClass={(unbilled?.count ?? 0) > 0 ? 'text-amber-600' : 'text-navy-900'}
          sub={
            unbilled && unbilled.count > 0
              ? `$${(unbilled.total_dollars || 0).toLocaleString()} waiting to bill`
              : 'Nothing to bill'
          }
          action={
            unbilled && unbilled.count > 0
              ? { label: 'Send invoices →', to: '/jobs?stale=unbilled_completed' }
              : undefined
          }
          onNavigate={navigate}
          loading={staleQ.isLoading}
          error={staleQ.isError}
        />
        <StatCard
          label="AI Intake"
          value={String(intakeCount)}
          valueClass={intakeCount > 0 ? 'text-violet-600' : 'text-navy-900'}
          sub={intakeCount > 0 ? 'New leads to review' : 'Nothing waiting'}
          action={intakeCount > 0 ? { label: 'Review queue →', to: '/intake' } : undefined}
          onNavigate={navigate}
        />
      </div>

      <StickyNoteStrip />
      {ctxPos && (
        <StickyNoteContextMenu pos={ctxPos} onClose={() => setCtxPos(null)} />
      )}
      {/* Renders nothing for anybody who sees every job. */}
      <SupervisedProjectsPanel />

      <CrewRightNowPanel />
      {/* Customer requests from the portal / marketplace: the same panels
          dispatch shows, so a request is seen wherever the office starts
          its day. Both render nothing when empty. */}
      <IncomingRequestsPanel />
      <IncomingEstimateRequestsPanel />
      {(spotlightQ.isLoading || spotlightJobs.length > 0) && (
        <section className="rounded-xl border border-amber-300 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-navy-900">Dormant job spotlight</h2>
              <p className="text-xs text-slate-600">
                More than one minute past ETA and still open, in progress, or blocked.
              </p>
            </div>
            <span className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white tabular-nums">
              {visibleSpotlightJobs.length}
            </span>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              Status
              <select
                value={spotlightStatus}
                onChange={(event) => setSpotlightStatus(event.target.value)}
                className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
              >
                <option value="all">All statuses</option>
                {spotlightStatuses.map((status) => (
                  <option key={status.id} value={status.id}>{status.name}</option>
                ))}
              </select>
            </label>
          </div>
          {spotlightQ.isLoading ? (
            <div className="p-4"><SkeletonRows /></div>
          ) : visibleSpotlightJobs.length === 0 ? (
            <Empty>No dormant jobs match this status.</Empty>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {visibleSpotlightJobs.map((job) => {
                const color = visibleStatusColor(job.status?.color)
                return (
                  <li key={job.id}>
                    <button
                      type="button"
                      onClick={() => goJob(job.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-navy-900">
                          {job.customer_name ?? 'Customer'} — {job.title}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {spotlightAddress(job) || `Job #${job.work_order_number ?? ''}`}
                        </span>
                      </span>
                      <span
                        className="hidden rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline-flex"
                        style={{ backgroundColor: color, color: textColorOn(color) }}
                      >
                        {job.status?.name ?? 'Open'}
                      </span>
                      <span className="w-28 shrink-0 text-right text-xs font-bold text-red-600">
                        {overdueLabel(job.overdue_minutes)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
      {/* Next bar */}
      {stats.next && stats.next.id !== currentJob?.id && (
        <button
          type="button"
          onClick={() => goJob(stats.next!.id)}
          className="w-full rounded-xl border border-slate-200 bg-white px-5 py-3 flex items-center gap-4 text-left hover:shadow-sm transition-shadow"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Next</span>
          <span
            className="h-8 w-1.5 rounded-full shrink-0"
            style={{ background: visibleStatusColor(stats.next.status?.color) }}
          />
          <span className="text-sm font-medium text-slate-500 shrink-0">
            {fmtTime(stats.next.schedule?.start_time) || 'Unscheduled'}
          </span>
          <span className="min-w-0 flex-1 truncate text-slate-900">
            {customerOf(stats.next)} — {stats.next.title}
          </span>
          <StatusPill w={stats.next} />
          {stats.remaining > 1 && (
            <span className="text-xs text-amber-700 font-medium shrink-0">
              +{stats.remaining - 1} more today →
            </span>
          )}
        </button>
      )}

      {/* Bottom row */}
      <div data-easy-ops-grid className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Today's schedule */}
        <Panel
          title="Today's schedule"
          to="/schedule"
          toLabel="full view →"
          navigate={navigate}
          tour="dash-schedule"
          action={stats.done > 0 ? {
            label: clearCompleted.isPending ? 'clearing...' : `clear ${stats.done} done`,
            disabled: !canClearDone,
            onClick: () => clearCompleted.mutate(),
          } : undefined}
        >
          {jobsQ.isLoading ? (
            <SkeletonRows />
          ) : stats.sorted.length === 0 ? (
            <Empty>No jobs on the calendar for today.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.sorted.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => goJob(w.id)}
                    className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-slate-50 rounded-lg px-1"
                  >
                    <span
                      className="h-9 w-1.5 rounded-full shrink-0"
                      style={{ background: visibleStatusColor(w.status?.color) }}
                    />
                    <span className="text-xs font-medium text-slate-500 w-16 shrink-0">
                      {fmtTime(w.schedule?.start_time) || '—'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-900">
                      {customerOf(w)} — {w.title}
                    </span>
                    <StatusPill w={w} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Visits waiting on a price.
            Its own panel rather than a line inside Needs attention: a
            tech logged work and drove away, and if nobody prices it the
            need sits on the item until somebody scans its label months
            later. That is a different job from "this job is stale". */}
        <Panel
          title="Waiting on a quote"
          to="/jobs"
          toLabel="view all →"
          navigate={navigate}
          tour="dash-needs-quote"
        >
          {needsQuoteQ.isPending ? (
            <Empty>Loading…</Empty>
          ) : needsQuoteQ.isError ? (
            <Empty>Could not load visits waiting on a quote.</Empty>
          ) : needsQuote.length === 0 ? (
            <Empty>Nothing is waiting on a price.</Empty>
          ) : (
            <ul className="space-y-2 overflow-y-auto">
              {quoteError && (
                <li className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-medium text-rose-800">
                  {quoteError}
                </li>
              )}
              {needsQuote.slice(0, 6).map((visit) => (
                <li key={visit.work_order_id} className="rounded-lg border border-slate-200 p-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/jobs/${visit.work_order_id}`)}
                      className="text-sm font-semibold text-navy-800 hover:underline text-left"
                    >
                      {visit.customer || 'Customer'}
                    </button>
                    {visit.worst_priority === 'critical' && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                        Critical
                      </span>
                    )}
                    {visit.worst_priority === 'high' && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        High
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">
                    {visit.property}
                    {visit.property && ' — '}
                    {visit.item_count} item{visit.item_count === 1 ? '' : 's'} need
                    {visit.item_count === 1 ? 's' : ''} parts
                  </p>
                  {visit.covered_by_agreement && (
                    /* The one most likely to be missed: the agreement's
                       fee covers the visit, so the job never reaches an
                       invoice and nothing else prompts a look. */
                    <p className="text-[11px] text-slate-500">On a service plan — the visit itself is covered</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setQuoteError(null)
                        quote.mutate(visit.work_order_id)
                      }}
                      disabled={quote.isPending}
                      className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                    >
                      {quote.isPending && quote.variables === visit.work_order_id
                        ? 'Building…'
                        : 'Quote the parts'}
                    </button>
                    {visit.items[0]?.asset?.scan_url && (
                      <a
                        href={visit.items[0].asset!.scan_url!}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {/* Pricing without looking at what has already
                            been done to the thing is pricing work
                            somebody may have done last month. */}
                        Full record →
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Needs attention */}
        <Panel title="Needs attention" to="/jobs" toLabel="view all →" navigate={navigate} tour="dash-attention">
          {attention.length === 0 ? (
            <Empty>{[unscheduledQ, staleQ, rxQ, estQ, timeOffQ].some(query => query.isError)
              ? 'Attention items are incomplete. Retry the unavailable sections.'
              : [unscheduledQ, staleQ, rxQ, estQ].some(query => query.isLoading) || (canViewTimeOff && timeOffQ.isLoading)
                ? 'Checking what needs attention…'
                : "You're all caught up. Nothing needs attention."}</Empty>
          ) : (
            <ul className="space-y-1">
              {attention.map((a) => (
                <li key={a.key}>
                  <button
                    type="button"
                    onClick={() => navigate(a.href)}
                    className="w-full flex items-center gap-3 py-2 px-1 text-left hover:bg-slate-50 rounded-lg"
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        a.severity === 'danger'
                          ? 'bg-red-500'
                          : a.severity === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-sky-500'
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">{a.label}</span>
                      <span className="block text-xs text-slate-500 truncate">{a.hint}</span>
                    </span>
                    <span
                      className={`text-sm font-bold shrink-0 ${
                        a.severity === 'danger' ? 'text-red-600' : 'text-slate-700'
                      }`}
                    >
                      {a.value}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Unanswered calls */}
        <Panel title="Unanswered calls" to="/communications" toLabel="open inbox →" navigate={navigate}>
          {callsQ.isLoading ? (
            <SkeletonRows />
          ) : calls.length === 0 ? (
            <Empty>No calls waiting on a callback.</Empty>
          ) : (
            <ul className="space-y-1">
              {calls.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate('/communications')}
                    className="w-full flex items-center justify-between gap-2 py-2 px-1 text-left hover:bg-slate-50 rounded-lg"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-navy-900">
                        {formatPhone(c.external_number) || c.external_number}
                      </span>
                      <span className="block text-xs text-slate-500 truncate">
                        {c.customer_name ?? 'No customer match'}
                      </span>
                    </span>
                    {c.unread_count > 0 && (
                      <span className="shrink-0 inline-flex h-2 w-2 rounded-full bg-sky-500" />
                    )}
                  </button>
                </li>
              ))}
              {calls.length > 8 && (
                <li className="text-[11px] text-slate-400 italic px-1">+ {calls.length - 8} more</li>
              )}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

// ---------- small building blocks ----------

function StatCard({
  label,
  value,
  sub,
  valueClass = 'text-navy-900',
  action,
  onNavigate,
  loading,
  error,
}: {
  label: string
  value: string
  sub: string
  valueClass?: string
  action?: { label: string; to: string }
  onNavigate?: (to: string) => void
  loading?: boolean
  error?: boolean
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      {error ? <p className="mt-1 text-sm text-amber-800">Unavailable</p> : loading ? (
        <div className="mt-1 h-7 w-12 bg-slate-100 rounded animate-pulse" />
      ) : (
        <div className={`mt-0.5 text-3xl font-bold tabular-nums ${valueClass}`}>{value}</div>
      )}
      <div className="mt-1 text-xs text-slate-500 truncate">{error ? 'Retry to refresh this section' : loading ? 'Loading…' : sub}</div>
      {action && (
        <button
          type="button"
          onClick={() => onNavigate?.(action.to)}
          className="mt-1 text-xs font-medium text-amber-700 hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

function Panel({
  title,
  to,
  toLabel,
  navigate,
  tour,
  action,
  children,
}: {
  title: string
  to: string
  toLabel: string
  navigate: (to: string) => void
  tour?: string
  action?: { label: string; disabled?: boolean; onClick: () => void }
  children: React.ReactNode
}) {
  return (
    <div
      data-tour={tour}
      className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 min-h-[18rem] flex flex-col"
    >
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h2>
        <div className="flex items-center gap-3">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(to)}
            className="text-xs font-medium text-amber-700 hover:underline"
          >
            {toLabel}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="space-y-2 pt-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-9 bg-slate-100 rounded animate-pulse" />
      ))}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400 py-6 text-center">{children}</p>
}
