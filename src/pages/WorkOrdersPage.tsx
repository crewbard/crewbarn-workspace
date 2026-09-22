import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { useJobStatuses } from '@/hooks/useJobStatuses'
import { visibleStatusColor, textColorOn } from '@/lib/statusColor'
import { JobTypeChip } from '@/components/JobTypeChip'
import { WorkflowTabs, type WorkflowTab } from '@/components/lists/WorkflowTabs'
import { RowChevron } from '@/components/lists/RowChevron'
import type { WorkOrder, WorkOrderListParams, WorkOrderServiceLocation } from '@/types/workOrder'
import { JobLocationMap } from '@/components/schedule/JobLocationMap'
import type { JobFilingSummary, StatusMoneySummary } from '@/types/api'
import { useTheme, type FolderLayout } from '@/hooks/useTheme'
import { FolderBrowser, Pager, type FolderNode } from '@/components/FolderBrowser'
import { FolderStatTile, formatFolderMoney } from '@/components/FolderStatTile'
import { FolderLayoutSwitch } from '@/components/FolderLayoutSwitch'

// Quick-peek: a card's "Peek" opens a slide-in drawer without leaving the list.
// Cards live deep inside the folder tree, so the open handler rides a context
// (wo + the sibling list to arrow-key through) instead of prop-drilling.
type OpenPeek = (wo: WorkOrder, siblings: WorkOrder[]) => void
const JobPeekContext = createContext<OpenPeek | null>(null)
function useJobPeek(): OpenPeek | null {
  return useContext(JobPeekContext)
}

type SubFilter = 'all' | 'subbed' | 'in_house'
// Group-by (files view). Per the folder-views spec, Jobs offer Status / Year /
// Tech; 'month'/'billing'/'assignment' buckets stay in filingBucket for reuse.
type JobFilingMode = 'year' | 'month' | 'status' | 'billing' | 'assignment' | 'tech'

const JOB_FILING_OPTIONS: Array<{ value: JobFilingMode; label: string }> = [
  { value: 'status', label: 'Status' },
  { value: 'year', label: 'Year' },
  { value: 'tech', label: 'Tech' },
]

const JOB_MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, '0'),
  label: new Date(2024, index, 1).toLocaleDateString('en-US', { month: 'short' }),
}))

// Curated workflow stages surfaced as tabs (only those the tenant actually
// has, matched by slug). The full status list stays in the dropdown for the
// long tail. Counts are added once the list endpoint returns per-status totals.
const JOB_TAB_SLUGS = ['needs-scheduling', 'scheduled', 'dispatched', 'on-site', 'in-progress', 'complete']

const STALE_LABELS: Record<string, string> = {
  dormant: 'Dormant (no update 7d+)',
  past_scheduled_open: 'Past-due scheduled',
  unbilled_completed: 'Completed but unbilled',
  needs_parts: 'Needs parts',
  parts_ordered: 'Parts ordered',
}

