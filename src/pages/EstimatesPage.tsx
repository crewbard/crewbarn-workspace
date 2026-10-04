import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useEstimates } from '@/hooks/useEstimates'
import { WorkflowTabs, type WorkflowTab } from '@/components/lists/WorkflowTabs'
import { RowChevron } from '@/components/lists/RowChevron'
import { useTheme, type FolderLayout } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'
import { FolderBrowser, Pager, type FolderNode } from '@/components/FolderBrowser'
import { FolderLayoutSwitch } from '@/components/FolderLayoutSwitch'
import { FolderStatTile, formatFolderMoney } from '@/components/FolderStatTile'
import type { Estimate, EstimateStatus } from '@/types/estimate'
import type { EstimateFilingSummary } from '@/types/api'
import { EasyActionCards } from '@/components/easy/EasyActionCards'
import { Modal } from '@/components/ui/Modal'
import { CustomerOrdersPanel } from '@/components/estimates/CustomerOrdersPanel'

const STATUS_OPTIONS: { value: EstimateStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'superseded', label: 'Superseded' },
  { value: 'expired', label: 'Expired' },
]

const ESTIMATE_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

// Estimate status is a fixed system enum (not a per-tenant JobStatus), so the
// stripe/pill colors come from this map — meaning, not decoration.
const ESTIMATE_STATUS_META: Record<string, { stripe: string; pill: string; label: string }> = {
  draft:      { stripe: '#94a3b8', pill: 'bg-slate-100 text-slate-700',   label: 'Draft' },
  sent:       { stripe: '#3b82f6', pill: 'bg-blue-100 text-blue-800',     label: 'Sent' },
  approved:   { stripe: '#10b981', pill: 'bg-emerald-100 text-emerald-800', label: 'Approved' },
  rejected:   { stripe: '#ef4444', pill: 'bg-red-100 text-red-800',       label: 'Rejected' },
  superseded: { stripe: '#f59e0b', pill: 'bg-amber-100 text-amber-800',   label: 'Superseded' },
  expired:    { stripe: '#f59e0b', pill: 'bg-amber-100 text-amber-800',   label: 'Expired' },
}
const ESTIMATE_FALLBACK_META = { stripe: '#94a3b8', pill: 'bg-slate-100 text-slate-700', label: 'Draft' }

// Workflow tabs — the common approval stages (Superseded stays in the dropdown).
const ESTIMATE_TABS: WorkflowTab[] = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'expired', label: 'Expired' },
]

const fmtDate = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

// Titles are optional — untitled estimates fall back to the customer so the
// list stays scannable instead of a wall of "Untitled estimate" placeholders.
const estimateTitle = (est: Estimate) =>
  est.title ? (
    <>{est.title}</>
  ) : est.customer?.display_name ? (
    <>Estimate — {est.customer.display_name}</>
  ) : (
    <span className="text-slate-400 font-normal">Untitled estimate</span>
  )

