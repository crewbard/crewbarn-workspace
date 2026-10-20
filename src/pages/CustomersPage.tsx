import { useEffect, useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useRememberRecordList } from '@/hooks/useShortcuts'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCustomers } from '@/hooks/useCustomers'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/Avatar'
import { Input } from '@/components/ui/Input'
import { WorkflowTabs } from '@/components/lists/WorkflowTabs'
import { RowChevron } from '@/components/lists/RowChevron'
import { useTheme, type FolderLayout } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'
import { FolderBrowser, type FolderNode } from '@/components/FolderBrowser'
import { FolderLayoutSwitch } from '@/components/FolderLayoutSwitch'
import type { Customer, CustomerType } from '@/types/customer'
import { CustomerTagDot } from '@/components/customers/CustomerTagDot'
import { Modal } from '@/components/ui/Modal'

// Type-based workflow tabs and a separate server-backed Outstanding toggle.
const CUSTOMER_TABS: Array<{ key: '' | CustomerType; label: string }> = [
  { key: '', label: 'All' },
  { key: 'residential', label: 'Residential' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'government', label: 'Government' },
]

const CUSTOMER_FILE_LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]

type CustomerDateFilter = 'all' | '30-days' | 'never'
type CustomerSort = 'name-asc' | 'name-desc' | 'last-contact'

function customerPageView(customers: Customer[], dateFilter: CustomerDateFilter, sort: CustomerSort) {
  const cutoff = Date.now() - 30 * 86_400_000
  return customers.filter((customer) => dateFilter === 'all'
    || (dateFilter === 'never' ? !customer.last_contact_at : Boolean(customer.last_contact_at && new Date(customer.last_contact_at).getTime() >= cutoff)))
    .sort((a, b) => sort === 'last-contact'
      ? (b.last_contact_at ? new Date(b.last_contact_at).getTime() : 0) - (a.last_contact_at ? new Date(a.last_contact_at).getTime() : 0)
      : a.display_name.localeCompare(b.display_name) * (sort === 'name-desc' ? -1 : 1))
}