export function WorkOrdersPage() {
  const navigate = useNavigate()
  const { jobView, setJobView, density, folderLayout, setFolderLayout } = useTheme()
  const desktopRowPad = density === 'dense' ? 'px-4 py-2' : density === 'compact' ? 'px-4 py-2.5' : 'px-4 py-3'
  const [searchParams, setSearchParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [statusId, setStatusId] = useState('')
  const [subFilter, setSubFilter] = useState<SubFilter>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [thisWeek, setThisWeek] = useState(false)
  // Quick-peek: the job whose slide-in drawer is open, plus the list to
  // arrow-key through (←/→). Set together when a card's "Peek" is clicked.
  const [peek, setPeek] = useState<{ id: string; siblings: WorkOrder[] } | null>(null)
  const [page, setPage] = useState(1)
  const [filingView, setFilingView] = useState(() =>
    jobView === 'files'
      || (typeof window !== 'undefined' && window.localStorage.getItem('crewbarn:job-filing-view') === 'true'),
  )
  const [filingMode, setFilingMode] = useState<JobFilingMode>(() => {
    const saved = typeof window !== 'undefined'
      ? window.localStorage.getItem('crewbarn:job-filing-mode')
      : null
    return JOB_FILING_OPTIONS.some((option) => option.value === saved) ? saved as JobFilingMode : 'status'
  })

  // Deep-link filters (set by the dashboard "Needs attention" widget).
  const stale = searchParams.get('stale') || undefined
  const leadTech = searchParams.get('lead_tech_account_id') || undefined

  const clearParam = (key: string) => {
    const next = new URLSearchParams(searchParams)
    next.delete(key)
    setSearchParams(next, { replace: true })
    setPage(1)
  }

  // Tech/month/billing/assignment still bucket the loaded page client-side, so
  // they need a big page. Year + Status are server-complete (each folder fetches
  // its own jobs), so the main query only needs a small page there.
  const clientGroupedMode = filingView
    && filingMode !== 'year'
    && filingMode !== 'status'

  const workOrdersQuery = useWorkOrders({
    q: q || undefined,
    status_id: statusId || undefined,
    stale,
    scheduled_week: thisWeek ? 'current' : undefined,
    lead_tech_account_id: leadTech,
    is_subbed: subFilter === 'subbed' ? true : subFilter === 'in_house' ? false : undefined,
    // Year + Status are server-complete (counts + money + lazy per-folder fetch);
    // Tech/month/billing still group the loaded jobs client-side → pull a big page.
    include_filing_counts: filingView && filingMode === 'year' ? true : undefined,
    include_status_money: filingView && filingMode === 'status' ? true : undefined,
    page,
    per_page: clientGroupedMode ? 200 : 25,
  })
  const statusesQuery = useJobStatuses({ active: true, per_page: 100 })

  const items = workOrdersQuery.data?.data ?? []
  const meta = workOrdersQuery.data?.meta
  const tabCounts = workOrdersQuery.data?.tab_counts
  const jobFilingCounts = workOrdersQuery.data?.job_filing_counts
  const statusMoney = workOrdersQuery.data?.status_money
  // The exact list filters (minus paging/filing), so the folder view — and the
  // lazily-fetched month cards — stay consistent with the filtered counts.
  const folderFilters: WorkOrderListParams = {
    q: q || undefined,
    status_id: statusId || undefined,
    stale,
    scheduled_week: thisWeek ? 'current' : undefined,
    lead_tech_account_id: leadTech,
    is_subbed: subFilter === 'subbed' ? true : subFilter === 'in_house' ? false : undefined,
  }
  const statuses = useMemo(() => statusesQuery.data?.data ?? [], [statusesQuery.data?.data])

  // Active filters as removable chips ("Filtered by …"), matching the design.
  const activeFilters: Array<{ key: string; label: string; remove: () => void }> = []
  if (thisWeek) {
    activeFilters.push({ key: 'week', label: 'This week', remove: () => { setThisWeek(false); setPage(1) } })
  }
  if (statusId) {
    const name = statuses.find((s) => s.id === statusId)?.name ?? 'Status'
    activeFilters.push({ key: 'status', label: `Status: ${name}`, remove: () => { setStatusId(''); setPage(1) } })
  }
  if (subFilter !== 'all') {
    activeFilters.push({ key: 'sub', label: subFilter === 'subbed' ? 'Subbed out' : 'In-house', remove: () => { setSubFilter('all'); setPage(1) } })
  }
  if (stale) {
    activeFilters.push({ key: 'stale', label: STALE_LABELS[stale] ?? 'Needs attention', remove: () => clearParam('stale') })
  }
  if (leadTech) {
    activeFilters.push({ key: 'tech', label: leadTech === 'unassigned' ? 'Unassigned' : 'Assigned tech', remove: () => clearParam('lead_tech_account_id') })
  }
  if (q) {
    activeFilters.push({ key: 'q', label: `Search: ${q}`, remove: () => { setQ(''); setPage(1) } })
  }
  const clearAllFilters = () => {
    setStatusId('')
    setSubFilter('all')
    setQ('')
    setThisWeek(false)
    setPage(1)
    const next = new URLSearchParams(searchParams)
    next.delete('stale')
    next.delete('lead_tech_account_id')
    setSearchParams(next, { replace: true })
  }

  // Workflow tabs: "All" + the curated stages that exist for this tenant,
  // ordered by the workflow sequence. Each maps to the server status_id filter.
  // Live counts come from the index endpoint's tab_counts (keyed by status_id).
  const jobTabs = useMemo<WorkflowTab[]>(() => {
    // Exactly ONE tab per intended stage, in workflow order. Building from
    // JOB_TAB_SLUGS (not from the status list) means duplicate status rows
    // sharing a slug can't produce duplicate tabs — pick the first match per
    // slug. (Dupe status rows are a data bug fixed separately; this keeps the
    // tab strip correct regardless.)
    const byStage = JOB_TAB_SLUGS
      .map((slug) => statuses.find((s) => s.slug === slug))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => ({
        key: s.id,
        label: s.name,
        count: tabCounts ? tabCounts[s.id] ?? 0 : undefined,
      }))
    return [
      { key: '', label: 'All', count: tabCounts ? tabCounts.all ?? 0 : undefined },
      ...byStage,
    ]
  }, [statuses, tabCounts])

  const openPeek: OpenPeek = (wo, siblings) =>
    setPeek({ id: wo.id, siblings: siblings.length ? siblings : [wo] })

  return (
    <JobPeekContext.Provider value={openPeek}>
    <div className={`mx-auto px-3 sm:px-6 py-4 sm:py-6 ${filingView ? 'max-w-[1760px]' : 'max-w-7xl'}`}>
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Jobs</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Secondary actions hidden on phones — accessible via Tool Shed
              menu or the action overflow on detail pages. Keeps the
              primary "+ New Job" button reachable without scrolling. */}
          <Link
            to="/inbound-sub-jobs"
            className="hidden lg:inline-block px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md"
            title="Sub jobs sent to you by partner tenants — accept or decline"
          >
            Inbound
          </Link>
          <Link
            to="/sub-payouts"
            className="hidden lg:inline-block px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md"
            title="Ledger of paid + outstanding sub invoices"
          >
            Sub payouts
          </Link>
          <Link
            to="/sub-reviews"
            className="hidden lg:inline-block px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md"
            title="Review pending NTE extensions and sub invoices"
          >
            Sub reviews
          </Link>
          <Link
            to="/jobs/new?kind=sub"
            className="hidden sm:inline-block px-4 py-2 text-sm font-medium border border-amber-500 text-amber-700 hover:bg-amber-50 rounded-md whitespace-nowrap"
            title="Outsource a job to a vendor partner"
          >
            + Sub Job
          </Link>
          <Link
            to="/jobs/new"
            data-tour="jobs-new"
            className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md whitespace-nowrap"
          >
            + New Job
          </Link>
        </div>
      </div>

      {/* Workflow tabs — common stages up front; full list stays in the dropdown. */}
      <WorkflowTabs
        tabs={jobTabs}
        active={statusId}
        onChange={(key) => {
          setStatusId(key)
          setPage(1)
        }}
      />

      {/* Filters */}
      <div className="flex items-center gap-2 sm:gap-3 mb-4 flex-wrap">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          placeholder="Search by title, customer, address..."
          className="flex-1 min-w-[180px] sm:max-w-md px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        />
        {/* This week — quick scope to jobs scheduled in the current tenant week. */}
        <button
          type="button"
          onClick={() => { setThisWeek((v) => !v); setPage(1) }}
          aria-pressed={thisWeek}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
            thisWeek
              ? 'border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm10 6H4v8h12V8z" clipRule="evenodd" />
          </svg>
          This week
        </button>
        {/* Filters dropdown — status + sub-contracting live in a panel so the
            toolbar stays clean; active count shows on the button. */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              activeFilters.length > 0
                ? 'border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M2.628 3.02A1 1 0 013.5 2.5h13a1 1 0 01.78 1.626L12 10.35V16a1 1 0 01-1.447.894l-2-1A1 1 0 018 15v-4.65L2.72 4.126a1 1 0 01-.092-1.106z" clipRule="evenodd" />
            </svg>
            Filters
            {activeFilters.length > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
                {activeFilters.length}
              </span>
            )}
          </button>
          {filtersOpen && (
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onClick={() => setFiltersOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </label>
                  <select
                    value={statusId}
                    onChange={(e) => {
                      setStatusId(e.target.value)
                      setPage(1)
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">All statuses</option>
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Sub-contracting
                  </label>
                  <div className="inline-flex w-full overflow-hidden rounded-md border border-slate-300">
                    {(
                      [
                        { v: 'all', label: 'All' },
                        { v: 'in_house', label: 'In-house' },
                        { v: 'subbed', label: 'Subbed' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => {
                          setSubFilter(opt.v)
                          setPage(1)
                        }}
                        className={`flex-1 px-3 py-1.5 text-xs font-medium ${
                          subFilter === opt.v
                            ? 'bg-amber-500 text-white'
                            : 'bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {activeFilters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearAllFilters()
                      setFiltersOpen(false)
                    }}
                    className="mt-4 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {(jobView === 'cards' || jobView === 'files') && (
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            {/* Same light segmented control as FolderLayoutSwitch so the toggles match. */}
            <div
              className="inline-flex h-9 items-center gap-0.5 rounded-md border border-slate-300 bg-slate-100 p-1"
              role="group"
              aria-label="Job card display"
            >
              <button
                type="button"
                onClick={() => {
                  setFilingView(false)
                  setJobView('cards')
                }}
                className={'rounded px-2.5 py-1 text-xs font-semibold transition-colors ' + (
                  !filingView
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                )}
                aria-pressed={!filingView}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilingView(true)
                  setJobView('files')
                }}
                className={'rounded px-2.5 py-1 text-xs font-semibold transition-colors ' + (
                  filingView
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                )}
                aria-pressed={filingView}
              >
                Files
              </button>
            </div>

            {filingView && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Group by</span>
                {JOB_FILING_OPTIONS.map((option) => {
                  const active = filingMode === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setFilingMode(option.value)
                        setPage(1)
                        window.localStorage.setItem('crewbarn:job-filing-mode', option.value)
                      }}
                      className={'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ' + (
                        active
                          ? 'border-amber-300 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            )}

            {filingView && (
              <FolderLayoutSwitch value={folderLayout} onChange={setFolderLayout} />
            )}
          </div>
        )}
      </div>

      {/* Filtered by — active filters shown as removable chips + Clear all. */}
      {activeFilters.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Filtered by</span>
          {activeFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={f.remove}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              {f.label}
              <span aria-hidden className="text-sm leading-none text-amber-500">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="ml-1 text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Mobile cards — each WO is a tappable card. Title gets visual
          priority; status pill + total stack as meta. Portal-request
          chip surfaces inline because that's a queue the office
          actively triages. */}
      <div className="md:hidden space-y-2">
        {workOrdersQuery.isLoading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded animate-pulse" />
          ))
        ) : items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
            {q || statusId ? 'No jobs match your filters.' : 'No jobs yet.'}
          </div>
        ) : (
          items.map((wo) => (
            <div
              key={wo.id}
              onClick={() => navigate(`/jobs/${wo.id}`)}
              className="rounded-lg border border-slate-200 bg-white p-3 active:bg-amber-50/60 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-slate-500">
                  {wo.display_number}
                </span>
                {wo.status && (
                  <StatusPill name={wo.status.name} color={wo.status.color} />
                )}
              </div>
              <div className="mt-1 font-medium text-slate-900 leading-snug flex items-center gap-2 flex-wrap">
                {wo.title}
                {wo.request_status === 'pending' && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded"
                    title="Submitted via customer portal"
                  >
                    📨 Portal
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-slate-600 gap-2">
                <span className="truncate">
                  {wo.service_customer?.display_name ?? '—'}
                  {wo.service_customer?.vip && (
                    <span className="ml-1 text-[10px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded">
                      VIP
                    </span>
                  )}
                </span>
                <span className="font-mono tabular-nums shrink-0">
                  {wo.money?.total_formatted ?? '$0.00'}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>{formatSchedule(wo)}</span>
                <NextStepHint wo={wo} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop — follows Tool Shed → Appearance → Job default view. */}
      {jobView === 'cards' || jobView === 'files' ? (
        <DesktopJobCards
          items={items}
          isLoading={workOrdersQuery.isLoading}
          filingView={filingView}
          filingMode={filingMode}
          folderLayout={folderLayout}
          filingCounts={jobFilingCounts}
          statuses={statuses}
          tabCounts={tabCounts}
          statusMoney={statusMoney}
          filters={folderFilters}
          emptyText={
            q || statusId
              ? 'No jobs match your filters.'
              : 'No jobs yet. Click "New Job" to create one.'
          }
        />
      ) : (
      <div className="hidden md:block bg-white border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
        {workOrdersQuery.isLoading ? (
          <div role="status" className="cb-loading-region text-center">Loading jobs…</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-500">
            {q || statusId
              ? 'No jobs match your filters.'
              : 'No jobs yet. Click "New Job" to create one.'}
          </div>
        ) : (
          items.map((wo) => (
            <div
              key={wo.id}
              onClick={() => navigate(`/jobs/${wo.id}`)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/jobs/${wo.id}`)
                }
              }}
              className="group flex items-stretch cursor-pointer hover:bg-amber-50/40 focus:outline-none focus:bg-amber-50/60 transition-colors"
            >
              {/* Status stripe */}
              <span
                className="w-1 shrink-0"
                style={{ background: wo.status ? visibleStatusColor(wo.status.color) : '#e2e8f0' }}
                aria-hidden
              />

              <div className={`flex-1 min-w-0 flex items-center gap-4 ${desktopRowPad}`}>
                {/* Identity + who/where */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] text-slate-400">{wo.display_number}</span>
                    <span className="font-semibold text-slate-900 truncate">{wo.title}</span>
                    {wo.request_status === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded" title="Submitted via customer portal">
                        📨 Portal
                      </span>
                    )}
                    {wo.is_subbed && (
                      <span className="inline-flex items-center text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Subbed</span>
                    )}
                    {(wo.priority === 'urgent' || wo.priority === 'emergency') && (
                      <span className="inline-flex items-center text-[10px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                        {wo.priority === 'emergency' ? '🚨 Emergency' : '⚡ Urgent'}
                      </span>
                    )}
                  </div>
                  {jobView !== 'compact' && (
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {wo.service_customer?.display_name ?? 'No customer'}
                    {wo.service_customer?.vip && (
                      <span className="ml-1 text-[10px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded">VIP</span>
                    )}
                    {locationLabel(wo) && <> · {locationLabel(wo)}</>}
                    {' · '}
                    {wo.lead_tech?.full_name ?? <span className="text-slate-400">No assigned tech</span>}
                  </div>
                  )}
                </div>

                {/* Status + schedule + next-step hint */}
                <div className="shrink-0 w-44 text-right">
                  {wo.status && <StatusPill name={wo.status.name} color={wo.status.color} />}
                  <div className={`text-[11px] mt-1 ${wo.schedule.is_scheduled ? 'text-slate-500' : 'text-slate-400'}`}>
                    {formatSchedule(wo)}
                  </div>
                  <div className="flex justify-end mt-1">
                    <NextStepHint wo={wo} />
                  </div>
                </div>

                {/* Money + field-risk */}
                <div className="shrink-0 w-32 text-right">
                  <div className="font-mono tabular-nums text-sm font-semibold text-slate-800">
                    {wo.money?.total_formatted ?? '$0.00'}
                  </div>
                  <div className="flex justify-end gap-1 mt-1">
                    <RiskBadges wo={wo} />
                  </div>
                </div>

                <RowChevron />
              </div>
            </div>
          ))
        )}
      </div>
      )}

      {/* Pagination */}
      {meta && meta.last_page > 1 && !filingView && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <div className="text-slate-600">
            Showing {meta.from ?? 0}–{meta.to ?? 0} of {meta.total}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={meta.current_page <= 1}
              className="px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-slate-600">
              Page {meta.current_page} of {meta.last_page}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(p + 1, meta.last_page))}
              disabled={meta.current_page >= meta.last_page}
              className="px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
      <JobPeekDrawer
        peek={peek}
        onClose={() => setPeek(null)}
        onSelect={(id) => setPeek((p) => (p ? { ...p, id } : null))}
      />
    </div>
    </JobPeekContext.Provider>
  )
}

