import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { RecordPaymentModal } from '@/components/invoices/RecordPaymentModal'
import {
  invoiceKeys,
  useInvoiceFilingSummary,
  useInvoiceStatusCounts,
  useInvoices,
} from '@/hooks/useInvoices'
import { WorkflowTabs, type WorkflowTab } from '@/components/lists/WorkflowTabs'
import type { Invoice, InvoiceFilingSummaryEntry, InvoiceListParams, InvoiceStatus } from '@/types/invoice'

/**
 * Invoices billing worklist (Slice 1). No standalone list existed before —
 * this is the office's "what needs collecting" view. Overdue / Partial are
 * DERIVED (the stored status is just draft/sent/paid/cancelled), so tabs +
 * stripe come from a computed state, not the raw status.
 *
 * The list endpoint returns a flat array (no pagination meta in the client),
 * so we fetch a generous page and filter the tabs client-side.
 */

type InvoiceBucket = 'all' | 'draft' | 'sent' | 'overdue' | 'paid'

type InvoiceView = 'cards' | 'files'
const INVOICE_TABS: WorkflowTab[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
]

const fmtCents = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100)


const MONTHS = [
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
const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

/** Derived display state — meaning, not the raw 4-value status. */
function invoiceState(inv: Invoice): { label: string; stripe: string; pill: string } {
  if (inv.status === 'paid') return { label: 'Paid', stripe: '#10b981', pill: 'bg-emerald-100 text-emerald-800' }
  if (inv.status === 'cancelled') return { label: 'Void', stripe: '#cbd5e1', pill: 'bg-slate-100 text-slate-500' }
  if (inv.status === 'draft') return { label: 'Draft', stripe: '#94a3b8', pill: 'bg-slate-100 text-slate-700' }
  // sent
  if (inv.is_overdue) return { label: 'Overdue', stripe: '#f43f5e', pill: 'bg-rose-100 text-rose-700' }
  if (inv.money.amount_paid_cents > 0 && inv.money.balance_due_cents > 0) {
    return { label: 'Partial', stripe: '#f59e0b', pill: 'bg-amber-100 text-amber-800' }
  }
  return { label: 'Sent', stripe: '#3b82f6', pill: 'bg-blue-100 text-blue-800' }
}

function inBucket(inv: Invoice, bucket: InvoiceBucket): boolean {
  switch (bucket) {
    case 'all': return true
    case 'draft': return inv.status === 'draft'
    case 'sent': return inv.status === 'sent'
    case 'overdue': return inv.status === 'sent' && inv.is_overdue
    case 'paid': return inv.status === 'paid'
  }
}

// ---------- Next-step hint (List Workflow Slice 3) ----------
// Read-only "what to do next". Not clickable yet (phase 2). Null when the

function invoiceServerFilters(bucket: InvoiceBucket, search: string): InvoiceListParams {
  const filters: InvoiceListParams = { q: search.trim() || undefined }
  if (bucket === 'overdue') return { ...filters, overdue: true }
  if (bucket !== 'all') filters.status = bucket as InvoiceStatus

  return filters
}
// invoice is settled (paid/cancelled) or has nothing outstanding.
type NextStepTone = 'sky' | 'amber' | 'rose'
const NEXT_STEP_TONE: Record<NextStepTone, string> = {
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-700',
}

function invoiceNextStep(inv: Invoice): { label: string; tone: NextStepTone } | null {
  if (inv.status === 'draft') return { label: 'Send', tone: 'sky' }
  if (inv.status === 'paid' || inv.status === 'cancelled') return null
  // sent with an outstanding balance — collect it (rose if past due).
  if (inv.money.balance_due_cents > 0) {
    return { label: 'Record payment', tone: inv.is_overdue ? 'rose' : 'amber' }
  }
  return null
}

function NextStepHint({
  inv,
  onTakePayment,
}: {
  inv: Invoice
  onTakePayment: (inv: Invoice) => void
}) {
  const navigate = useNavigate()
  const step = invoiceNextStep(inv)
  if (!step) return null

  // Taking payment happens HERE rather than on the detail page. It was a
  // deep-link into ?action=payment, which worked but cost a page load out and
  // a click back for every invoice — and collecting is usually the reason the
  // list is open in the first place. Send still goes to the detail surface,
  // since that is where the rest of that decision lives.
  const isPayment = step.label === 'Record payment'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (isPayment) onTakePayment(inv)
        else navigate(`/invoices/${inv.id}`)
      }}
      className={
        isPayment
          ? 'inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700'
          : `inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium hover:brightness-95 ${NEXT_STEP_TONE[step.tone]}`
      }
      title={isPayment ? 'Take a payment on this invoice' : 'Go to the next step'}
    >
      {isPayment ? `Take payment · ${fmtCents(inv.money.balance_due_cents)}` : `→ ${step.label}`}
    </button>
  )
}