/** Compact "8 days ago" / "Never contacted" relative time for the row. */
function relativeTime(iso: string | null): string {
  if (!iso) return 'Never contacted'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} mo ago`
  return `${Math.floor(days / 365)} yr ago`
}

function formatCustomerCurrency(cents: number | null) {
  if (cents === null || cents === 0) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

/**
 * Left accent stripe color — the dominant signal for the row.
 * warning/do-not-call > VIP/priority > standing relationship > quiet.
 */
function customerStripe(c: Customer): string {
  const tags = c.tags ?? []
  if (tags.includes('warning') || tags.includes('do-not-call')) return '#f43f5e' // rose-500
  if (c.vip || tags.includes('priority')) return '#f59e0b'                        // amber-500
  if (c.service_agreement || tags.includes('recurring')) return '#14b8a6'         // teal-500
  return '#e2e8f0'                                                                // slate-200 (quiet)
}

/**
 * Slice-2 activity chips — open jobs / pending quotes / unpaid invoices.
 * Only renders the non-zero counts; nothing when the customer is quiet.
 * Counts come from the index endpoint's withCount aggregates.
 */
function CustomerActivityChips({ c }: { c: Customer }) {
  const open = c.responsible_open_jobs ?? c.open_jobs_count ?? 0
  const quotes = c.pending_estimates_count ?? 0
  const unpaid = c.responsible_unpaid_count ?? c.unpaid_invoices_count ?? 0
  const unpaidCents = c.responsible_unpaid_cents ?? 0
  if (open === 0 && quotes === 0 && unpaid === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {open > 0 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-sky-100 text-sky-700 font-medium">
          {open} open {open === 1 ? 'job' : 'jobs'}
        </span>
      )}
      {quotes > 0 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-violet-100 text-violet-700 font-medium">
          {quotes} pending {quotes === 1 ? 'quote' : 'quotes'}
        </span>
      )}
      {unpaid > 0 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-700 font-medium">
          {unpaid} unpaid {unpaid === 1 ? 'invoice' : 'invoices'}
          {unpaidCents > 0 && <> · {formatCustomerCurrency(unpaidCents)}</>}
        </span>
      )}
    </div>
  )
}


function CustomerCard({
  customer,
  onOpen,
  onPreview,
  tour,
}: {
  customer: Customer
  onOpen: (id: string) => void
  onPreview: (customer: Customer) => void
  /** Tutorial marker for a card that opens the customer's page. */
  tour?: string
}) {
  const lifetimeCents = lifetimePaidCents(customer)
  const hasValue = lifetimeCents > 0

  return (
    <article className="flex h-full min-h-[210px] min-w-0 flex-col overflow-hidden rounded-lg border border-navy-100 bg-white shadow-sm transition-colors hover:border-amber-300">
    <button
      type="button"
      data-tour={tour}
      onClick={() => onOpen(customer.id)}
      className="group flex w-full flex-1 flex-col text-left transition-colors hover:bg-amber-50/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500"
    >
      <span className="block h-1" style={{ background: customerStripe(customer) }} aria-hidden />
      <div className="flex w-full flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Avatar name={customer.display_name} colorKey={customer.id} preset={customer.avatar_preset} imageUrl={customer.avatar_url} size={32} className="shrink-0" />
              <span className="truncate text-base font-semibold text-navy-900">
                {customer.display_name}
              </span>
              {customer.vip && (
                <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  VIP
                </span>
              )}
              {(customer.tags ?? []).includes('warning') && (
                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                  Warning
                </span>
              )}
            </div>
            <div className="mt-1 truncate text-xs text-navy-500">
              <span className="capitalize">{customer.customer_type}</span>
              {customer.industry && <> · {customer.industry}</>}
              {customer.account_number && (
                <span className="font-mono"> · #{customer.account_number}</span>
              )}
            </div>
          </div>
          <RowChevron />
        </div>

        <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
          <div className="rounded-md bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Lifetime paid
            </div>
            <div className="mt-1 font-mono text-sm font-semibold text-navy-900">
              {hasValue ? formatCustomerCurrency(lifetimeCents) : 'No paid work'}
            </div>
          </div>
          <div className="rounded-md bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Last touch
            </div>
            <div className="mt-1 text-sm font-semibold text-navy-900">
              {relativeTime(customer.last_contact_at)}
            </div>
          </div>
        </div>

        <CustomerActivityChips c={customer} />
      </div>
    </button>
    <div className="flex min-h-11 items-center justify-between gap-3 border-t border-navy-100 px-4 py-2 text-sm">
      <button type="button" onClick={() => onPreview(customer)} className="font-medium text-slate-600 underline underline-offset-2 hover:text-amber-800" aria-label={`Quick Peek at ${customer.display_name}`}>Quick Peek</button>
      <Link to={`/customers/${customer.id}`} className="font-semibold text-amber-800 hover:underline">Open account →</Link>
    </div>
    </article>
  )
}

/**
 * One A–Z folder's customers, fetched on open (mirrors the page's per-letter
 * lazy load). Rendered by FolderBrowser for whichever folder(s) are open, so
 * it works across Cabinet / Tree / Accordion without loading every letter.
 */
function CustomerFolderContents({
  letter,
  customerType,
  outstanding,
  search,
  display,
  onOpen,
  onPreview,
  dateFilter,
  sort,
}: {
  letter: string
  customerType: CustomerType | ''
  outstanding: boolean
  search: string
  display: 'grid' | 'list'
  onOpen: (id: string) => void
  onPreview: (customer: Customer) => void
  dateFilter: CustomerDateFilter
  sort: CustomerSort
}) {
  // Page within the open folder — 50 at a time with a Next button, so opening
  // a big letter (A, S…) doesn't pull the whole letter at once.
  const [page, setPage] = useState(1)
  // Search / type can change while a folder stays open; snap back to page 1 so
  // we never sit past the last page.
  useEffect(() => { setPage(1) }, [letter, customerType, outstanding, search])

  const { data, isFetching, isError, refetch } = useCustomers({
    filing_letter: letter,
    customer_type: customerType || undefined,
    outstanding: outstanding || undefined,
    q: search || undefined,
    sort: 'display_name',
    direction: 'asc',
    page,
    per_page: 50,
  })
  const customers = customerPageView(data?.data ?? [], dateFilter, sort)
  const meta = data?.meta
  // Cap at 4 cards per row; step down on narrower widths.
  const gridClass = 'grid auto-rows-fr gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

  if (isError) {
    return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">This customer folder could not be loaded. <button type="button" className="underline" onClick={() => refetch()}>Try again</button></div>
  }
  if (isFetching && customers.length === 0) {
    return (
      <div className={display === 'list' ? 'space-y-2.5' : gridClass}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-lg bg-white" />)}
      </div>
    )
  }
  if ((data?.data.length ?? 0) === 0) {
    return <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">No customers filed under {letter}.</div>
  }

  const cards = customers.map((c) => <CustomerCard key={c.id} customer={c} onOpen={onOpen} onPreview={onPreview} tour="customers-row" />)
  return (
    <div>
      {customers.length === 0 && <p className="mb-4 text-sm text-slate-500">No customers on this folder page match the last-contact filter. Try another page or choose Any date.</p>}
      {display === 'list'
        ? <div className="space-y-2.5">{cards}</div>
        : <div className={gridClass}>{cards}</div>}
      {meta && meta.last_page > 1 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="text-sm text-slate-500">
            Showing {meta.from}–{meta.to} of {meta.total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
            >
              Previous
            </Button>
            <span className="px-2 text-sm text-slate-600">
              Page {meta.current_page} of {meta.last_page}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              disabled={page >= meta.last_page || isFetching}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function DesktopCustomerCards({
  customers,
  onOpen,
  onPreview,
  filingView,
  filingCounts,
  folderLayout,
  customerType,
  outstanding,
  search,
  dateFilter,
  sort,
}: {
  customers: Customer[]
  onOpen: (id: string) => void
  onPreview: (customer: Customer) => void
  filingView: boolean
  filingCounts: Record<string, number>
  folderLayout: FolderLayout
  customerType: CustomerType | ''
  outstanding: boolean
  search: string
  dateFilter: CustomerDateFilter
  sort: CustomerSort
}) {
  if (!filingView) {
    return (
      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {customers.map((customer) => (
          <CustomerCard key={customer.id} customer={customer} onOpen={onOpen} onPreview={onPreview} tour="customers-row" />
        ))}
      </div>
    )
  }

  // A–Z folders with content; each opens its own lazy fetch (see
  // CustomerFolderContents). Teal tab — the customer accent.
  const folders: FolderNode[] = CUSTOMER_FILE_LETTERS
    .filter((letter) => (filingCounts[letter] ?? 0) > 0)
    .map((letter) => ({
      key: letter,
      label: letter,
      count: filingCounts[letter] ?? 0,
      tab: '#0F766E',
      render: (display) => (
        <CustomerFolderContents letter={letter} customerType={customerType} outstanding={outstanding} search={search} display={display} onOpen={onOpen} onPreview={onPreview} dateFilter={dateFilter} sort={sort} />
      ),
    }))

  return (
    <div className="min-w-0">
      <FolderBrowser folders={folders} layout={folderLayout} countNoun="customer" emptyFolderText="No customers filed here." />
    </div>
  )
}
/** Lifetime paid: what this account has paid (incl. sub-accounts it pays
 *  for). Same meaning as "Lifetime paid" on the customer account page. */
function lifetimePaidCents(customer: Customer): number {
  return customer.responsible_paid_cents ?? customer.lifetime_value_cents ?? 0
}

export function CustomersPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { theme, customerView, setCustomerView, density, folderLayout, setFolderLayout } = useTheme()
  const { has } = usePermissions()
  const canCreate = has('customers.edit')
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const [preview, setPreview] = useState<Customer | null>(null)
  // Filter / search / sort state
  const [search, setSearch] = useState(() => searchParams.get('q')?.trim() ?? '')
  const [typeFilter, setTypeFilter] = useState<CustomerType | ''>('')
  const [outstanding, setOutstanding] = useState(false)
  const [dateFilter, setDateFilter] = useState<CustomerDateFilter>('all')
  const [sort, setSort] = useState<CustomerSort>('name-asc')
  const [page, setPage] = useState(1)
  const perPage = 25
  const filingView = customerView === 'files'
  const { data, isLoading, isFetching, isError, error, refetch } = useCustomers({
    q: search || undefined,
    customer_type: typeFilter || undefined,
    outstanding: outstanding || undefined,
    // The main query supplies the A–Z counts; each open folder fetches its own
    // letter (CustomerFolderContents), so no letter is pinned here.
    filing_letter: undefined,
    sort: 'display_name',
    direction: 'asc',
    page,
    per_page: perPage,
  })

  const desktopRowPad = density === 'dense' ? 'px-4 py-2' : density === 'compact' ? 'px-4 py-2.5' : 'px-4 py-3'
  const visibleCustomers = customerPageView(data?.data ?? [], dateFilter, sort)
  // [ and ] on a customer step through this list, in this order.
  useRememberRecordList('customers', visibleCustomers)
  const directoryTotal = filingView && data?.filing_counts
    ? Object.values(data.filing_counts).reduce((total, count) => total + count, 0)
    : data?.meta?.total

  return (
    <div className="min-h-screen bg-background">
      {/* Slice 13c polish: removed local TopBar — global TopBar from
          AppLayout already wraps every authenticated page. */}

      {/* Page content */}
      <main data-focus-page="customers" className={`mx-auto px-3 sm:px-6 py-4 sm:py-8 ${easy ? 'w-full' : filingView ? 'max-w-[1760px]' : 'max-w-7xl'}`}>
        {/* Page header */}
        {easy ? <div data-tour="customers-header"><EasyPageHeading title="Customers" description="Find the people and businesses you work with. Open a customer to see their jobs, locations, conversations, and billing." actions={canCreate ? <Link to="/customers/new"><Button data-tour="customers-new">+ New customer</Button></Link> : undefined} /></div> : <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
          <div className="min-w-0" data-tour="customers-header">
            <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Customers</h1>
            <p className="text-sm text-navy-500 mt-1">
              {directoryTotal !== undefined
                ? directoryTotal.toLocaleString() + ' ' + (directoryTotal === 1 ? 'customer' : 'customers')
                : 'Loading...'}
            </p>
          </div>
          {canCreate && (
            <Link to="/customers/new" className="shrink-0">
              <Button data-tour="customers-new">+ New</Button>
            </Link>
          )}
        </div>}
        {easy && !isError && directoryTotal !== undefined && <p className="mb-4 text-sm text-slate-500">{directoryTotal.toLocaleString()} {directoryTotal === 1 ? 'customer' : 'customers'}</p>}

        {/* Workflow tabs — faster than a dropdown, makes the page feel alive.
            Live counts (by type) come from the index endpoint's tab_counts. */}
        <div data-tour="customers-type-tabs">
        <WorkflowTabs
          tabs={CUSTOMER_TABS.map((t) => ({
            ...t,
            count: !isError && data?.tab_counts
              ? data.tab_counts[t.key === '' ? 'all' : t.key] ?? 0
              : undefined,
          }))}
          active={typeFilter}
          onChange={(key) => {
            setTypeFilter(key as CustomerType | '')
            setPage(1)
          }}
        />
        </div>

        {/* Search bar */}
        <div data-easy-list-toolbar data-tour="customers-search" className="bg-white rounded-lg border border-navy-100 p-4 mb-6 flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Input
              type="search"
              placeholder="Search by name, email, phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <button
            type="button"
            aria-pressed={outstanding}
            title="Show customers with an unpaid invoice balance, including work billed to their account"
            onClick={() => { setOutstanding((current) => !current); setPage(1) }}
            className={'h-10 shrink-0 rounded-md border px-4 text-sm font-semibold transition-colors ' + (outstanding
              ? 'border-amber-500 bg-amber-50 text-amber-900'
              : 'border-navy-200 bg-white text-navy-700 hover:border-amber-400 hover:bg-amber-50')}
          >Outstanding only</button>
          <label className="flex flex-col gap-1 text-xs text-navy-600">Last contact · current page
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as CustomerDateFilter)} className="h-10 rounded-md border border-navy-200 bg-white px-3 text-sm">
              <option value="all">Any date</option><option value="30-days">Past 30 days</option><option value="never">Never contacted</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-navy-600">Sort · current page
            <select value={sort} onChange={(e) => setSort(e.target.value as CustomerSort)} className="h-10 rounded-md border border-navy-200 bg-white px-3 text-sm">
              <option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="last-contact">Last contact · newest</option>
            </select>
          </label>
            <div
              className="inline-flex h-10 shrink-0 overflow-hidden rounded-md border border-navy-200 bg-slate-50"
              role="group"
              aria-label="Customer view"
              data-tour="customers-view-switch"
            >
              <button
                type="button"
                onClick={() => setCustomerView('compact')}
                className={'px-4 text-sm font-semibold transition-colors ' + (
                  customerView === 'compact' || customerView === 'relationship'
                    ? 'bg-navy-800 text-white'
                    : 'text-navy-600 hover:bg-white hover:text-navy-900'
                )}
                aria-pressed={customerView === 'compact' || customerView === 'relationship'}
                data-easy-view-option
              >Rows</button>
              <button
                type="button"
                onClick={() => {
                  setCustomerView('cards')
                }}
                className={'px-4 text-sm font-semibold transition-colors ' + (
                  customerView === 'cards' && !filingView
                    ? 'bg-navy-800 text-white'
                    : 'text-navy-600 hover:bg-white hover:text-navy-900'
                )}
                aria-pressed={customerView === 'cards' && !filingView}
                data-easy-view-option
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomerView('files')
                }}
                className={'border-l border-navy-200 px-4 text-sm font-semibold transition-colors ' + (
                  filingView
                    ? 'bg-amber-500 text-white'
                    : 'text-navy-600 hover:bg-white hover:text-navy-900'
                )}
                aria-pressed={filingView}
                data-easy-view-option
              >
                Files
              </button>
            </div>
            <div data-tour="customers-folder-layout" className="flex items-center">
              <FolderLayoutSwitch value={folderLayout} onChange={(layout) => {
                setFolderLayout(layout)
                setCustomerView('files')
                setPage(1)
              }} />
            </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div role="status" className="cb-loading-region border border-navy-100 text-center">
            Loading customers...
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-danger">
            Failed to load customers: {(error as Error)?.message ?? 'Unknown error'}
            <button type="button" className="ml-3 underline" onClick={() => refetch()}>Try again</button>
          </div>
        )}

        {/* Empty state */}
        {!isError && data && data.data.length === 0 && (
          <div data-tour="customers-empty" data-empty-reason={search || typeFilter || outstanding ? 'filtered' : 'none'} className="bg-white rounded-lg border border-navy-100 p-12 text-center">
            <p className="text-navy-500 mb-4">
              {search || typeFilter || outstanding
                ? 'No customers match your filters.'
                : canCreate ? 'No customers yet. Create your first one.' : 'No customers yet.'}
            </p>
            {!search && !typeFilter && !outstanding && canCreate && (
              <Link to="/customers/new">
                <Button>+ New customer</Button>
              </Link>
            )}
          </div>
        )}

        <div data-tour="customers-list" hidden={isError}>
        {!filingView && !isError && data && data.data.length > 0 && visibleCustomers.length === 0 && <p className="rounded-lg border border-navy-100 bg-white p-6 text-sm text-slate-500">No customers on this page match the last-contact filter. Try another page or choose Any date.</p>}
        {/* Mobile cards — single tappable block per customer. Lifetime
            value gets a prominent right-side number; type/industry +
            last-contact stack as a meta line. */}
        {data && data.data.length > 0 && customerView !== 'cards' && !filingView && (
          <div className="md:hidden space-y-2">
            {visibleCustomers.map((customer) => (
              <article key={customer.id} className="space-y-2">
              <Link
                to={`/customers/${customer.id}`}
                data-tour="customers-row"
                className="block rounded-lg border border-navy-100 bg-white p-3 hover:border-amber-300 hover:bg-amber-50/30 active:bg-amber-50/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-navy-800 break-words">
                        {customer.display_name}
                      </span>
                      {customer.vip && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-500 text-white font-semibold">
                          VIP
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-navy-500 mt-0.5 capitalize">
                      {customer.customer_type}
                      {customer.account_number && (
                        <span className="font-mono ml-1">
                          · #{customer.account_number}
                        </span>
                      )}
                      {customer.industry && (
                        <span className="ml-1">· {customer.industry}</span>
                      )}
                    </div>
                    {customer.tags && customer.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {customer.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200"
                          >
                            <CustomerTagDot name={tag} />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <CustomerActivityChips c={customer} />
                  </div>
                  <div className="text-right shrink-0">
                    {lifetimePaidCents(customer) > 0 ? (
                      <>
                        <div className="font-mono text-sm font-semibold text-navy-800">
                          {formatCustomerCurrency(lifetimePaidCents(customer))}
                        </div>
                        <div className="text-[10px] uppercase text-navy-400 tracking-wide">
                          lifetime paid
                        </div>
                      </>
                    ) : (
                      <div className="text-[11px] text-navy-400">No paid work yet</div>
                    )}
                    <div className="text-[11px] text-navy-500 mt-1">
                      {customer.last_contact_at
                        ? relativeTime(customer.last_contact_at)
                        : 'Never contacted'}
                    </div>
                  </div>
                </div>
              </Link>
              <button type="button" onClick={() => setPreview(customer)} className="px-3 text-sm text-slate-600 underline" aria-label={`Quick Peek at ${customer.display_name}`}>Quick Peek</button>
              </article>
            ))}
          </div>
        )}

        {data && data.data.length > 0 && (customerView === 'cards' || customerView === 'files') && (
          <DesktopCustomerCards
            customers={visibleCustomers}
            onOpen={(id) => navigate(`/customers/${id}`)}
            onPreview={setPreview}
            filingView={filingView}
            filingCounts={data.filing_counts ?? {}}
            folderLayout={folderLayout}
            customerType={typeFilter}
            outstanding={outstanding}
            search={search}
            dateFilter={dateFilter}
            sort={sort}
          />
        )}

        {/* Desktop — clickable relationship rows (table/card hybrid). */}
        {data && data.data.length > 0 && customerView !== 'cards' && customerView !== 'files' && (
          <div className="hidden md:block bg-white rounded-lg border border-navy-100 overflow-hidden divide-y divide-navy-100">
            {visibleCustomers.map((customer) => {
              const hasValue = lifetimePaidCents(customer) > 0
              return (
                <div
                  key={customer.id}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/customers/${customer.id}`)
                    }
                  }}
                  role="link"
                  tabIndex={0}
                  data-tour="customers-row"
                  className="group flex items-stretch cursor-pointer hover:bg-amber-50/40 focus:outline-none focus:bg-amber-50/60 transition-colors"
                >
                  {/* Left priority/health stripe */}
                  <span className="w-1 shrink-0" style={{ background: customerStripe(customer) }} aria-hidden />

                  <div className={`flex-1 min-w-0 flex items-center gap-4 ${desktopRowPad}`}>
                    {/* Primary + secondary */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-navy-800 truncate">{customer.display_name}</span>
                        {customer.vip && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-500 text-white font-semibold">VIP</span>
                        )}
                        {(customer.tags ?? []).includes('warning') && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-700 font-semibold">Warning</span>
                        )}
                        {(customer.tags ?? []).includes('do-not-call') && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-700 font-semibold">Do not call</span>
                        )}
                        {(customer.tags ?? []).includes('recurring') && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border border-teal-300 text-teal-700">Recurring</span>
                        )}
                        {(customer.tags ?? []).includes('referred') && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border border-amber-300 text-amber-700">Referred</span>
                        )}
                      </div>
                      {(customerView !== 'compact' || theme === 'focus') && (
                        <>
                          <div className="text-xs text-navy-500 mt-0.5 truncate">
                            <span className="capitalize">{customer.customer_type}</span>
                            {customer.industry && <> · {customer.industry}</>}
                            {customer.account_number && (
                              <span className="font-mono"> · #{customer.account_number}</span>
                            )}
                          </div>
                          <CustomerActivityChips c={customer} />
                        </>
                      )}
                    </div>

                    {/* Value + last touch */}
                    <div className="text-right shrink-0 w-48">
                      {hasValue ? (
                        <div className="font-mono text-sm font-semibold text-navy-800" title="Lifetime paid">
                          {formatCustomerCurrency(lifetimePaidCents(customer))}
                        </div>
                      ) : (
                        <div className="text-xs text-navy-400">No paid work yet</div>
                      )}
                      <div className="text-[11px] text-navy-500 mt-0.5">
                        {customer.last_contact_at
                          ? `Last touch: ${relativeTime(customer.last_contact_at)}`
                          : 'Never contacted'}
                      </div>
                    </div>

                    <button type="button" onClick={(e) => { e.stopPropagation(); setPreview(customer) }} className="shrink-0 text-sm text-slate-600 underline" aria-label={`Quick Peek at ${customer.display_name}`}>Quick Peek</button>
                    {/* Chevron */}
                    <RowChevron />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        </div>
        {!isError && data && !filingView && data.meta.last_page > 1 && (
          <div data-easy-pager data-tour="customers-pager" className="flex flex-wrap items-center justify-between gap-3 mt-6 px-1">
            <div className="text-sm text-navy-500">
              Showing {data.meta.from}–{data.meta.to} of {data.meta.total}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={isFetching || page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-navy-600 px-2">
                Page {data.meta.current_page} of {data.meta.last_page}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.meta.last_page, p + 1))}
                disabled={isFetching || page >= data.meta.last_page}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </main>
      {preview && <Modal isOpen onClose={() => setPreview(null)} title={preview.display_name} subtitle="Customer Quick Peek">
        <Modal.Body>
          <div className="flex items-center gap-4">
            <Avatar name={preview.display_name} colorKey={preview.id} preset={preview.avatar_preset} imageUrl={preview.avatar_url} size={48} />
            <div><p className="capitalize">{preview.customer_type}{preview.vip ? ' · VIP' : ''}</p><p className="text-sm text-slate-500">{preview.account_number ? `Account #${preview.account_number}` : 'No account number'}</p></div>
          </div>
          {(preview.tags ?? []).length > 0 && <p className="mt-4 text-sm font-medium">{preview.tags.join(' · ')}</p>}
          <CustomerActivityChips c={preview} />
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-sm text-slate-500">Email</dt><dd className="break-words">{preview.email || 'Not provided'}</dd></div>
            <div><dt className="text-sm text-slate-500">Last contact</dt><dd>{relativeTime(preview.last_contact_at)}</dd></div>
          </dl>
          <p className="mt-5 text-sm text-slate-500">Open the account for estimates, jobs, invoices, contacts, and conversations. This preview does not change any records.</p>
        </Modal.Body>
        <Modal.Footer><button type="button" onClick={() => setPreview(null)} className="rounded-lg border px-4 py-2">Back to customers</button><Link to={`/customers/${preview.id}`} className="rounded-lg bg-amber-400 px-4 py-2 font-semibold">Open account →</Link></Modal.Footer>
      </Modal>}
    </div>
  )
}