interface JobFileGroup {
  key: string
  label: string
  rank: number
  items: WorkOrder[]
}

function filingDate(wo: WorkOrder): Date | null {
  if (wo.schedule.date) {
    const scheduled = new Date(wo.schedule.date + 'T00:00:00')
    if (!Number.isNaN(scheduled.getTime())) return scheduled
  }

  if (wo.created_at) {
    const created = new Date(wo.created_at)
    if (!Number.isNaN(created.getTime())) return created
  }

  return null
}

function filingBucket(
  wo: WorkOrder,
  mode: JobFilingMode,
): Omit<JobFileGroup, 'items'> {
  if (mode === 'year' || mode === 'month') {
    const date = filingDate(wo)
    if (!date) return { key: mode + ':undated', label: 'Undated', rank: Number.MAX_SAFE_INTEGER }

    const year = date.getFullYear()
    if (mode === 'year') {
      return { key: 'year:' + year, label: String(year), rank: -year }
    }

    const month = date.getMonth()
    const monthKey = year + '-' + String(month + 1).padStart(2, '0')
    return {
      key: 'month:' + monthKey,
      label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      rank: -(year * 12 + month),
    }
  }

  if (mode === 'status') {
    const label = wo.status?.name?.trim() || 'No status'
    return { key: 'status:' + (wo.status?.id ?? label), label, rank: 0 }
  }

  if (mode === 'tech') {
    const name = wo.lead_tech?.full_name?.trim()
    return name
      ? { key: 'tech:' + (wo.lead_tech_account_id ?? name), label: name, rank: 0 }
      : { key: 'tech:unassigned', label: 'Unassigned', rank: 1 }
  }

  if (mode === 'billing') {
    if ((wo.money_due_cents ?? 0) > 0) {
      return { key: 'billing:unpaid', label: 'Unpaid', rank: 0 }
    }
    if (!wo.has_invoice) {
      return { key: 'billing:not-invoiced', label: 'Not invoiced', rank: 1 }
    }
    return { key: 'billing:paid', label: 'Paid', rank: 2 }
  }

  return wo.is_subbed
    ? { key: 'assignment:subbed', label: 'Subbed', rank: 1 }
    : { key: 'assignment:in-house', label: 'In-house', rank: 0 }
}