export function InvoicesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)
  const [bucket, setBucket] = useState<InvoiceBucket>('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<InvoiceView>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('crewbarn:invoice-view') === 'files'
      ? 'files'
      : 'cards',
  )
  const [selectedYear, setSelectedYear] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  const { data, isLoading } = useInvoices({ per_page: 200 })
  const all = useMemo(() => data ?? [], [data])

  const serverFilters = useMemo(
    () => invoiceServerFilters(bucket, search),
    [bucket, search],
  )
  const filingSummary = useInvoiceFilingSummary(serverFilters, { enabled: view === 'files' })
  const filedInvoices = useInvoices(
    {
      ...serverFilters,
      filing_year: selectedYear ? Number(selectedYear) : undefined,
      filing_month: selectedMonth ? Number(selectedMonth) : undefined,
      per_page: 200,
    },
    { enabled: view === 'files' && selectedYear !== null && selectedMonth !== null },
  )

  // Changing the SEARCH still drops you back to the top of the cabinet: the
  // folder you were in may not contain any hits. Changing the TAB no longer
  // does — the tabs now describe the open folder, so throwing the folder away
  // would undo the selection the counts are about.
  useEffect(() => {
    setSelectedYear(null)
    setSelectedMonth(null)
  }, [search])

  // Counts follow whatever is open: all invoices, one year, or one month.
  const statusCounts = useInvoiceStatusCounts({
    q: search.trim() || undefined,
    filing_year: view === 'files' && selectedYear ? Number(selectedYear) : undefined,
    filing_month: view === 'files' && selectedMonth ? Number(selectedMonth) : undefined,
  })

  const selectView = (nextView: InvoiceView) => {
    setView(nextView)
    window.localStorage.setItem('crewbarn:invoice-view', nextView)
  }
  // Search-filtered set (independent of the active tab) — drives both the
  // visible rows and the per-tab counts so the badges reflect the search but
  // don't move when you switch tabs. Counts are client-side over the fetched
  // page (per_page 200); a tenant with more open invoices than that would
  // undercount — the same ceiling the list itself already has.
  const searched = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return all
    return all.filter(
      (inv) =>
        inv.display_number?.toLowerCase().includes(term) ||
        (inv.customer?.display_name ?? '').toLowerCase().includes(term),
    )
  }, [all, search])

  const cardItems = useMemo(
    () => searched.filter((inv) => inBucket(inv, bucket)),
    [searched, bucket],
  )
  const items = view === 'files' ? filedInvoices.data ?? [] : cardItems
  const itemsLoading = view === 'files' ? filedInvoices.isLoading : isLoading
  const folderIsOpen = view === 'files' && selectedYear !== null && selectedMonth !== null
  const showInvoiceCards = view === 'cards' || folderIsOpen

  // Server-counted. These used to be tallied in the browser over the first 200
  // rows, so on a tenant with thousands of invoices "All" read 200 — the page
  // size, shown as a total — and stayed there when a folder was opened. The
  // client set is still the fallback while the count is in flight, so the tabs
  // never flash empty.
  const tabCounts = useMemo<Record<string, number>>(
    () =>
      (statusCounts.data as Record<string, number> | undefined) ?? {
        all: searched.length,
        draft: searched.filter((i) => inBucket(i, 'draft')).length,
        sent: searched.filter((i) => inBucket(i, 'sent')).length,
        overdue: searched.filter((i) => inBucket(i, 'overdue')).length,
        paid: searched.filter((i) => inBucket(i, 'paid')).length,
      },
    [statusCounts.data, searched],
  )

  return (
    <div className="mx-auto w-full max-w-none px-4 py-4 sm:px-6 sm:py-6 2xl:px-8">
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Invoices</h1>
      </div>

      {/* Workflow tabs — live counts derived client-side from the fetched set. */}
      <WorkflowTabs
        tabs={INVOICE_TABS.map((t) => ({ ...t, count: tabCounts[t.key] ?? 0 }))}
        active={bucket}
        onChange={(k) => setBucket(k as InvoiceBucket)}
      />

      {/* Search */}
      <div className="flex items-center gap-2 sm:gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by invoice # or customer..."
          className="flex-1 min-w-[180px] sm:max-w-md px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        />
        <div className="ml-auto inline-flex shrink-0 overflow-hidden rounded-md border border-slate-300 bg-white">
          <button
            type="button"
            onClick={() => selectView('cards')}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              view === 'cards' ? 'bg-amber-500 text-white' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            Cards
          </button>
          <button
            type="button"
            onClick={() => selectView('files')}
            className={`border-l border-slate-300 px-4 py-2 text-sm font-semibold transition-colors ${
              view === 'files' ? 'bg-amber-500 text-white' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            Files
          </button>
        </div>
      </div>

      {view === 'files' ? (
        <InvoiceFilingNavigation
          summary={filingSummary.data}
          isLoading={filingSummary.isLoading}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onSelectYear={(year) => {
            setSelectedYear(year)
            setSelectedMonth(null)
          }}
          onSelectMonth={setSelectedMonth}
        />
      ) : null}

      <div className={showInvoiceCards ? '' : 'hidden'}>
        {itemsLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-500">
            {search || bucket !== 'all' ? 'No invoices match your filters.' : 'No invoices yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((inv) => {
              const state = invoiceState(inv)
              const balance = inv.money.balance_due_cents
              return (
                <div
                  key={inv.id}
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/invoices/${inv.id}`)
                    }
                  }}
                  className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <span className="absolute inset-x-0 top-0 h-1" style={{ background: state.stripe }} aria-hidden />

                  <div className="flex items-start justify-between gap-3 pt-1">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-slate-400">{inv.display_number}</div>
                      <div className="mt-1 truncate text-base font-semibold text-slate-900">
                        {inv.customer?.display_name ?? 'No customer'}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${state.pill}`}>
                      {state.label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total</div>
                      <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
                        {fmtCents(inv.money.total_cents)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Balance</div>
                      <div
                        className={[
                          'mt-1 font-mono text-lg font-semibold tabular-nums',
                          balance > 0 ? 'text-rose-600' : inv.status === 'paid' ? 'text-emerald-700' : 'text-slate-400',
                        ].join(' ')}
                      >
                        {balance > 0 ? fmtCents(balance) : inv.status === 'paid' ? 'Paid' : '$0.00'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1 text-sm text-slate-600">
                    <div>
                      <span className="font-medium text-slate-700">Job:</span>{' '}
                      {inv.work_order?.display_number ?? 'No job attached'}
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Date:</span>{' '}
                      {inv.due_at ? (
                        <span className={inv.is_overdue ? 'font-medium text-rose-600' : ''}>
                          Due {fmtDate(inv.due_at)}
                        </span>
                      ) : inv.issued_at ? (
                        <>Issued {fmtDate(inv.issued_at)}</>
                      ) : (
                        <span className="text-slate-400">No due date</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <NextStepHint inv={inv} onTakePayment={setPayingInvoice} />
                    <span className="text-xs font-semibold text-amber-700 opacity-0 transition-opacity group-hover:opacity-100">
                      Open invoice
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {payingInvoice && (
        <RecordPaymentModal
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onSaved={() => {
            setPayingInvoice(null)
            // The list, the bucket counts and the folder totals all move when
            // money lands, and they are separate queries under one key root —
            // so invalidate the root rather than guessing at each.
            void queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
          }}
        />
      )}
    </div>
  )
}
interface InvoiceFilingNavigationProps {
  summary?: {
    years: Record<string, InvoiceFilingSummaryEntry>
    months: Record<string, Record<string, InvoiceFilingSummaryEntry>>
  }
  isLoading: boolean
  selectedYear: string | null
  selectedMonth: string | null
  onSelectYear: (year: string) => void
  onSelectMonth: (month: string) => void
}

function InvoiceFilingNavigation({
  summary,
  isLoading,
  selectedYear,
  selectedMonth,
  onSelectYear,
  onSelectMonth,
}: InvoiceFilingNavigationProps) {
  if (isLoading && !summary) {
    return (
      <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-slate-500">
        Loading invoice folders...
      </div>
    )
  }

  const years = Object.entries(summary?.years ?? {}).sort(([left], [right]) => Number(right) - Number(left))
  const monthSummaries = selectedYear ? summary?.months[selectedYear] ?? {} : {}
  const months = Object.entries(monthSummaries).sort(([left], [right]) => Number(left) - Number(right))
  const selectedMonthLabel = selectedMonth ? MONTHS[Number(selectedMonth) - 1] : null

  if (years.length === 0) {
    return (
      <div className="mb-4 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-slate-500">
        No invoice folders match these filters.
      </div>
    )
  }

  return (
    <div className="mb-4 space-y-4">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {years.map(([year, totals]) => (
          <InvoiceFolderButton
            key={year}
            label={year}
            summary={totals}
            isOpen={selectedYear === year}
            onClick={() => onSelectYear(year)}
          />
        ))}
      </div>

      {selectedYear ? (
        <section className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
          <div className="flex items-center justify-between gap-4 bg-slate-900 px-5 py-4 text-white">
            <div>
              <div className="text-xs font-semibold uppercase text-amber-400">
                All years / {selectedYear}
              </div>
              <h2 className="mt-1 text-xl font-semibold">
                {selectedMonthLabel ? `${selectedMonthLabel} ${selectedYear}` : selectedYear}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onSelectYear(selectedYear)}
              className="rounded-md border border-slate-600 px-3 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              {selectedMonth ? 'Back to months' : 'Year open'}
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto p-4">
            {months.map(([month, totals]) => (
              <InvoiceFolderButton
                key={month}
                label={MONTHS[Number(month) - 1] ?? month}
                summary={totals}
                isOpen={selectedMonth === month}
                onClick={() => onSelectMonth(month)}
                compact
              />
            ))}
          </div>

          {!selectedMonth ? (
            <div className="mx-4 mb-4 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-slate-500">
              Select a month folder to view its invoices.
            </div>
          ) : null}
        </section>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-slate-500">
          Select a year folder to view its month folders.
        </div>
      )}
    </div>
  )
}

interface InvoiceFolderButtonProps {
  label: string
  summary: InvoiceFilingSummaryEntry
  isOpen: boolean
  onClick: () => void
  compact?: boolean
}

function InvoiceFolderButton({
  label,
  summary,
  isOpen,
  onClick,
  compact = false,
}: InvoiceFolderButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isOpen}
      className={`relative shrink-0 border bg-white p-4 text-left shadow-sm transition-colors before:absolute before:-top-3 before:left-0 before:h-3 before:w-24 before:rounded-t-md before:bg-slate-900 hover:border-amber-400 ${
        compact ? 'w-64' : 'w-64'
      } ${
        isOpen
          ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500 ring-offset-2 before:bg-amber-500'
          : 'border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-lg font-semibold text-slate-900">{label}</span>
        {isOpen ? <span className="text-sm font-semibold text-amber-700">Open</span> : null}
      </div>
      <div className="mt-7 text-sm font-semibold text-slate-600">
        {summary.count.toLocaleString()} {summary.count === 1 ? 'invoice' : 'invoices'}
      </div>
      <div className="mt-3 border-t border-slate-200 pt-3 text-xs font-semibold uppercase">
        <div className="flex items-center justify-between gap-4 text-emerald-700">
          <span>Total</span>
          <span className="font-mono tabular-nums">{fmtCents(summary.total_cents)}</span>
        </div>
        <div className={`mt-1 flex items-center justify-between gap-4 ${
          summary.outstanding_cents > 0 ? 'text-rose-600' : 'text-slate-500'
        }`}>
          <span>Outstanding</span>
          <span className="font-mono tabular-nums">{fmtCents(summary.outstanding_cents)}</span>
        </div>
      </div>
    </button>
  )
}
