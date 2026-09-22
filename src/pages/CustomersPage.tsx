import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCustomers } from '@/hooks/useCustomers'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/Avatar'
import { Input } from '@/components/ui/Input'
import { WorkflowTabs } from '@/components/lists/WorkflowTabs'
import { RowChevron } from '@/components/lists/RowChevron'
import { useTheme, type FolderLayout } from '@/hooks/useTheme'
import { FolderBrowser, type FolderNode } from '@/components/FolderBrowser'
import { FolderLayoutSwitch } from '@/components/FolderLayoutSwitch'
import type { Customer, CustomerType } from '@/types/customer'

// Type-based workflow tabs (accurate via the existing server filter). VIP /
// Recurring / Balance-Due / Open-Work tabs with live counts land in the next
// slice once the list endpoint returns per-customer activity aggregates.
const CUSTOMER_TABS: Array<{ key: '' | CustomerType; label: string }> = [
  { key: '', label: 'All' },
  { key: 'residential', label: 'Residential' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'government', label: 'Government' },
]

const CUSTOMER_FILE_LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]

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
}: {
  customer: Customer
  onOpen: (id: string) => void
}) {
  const lifetimeCents = customer.responsible_paid_cents ?? customer.lifetime_value_cents
  const hasValue = lifetimeCents > 0

  return (
    <button
      type="button"
      onClick={() => onOpen(customer.id)}
      className="group flex w-full flex-col overflow-hidden rounded-lg border border-navy-100 bg-white text-left shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
      <span className="block h-1" style={{ background: customerStripe(customer) }} aria-hidden />
      <div className="p-4">
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

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-md bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Lifetime
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
  search,
  display,
  onOpen,
}: {
  letter: string
  customerType: CustomerType | ''
  search: string
  display: 'grid' | 'list'
  onOpen: (id: string) => void
}) {
  // Page within the open folder — 50 at a time with a Next button, so opening
  // a big letter (A, S…) doesn't pull the whole letter at once.
  const [page, setPage] = useState(1)
  // Search / type can change while a folder stays open; snap back to page 1 so
  // we never sit past the last page.
  useEffect(() => { setPage(1) }, [letter, customerType, search])

  const { data, isFetching } = useCustomers({
    filing_letter: letter,
    customer_type: customerType || undefined,
    q: search || undefined,
    sort: 'display_name',
    direction: 'asc',
    page,
    per_page: 50,
  })
  const customers = data?.data ?? []
  const meta = data?.meta
  // Cap at 4 cards per row; step down on narrower widths.
  const gridClass = 'grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

  if (isFetching && customers.length === 0) {
    return (
      <div className={display === 'list' ? 'space-y-2.5' : gridClass}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-lg bg-white" />)}
      </div>
    )
  }
  if (customers.length === 0) {
    return <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">No customers filed under {letter}.</div>
  }

  const cards = customers.map((c) => <CustomerCard key={c.id} customer={c} onOpen={onOpen} />)
  return (
    <div>
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
  filingView,
  filingCounts,
  folderLayout,
  customerType,
  search,
}: {
  customers: Customer[]
  onOpen: (id: string) => void
  filingView: boolean
  filingCounts: Record<string, number>
  folderLayout: FolderLayout
  customerType: CustomerType | ''
  search: string
}) {
  if (!filingView) {
    return (
      <div className="hidden md:grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {customers.map((customer) => (
          <CustomerCard key={customer.id} customer={customer} onOpen={onOpen} />
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
        <CustomerFolderContents letter={letter} customerType={customerType} search={search} display={display} onOpen={onOpen} />
      ),
    }))

  return (
    <div className="hidden min-w-0 md:block">
      <FolderBrowser folders={folders} layout={folderLayout} countNoun="customer" emptyFolderText="No customers filed here." />
    </div>
  )
}
export function CustomersPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { customerView, setCustomerView, density, folderLayout, setFolderLayout } = useTheme()
  // Filter / search / sort state
  const [search, setSearch] = useState(() => searchParams.get('q')?.trim() ?? '')
  const [typeFilter, setTypeFilter] = useState<CustomerType | ''>('')
  const [page, setPage] = useState(1)
  const perPage = 25
  const [filingView, setFilingView] = useState(() =>
    customerView === 'files'
      || (typeof window !== 'undefined' && window.localStorage.getItem('crewbarn:customer-filing-view') === 'true'),
  )
  const { data, isLoading, isError, error } = useCustomers({
    q: search || undefined,
    customer_type: typeFilter || undefined,
    // The main query supplies the A–Z counts; each open folder fetches its own
    // letter (CustomerFolderContents), so no letter is pinned here.
    filing_letter: undefined,
    sort: 'display_name',
    direction: 'asc',
    page,
    per_page: perPage,
  })

  const desktopRowPad = density === 'dense' ? 'px-4 py-2' : density === 'compact' ? 'px-4 py-2.5' : 'px-4 py-3'
  const directoryTotal = filingView && data?.filing_counts
    ? Object.values(data.filing_counts).reduce((total, count) => total + count, 0)
    : data?.meta?.total

  return (
    <div className="min-h-screen bg-background">
      {/* Slice 13c polish: removed local TopBar — global TopBar from
          AppLayout already wraps every authenticated page. */}

      {/* Page content */}
      <main className={`mx-auto px-3 sm:px-6 py-4 sm:py-8 ${filingView ? 'max-w-[1760px]' : 'max-w-7xl'}`}>
        {/* Page header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Customers</h1>
            <p className="text-sm text-navy-500 mt-1">
              {directoryTotal !== undefined
                ? directoryTotal.toLocaleString() + ' ' + (directoryTotal === 1 ? 'customer' : 'customers')
                : 'Loading...'}
            </p>
          </div>
          <Link to="/customers/new" className="shrink-0">
            <Button data-tour="customers-new">+ New</Button>
          </Link>
        </div>

        {/* Workflow tabs — faster than a dropdown, makes the page feel alive.
            Live counts (by type) come from the index endpoint's tab_counts. */}
        <WorkflowTabs
          tabs={CUSTOMER_TABS.map((t) => ({
            ...t,
            count: data?.tab_counts
              ? data.tab_counts[t.key === '' ? 'all' : t.key] ?? 0
              : undefined,
          }))}
          active={typeFilter}
          onChange={(key) => {
            setTypeFilter(key as CustomerType | '')
            setPage(1)
          }}
        />

        {/* Search bar */}
        <div className="bg-white rounded-lg border border-navy-100 p-4 mb-6 flex gap-3 flex-wrap">
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
          {(customerView === 'cards' || customerView === 'files') && (
            <div
              className="hidden h-10 shrink-0 overflow-hidden rounded-md border border-navy-200 bg-slate-50 md:inline-flex"
              role="group"
              aria-label="Customer card display"
            >
              <button
                type="button"
                onClick={() => {
                  setFilingView(false)
                  setCustomerView('cards')
                }}
                className={'px-4 text-sm font-semibold transition-colors ' + (
                  !filingView
                    ? 'bg-navy-800 text-white'
                    : 'text-navy-600 hover:bg-white hover:text-navy-900'
                )}
                aria-pressed={!filingView}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilingView(true)
                  setCustomerView('files')
                }}
                className={'border-l border-navy-200 px-4 text-sm font-semibold transition-colors ' + (
                  filingView
                    ? 'bg-amber-500 text-white'
                    : 'text-navy-600 hover:bg-white hover:text-navy-900'
                )}
                aria-pressed={filingView}
              >
                Files
              </button>
            </div>
          )}

          {filingView && (
            <div className="hidden items-center md:flex">
              <FolderLayoutSwitch value={folderLayout} onChange={setFolderLayout} />
            </div>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div role="status" className="cb-loading-region border border-navy-100 text-center">
            Loading customers...
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-danger">
            Failed to load customers: {(error as Error)?.message ?? 'Unknown error'}
          </div>
        )}

        {/* Empty state */}
        {data && data.data.length === 0 && (
          <div className="bg-white rounded-lg border border-navy-100 p-12 text-center">
            <p className="text-navy-500 mb-4">
              {search || typeFilter
                ? 'No customers match your filters.'
                : 'No customers yet. Create your first one.'}
            </p>
            {!search && !typeFilter && (
              <Link to="/customers/new">
                <Button>+ New customer</Button>
              </Link>
            )}
          </div>
        )}

        {/* Mobile cards — single tappable block per customer. Lifetime
            value gets a prominent right-side number; type/industry +
            last-contact stack as a meta line. */}
        {data && data.data.length > 0 && (
          <div className="md:hidden space-y-2">
            {data.data.map((customer) => (
              <Link
                key={customer.id}
                to={`/customers/${customer.id}`}
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
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <CustomerActivityChips c={customer} />
                  </div>
                  <div className="text-right shrink-0">
                    {customer.lifetime_value_cents > 0 ? (
                      <>
                        <div className="font-mono text-sm font-semibold text-navy-800">
                          {formatCustomerCurrency(customer.lifetime_value_cents)}
                        </div>
                        <div className="text-[10px] uppercase text-navy-400 tracking-wide">
                          lifetime
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
            ))}
          </div>
        )}

        {data && data.data.length > 0 && (customerView === 'cards' || customerView === 'files') && (
          <DesktopCustomerCards
            customers={data.data}
            onOpen={(id) => navigate(`/customers/${id}`)}
            filingView={filingView}
            filingCounts={data.filing_counts ?? {}}
            folderLayout={folderLayout}
            customerType={typeFilter}
            search={search}
          />
        )}

        {/* Desktop — clickable relationship rows (table/card hybrid). */}
        {data && data.data.length > 0 && customerView !== 'cards' && customerView !== 'files' && (
          <div className="hidden md:block bg-white rounded-lg border border-navy-100 overflow-hidden divide-y divide-navy-100">
            {data.data.map((customer) => {
              const hasValue = customer.lifetime_value_cents > 0
              return (
                <div
                  key={customer.id}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/customers/${customer.id}`)
                    }
                  }}
                  role="link"
                  tabIndex={0}
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
                      {customerView !== 'compact' && (
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
                        <div className="font-mono text-sm font-semibold text-navy-800">
                          {formatCustomerCurrency(customer.lifetime_value_cents)}
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

                    {/* Chevron */}
                    <RowChevron />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {data && !filingView && data.meta.last_page > 1 && (
          <div className="flex items-center justify-between mt-6 px-1">
            <div className="text-sm text-navy-500">
              Showing {data.meta.from}–{data.meta.to} of {data.meta.total}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
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
                disabled={page >= data.meta.last_page}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