function groupJobs(items: WorkOrder[], mode: JobFilingMode): JobFileGroup[] {
  const groups = new Map<string, JobFileGroup>()

  items.forEach((wo) => {
    const bucket = filingBucket(wo, mode)
    const existing = groups.get(bucket.key)
    if (existing) {
      existing.items.push(wo)
    } else {
      groups.set(bucket.key, { ...bucket, items: [wo] })
    }
  })

  return Array.from(groups.values()).sort(
    (a, b) => a.rank - b.rank || a.label.localeCompare(b.label),
  )
}

type PaymentFilter = 'all' | 'collected' | 'unpaid_balance' | 'not_invoiced'

const PAYMENT_EMPTY: Record<Exclude<PaymentFilter, 'all'>, string> = {
  collected: 'No fully-paid jobs here.',
  unpaid_balance: 'No jobs with a balance due here.',
  not_invoiced: 'No un-invoiced jobs here.',
}


/** One folder's jobs, fetched on open, scoped by whatever defines the folder
 *  ({status_id} | {filing_year, filing_month} | {lead_tech_account_id}). The
 *  money roll-ups double as payment filters (All / Collected / Unpaid balance /
 *  Not invoiced); totals stay full-scope (server aggregate), the click narrows
 *  the list. */
function JobBucketFolder({
  scope,
  money,
  filters,
  display,
  onOpen,
}: {
  scope: WorkOrderListParams
  money?: StatusMoneySummary
  filters?: WorkOrderListParams
  display: 'grid' | 'list'
  onOpen: (wo: WorkOrder) => void
}) {
  const [payment, setPayment] = useState<PaymentFilter>('all')
  const [progress, setProgress] = useState<'all' | 'complete' | 'open'>('all')
  const [page, setPage] = useState(1)
  const filterKey = JSON.stringify({ f: filters ?? {}, s: scope })
  useEffect(() => { setPage(1) }, [filterKey, payment, progress])

  const { data, isFetching } = useWorkOrders({
    ...filters,
    ...scope,
    payment: payment === 'all' ? undefined : payment,
    progress: progress === 'all' ? undefined : progress,
    page,
    per_page: 50,
  })
  const jobs = data?.data ?? []
  const meta = data?.meta
  const gridClass = 'grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  const collected = money?.collected_cents ?? 0
  const unpaid = money?.unpaid_cents ?? 0
  const notInvoiced = money?.not_invoiced_cents ?? 0

  return (
    <div>
      <div className="mb-2.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <FolderStatTile
          tone="all" label="All money" count={money?.count} value={formatFolderMoney(collected + unpaid + notInvoiced)}
          sublabel="Everything in this folder" active={payment === 'all'} onClick={() => setPayment('all')}
        />
        <FolderStatTile
          tone="collected" label="Collected" count={money?.collected_count} value={formatFolderMoney(collected)}
          sublabel="Invoice balance paid in full" active={payment === 'collected'} onClick={() => setPayment('collected')}
        />
        <FolderStatTile
          tone="unpaid" label="Unpaid balance" count={money?.unpaid_count} value={formatFolderMoney(unpaid)}
          sublabel="Invoiced, balance still due" active={payment === 'unpaid_balance'} onClick={() => setPayment('unpaid_balance')}
        />
        <FolderStatTile
          tone="not_invoiced" label="Not invoiced" count={money?.not_invoiced_count} value={formatFolderMoney(notInvoiced)}
          sublabel="Done or booked, no invoice yet" active={payment === 'not_invoiced'} onClick={() => setPayment('not_invoiced')}
        />
      </div>
      {/* Second story: how much of the folder is actually done. Only the
          server-side folders (year/month, status) carry these counts. */}
      {money?.complete_count !== undefined && (
        <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <FolderStatTile
            tone="complete" label="Completed" count={money.complete_count} value={String(money.complete_count)}
            sublabel="Finished jobs" active={progress === 'complete'}
            onClick={() => setProgress(progress === 'complete' ? 'all' : 'complete')}
          />
          <FolderStatTile
            tone="open" label="Still open" count={money.open_count} value={String(money.open_count ?? 0)}
            sublabel="Not complete — scheduled, in progress or on hold" active={progress === 'open'}
            onClick={() => setProgress(progress === 'open' ? 'all' : 'open')}
          />
        </div>
      )}

      {isFetching && jobs.length === 0 ? (
        <div className={display === 'list' ? 'space-y-2.5' : gridClass}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-lg bg-white" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
          {payment === 'all' ? 'No jobs in this folder.' : PAYMENT_EMPTY[payment]}
        </div>
      ) : (
        <>
          {display === 'list'
            ? <div className="space-y-2.5">{jobs.map((wo) => <JobCard key={wo.id} wo={wo} siblings={jobs} onOpen={() => onOpen(wo)} />)}</div>
            : <div className={gridClass}>{jobs.map((wo) => <JobCard key={wo.id} wo={wo} siblings={jobs} onOpen={() => onOpen(wo)} />)}</div>}
          {meta && meta.last_page > 1 && (
            <Pager
              from={meta.from ?? 0}
              to={meta.to ?? 0}
              total={meta.total}
              page={meta.current_page}
              totalPages={meta.last_page}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              busy={isFetching}
            />
          )}
        </>
      )}
    </div>
  )
}


