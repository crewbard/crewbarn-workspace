import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders'
import type { PurchaseOrderStatus } from '@/types/purchaseOrder'
import { formatDateValue } from '@/hooks/useTenantTime'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'
import { EasyActionCards } from '@/components/easy/EasyActionCards'

const STATUS_OPTIONS: { value: PurchaseOrderStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'partially_received', label: 'Partially received' },
  { value: 'received', label: 'Received' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  ordered: 'Ordered',
  partially_received: 'Partially received',
  received: 'Received',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_PALETTE: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-700' },
  ordered: { bg: 'bg-blue-100', text: 'text-blue-800' },
  partially_received: { bg: 'bg-amber-100', text: 'text-amber-800' },
  received: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  completed: { bg: 'bg-slate-200', text: 'text-slate-700' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800' },
}

export function PurchaseOrdersPage() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const [cards, setCards] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<PurchaseOrderStatus | ''>('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [page, setPage] = useState(1)

  const query = usePurchaseOrders({
    q: q || undefined,
    status: status || undefined,
    include_archived: includeArchived || undefined,
    page,
    per_page: 25,
  })

  const items = query.data?.data ?? []
  const meta = query.data?.meta

  return (
    <div className={easy ? 'w-full min-w-0 px-4 py-6 sm:px-6' : 'max-w-7xl mx-auto px-6 py-6'}>
      {easy ? <EasyPageHeading title="Purchase orders" description="Track supplies from draft to delivery. Open an order to review its items, vendor, and receiving details." actions={<>
        <Link to="/purchase-orders/needs-ordered" className="rounded-xl border border-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900">Needs ordering</Link>
        <Link to="/purchase-orders/new" className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-300">+ New PO</Link>
      </>} /> : <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Purchase Orders</h1>
          <p className="text-sm text-slate-600 mt-1">
            Track vendor orders from draft through delivery and completion.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/purchase-orders/needs-ordered"
            className="px-4 py-2 text-sm font-medium bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-md"
          >
            ⚠ Needs Ordered
          </Link>
          <Link
            to="/purchase-orders/new"
            className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md"
          >
            + New PO
          </Link>
        </div>
      </div>}

      {easy && <EasyActionCards label="Find orders" actions={[
        { key: 'draft', title: 'Draft orders', description: 'Review orders still being prepared.' },
        { key: 'ordered', title: 'Waiting for delivery', description: 'See orders placed with vendors.' },
        { key: 'partially_received', title: 'Partly delivered', description: 'Find orders with items still outstanding.' },
        { key: 'received', title: 'Received orders', description: 'Review orders marked as received.' },
      ].map(action => ({ ...action, active: status === action.key, onClick: () => {
        setStatus(status === action.key ? '' : action.key as PurchaseOrderStatus)
        setPage(1)
      } }))} />}

      <div data-easy-list-toolbar className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          aria-label="Search purchase orders"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          placeholder="Search by PO # or vendor..."
          className="flex-1 max-w-md px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        />
        <select
          aria-label="Purchase order status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as PurchaseOrderStatus | '')
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
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => {
              setIncludeArchived(e.target.checked)
              setPage(1)
            }}
            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          Show archived
        </label>
      </div>

      {easy && <div role="group" aria-label="Purchase order display" className="mb-4 flex gap-2">
        <button type="button" data-easy-view-option aria-pressed={cards} onClick={() => setCards(true)} className="rounded-lg border px-4 py-2">Order cards</button>
        <button type="button" data-easy-view-option aria-pressed={!cards} onClick={() => setCards(false)} className="rounded-lg border px-4 py-2">Detailed table</button>
      </div>}
      {easy && cards && query.isSuccess && items.length > 0 && <section aria-label="Purchase orders on this page" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(po => <Link key={po.id} to={`/purchase-orders/${po.id}`} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 hover:border-amber-500">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{po.po_number}</h2><span className={`rounded px-2 py-1 text-xs ${(STATUS_PALETTE[po.status] ?? STATUS_PALETTE.draft).bg}`}>{STATUS_LABELS[po.status] ?? po.status}</span></div>
          <p className="mt-3 break-words">{po.vendor?.label ?? 'No vendor'}</p>
          <p className="mt-2 text-sm text-slate-500">Expected: {po.expected_delivery ? formatDateValue(po.expected_delivery, { month: 'short', day: 'numeric', year: 'numeric' }, 'en-US') : 'Not set'}</p>
          <p className="mt-3 font-semibold">{po.money?.total_formatted ?? 'Total unavailable'}</p>
          <span className="mt-4 block text-sm text-amber-800">{po.status === 'draft' ? 'Review draft' : po.status === 'ordered' || po.status === 'partially_received' ? 'Review delivery & receiving' : 'Review order'} →</span>
        </Link>)}
      </section>}
      <div hidden={easy && cards && query.isSuccess && items.length > 0} className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <Th>Number</Th>
              <Th>Status</Th>
              <Th>Vendor</Th>
              <Th>Order date</Th>
              <Th>Expected</Th>
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : query.isError ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center">
                <p role="alert" className="text-red-700">Purchase orders could not be loaded.</p>
                <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}
                  className="mt-2 rounded border border-slate-300 px-3 py-2 disabled:opacity-50">Try again</button>
              </td></tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {q || status
                    ? 'No purchase orders match your filters.'
                    : 'No purchase orders yet. Click "New PO" to create one.'}
                </td>
              </tr>
            ) : (
              items.map((po) => {
                const palette = STATUS_PALETTE[po.status] ?? STATUS_PALETTE.draft
                return (
                  <tr
                    key={po.id}
                    onClick={() => navigate(`/purchase-orders/${po.id}`)}
                    className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50"
                  >
                    <Td className="font-mono text-xs text-slate-600"><Link to={`/purchase-orders/${po.id}`} onClick={event => event.stopPropagation()} className="underline underline-offset-2">{po.po_number}</Link></Td>
                    <Td>
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${palette.bg} ${palette.text}`}
                      >
                        {STATUS_LABELS[po.status] ?? po.status}
                      </span>
                    </Td>
                    <Td className="text-slate-700">
                      {po.vendor?.label ?? <span className="text-slate-300">—</span>}
                    </Td>
                    <Td className="text-slate-700">
                      {po.order_date
                        ? formatDateValue(po.order_date, { month: 'short', day: 'numeric', year: 'numeric' }, 'en-US')
                        : '—'}
                    </Td>
                    <Td className="text-slate-700">
                      {po.expected_delivery
                        ? formatDateValue(po.expected_delivery, { month: 'short', day: 'numeric', year: 'numeric' }, 'en-US')
                        : '—'}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {po.money?.total_formatted ?? '$0.00'}
                    </Td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!query.isError && meta && meta.last_page > 1 && (
        <div data-easy-pager className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm">
          <div className="text-slate-600">
            Showing {meta.from ?? 0}–{meta.to ?? 0} of {meta.total}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={query.isFetching || meta.current_page <= 1}
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
              disabled={query.isFetching || meta.current_page >= meta.last_page}
              className="px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' | 'left' }) {
  return (
    <th
      className={`px-4 py-2 text-xs font-medium text-slate-600 uppercase tracking-wider ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align,
  className = '',
}: {
  children: React.ReactNode
  align?: 'right' | 'left'
  className?: string
}) {
  return (
    <td className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''} ${className}`}>
      {children}
    </td>
  )
}