export function EstimatesPage() {
  const navigate = useNavigate()
  const { theme, estimateView, setEstimateView, density, folderLayout, setFolderLayout } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const [board, setBoard] = useState(true)
  const [mobileLane, setMobileLane] = useState('Drafts')
  const [preview, setPreview] = useState<Estimate | null>(null)
  const showBoard = easy && board
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<EstimateStatus | ''>('')
  // Status filters must reveal their matching lane on the single-column phone board.
  useEffect(() => {
    if (status === 'draft') setMobileLane('Drafts')
    else if (status === 'sent') setMobileLane('Waiting on them')
    else if (status === 'approved') setMobileLane('Approved')
    else if (status) setMobileLane('Closed / expired')
  }, [status])
  const [page, setPage] = useState(1)
  const [filingView, setFilingView] = useState(
    () => estimateView === 'files'
      || (typeof window !== 'undefined' && window.localStorage.getItem('crewbarn:estimate-filing-view') === 'true'),
  )
  const estimatesQuery = useEstimates({
    q: q || undefined,
    status: status || undefined,
    // The main query supplies the year/month counts; each open month folder
    // fetches its own estimates (EstimateFolderContents).
    include_filing_counts: filingView || undefined,
    page,
    per_page: 25,
  })

  const items = estimatesQuery.data?.data ?? []
  const meta = estimatesQuery.data?.meta
  const tabCounts = estimatesQuery.data?.tab_counts
  const filingCounts = estimatesQuery.data?.estimate_filing_counts
  const desktopRowPad = density === 'dense' ? 'px-4 py-2' : density === 'compact' ? 'px-4 py-2.5' : 'px-4 py-3'

  return (
    <div className={`mx-auto px-3 sm:px-6 py-4 sm:py-6 ${easy ? 'w-full min-w-0 max-w-none' : filingView ? 'max-w-[1760px]' : 'max-w-7xl'}`}>
      {easy ? <EasyPageHeading title="Estimates" description="Prepare the work, follow up on approvals, and find estimates ready for their next step." actions={<Link to="/estimates/new" data-tour="estimates-new" className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-300">+ New estimate</Link>} /> : <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Estimates</h1>
        <Link
          to="/estimates/new"
          data-tour="estimates-new"
          className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md whitespace-nowrap"
        >
          + New
        </Link>
      </div>}

      {/* Orders customers built from the shop's catalogs in the portal. Hidden when none wait. */}
      <CustomerOrdersPanel />

      {/* Workflow tabs — common approval stages; full list stays in the dropdown.
          Live counts (by approval status) come from the index tab_counts. */}
      {easy && <EasyActionCards label="Move an estimate forward" actions={[
        { key: 'draft', title: 'Finish a draft', description: 'Review the details before sending.' },
        { key: 'sent', title: 'Waiting on them', description: 'Open an estimate to review follow-up options.' },
        { key: 'approved', title: 'Approved', description: 'Review approved work and its next step.' },
        { key: 'expired', title: 'Past its expiry', description: 'Review pricing and terms before sending again.' },
      ].map(action => ({ ...action, count: estimatesQuery.isError ? undefined : tabCounts?.[action.key], active: status === action.key, onClick: () => { setStatus(action.key as EstimateStatus); setPage(1) } }))} />}
      <WorkflowTabs
        tabs={ESTIMATE_TABS.map((t) => ({
          ...t,
          count: !estimatesQuery.isError && tabCounts ? tabCounts[t.key === '' ? 'all' : t.key] ?? 0 : undefined,
        }))}
        active={status}
        onChange={(key) => {
          setStatus(key as EstimateStatus | '')
          setPage(1)
        }}
      />

      {/* Filters */}
      <div data-easy-list-toolbar className="flex items-center gap-2 sm:gap-3 mb-4 flex-wrap">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          placeholder="Search by estimate # or notes..."
          className="flex-1 min-w-[180px] sm:max-w-md px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as EstimateStatus | '')
            setPage(1)
          }}
          className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {(estimateView === 'cards' || estimateView === 'files') && (
          <div className="ml-auto inline-flex overflow-hidden rounded-md border border-slate-300 bg-white">
            <button
              type="button"
              onClick={() => {
                setFilingView(false)
                setBoard(false)
                setEstimateView('cards')
                setPage(1)
              }}
              className={
                'px-3 py-2 text-sm font-medium transition-colors ' +
                (!filingView ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50')
              }
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => {
                setFilingView(true)
                setBoard(false)
                setEstimateView('files')
                setPage(1)
              }}
              className={
                'border-l border-slate-300 px-3 py-2 text-sm font-medium transition-colors ' +
                (filingView ? 'bg-amber-500 text-white' : 'text-slate-700 hover:bg-slate-50')
              }
            >
              Files
            </button>
          </div>
        )}

        {filingView && !showBoard && (
          <div className="ml-2 hidden items-center md:flex">
            <FolderLayoutSwitch value={folderLayout} onChange={setFolderLayout} />
          </div>
        )}
      </div>

      {/* Table */}
      {easy && <div className="mb-5 flex w-full flex-col items-center gap-2">
        <div role="group" aria-label="Estimate view" className="flex flex-wrap justify-center gap-3">
        <button type="button" aria-pressed={board} onClick={() => setBoard(true)} className={`rounded-lg border px-4 py-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${board ? 'border-amber-500 bg-amber-500/15 text-amber-900' : 'border-slate-400 bg-transparent text-slate-700 hover:bg-amber-500/5'}`}>Workflow board</button>
        <button type="button" aria-pressed={!board} onClick={() => setBoard(false)} className={`rounded-lg border px-4 py-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${!board ? 'border-amber-500 bg-amber-500/15 text-amber-900' : 'border-slate-400 bg-transparent text-slate-700 hover:bg-amber-500/5'}`}>Detailed list & files</button>
        </div>
        {showBoard && <span className="text-center text-sm text-slate-500">Current page of filtered results. Open an estimate to review and act.</span>}
      </div>}
      {estimatesQuery.isError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">Estimates could not be loaded. <button type="button" className="underline" onClick={() => estimatesQuery.refetch()}>Try again</button></div>}
      {showBoard && !estimatesQuery.isError && (estimatesQuery.isLoading ? <p role="status">Loading estimates…</p> : <>
      <div role="group" aria-label="Estimate board lane" className="mb-3 flex flex-wrap gap-2 md:hidden">
        {['Drafts', 'Waiting on them', 'Approved', 'Closed / expired'].map(lane => <button key={lane} type="button" data-easy-view-option aria-pressed={mobileLane === lane} onClick={() => setMobileLane(lane)} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm">{lane}</button>)}
      </div>
      <div data-easy-estimate-board className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { title: 'Drafts', statuses: ['draft'] },
          { title: 'Waiting on them', statuses: ['sent'] },
          { title: 'Approved', statuses: ['approved'] },
          { title: 'Closed / expired', statuses: ['rejected', 'superseded', 'expired'] },
        ].map(column => {
          const rows = items.filter(est => column.statuses.includes(est.status))
          return <section key={column.title} aria-label={column.title} className={`${mobileLane === column.title ? '' : 'hidden md:block'} min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3`}>
            <h2 className="font-semibold">{column.title} <span className="text-slate-500">({rows.length})</span></h2>
            {rows.length === 0 && <p className="text-sm text-slate-500">None on this page.</p>}
            {rows.map(est => <article key={est.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">{est.display_number} · {ESTIMATE_STATUS_META[est.status]?.label ?? est.status}</div>
              <h3 className="font-semibold break-words">{estimateTitle(est)}</h3>
              <p className="text-sm text-slate-600">{est.customer?.display_name ?? 'No customer'}</p>
              <p className="font-semibold">{est.money?.total_formatted ?? 'Total unavailable'}</p>
              <p className="text-xs text-slate-500">{estimateDateLabel(est)}</p>
              <NextStepHint est={est} />
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <button type="button" className="underline text-slate-600" onClick={() => setPreview(est)} aria-label={`Quick look at ${est.display_number}`}>Quick look</button>
                <Link to={`/estimates/${est.id}`} className="font-semibold text-amber-800">Open estimate →</Link>
              </div>
            </article>)}
          </section>
        })}
      </div></>)}
      <div hidden={showBoard || estimatesQuery.isError}>
      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {estimatesQuery.isLoading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded animate-pulse" />
          ))
        ) : items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
            {q || status
              ? 'No estimates match your filters.'
              : 'No estimates yet.'}
          </div>
        ) : (
          items.map((est) => {
            const meta = ESTIMATE_STATUS_META[est.status] ?? ESTIMATE_FALLBACK_META
            return (
              <div
                key={est.id}
                onClick={() => navigate(`/estimates/${est.id}`)}
                className="flex items-stretch rounded-lg border border-slate-200 bg-white overflow-hidden active:bg-amber-50/60 cursor-pointer"
              >
                <span className="w-1 shrink-0" style={{ background: meta.stripe }} aria-hidden />
                <div className="flex-1 min-w-0 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-slate-500">{est.display_number}</span>
                    <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded ${meta.pill}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-1 font-medium text-slate-900 truncate">
                    {estimateTitle(est)}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-600 truncate">
                      {est.customer?.display_name ?? 'No customer'}
                      {est.customer?.vip && (
                        <span className="ml-1 text-[10px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded">VIP</span>
                      )}
                    </span>
                    <span className="font-mono text-sm tabular-nums shrink-0 text-slate-800">
                      {est.money?.total_formatted ?? '$0.00'}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>{estimateDateLabel(est)}</span>
                    <NextStepHint est={est} />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop — clickable workflow rows (status stripe + identity, status +
          date, total, chevron). */}
      {(estimateView === 'cards' || estimateView === 'files') && filingView && (
        <DesktopEstimateFiles
          filingCounts={filingCounts}
          folderLayout={folderLayout}
          status={status}
          search={q}
          onOpen={(id) => navigate(`/estimates/${id}`)}
        />
      )}

      {(estimateView === 'cards' || estimateView === 'files') && !filingView && !estimatesQuery.isLoading && items.length > 0 && (
        <DesktopEstimateCards
          estimates={items}
          onOpen={(id) => navigate(`/estimates/${id}`)}
        />
      )}

      <div className={(filingView || ((estimateView === 'cards' || estimateView === 'files') && !estimatesQuery.isLoading && items.length > 0) ? 'hidden' : 'hidden md:block') + ' bg-white border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100'}>
        {estimatesQuery.isLoading ? (
          <div className="px-4 py-8 text-center text-slate-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-500">
            {q || status
              ? 'No estimates match your filters.'
              : 'No estimates yet. Click "New Estimate" to create one.'}
          </div>
        ) : (
          items.map((est) => {
            const meta = ESTIMATE_STATUS_META[est.status] ?? ESTIMATE_FALLBACK_META
            return (
              <div
                key={est.id}
                onClick={() => navigate(`/estimates/${est.id}`)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/estimates/${est.id}`)
                  }
                }}
                className="group flex items-stretch cursor-pointer hover:bg-amber-50/40 focus:outline-none focus:bg-amber-50/60 transition-colors"
              >
                <span className="w-1 shrink-0" style={{ background: meta.stripe }} aria-hidden />

                <div className={`flex-1 min-w-0 flex items-center gap-4 ${desktopRowPad}`}>
                  {/* Identity */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] text-slate-400">{est.display_number}</span>
                      <span className="font-semibold text-slate-900 truncate">
                        {estimateTitle(est)}
                      </span>
                    </div>
                    {estimateView !== 'compact' && (
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        {est.customer?.display_name ?? 'No customer'}
                        {est.customer?.vip && (
                          <span className="ml-1 text-[10px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded">VIP</span>
                        )}
                        {' · '}
                        {estimateDateLabel(est)}
                      </div>
                    )}
                  </div>

                  {/* Status + total + next-step hint */}
                  <div className="shrink-0 w-40 text-right">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${meta.pill}`}>
                      {meta.label}
                    </span>
                    <div className="font-mono tabular-nums text-sm font-semibold text-slate-800 mt-1">
                      {est.money?.total_formatted ?? '$0.00'}
                    </div>
                    <div className="flex justify-end mt-1">
                      <NextStepHint est={est} />
                    </div>
                  </div>

                  <RowChevron />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      </div>
      {meta && !estimatesQuery.isError && meta.last_page > 1 && (!filingView || showBoard) && (
        <div data-easy-pager className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm">
          <div className="text-slate-600">
            Showing {meta.from ?? 0}–{meta.to ?? 0} of {meta.total}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={estimatesQuery.isFetching || meta.current_page <= 1}
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
              disabled={estimatesQuery.isFetching || meta.current_page >= meta.last_page}
              className="px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
      {easy && preview && <Modal isOpen onClose={() => setPreview(null)} title={preview.display_number} subtitle="Estimate quick look">
        <Modal.Body>
          <h2 className="text-lg font-semibold">{estimateTitle(preview)}</h2>
          <p className="mt-1 text-slate-600">{preview.customer?.display_name ?? 'No customer'}</p>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <div><dt className="text-sm text-slate-500">Status</dt><dd>{ESTIMATE_STATUS_META[preview.status]?.label ?? preview.status}</dd></div>
            <div><dt className="text-sm text-slate-500">Total</dt><dd className="font-semibold">{preview.money?.total_formatted ?? 'Unavailable'}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-slate-500">{estimateDateLabel(preview)}</p>
          {preview.description && <p className="mt-4 whitespace-pre-wrap break-words">{preview.description}</p>}
          <div className="mt-4"><NextStepHint est={preview} /></div>
          <p className="mt-5 text-sm text-slate-500">Open the estimate for line items and available actions. Previewing does not send, approve, or convert it.</p>
        </Modal.Body>
        <Modal.Footer><button type="button" className="rounded-lg border px-4 py-2" onClick={() => setPreview(null)}>Back to board</button><Link to={`/estimates/${preview.id}`} className="rounded-lg bg-amber-400 px-4 py-2 font-semibold">Open estimate →</Link></Modal.Footer>
      </Modal>}
    </div>
  )
}

type EstimateBucket = 'all' | 'won' | 'lost' | 'dormant'

const BUCKET_EMPTY: Record<Exclude<EstimateBucket, 'all'>, string> = {
  won: 'Nothing won in this folder yet.',
  lost: 'Nothing lost here — good.',
  dormant: 'No dormant estimates — every sent one has had a touch in the last two weeks.',
}

/**
 * One month's estimates, fetched on open, under the same four-tile bar the
 * Jobs cabinet has: everything quoted, won, lost, and the dormant ones —
 * sent, unanswered, untouched for two weeks — that are money quietly
 * walking away. Each tile filters the list below it.
 */
function EstimateFolderContents({
  year,
  month,
  summary,
  status,
  search,
  onOpen,
}: {
  year: string
  month: string
  summary?: EstimateFilingSummary
  status: EstimateStatus | ''
  search: string
  onOpen: (id: string) => void
}) {
  const [bucket, setBucket] = useState<EstimateBucket>('all')
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [bucket, status, search])
  const { data, isFetching, isError, refetch } = useEstimates({
    filing_year: Number(year),
    filing_month: Number(month),
    status: status || undefined,
    q: search || undefined,
    bucket: bucket === 'all' ? undefined : bucket,
    page,
    per_page: 50,
  })
  const estimates = data?.data ?? []
  const meta = data?.meta

  return (
    <div>
      <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <FolderStatTile
          tone="all" label="All quoted" count={summary?.count} countNoun="estimate" value={formatFolderMoney(summary?.total_cents ?? 0)}
          sublabel="Everything in this folder" active={bucket === 'all'} onClick={() => setBucket('all')}
        />
        <FolderStatTile
          tone="won" label="Won" count={summary?.won_count} countNoun="estimate" value={formatFolderMoney(summary?.won_cents ?? 0)}
          sublabel="Approved by the customer" active={bucket === 'won'} onClick={() => setBucket(bucket === 'won' ? 'all' : 'won')}
        />
        <FolderStatTile
          tone="lost" label="Lost" count={summary?.lost_count} countNoun="estimate" value={formatFolderMoney(summary?.lost_cents ?? 0)}
          sublabel="Declined or expired" active={bucket === 'lost'} onClick={() => setBucket(bucket === 'lost' ? 'all' : 'lost')}
        />
        <FolderStatTile
          tone="dormant" label="Dormant" count={summary?.dormant_count} countNoun="estimate" value={formatFolderMoney(summary?.dormant_cents ?? 0)}
          sublabel="Sent, no answer, untouched 14+ days" active={bucket === 'dormant'} onClick={() => setBucket(bucket === 'dormant' ? 'all' : 'dormant')}
        />
      </div>

      {isError ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">This estimate folder could not be loaded. <button type="button" className="underline" onClick={() => refetch()}>Try again</button></div> : isFetching && estimates.length === 0 ? (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-52 animate-pulse rounded-lg bg-white" />)}
        </div>
      ) : estimates.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          {bucket === 'all' ? 'No estimates in this month.' : BUCKET_EMPTY[bucket]}
        </div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {estimates.map((est) => <EstimateCard key={est.id} est={est} onOpen={() => onOpen(est.id)} />)}
          </div>
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

function DesktopEstimateFiles({
  filingCounts,
  folderLayout,
  status,
  search,
  onOpen,
}: {
  filingCounts: {
    years: Record<string, EstimateFilingSummary>
    months: Record<string, Record<string, EstimateFilingSummary>>
  } | undefined
  folderLayout: FolderLayout
  status: EstimateStatus | ''
  search: string
  onOpen: (id: string) => void
}) {
  // Year → Month, the same cabinet as Jobs: a year folder carries the won /
  // open money, each month drills into its own tiles + cards, fetched on open.
  const years = Object.keys(filingCounts?.years ?? {}).sort((a, b) => Number(b) - Number(a))
  const folders: FolderNode[] = years.map((year) => {
    const ysum = filingCounts!.years[year]
    const months = filingCounts?.months[year] ?? {}
    const subFolders: FolderNode[] = []
    for (let m = 12; m >= 1; m--) {
      const month = String(m).padStart(2, '0')
      const summary = months[month]
      if (!summary || summary.count === 0) continue
      subFolders.push({
        key: 'm:' + year + '-' + month,
        label: ESTIMATE_MONTHS[m - 1] + ' ' + year,
        count: summary.count,
        render: () => (
          <EstimateFolderContents year={year} month={month} summary={summary} status={status} search={search} onOpen={onOpen} />
        ),
      })
    }
    return {
      key: 'year:' + year,
      label: year,
      count: ysum.count,
      money: { kind: 'total' as const, total: ysum.won_cents ?? 0, label: 'Won' },
      subFolders,
    }
  })

  if (folders.length === 0) {
    return (
      <div className="hidden rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 md:block">
        No estimate folders match these filters.
      </div>
    )
  }

  return (
    <div className="hidden min-w-0 md:block">
      <FolderBrowser folders={folders} layout={folderLayout} countNoun="estimate" emptyFolderText="No estimates in this folder." />
    </div>
  )
}

/**
 * The in-folder card, cut to the Jobs cabinet's pattern: number + stripe +
 * status up top, title, customer · place, then date and money pinned to the
 * bottom with the next step — so the two cabinets read as one system.
 */
function EstimateCard({ est, onOpen }: { est: Estimate; onOpen: () => void }) {
  const meta = ESTIMATE_STATUS_META[est.status] ?? ESTIMATE_FALLBACK_META
  const loc = est.service_location
  const place = loc ? [loc.city, loc.state].filter(Boolean).join(', ') : ''
  return (
    <article
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      role="link"
      tabIndex={0}
      className="group flex h-full cursor-pointer flex-col rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] text-slate-500">{est.display_number}</span>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.pill}`}>{meta.label}</span>
      </div>
      <div className="mt-2 flex min-h-11 items-start gap-2">
        <span className="mt-1 h-8 w-1 shrink-0 rounded" style={{ background: meta.stripe }} aria-hidden />
        <div className="min-w-0">
          <div className="line-clamp-2 font-semibold leading-snug text-slate-900">{estimateTitle(est)}</div>
          <div className="mt-1 truncate text-xs text-slate-500">
            {est.customer?.display_name ?? 'No customer'}
            {est.customer?.vip && <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-800">VIP</span>}
            {place && <> · {place}</>}
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="min-w-0 text-xs text-slate-500">
          <div className="truncate">{estimateDateLabel(est)}</div>
          {est.expires_at && est.status === 'sent' && !estimateDateLabel(est).startsWith('Expires') && (
            <div className="truncate">Expires {fmtDate(est.expires_at)}</div>
          )}
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-semibold text-slate-900">{est.money?.total_formatted ?? '$0.00'}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0"><NextStepHint est={est} /></div>
        <span className="text-xs font-semibold text-amber-700 opacity-0 transition-opacity group-hover:opacity-100">Open</span>
      </div>
    </article>
  )
}

function DesktopEstimateCards({
  estimates,
  onOpen,
}: {
  estimates: Estimate[]
  onOpen: (id: string) => void
}) {
  return (
    <div className="hidden md:grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {estimates.map((est) => {
        const meta = ESTIMATE_STATUS_META[est.status] ?? ESTIMATE_FALLBACK_META
        return (
          <div
            key={est.id}
            onClick={() => onOpen(est.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(est.id)
              }
            }}
            role="link"
            tabIndex={0}
            className="group overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <span className="block h-1" style={{ background: meta.stripe }} aria-hidden />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-slate-500">{est.display_number}</div>
                  <div className="mt-1 truncate text-base font-semibold text-slate-900">
                    {estimateTitle(est)}
                  </div>
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${meta.pill}`}>
                  {meta.label}
                </span>
              </div>

              <div className="mt-3 truncate text-sm text-slate-600">
                {est.customer?.display_name ?? 'No customer'}
                {est.customer?.vip && (
                  <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-800">VIP</span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Total
                  </div>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-900">
                    {est.money?.total_formatted ?? '$0.00'}
                  </div>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {estimateDateLabel(est)}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">Next step</span>
                <NextStepHint est={est} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Next-step hint (List Workflow Slice 3) ----------
// Read-only "what to do next" from the approval lifecycle. Not clickable
// yet (phase 2). Null when the estimate is in a settled/terminal state.
type NextStepTone = 'sky' | 'amber' | 'emerald'
const NEXT_STEP_TONE: Record<NextStepTone, string> = {
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-800',
  emerald: 'bg-emerald-100 text-emerald-700',
}

function estimateNextStep(est: Estimate): { label: string; tone: NextStepTone } | null {
  if (est.status === 'draft') return { label: 'Send', tone: 'sky' }
  if (est.status === 'sent') return { label: 'Follow up', tone: 'amber' }
  // Approved and not yet turned into a job — the money-making move.
  if (est.status === 'approved' && !est.converted_to_work_order_id) {
    return { label: 'Convert', tone: 'emerald' }
  }
  return null
}

function NextStepHint({ est }: { est: Estimate }) {
  const navigate = useNavigate()
  const step = estimateNextStep(est)
  if (!step) return null
  // Convert deep-links to the detail page with the convert modal auto-opened
  // (the modal still confirms before creating the job). Send/Follow-up just
  // land on the detail surface where the action buttons live.
  const target =
    step.label === 'Convert'
      ? `/estimates/${est.id}?action=convert`
      : `/estimates/${est.id}`
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        navigate(target)
      }}
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium hover:brightness-95 ${NEXT_STEP_TONE[step.tone]}`}
      title="Go to the next step"
    >
      → {step.label}
    </button>
  )
}

/** Status-aware date line for an estimate row. */
function estimateDateLabel(est: Estimate): string {
  if (est.status === 'approved' && est.approved_at) return `Approved ${fmtDate(est.approved_at)}`
  if (est.status === 'sent' && est.expires_at) return `Expires ${fmtDate(est.expires_at)}`
  if (est.status === 'sent' && est.sent_at) return `Sent ${fmtDate(est.sent_at)}`
  if (est.status === 'expired' && est.expires_at) return `Expired ${fmtDate(est.expires_at)}`
  if (est.status === 'rejected' && est.rejected_at) return `Declined ${fmtDate(est.rejected_at)}`
  return est.created_at ? `Created ${fmtDate(est.created_at)}` : 'No date'
}