function DesktopJobCards({
  items,
  isLoading,
  emptyText,
  filingView,
  filingMode,
  folderLayout,
  filingCounts,
  statuses,
  tabCounts,
  statusMoney,
  filters,
}: {
  items: WorkOrder[]
  isLoading: boolean
  emptyText: string
  filingView: boolean
  filingMode: JobFilingMode
  folderLayout: FolderLayout
  filingCounts?: { years: Record<string, JobFilingSummary>; months: Record<string, Record<string, JobFilingSummary>> }
  statuses: Array<{ id: string; name: string; color: string }>
  tabCounts?: Record<string, number>
  statusMoney?: Record<string, StatusMoneySummary>
  filters?: WorkOrderListParams
}) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="hidden md:grid grid-cols-2 xl:grid-cols-3 gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-36 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (items.length === 0 && !filingView) {
    return (
      <div className="hidden md:block bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
        {emptyText}
      </div>
    )
  }

  const openJob = (wo: WorkOrder) => navigate('/jobs/' + wo.id)

  if (!filingView) {
    return (
      <div className="hidden md:grid grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map((wo) => (
          <JobCard key={wo.id} wo={wo} siblings={items} onOpen={() => openJob(wo)} />
        ))}
      </div>
    )
  }

  // Group by Year → TWO levels: server-complete year folders, each drilling to
  // its own Month sub-folders (newest first); a month fetches its jobs on open.
  if (filingMode === 'year') {
    const yearFolders: FolderNode[] = Object.entries(filingCounts?.years ?? {})
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, ysum]) => ({
        key: 'year:' + year,
        label: year,
        count: ysum.count,
        money: { kind: 'balance' as const, collected: ysum.collected_cents ?? 0, uncollected: (ysum.unpaid_cents ?? 0) + (ysum.not_invoiced_cents ?? 0) },
        subFolders: JOB_MONTHS
          .map((m): FolderNode | null => {
            const msum = filingCounts?.months[year]?.[m.value]
            if (!msum || msum.count === 0) return null
            return {
              key: 'm:' + year + '-' + m.value,
              label: m.label + ' ' + year,
              count: msum.count,
              // No `money` here — the 4-box filter (JobBucketFolder) owns the
              // money display + payment filter for the month.
              render: (display) => (
                <JobBucketFolder
                  scope={{ filing_year: Number(year), filing_month: Number(m.value) }}
                  money={msum}
                  filters={filters}
                  display={display}
                  onOpen={openJob}
                />
              ),
            }
          })
          .filter((f): f is FolderNode => f !== null)
          .reverse(),
      }))

    return (
      <div className="hidden min-w-0 md:block">
        <FolderBrowser folders={yearFolders} layout={folderLayout} countNoun="job" emptyFolderText="No jobs are filed here." />
      </div>
    )
  }

  // Group by Status → server-complete: one folder per status (real count from
  // tab_counts, real money from status_money), each fetching its own jobs on
  // open. Fixes the old client-side grouping that only surfaced statuses present
  // in the loaded page (so "Invoiced" swallowed everything).
  if (filingMode === 'status') {
    const statusFolders: FolderNode[] = statuses
      .filter((s) => (tabCounts?.[s.id] ?? 0) > 0)
      .map((s) => ({
        key: 'status:' + s.id,
        label: s.name,
        count: tabCounts?.[s.id] ?? 0,
        tab: visibleStatusColor(s.color),
        render: (display) => (
          <JobBucketFolder
            scope={{ status_id: s.id }}
            money={statusMoney?.[s.id]}
            filters={filters}
            display={display}
            onOpen={openJob}
          />
        ),
      }))

    return (
      <div className="hidden min-w-0 md:block">
        <FolderBrowser folders={statusFolders} layout={folderLayout} countNoun="job" emptyFolderText="No jobs are filed here." />
      </div>
    )
  }

  // Folder tab color: billing uses paid/unpaid hues; other client-side
  // groupings (tech/month/assignment) stay neutral navy. (Status + Year are
  // handled server-side above.)
  const folderTab = (group: JobFileGroup): string | undefined => {
    if (filingMode === 'billing') {
      if (group.key === 'billing:paid') return '#15803D'
      if (group.key === 'billing:unpaid') return '#BE123C'
      return '#E8902C'
    }
    return undefined
  }

  const folders: FolderNode[] = groupJobs(items, filingMode).map((group) => {
    // Per-folder money roll-up: uncollected = open balance (a not-yet-invoiced
    // job counts its full value as uncollected); collected = the rest.
    let collected = 0
    let uncollected = 0
    for (const wo of group.items) {
      const total = wo.money?.total_cents ?? 0
      // Invoiced → open balance is uncollected; not invoiced → full value is.
      const due = wo.has_invoice ? (wo.money_due_cents ?? 0) : total
      uncollected += due
      collected += total - due
    }
    return {
      key: group.key,
      label: group.label,
      count: group.items.length,
      tab: folderTab(group),
      money: { kind: 'balance' as const, collected, uncollected },
      items: group.items.map((wo) => <JobCard key={wo.id} wo={wo} siblings={group.items} onOpen={() => openJob(wo)} />),
    }
  })

  return (
    <div className="hidden min-w-0 md:block">
      <FolderBrowser
        folders={folders}
        layout={folderLayout}
        countNoun="job"
        emptyFolderText="No jobs are filed here."
      />
    </div>
  )
}


function JobCard({ wo, onOpen, siblings }: { wo: WorkOrder; onOpen: () => void; siblings?: WorkOrder[] }) {
  const openPeek = useJobPeek()
  return (
    <article
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      role="link"
      tabIndex={0}
      className="group flex h-full cursor-pointer flex-col rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] text-slate-500">{wo.display_number}</span>
        <div className="flex items-center gap-2">
          <PaymentStamp wo={wo} />
          {wo.status && <StatusPill name={wo.status.name} color={wo.status.color} />}
        </div>
      </div>
      <div className="mt-2 flex min-h-11 items-start gap-2">
        <span
          className="mt-1 h-8 w-1 shrink-0 rounded"
          style={{ background: wo.status ? visibleStatusColor(wo.status.color) : '#e2e8f0' }}
          aria-hidden
        />
        {wo.job_type && (
          <JobTypeChip color={wo.job_type.color} icon={wo.job_type.icon} size={22} className="mt-0.5" />
        )}
        <div className="min-w-0">
          <div className="line-clamp-2 font-semibold leading-snug text-slate-900">{wo.title}</div>
          <div className="mt-1 truncate text-xs text-slate-500">
            {wo.service_customer?.display_name ?? 'No customer'}
            {locationLabel(wo) && <> · {locationLabel(wo)}</>}
          </div>
        </div>
      </div>
      {/* Meta + footer pinned to the bottom (mt-auto) so the card fills a uniform
          height and Peek always lands in the same spot, whatever the title length. */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="min-w-0 text-xs text-slate-500">
          <div className="truncate">{formatSchedule(wo)}</div>
          <div className="truncate">{wo.lead_tech?.full_name ?? 'No assigned tech'}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-semibold text-slate-900">
            {wo.money?.total_formatted ?? '$0.00'}
          </div>
          <div className="mt-1 flex justify-end gap-1">
            <RiskBadges wo={wo} />
          </div>
        </div>
      </div>
      <CommunicationBadges wo={wo} />
      {/* Footer: next-step on the left (empty slot keeps its width), Peek pinned
          to the right so it lands in the same spot on every card. */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0"><NextStepHint wo={wo} /></div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-semibold text-amber-700 opacity-0 transition-opacity group-hover:opacity-100">
            Open
          </span>
          {openPeek && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openPeek(wo, siblings ?? [])
              }}
              className="rounded border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
            >
              Peek
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

/** Full one-line service address: "123 Main St #4, Cocoa, FL 32922". */
function fullServiceAddress(loc?: WorkOrderServiceLocation | null): string {
  if (!loc) return ''
  const line1 = [loc.street_address, loc.apt_unit].filter(Boolean).join(' ')
  const cityStateZip = [loc.city, [loc.state, loc.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return [line1, cityStateZip].filter(Boolean).join(', ')
}

function PeekField({ label, value, mono, span }: { label: string; value: string; mono?: boolean; span?: boolean }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm text-slate-900 ${mono ? 'font-mono font-semibold tabular-nums' : ''}`}>{value}</dd>
    </div>
  )
}

/** Slide-in quick-peek: a job's summary + at-a-glance + next action, without
 *  leaving the list. ←/→ moves through the sibling list; Esc closes. */
function JobPeekDrawer({
  peek,
  onClose,
  onSelect,
}: {
  peek: { id: string; siblings: WorkOrder[] } | null
  onClose: () => void
  onSelect: (id: string) => void
}) {
  const navigate = useNavigate()
  const jobs = peek?.siblings ?? []
  const index = peek ? jobs.findIndex((j) => j.id === peek.id) : -1
  const wo = index >= 0 ? jobs[index] : null
  const hasPrev = index > 0
  const hasNext = index >= 0 && index < jobs.length - 1

  useEffect(() => {
    if (!peek) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && index > 0) onSelect(jobs[index - 1].id)
      else if (e.key === 'ArrowRight' && index >= 0 && index < jobs.length - 1) onSelect(jobs[index + 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [peek, index, jobs, onClose, onSelect])

  if (!peek || !wo) return null
  const step = nextStep(wo)
  const peekAddress = fullServiceAddress(wo.service_location)

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end" role="dialog" aria-modal="true" aria-label={`Job ${wo.display_number}`}>
      <button type="button" aria-label="Close peek" onClick={onClose} className="absolute inset-0 bg-slate-900/30" />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-slate-500">{wo.display_number}</span>
              {wo.status && <StatusPill name={wo.status.name} color={wo.status.color} />}
            </div>
            <h2 className="mt-1 text-lg font-bold leading-snug text-slate-900">{wo.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-2.5">
          <button type="button" onClick={() => navigate(`/jobs/${wo.id}`)} className="text-sm font-semibold text-amber-700 hover:text-amber-800">
            Open full record →
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <PeekField label="Customer" value={wo.service_customer?.display_name ?? '—'} />
            <PeekField label="Scheduled" value={formatSchedule(wo)} />
            <PeekField label="Amount" value={wo.money?.total_formatted ?? '$0.00'} mono />
            <PeekField label="Lead tech" value={wo.lead_tech?.full_name ?? 'Unassigned'} />
            {wo.service_location && (
              <div className="col-span-2">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Location</dt>
                <dd className="mt-0.5 text-sm">
                  {wo.service_location.nickname && (
                    <div className="font-medium text-slate-900">{wo.service_location.nickname}</div>
                  )}
                  <div className="text-slate-600">{peekAddress || '—'}</div>
                </dd>
              </div>
            )}
          </dl>

          {peekAddress && (
            <div className="mt-4">
              <JobLocationMap
                address={peekAddress}
                lat={wo.service_location?.latitude}
                lng={wo.service_location?.longitude}
                label={wo.service_location?.nickname ?? undefined}
              />
            </div>
          )}

          <div className="mt-5">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">At a glance</div>
            <div className="space-y-1.5 text-sm text-slate-600">
              <div>· {wo.has_invoice ? 'Invoiced' : 'Not yet invoiced'}</div>
              {wo.is_subbed && <div>· Subbed out to a subcontractor</div>}
              {(wo.priority === 'urgent' || wo.priority === 'emergency') && (
                <div>· {wo.priority === 'emergency' ? 'Emergency' : 'Urgent'} priority</div>
              )}
              {wo.request_status === 'pending' && <div>· 📨 Submitted via customer portal</div>}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={() => navigate(`/jobs/${wo.id}`)}
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600"
          >
            {step ? step.label : 'Open full record'}
          </button>
          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
            <button type="button" disabled={!hasPrev} onClick={() => hasPrev && onSelect(jobs[index - 1].id)} className="rounded px-2 py-1 font-semibold hover:bg-slate-100 disabled:opacity-40">← Prev</button>
            <span className="tabular-nums">{index + 1} of {jobs.length}</span>
            <button type="button" disabled={!hasNext} onClick={() => hasNext && onSelect(jobs[index + 1].id)} className="rounded px-2 py-1 font-semibold hover:bg-slate-100 disabled:opacity-40">Next →</button>
          </div>
          <div className="mt-1.5 text-center text-[11px] text-slate-400">←/→ moves between jobs · Esc closes</div>
        </div>
      </aside>
    </div>,
    document.body,
  )
}

function PaymentStamp({ wo }: { wo: WorkOrder }) {
  const isPaid = wo.has_invoice === true && (wo.money_due_cents ?? 0) <= 0
  const amountDue = wo.money_due_cents ?? 0
  const title = isPaid
    ? 'Invoice balance paid in full'
    : wo.has_invoice
      ? `Outstanding invoice balance: ${formatFolderMoney(amountDue)}`
      : 'Not paid yet; no invoice has been created'

  return (
    <span
      className={
        'inline-flex min-w-14 items-center justify-center rounded-sm border-2 px-2 py-0.5 text-[10px] font-black ' +
        (isPaid
          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
          : 'border-rose-600 bg-rose-50 text-rose-700')
      }
      title={title}
      aria-label={title}
    >
      {isPaid ? 'PAID' : 'UNPAID'}
    </span>
  )
}

// Status pill driven by the tenant's configured status color (handles hex +
// legacy Tailwind names + white→fallback), matching the calendar.
function CommunicationBadges({ wo }: { wo: WorkOrder }) {
  const communications = wo.communications
  if (!communications?.email_sent_at && !communications?.text_sent_at) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 text-[11px] font-semibold">
      {communications.email_sent_at && (
        <>
          <span
            className="rounded bg-sky-50 px-2 py-1 text-sky-800 ring-1 ring-inset ring-sky-200"
            title={`Email sent ${communicationStamp(communications.email_sent_at)}`}
          >
            Email sent
          </span>
          <span
            className={`rounded px-2 py-1 ring-1 ring-inset ${
              communications.email_opened_at
                ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                : 'bg-rose-100 text-rose-800 ring-rose-200'
            }`}
            title={
              communications.email_opened_at
                ? `First opened ${communicationStamp(communications.email_opened_at)}`
                : 'No tracked open yet. Some email apps block tracking images.'
            }
          >
            {communications.email_opened_at ? 'Opened' : 'Not opened'}
          </span>
        </>
      )}
      {communications.text_sent_at && (
        <span
          className={`rounded px-2 py-1 ring-1 ring-inset ${
            communications.text_delivered_at
              ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
              : 'bg-slate-100 text-slate-700 ring-slate-200'
          }`}
          title={`Text ${communications.text_delivered_at ? 'delivered' : 'sent'} ${communicationStamp(communications.text_delivered_at ?? communications.text_sent_at)}`}
        >
          Text {communications.text_delivered_at ? 'delivered' : 'sent'}
        </span>
      )}
    </div>
  )
}

function communicationStamp(value: string) {
  return new Date(value).toLocaleString()
}

function StatusPill({ name, color }: { name: string; color: string }) {
  const bg = visibleStatusColor(color)
  return (
    <span
      className="inline-block px-2 py-0.5 text-xs font-medium rounded"
      style={{ background: bg, color: textColorOn(bg) }}
    >
      {name}
    </span>
  )
}

/** Best short location label for a job row, or null when none. */
function locationLabel(wo: WorkOrder): string | null {
  return wo.service_location?.nickname || wo.service_location?.street_address || null
}

/** Small field-risk chips (NTE / signature / photos required). */
function RiskBadges({ wo }: { wo: WorkOrder }) {
  const badges: Array<{ key: string; label: string; title: string }> = []
  if (wo.nte?.cents != null) {
    badges.push({ key: 'nte', label: 'NTE', title: 'Not-to-exceed cap set' })
  }
  if (wo.field_policy?.requires_signature) {
    badges.push({ key: 'sig', label: '✍️', title: 'Signature required' })
  }
  if ((wo.field_policy?.min_photos_required ?? 0) > 0 || wo.field_policy?.requires_before_after_photos) {
    badges.push({ key: 'photo', label: '📷', title: 'Photos required' })
  }
  if (badges.length === 0) return null
  return (
    <>
      {badges.map((b) => (
        <span
          key={b.key}
          title={b.title}
          className="inline-flex items-center rounded bg-slate-100 text-slate-600 px-1 text-[10px] font-medium leading-[16px]"
        >
          {b.label}
        </span>
      ))}
    </>
  )
}

function formatSchedule(wo: WorkOrder): string {
  if (!wo.schedule.is_scheduled) return 'Not scheduled'
  if (!wo.schedule.date) return 'Scheduled'
  const dateStr = new Date(wo.schedule.date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  if (wo.schedule.start_time) {
    return `${dateStr}, ${formatTime(wo.schedule.start_time)}`
  }
  return dateStr
}

function formatTime(time: string): string {
  // "14:30:00" or "14:30" → "2:30 PM"
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  const minute = m
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${minute} ${ampm}`
}

// ---------- Next-step hint (List Workflow Slice 2) ----------
// Read-only "what to do next" derived from the status FSM category +
// schedule/assignment + has_invoice. NOT a rules engine, and not yet
// clickable (that's phase 2). Returns null when there's no obvious step so
// quiet rows stay uncluttered.
type NextStepTone = 'sky' | 'amber' | 'rose' | 'emerald'

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function nextStep(wo: WorkOrder): { label: string; tone: NextStepTone } | null {
  const cat = wo.status?.category
  if (cat === 'complete') {
    // Money on the table — completed but never invoiced.
    return wo.has_invoice === false ? { label: 'Invoice', tone: 'emerald' } : null
  }
  if (cat === 'blocked') return { label: 'Unblock', tone: 'rose' }
  // open / in_progress
  if (!wo.schedule.is_scheduled) return { label: 'Schedule', tone: 'sky' }
  if (!wo.lead_tech && !wo.crew) return { label: 'Assign tech', tone: 'amber' }
  if (wo.schedule.date && new Date(wo.schedule.date + 'T00:00:00') < startOfToday()) {
    return { label: 'Overdue', tone: 'rose' }
  }
  if (cat === 'in_progress') return { label: 'Complete', tone: 'amber' }
  return null
}

const NEXT_STEP_TONE: Record<NextStepTone, string> = {
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-700',
  emerald: 'bg-emerald-100 text-emerald-700',
}

function NextStepHint({ wo }: { wo: WorkOrder }) {
  const navigate = useNavigate()
  const step = nextStep(wo)
  if (!step) return null
  // Every job action (schedule / assign / complete / invoice) lives on the
  // job detail page, so the hint routes there. stopPropagation so it doesn't
  // double-fire the row's own navigate.
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        navigate(`/jobs/${wo.id}`)
      }}
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium hover:brightness-95 ${NEXT_STEP_TONE[step.tone]}`}
      title="Go to the next step"
    >
      → {step.label}
    </button>
  )
}
