import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  usePurchaseOrder,
  useUpdatePurchaseOrder,
  useDeletePurchaseOrder,
  useCreatePurchaseOrderItem,
  useUpdatePurchaseOrderItem,
  useDeletePurchaseOrderItem,
  useReceivePurchaseOrder,
} from '@/hooks/usePurchaseOrders'
import { useCatalogItems, useCreateCatalogItem } from '@/hooks/useCatalogItems'
import { useAllInventoryBins } from '@/hooks/useInventoryBins'
import { BinTreePicker } from '@/components/BinTreePicker'
import type { InventoryBin } from '@/types/inventoryBin'
import { listStockLevels } from '@/lib/inventoryStockLevels'
import type { InventoryStockLevel } from '@/types/inventoryStockLevel'
import { isCountableUnit, qtyStepFor } from '@/lib/unitsOfMeasure'
import { useInventoryLocations } from '@/hooks/useInventoryLocations'
import { useLowStock } from '@/hooks/useLowStock'
import { Modal } from '@/components/ui/Modal'
import { ApiError, isDeleteCancelled } from '@/lib/api'
import { formatDateValue } from '@/hooks/useTenantTime'
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderItemInput,
  PurchaseOrderStatus,
} from '@/types/purchaseOrder'
import type { CatalogItem } from '@/types/catalogItem'
import type { LowStockItem } from '@/types/lowStock'
import { useTheme } from '@/hooks/useTheme'

const STATUS_PALETTE: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-700' },
  ordered: { bg: 'bg-blue-100', text: 'text-blue-800' },
  partially_received: { bg: 'bg-amber-100', text: 'text-amber-800' },
  received: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  completed: { bg: 'bg-slate-200', text: 'text-slate-700' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800' },
}

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  ordered: 'Ordered',
  partially_received: 'Partially received',
  received: 'Received',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_OPTIONS: PurchaseOrderStatus[] = [
  'draft',
  'ordered',
  'partially_received',
  'received',
  'completed',
  'cancelled',
]

export function PurchaseOrderDetailPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const [statusError, setStatusError] = useState<string | null>(null)
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const poQuery = usePurchaseOrder(id)
  const updateMutation = useUpdatePurchaseOrder()
  const deleteMutation = useDeletePurchaseOrder()

  if (poQuery.isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="text-sm text-slate-500">Loading purchase order…</div>
      </div>
    )
  }
  if (poQuery.isError || !poQuery.data) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="text-sm text-red-600">
          Failed to load PO. {poQuery.error instanceof Error ? poQuery.error.message : ''}
        </div>
        <Link to="/purchase-orders" className="text-sm text-amber-700 underline mt-3 inline-block">
          ← Back to purchase orders
        </Link>
      </div>
    )
  }

  const po = poQuery.data
  const palette = STATUS_PALETTE[po.status] ?? STATUS_PALETTE.draft

  async function handleStatusChange(next: PurchaseOrderStatus) {
    if (next === po.status) return
    setStatusError(null)
    try {
      await updateMutation.mutateAsync({ id: po.id, input: { status: next } })
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Could not update the order status.')
    }
  }

  async function handleDelete() {
    // Confirmation handled by the global delete modal (password + reason).
    try {
      await deleteMutation.mutateAsync(po.id)
      navigate('/purchase-orders')
    } catch {
      // Cancelled or failed.
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="mb-4">
        <Link to="/purchase-orders" className="text-sm text-amber-700 hover:underline">
          ← Back to purchase orders
        </Link>
      </div>

      <div className={easy ? 'mb-6 flex flex-wrap items-start justify-between gap-5 rounded-2xl bg-emerald-950 p-5 sm:p-7' : 'flex items-start justify-between mb-6 gap-6'}>
        <div>
          <div className="flex items-center gap-3">
            <h1 className={`text-2xl font-semibold font-mono ${easy ? 'text-white' : 'text-slate-900'}`}>
              {po.po_number}
            </h1>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${palette.bg} ${palette.text}`}
            >
              {STATUS_LABELS[po.status] ?? po.status}
            </span>
          </div>
          <p className={`text-sm mt-1 ${easy ? 'text-emerald-100' : 'text-slate-600'}`}>
            Vendor: <span className="font-medium">{po.vendor?.label ?? '—'}</span>
            {po.vendor_order_number && (
              <>
                {' · '}
                Vendor order #:{' '}
                <span className="font-mono font-medium">{po.vendor_order_number}</span>
              </>
            )}
            {po.estimate_id && (
              <>
                {' · '}
                {po.kind === 'estimate' ? 'For estimate ' : 'From estimate '}
                <Link to={`/estimates/${po.estimate_id}`} className="font-medium underline">
                  {po.estimate_number ?? 'the estimate'}
                </Link>
              </>
            )}
            {po.work_order_id && (
              <>
                {' · '}
                <Link to={`/jobs/${po.work_order_id}`} className="font-medium underline">the job</Link>
              </>
            )}
          </p>
          {po.status_note && (
            <p className={`mt-2 rounded px-2.5 py-1.5 text-sm ${easy ? 'bg-amber-100 text-amber-950' : 'bg-amber-50 text-amber-900'}`}>
              {po.status_note}
            </p>
          )}
          {po.order_note && (
            <p className={`mt-2 text-sm ${easy ? 'text-emerald-100' : 'text-slate-600'}`}>
              Ordered before the customer approved: {po.order_note}
            </p>
          )}
        </div>
        <div className={easy ? 'flex flex-wrap items-center gap-2 rounded-xl bg-white p-2' : 'flex items-center gap-2'}>
          <select
            aria-label="Purchase order status"
            value={po.status}
            onChange={(e) => handleStatusChange(e.target.value as PurchaseOrderStatus)}
            disabled={updateMutation.isPending}
            className="text-sm px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                Status: {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm px-3 py-1.5 text-red-600 hover:text-red-800"
          >
            Delete
          </button>
        </div>
      </div>

      {statusError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{statusError}</p>}
      {easy && <nav aria-label="Purchase order sections" className="mb-5 flex flex-wrap gap-2">
        <a href="#po-details" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">Order details</a>
        <a href="#po-items" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">Items & quantities</a>
        {['draft', 'ordered', 'partially_received', 'received'].includes(po.status) && <a href="#po-receive" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">Receive delivery</a>}
      </nav>}

      <div id="po-details" className="scroll-mt-24"><HeaderCard po={po} /></div>
      <div id="po-items" className="scroll-mt-24"><LineItemsCard po={po} /></div>
      {(po.status === 'draft' ||
        po.status === 'ordered' ||
        po.status === 'partially_received' ||
        po.status === 'received') && <div id="po-receive" className="scroll-mt-24"><ReceivePanel po={po} /></div>}
    </div>
  )
}

// ============================================================
// Header card — order date, expected delivery, totals, notes
// ============================================================

function HeaderCard({ po }: { po: PurchaseOrder }) {
  const updateMutation = useUpdatePurchaseOrder()
  const [editing, setEditing] = useState(false)
  const [orderDate, setOrderDate] = useState(po.order_date ?? '')
  const [expected, setExpected] = useState(po.expected_delivery ?? '')
  const [taxDollars, setTaxDollars] = useState(
    po.money.tax_cents == null ? '' : (po.money.tax_cents / 100).toFixed(2)
  )
  const [shipDollars, setShipDollars] = useState(
    po.money.shipping_cents == null ? '' : (po.money.shipping_cents / 100).toFixed(2)
  )
  const [notes, setNotes] = useState(po.notes ?? '')
  const [vendorOrderNumber, setVendorOrderNumber] = useState(po.vendor_order_number ?? '')
  const [error, setError] = useState<string | null>(null)

  function dollarsToCents(s: string): number | null {
    const t = s.trim()
    if (!t) return null
    const n = Number(t)
    if (Number.isNaN(n)) return null
    return Math.round(n * 100)
  }

  async function handleSave() {
    setError(null)
    try {
      await updateMutation.mutateAsync({
        id: po.id,
        input: {
          vendor_order_number: vendorOrderNumber.trim() || null,
          order_date: orderDate || null,
          expected_delivery: expected || null,
          tax_cents: dollarsToCents(taxDollars),
          shipping_cents: dollarsToCents(shipDollars),
          notes: notes || null,
        },
      })
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Header
        </h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-amber-700 hover:underline font-medium"
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setOrderDate(po.order_date ?? '')
                setExpected(po.expected_delivery ?? '')
                setNotes(po.notes ?? '')
              }}
              className="text-xs text-slate-600 hover:underline"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="text-xs px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Row label="Vendor order #" value={po.vendor_order_number ?? '—'} mono />
          <Row label="Order date" value={fmtDate(po.order_date)} />
          <Row label="Expected delivery" value={fmtDate(po.expected_delivery)} />
          <Row label="Subtotal" value={po.money.subtotal_formatted} mono />
          <Row label="Total" value={po.money.total_formatted} mono bold />
          <Row
            label="Tax"
            value={po.money.tax_cents != null ? formatCents(po.money.tax_cents) : '—'}
            mono
          />
          <Row
            label="Shipping"
            value={po.money.shipping_cents != null ? formatCents(po.money.shipping_cents) : '—'}
            mono
          />
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-500 mb-1">Notes</dt>
            <dd className="text-sm text-slate-700 whitespace-pre-wrap">
              {po.notes || <span className="text-slate-300">—</span>}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="space-y-3">
          <Field label="Vendor order # (their confirmation/order #)">
            <input
              type="text"
              value={vendorOrderNumber}
              onChange={(e) => setVendorOrderNumber(e.target.value)}
              maxLength={100}
              placeholder='e.g. "AB12345"'
              className={inputClass()}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Order date">
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className={inputClass()}
              />
            </Field>
            <Field label="Expected delivery">
              <input
                type="date"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                className={inputClass()}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tax ($)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={taxDollars}
                onChange={(e) => setTaxDollars(e.target.value)}
                className={inputClass()}
              />
            </Field>
            <Field label="Shipping ($)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={shipDollars}
                onChange={(e) => setShipDollars(e.target.value)}
                className={inputClass()}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass() + ' resize-y'}
            />
          </Field>
          {error && (
            <div className="text-xs text-red-600 px-2 py-1 bg-red-50 rounded">{error}</div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  mono,
  bold,
}: {
  label: string
  value: string
  mono?: boolean
  bold?: boolean
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={`text-slate-800 ${mono ? 'tabular-nums font-mono' : ''} ${
          bold ? 'font-semibold' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return formatDateValue(d, { month: 'short', day: 'numeric', year: 'numeric' }, 'en-US')
}

function formatCents(c: number): string {
  return '$' + (c / 100).toFixed(2)
}

// ============================================================
// Line items
// ============================================================

function LineItemsCard({ po }: { po: PurchaseOrder }) {
  const items = po.items ?? []
  const [adding, setAdding] = useState(false)
  const [showLowStock, setShowLowStock] = useState(false)

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Line items{items.length > 0 && ` (${items.length})`}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLowStock(true)}
            className="text-xs px-3 py-1.5 bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 rounded font-medium"
          >
            ⚠ Low stock
          </button>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium"
            >
              + Add line
            </button>
          )}
        </div>
      </div>

      {adding && (
        <NewLineItemPanel
          poId={po.id}
          vendorLabel={po.vendor?.label ?? null}
          onClose={() => setAdding(false)}
        />
      )}

      {items.length === 0 && !adding && (
        <div className="px-5 py-8 text-center text-sm text-slate-500">
          No line items yet. Click "+ Add line" or "⚠ Low stock" to start.
        </div>
      )}

      {items.length > 0 && (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <Th>Item</Th>
              <Th>Description</Th>
              <Th align="right">Qty ord.</Th>
              <Th align="right">Qty rcv.</Th>
              <Th align="right">Unit cost</Th>
              <Th align="right">Line total</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <LineItemRow key={it.id} poId={po.id} item={it} poStatus={po.status} />
            ))}
          </tbody>
        </table>
      )}

      {showLowStock && (
        <LowStockPickerModal
          poId={po.id}
          onClose={() => setShowLowStock(false)}
        />
      )}
    </div>
  )
}

// ============================================================
// Existing line item row — view + inline edit
// ============================================================

function LineItemRow({
  poId,
  item,
  poStatus,
}: {
  poId: string
  item: PurchaseOrderItem
  poStatus: PurchaseOrderStatus
}) {
  const [editing, setEditing] = useState(false)
  const updateMutation = useUpdatePurchaseOrderItem(poId)
  const deleteMutation = useDeletePurchaseOrderItem(poId)
  const showPrint =
    (poStatus === 'partially_received' ||
      poStatus === 'received' ||
      poStatus === 'completed') &&
    (item.qty_received ?? 0) > 0

  const [description, setDescription] = useState(item.description)
  const [qtyOrd, setQtyOrd] = useState(String(item.qty_ordered))
  const [unitDollars, setUnitDollars] = useState((item.unit_cost_cents / 100).toFixed(2))
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    try {
      await updateMutation.mutateAsync({
        itemId: item.id,
        input: {
          description: description.trim(),
          qty_ordered: Number(qtyOrd) || 0,
          unit_cost_cents: Math.round(Number(unitDollars) * 100) || 0,
        },
      })
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDelete() {
    // Confirmation handled by the global delete modal (password + reason).
    try {
      await deleteMutation.mutateAsync(item.id)
    } catch (err) {
      if (!isDeleteCancelled(err)) alert(err instanceof Error ? err.message : String(err))
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-slate-100">
        <td className="px-3 py-2 text-xs text-slate-500">
          {item.catalog_item ? item.catalog_item.name : <span className="italic">free-text</span>}
        </td>
        <td className="px-3 py-2">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass()}
          />
        </td>
        <td className="px-3 py-2 text-right">
          <input
            type="number"
            step="0.01"
            min="0"
            value={qtyOrd}
            onChange={(e) => setQtyOrd(e.target.value)}
            className={inputClass() + ' text-right'}
          />
        </td>
        <td className="px-3 py-2 text-right text-xs text-slate-500 tabular-nums">
          {item.qty_received}
        </td>
        <td className="px-3 py-2 text-right">
          <input
            type="number"
            step="0.01"
            min="0"
            value={unitDollars}
            onChange={(e) => setUnitDollars(e.target.value)}
            className={inputClass() + ' text-right'}
          />
        </td>
        <td className="px-3 py-2 text-right text-xs text-slate-500 tabular-nums">
          {formatCents(item.line_total_cents)}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-right">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-slate-600 hover:underline mr-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="text-xs px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded disabled:opacity-50"
          >
            {updateMutation.isPending ? '…' : 'Save'}
          </button>
          {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="px-3 py-3 text-xs text-slate-700">
        {item.catalog_item ? (
          <div>
            <div className="font-medium">{item.catalog_item.name}</div>
            {item.catalog_item.sku && (
              <div className="text-slate-400 font-mono">{item.catalog_item.sku}</div>
            )}
          </div>
        ) : (
          <span className="italic text-slate-400">free-text</span>
        )}
      </td>
      <td className="px-3 py-3 text-slate-800">
        {item.description}
        {(item.part_number || item.source_page_label) && (
          <div className="text-xs text-slate-400">
            {item.part_number && <span className="font-mono">{item.part_number}</span>}
            {item.part_number && item.source_page_label && ' · '}
            {item.source_page_label && `catalog p. ${item.source_page_label}`}
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-right tabular-nums">{item.qty_ordered}</td>
      <td className="px-3 py-3 text-right tabular-nums text-slate-500">{item.qty_received}</td>
      <td className="px-3 py-3 text-right tabular-nums">
        {formatCents(item.unit_cost_cents)}
      </td>
      <td className="px-3 py-3 text-right tabular-nums font-medium">
        {formatCents(item.line_total_cents)}
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap">
        {showPrint && (
          <Link
            to={`/purchase-orders/${poId}/labels?item_id=${item.id}`}
            target="_blank"
            className="text-xs text-amber-700 hover:underline mr-3"
            title="Print QR labels for this line"
          >
            🏷 Labels
          </Link>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-amber-700 hover:underline mr-3"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="text-xs text-red-600 hover:underline"
        >
          Remove
        </button>
      </td>
    </tr>
  )
}

// ============================================================
// New line item panel — block-layout form rendered ABOVE the table.
// (Previously a table row, but the catalog typeahead dropdown was
// getting clipped and overlapping cells. Block layout fixes both.)
// ============================================================

function NewLineItemPanel({
  poId,
  vendorLabel,
  onClose,
}: {
  poId: string
  vendorLabel: string | null
  onClose: () => void
}) {
  const createMutation = useCreatePurchaseOrderItem(poId)
  const [pickerQuery, setPickerQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [picked, setPicked] = useState<CatalogItem | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [showNewProduct, setShowNewProduct] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(pickerQuery.trim()), 200)
    return () => clearTimeout(t)
  }, [pickerQuery])

  const itemsQuery = useCatalogItems({
    q: debouncedQuery || undefined,
    type: 'product',
    active: true,
    per_page: 12,
  })
  const results = itemsQuery.data?.data ?? []

  const [description, setDescription] = useState('')
  const [qtyOrd, setQtyOrd] = useState('1')
  const [unitDollars, setUnitDollars] = useState('0.00')
  const [error, setError] = useState<string | null>(null)

  const lineTotalCents = useMemo(() => {
    const q = Number(qtyOrd) || 0
    const u = Math.round(Number(unitDollars) * 100) || 0
    return Math.round(q * u)
  }, [qtyOrd, unitDollars])

  function selectCatalogItem(it: CatalogItem) {
    setPicked(it)
    setShowPicker(false)
    setPickerQuery('')
    if (!description) setDescription(it.name)
    setUnitDollars((it.pricing.owner_cost_cents / 100).toFixed(2))
  }

  async function handleSave() {
    setError(null)
    if (!description.trim()) {
      setError('Description is required.')
      return
    }
    const input: PurchaseOrderItemInput = {
      catalog_item_id: picked?.id ?? null,
      description: description.trim(),
      qty_ordered: Number(qtyOrd) || 0,
      unit_cost_cents: Math.round(Number(unitDollars) * 100) || 0,
    }
    try {
      await createMutation.mutateAsync(input)
      onClose()
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="border-b border-slate-200 bg-amber-50/40 px-5 py-4 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        New line
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[11px] font-medium text-slate-700 uppercase tracking-wide">
            Catalog item
          </label>
          <button
            type="button"
            onClick={() => setShowNewProduct(true)}
            className="text-[11px] text-amber-700 hover:underline font-medium"
          >
            + New product
          </button>
        </div>
        {picked ? (
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded px-3 py-2">
            <div className="text-sm">
              <div className="font-medium text-slate-800">{picked.name}</div>
              {picked.sku && (
                <div className="font-mono text-xs text-slate-400">{picked.sku}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="text-xs text-amber-700 hover:underline"
            >
              Clear
            </button>
          </div>
        ) : (
          <>
            <input
              value={pickerQuery}
              onChange={(e) => {
                setPickerQuery(e.target.value)
                setShowPicker(true)
              }}
              onFocus={() => setShowPicker(true)}
              onBlur={() => setTimeout(() => setShowPicker(false), 150)}
              placeholder="Search catalog by name or SKU…"
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
            {showPicker && debouncedQuery && (
              <div className="absolute z-20 mt-1 left-0 right-0 bg-white border border-slate-200 rounded shadow-lg max-h-72 overflow-y-auto">
                {itemsQuery.isLoading && (
                  <div className="px-3 py-2 text-xs text-slate-500">Loading…</div>
                )}
                {itemsQuery.isError && <div role="alert" className="px-3 py-2 text-xs text-red-700">
                  Product search could not be loaded.
                  <button type="button" disabled={itemsQuery.isFetching} className="ml-2 underline disabled:opacity-50" onMouseDown={event => event.preventDefault()} onClick={() => void itemsQuery.refetch()}>Try again</button>
                </div>}
                {!itemsQuery.isLoading && !itemsQuery.isError && results.length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-500 flex items-center justify-between">
                    <span>No matches.</span>
                    <button
                      type="button"
                      onMouseDown={() => {
                        setShowPicker(false)
                        setShowNewProduct(true)
                      }}
                      className="text-amber-700 hover:underline font-medium"
                    >
                      + Create "{debouncedQuery}"
                    </button>
                  </div>
                )}
                {!itemsQuery.isError && results.map((it) => (
                  <button
                    type="button"
                    key={it.id}
                    onMouseDown={() => selectCatalogItem(it)}
                    className="block w-full text-left px-3 py-2 hover:bg-amber-50 text-sm"
                  >
                    <div className="font-medium text-slate-800">{it.name}</div>
                    {it.sku && (
                      <div className="font-mono text-xs text-slate-400">{it.sku}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="text-[11px] text-slate-500 mt-1">
              Pick from catalog (auto-fills cost) or just type a description below.
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-6">
          <label className="block text-[11px] font-medium text-slate-700 mb-1 uppercase tracking-wide">
            Description <span className="text-red-500">*</span>
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's on this line?"
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            autoFocus
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] font-medium text-slate-700 mb-1 uppercase tracking-wide">
            Qty
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={qtyOrd}
            onChange={(e) => setQtyOrd(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded text-right focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] font-medium text-slate-700 mb-1 uppercase tracking-wide">
            Unit cost ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={unitDollars}
            onChange={(e) => setUnitDollars(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded text-right focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] font-medium text-slate-700 mb-1 uppercase tracking-wide">
            Line total
          </label>
          <div className="px-3 py-2 text-sm tabular-nums text-slate-700 font-medium text-right border border-slate-200 rounded bg-slate-50">
            {formatCents(lineTotalCents)}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-600 px-3 py-2 bg-red-50 border border-red-100 rounded">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="text-sm px-3 py-1.5 text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={createMutation.isPending}
          className="text-sm px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium disabled:opacity-50"
        >
          {createMutation.isPending ? 'Adding…' : 'Add line'}
        </button>
      </div>

      {showNewProduct && (
        <LinkOrCreateCatalogItemModal
          poId={poId}
          line={null}
          vendorLabel={vendorLabel}
          defaultName={pickerQuery || description}
          defaultUnitCostCents={Math.round(Number(unitDollars) * 100) || 0}
          onClose={() => setShowNewProduct(false)}
          onCreated={(item) => {
            // Auto-select the freshly created product into this line.
            selectCatalogItem(item)
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// Low stock picker modal — bulk-add from items at/below reorder threshold
// ============================================================

interface LowStockRowState {
  selected: boolean
  qty: string
}

function LowStockPickerModal({
  poId,
  onClose,
}: {
  poId: string
  onClose: () => void
}) {
  const lowStockQuery = useLowStock(true)
  const createMutation = useCreatePurchaseOrderItem(poId)
  const [rowState, setRowState] = useState<Record<string, LowStockRowState>>({})
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)

  const items = lowStockQuery.data ?? []

  useEffect(() => {
    if (!items.length) return
    setRowState((prev) => {
      const next = { ...prev }
      for (const it of items) {
        if (!next[it.id]) {
          next[it.id] = {
            selected: false,
            qty: String(it.suggested_qty || it.reorder_quantity || 1),
          }
        }
      }
      return next
    })
  }, [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        (it.sku ?? '').toLowerCase().includes(q) ||
        (it.supplier_name ?? '').toLowerCase().includes(q)
    )
  }, [items, search])

  const selectedIds = useMemo(
    () => Object.entries(rowState).filter(([, v]) => v.selected).map(([k]) => k),
    [rowState]
  )

  function toggleSelected(id: string) {
    setRowState((p) => ({
      ...p,
      [id]: { ...(p[id] ?? { selected: false, qty: '1' }), selected: !p[id]?.selected },
    }))
  }

  function setQty(id: string, qty: string) {
    setRowState((p) => ({
      ...p,
      [id]: { ...(p[id] ?? { selected: true, qty: '1' }), qty },
    }))
  }

  function selectAllVisible() {
    setRowState((p) => {
      const next = { ...p }
      for (const it of filtered) {
        next[it.id] = { ...(next[it.id] ?? { qty: String(it.suggested_qty) }), selected: true }
      }
      return next
    })
  }

  function clearSelection() {
    setRowState((p) => {
      const next = { ...p }
      for (const id of Object.keys(next)) {
        next[id] = { ...next[id], selected: false }
      }
      return next
    })
  }

  async function handleAddSelected() {
    if (lowStockQuery.isError || lowStockQuery.isFetching) return
    setError(null)
    const picks = items.filter((it) => rowState[it.id]?.selected)
    if (picks.length === 0) {
      setError('Select at least one item.')
      return
    }
    setBulkProgress({ done: 0, total: picks.length })
    const failures: string[] = []
    for (let i = 0; i < picks.length; i++) {
      const it = picks[i]
      const qty = Number(rowState[it.id]?.qty) || 0
      if (qty <= 0) {
        failures.push(`${it.name} (qty=0)`)
        setBulkProgress({ done: i + 1, total: picks.length })
        continue
      }
      try {
        await createMutation.mutateAsync({
          catalog_item_id: it.id,
          description: it.name,
          qty_ordered: qty,
          unit_cost_cents: it.owner_cost_cents,
        })
      } catch (e) {
        failures.push(it.name + ' (' + (e instanceof Error ? e.message : 'error') + ')')
      }
      setBulkProgress({ done: i + 1, total: picks.length })
    }
    setBulkProgress(null)
    if (failures.length > 0) {
      setError(`${failures.length} item(s) failed: ${failures.slice(0, 3).join(', ')}${failures.length > 3 ? '…' : ''}`)
      return
    }
    onClose()
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Add from low stock" size="xl">
      <Modal.Body>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, SKU, or supplier…"
              className="flex-1 max-w-md text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={selectAllVisible}
                className="text-amber-700 hover:underline"
              >
                Select all visible
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={clearSelection}
                className="text-slate-600 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          {lowStockQuery.isLoading && (
            <div className="text-sm text-slate-500 py-8 text-center">Loading low-stock items…</div>
          )}
          {lowStockQuery.isError && (
            <div role="alert" className="text-sm text-red-600 py-4">
              Failed to load: {lowStockQuery.error instanceof Error ? lowStockQuery.error.message : 'unknown error'}
              <button type="button" disabled={lowStockQuery.isFetching} className="ml-2 underline disabled:opacity-50" onClick={() => void lowStockQuery.refetch()}>Try again</button>
            </div>
          )}

          {!lowStockQuery.isLoading && !lowStockQuery.isError && items.length === 0 && (
            <div className="text-sm text-slate-500 py-8 text-center">
              No items at or below reorder threshold. Set reorder thresholds on catalog items to populate this list.
            </div>
          )}

          {!lowStockQuery.isError && filtered.length > 0 && (
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 w-10"></th>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-left">Supplier</th>
                    <th className="px-3 py-2 text-right">On hand</th>
                    <th className="px-3 py-2 text-right">Threshold</th>
                    <th className="px-3 py-2 text-right">Order qty</th>
                    <th className="px-3 py-2 text-right">Unit cost</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((it) => {
                    const state = rowState[it.id]
                    const selected = state?.selected ?? false
                    const qty = state?.qty ?? String(it.suggested_qty)
                    return (
                      <tr
                        key={it.id}
                        className={`border-b border-slate-100 ${selected ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelected(it.id)}
                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">{it.name}</div>
                          {it.sku && (
                            <div className="font-mono text-xs text-slate-400">{it.sku}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          {it.supplier_name ?? <span className="text-slate-300">—</span>}
                          {it.supplier_sku && (
                            <div className="font-mono text-slate-400">{it.supplier_sku}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {it.current_stock}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                          {it.reorder_threshold}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={qty}
                            onChange={(e) => setQty(it.id, e.target.value)}
                            disabled={!selected}
                            className="w-20 text-sm px-2 py-1 border border-slate-300 rounded text-right focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:bg-slate-50 disabled:text-slate-400"
                          />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                          {formatCents(it.owner_cost_cents)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 px-3 py-2 bg-red-50 border border-red-100 rounded">
              {error}
            </div>
          )}
          {bulkProgress && (
            <div className="text-xs text-slate-600 px-3 py-2 bg-slate-50 border border-slate-200 rounded">
              Adding {bulkProgress.done} of {bulkProgress.total}…
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="text-sm text-slate-600 mr-auto">
          {selectedIds.length} selected
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleAddSelected}
          disabled={
            lowStockQuery.isError ||
            lowStockQuery.isFetching ||
            createMutation.isPending ||
            selectedIds.length === 0 ||
            bulkProgress !== null
          }
          className="px-4 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {bulkProgress
            ? `Adding (${bulkProgress.done}/${bulkProgress.total})…`
            : `Add ${selectedIds.length || ''} to PO`}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

// Re-export type to keep linter happy if LowStockItem unused elsewhere.
export type { LowStockItem }

// ============================================================
// Shared
// ============================================================

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  )
}

function Th({
  children,
  align,
}: {
  children?: React.ReactNode
  align?: 'right' | 'left'
}) {
  return (
    <th
      className={`px-3 py-2 text-xs font-medium text-slate-600 uppercase tracking-wider ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function inputClass(): string {
  return 'w-full text-xs px-2 py-1 border border-slate-300 rounded focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
}

// ============================================================
// Receive panel — per-line "qty to receive now" + Receive submit
// ============================================================

function ReceivePanel({ po }: { po: PurchaseOrder }) {
  const items = po.items ?? []
  const receivable = items.filter(
    (it) => (it.qty_ordered ?? 0) - (it.qty_received ?? 0) > 0
  )
  const receiveMutation = useReceivePurchaseOrder(po.id)
  const { data: locationsData } = useInventoryLocations({ per_page: 200 })
  const locations = locationsData?.data ?? []
  const [panelLocationId, setPanelLocationId] = useState<string>('')
  const [panelBinId, setPanelBinId] = useState<string>('')
  const { data: binsData } = useAllInventoryBins(
    panelLocationId ? { location_id: panelLocationId } : {}
  )
  const bins = binsData?.data ?? []
  const filteredBins = panelLocationId
    ? bins.filter((b) => b.location_id === panelLocationId)
    : bins
  const [draftQty, setDraftQty] = useState<Record<string, string>>({})
  // Per-line bin override. Map keyed by po_item_id. When set, takes priority
  // over the panel-level bin and the catalog item's default_bin. Lets the
  // user receive different lines into different bins in one shipment.
  const [lineBin, setLineBin] = useState<Record<string, InventoryBin>>({})
  const [pickingBinFor, setPickingBinFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needsCatalog, setNeedsCatalog] = useState<PurchaseOrderItem | null>(null)
  // Safety modal: when a receive line would create a NEW (item, bin)
  // placement but the same item already has stock elsewhere, hold the
  // resolved lines here and let the user pick merge / create / cancel
  // before actually firing the receive.
  type ResolvedReceiveLine = {
    po_item_id: string
    qty: number
    location_id?: string
    bin_id?: string | null
  }
  type Conflict = {
    po_item_id: string
    itemName: string
    chosenLabel: string
    existing: { bin_id: string | null; label: string; qty: number }[]
  }
  const [pendingReceive, setPendingReceive] = useState<{
    lines: ResolvedReceiveLine[]
    conflicts: Conflict[]
  } | null>(null)
  const [checkingConflicts, setCheckingConflicts] = useState(false)

  // If panel location changes, clear bin (since old bin may be in a different location)
  useEffect(() => {
    if (panelBinId && !filteredBins.some((b) => b.id === panelBinId)) {
      setPanelBinId('')
    }
  }, [panelLocationId, filteredBins, panelBinId])

  function setQty(id: string, qty: string) {
    setDraftQty((p) => ({ ...p, [id]: qty }))
  }

  function fillRemaining() {
    const next: Record<string, string> = {}
    for (const it of receivable) {
      const remaining = (it.qty_ordered ?? 0) - (it.qty_received ?? 0)
      next[it.id] = String(Math.floor(remaining))
    }
    setDraftQty(next)
  }

  /**
   * Build the resolved lines (qty + location + bin), then check whether
   * any line would create a NEW (item, bin) placement when stock for that
   * same item already exists at a different bin. If so, gate the receive
   * behind a confirm modal so the user can merge into an existing spot
   * rather than splitting stock by accident.
   */
  async function handleSubmit() {
    setError(null)
    const explicitLocation = panelLocationId || undefined
    const explicitBin = panelBinId || undefined
    const lines: ResolvedReceiveLine[] = Object.entries(draftQty)
      .map(([po_item_id, qtyStr]) => {
        const perLineBin = lineBin[po_item_id]
        return {
          po_item_id,
          qty: Number(qtyStr) || 0,
          location_id: perLineBin ? perLineBin.location_id : explicitLocation,
          bin_id: perLineBin ? perLineBin.id : explicitBin,
        }
      })
      .filter((l) => l.qty > 0)
    if (lines.length === 0) {
      setError('Enter a qty on at least one line.')
      return
    }

    // Pre-flight: pull existing stock_levels per catalog item, find any
    // line that would land at a NEW bin while stock exists at others.
    setCheckingConflicts(true)
    try {
      const conflicts: Conflict[] = []
      for (const line of lines) {
        const poItem = items.find((it) => it.id === line.po_item_id)
        const catalogId = poItem?.catalog_item_id
        if (!catalogId) continue
        const resp = await listStockLevels({ catalog_item_id: catalogId, per_page: 100 })
        const existing = (resp.data as InventoryStockLevel[])
          .filter((sl) => (sl.bin_id ?? null) !== (line.bin_id ?? null))
          .map((sl) => ({
            bin_id: sl.bin_id,
            label: sl.bin?.path_label ?? sl.location?.name ?? '—',
            qty: sl.quantities.qty_on_hand,
          }))
        if (existing.length === 0) continue
        const chosenLabel =
          (line.bin_id ? bins.find((b) => b.id === line.bin_id)?.path_label : null)
          ?? (line.location_id ? locations.find((l) => l.id === line.location_id)?.name : null)
          ?? '(catalog default)'
        conflicts.push({
          po_item_id: line.po_item_id,
          itemName: poItem?.description ?? 'item',
          chosenLabel,
          existing,
        })
      }
      if (conflicts.length > 0) {
        setPendingReceive({ lines, conflicts })
        return
      }
    } catch (e) {
      // Non-fatal: if pre-flight fails, fall through and just submit.
      console.warn('Receive conflict pre-flight failed; submitting anyway.', e)
    } finally {
      setCheckingConflicts(false)
    }

    await executeReceive(lines)
  }

  async function executeReceive(lines: ResolvedReceiveLine[]) {
    setError(null)
    try {
      await receiveMutation.mutateAsync({ lines })
      setDraftQty({})
      setLineBin({})
      setPendingReceive(null)
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.details as
          | { code?: string; po_item_id?: string }
          | undefined
        if (details?.code === 'needs_catalog_item' && details.po_item_id) {
          const item = items.find((it) => it.id === details.po_item_id) ?? null
          if (item) setNeedsCatalog(item)
        }
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
  }

  if (receivable.length === 0) {
    return null
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mt-6">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-emerald-50">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
            Receive goods
          </h2>
          <p className="text-xs text-emerald-700 mt-0.5">
            Enter qty received per line. SN-tracked items get auto-generated serials; non-SN items bump stock.
          </p>
        </div>
        <button
          type="button"
          onClick={fillRemaining}
          className="text-xs px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded font-medium"
        >
          Fill remaining
        </button>
      </div>

      <div className="px-5 py-3 border-b border-slate-200 bg-white">
        <div className="text-[11px] font-medium text-slate-700 uppercase tracking-wide mb-2">
          Receive into (overrides catalog defaults)
        </div>
        <div className="flex items-center gap-3">
          <select
            value={panelLocationId}
            onChange={(e) => setPanelLocationId(e.target.value)}
            className="text-sm px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-emerald-500 bg-white min-w-[180px]"
          >
            <option value="">— Use catalog default —</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <select
            value={panelBinId}
            onChange={(e) => setPanelBinId(e.target.value)}
            disabled={!panelLocationId}
            className="text-sm px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-emerald-500 bg-white min-w-[200px] disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">
              {panelLocationId ? '— Any bin in this location —' : '— Pick a location first —'}
            </option>
            {filteredBins.map((b) => (
              <option key={b.id} value={b.id}>
                {b.path_label || b.name || b.bin_code}
              </option>
            ))}
          </select>
          {(panelLocationId || panelBinId) && (
            <button
              type="button"
              onClick={() => {
                setPanelLocationId('')
                setPanelBinId('')
              }}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Clear
            </button>
          )}
        </div>
        {locations.length === 0 && (
          <p className="text-xs text-amber-700 mt-2">
            No inventory locations yet. Add one in Tool Shed → Inventory → Locations before receiving.
          </p>
        )}
      </div>

      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <Th>Line</Th>
            <Th align="right">Ordered</Th>
            <Th align="right">Received</Th>
            <Th align="right">Remaining</Th>
            <Th align="right">Receive now</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {receivable.map((it) => {
            const remaining = (it.qty_ordered ?? 0) - (it.qty_received ?? 0)
            const needsLink = !it.catalog_item_id
            return (
              <tr key={it.id} className="border-b border-slate-100">
                <td className="px-3 py-3">
                  <div className="text-slate-800 font-medium">{it.description}</div>
                  {it.catalog_item ? (
                    <div className="text-xs font-mono text-slate-400">
                      {it.catalog_item.sku ?? it.catalog_item.id}
                    </div>
                  ) : (
                    <div className="text-xs text-amber-700 italic">free-text · not linked to catalog</div>
                  )}
                  {!needsLink && (() => {
                    const override = lineBin[it.id]
                    let dest: React.ReactNode
                    let source: 'override' | 'panel' | 'catalog' | 'none' = 'none'
                    if (override) {
                      dest = `→ ${override.path_label || override.name || override.bin_code}`
                      source = 'override'
                    } else if (panelBinId) {
                      dest = `→ ${filteredBins.find((b) => b.id === panelBinId)?.path_label ?? 'panel bin'}`
                      source = 'panel'
                    } else if (it.catalog_item?.default_bin?.name) {
                      dest = `→ ${it.catalog_item.default_bin.name} (catalog default)`
                      source = 'catalog'
                    } else if (panelLocationId) {
                      dest = `→ ${locations.find((l) => l.id === panelLocationId)?.name ?? ''} (any bin)`
                      source = 'panel'
                    } else {
                      dest = <span className="text-amber-700">⚠ no bin — pick one</span>
                    }
                    return (
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span className={source === 'override' ? 'text-emerald-700 font-medium' : ''}>
                          {dest}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPickingBinFor(it.id)}
                          className="text-[11px] text-amber-700 hover:underline"
                        >
                          {override ? 'Change' : 'Pick bin'}
                        </button>
                        {override && (
                          <button
                            type="button"
                            onClick={() => setLineBin((p) => {
                              const next = { ...p }
                              delete next[it.id]
                              return next
                            })}
                            className="text-[11px] text-slate-500 hover:text-slate-800"
                          >
                            Use default
                          </button>
                        )}
                      </div>
                    )
                  })()}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{it.qty_ordered}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-500">
                  {it.qty_received}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-medium">{remaining}</td>
                <td className="px-3 py-3 text-right">
                  {needsLink ? (
                    <span className="text-xs text-slate-400">—</span>
                  ) : (() => {
                    const lineUnit = it.catalog_item?.unit_label ?? 'each'
                    const isCount = isCountableUnit(lineUnit)
                    return (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step={qtyStepFor(lineUnit)}
                          min="0"
                          max={remaining}
                          inputMode={isCount ? 'numeric' : 'decimal'}
                          value={draftQty[it.id] ?? ''}
                          onChange={(e) => {
                            const allow = isCount
                              ? e.target.value.replace(/[^0-9]/g, '')
                              : e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1')
                            setQty(it.id, allow)
                          }}
                          placeholder="0"
                          className="w-20 text-sm px-2 py-1 border border-slate-300 rounded text-right focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        />
                        {!isCount && (
                          <span className="text-[11px] text-slate-500">{lineUnit}</span>
                        )}
                      </div>
                    )
                  })()}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  {needsLink && (
                    <button
                      type="button"
                      onClick={() => setNeedsCatalog(it)}
                      className="text-xs px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium"
                    >
                      Link / Create item
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {error && (
        <div className="mx-5 my-3 text-xs text-red-600 px-3 py-2 bg-red-50 border border-red-100 rounded">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 px-5 py-3 bg-slate-50 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setDraftQty({})}
          className="text-sm px-3 py-1.5 text-slate-600 hover:text-slate-900"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={receiveMutation.isPending || checkingConflicts}
          className="text-sm px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium disabled:opacity-50"
        >
          {checkingConflicts ? 'Checking…' : receiveMutation.isPending ? 'Receiving…' : 'Receive selected'}
        </button>
      </div>

      {needsCatalog && (
        <LinkOrCreateCatalogItemModal
          poId={po.id}
          line={needsCatalog}
          vendorLabel={po.vendor?.label ?? null}
          onClose={() => setNeedsCatalog(null)}
        />
      )}
      {pickingBinFor && (
        <BinTreePicker
          isOpen={true}
          onClose={() => setPickingBinFor(null)}
          allowNoBin={false}
          defaultLocationId={panelLocationId || undefined}
          title="Receive into bin"
          highlightItemId={
            pickingBinFor
              ? items.find((it) => it.id === pickingBinFor)?.catalog_item_id ?? undefined
              : undefined
          }
          onPick={(bin) => {
            if (bin && pickingBinFor) {
              setLineBin((p) => ({ ...p, [pickingBinFor]: bin }))
            }
            setPickingBinFor(null)
          }}
        />
      )}
      {pendingReceive && (
        <ReceiveConflictModal
          conflicts={pendingReceive.conflicts}
          onCancel={() => setPendingReceive(null)}
          onMerge={(merges) => {
            // Replace the chosen bin on each conflicting line with the
            // existing bin the user picked to merge into.
            const lines = pendingReceive.lines.map((line) => {
              const chosen = merges[line.po_item_id]
              if (!chosen) return line
              return { ...line, bin_id: chosen.bin_id, location_id: undefined as string | undefined }
            })
            executeReceive(lines)
          }}
          onCreateNew={() => executeReceive(pendingReceive.lines)}
        />
      )}
    </div>
  )
}

// ============================================================
// Link/Create catalog item modal — for free-text PO lines that need a
// catalog ref before receive can apply stock.
// ============================================================

function LinkOrCreateCatalogItemModal({
  poId,
  line,
  vendorLabel,
  onClose,
  onCreated,
  defaultName,
  defaultUnitCostCents,
}: {
  /** When set, the modal will PATCH the PO line's catalog_item_id after create/link. */
  poId: string
  line?: PurchaseOrderItem | null
  vendorLabel: string | null
  onClose: () => void
  /** Called after a catalog item is created/linked. Receives the resulting CatalogItem. */
  onCreated?: (item: CatalogItem) => void
  /** Pre-fill the name field when no line is provided (e.g. typed query in NewLineItemPanel). */
  defaultName?: string
  /** Pre-fill the owner-cost (in cents) when no line is provided. */
  defaultUnitCostCents?: number
}) {
  const hasLine = !!line
  const [tab, setTab] = useState<'link' | 'create'>('create')
  const updateLine = useUpdatePurchaseOrderItem(poId)
  const createCatalogItem = useCreateCatalogItem()
  const { data: binsData } = useAllInventoryBins({})
  const bins = binsData?.data ?? []

  // Link tab state
  const [pickerQuery, setPickerQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(pickerQuery.trim()), 200)
    return () => clearTimeout(t)
  }, [pickerQuery])
  const pickerResults = useCatalogItems({
    q: debouncedQuery || undefined,
    type: 'product',
    active: true,
    per_page: 12,
  })

  // Create tab state — defaults pulled from the PO line OR from props
  const initialUnitCostCents = line?.unit_cost_cents ?? defaultUnitCostCents ?? 0
  const [name, setName] = useState(line?.description ?? defaultName ?? '')
  const [sku, setSku] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  /**
   * Long description maps to catalog_items.internal_description — an
   * internal, FTS-indexed text field that holds vehicle fitment,
   * FCC IDs, crossover part numbers, alternate spellings, etc. NOT
   * customer-facing. The customer-facing summary lives in
   * `short_description` (max 100, prints on stickers + invoices).
   */
  const [longDescription, setLongDescription] = useState('')
  const [defaultBinId, setDefaultBinId] = useState('')
  const [supplierName, setSupplierName] = useState(vendorLabel ?? '')
  const [reorderThreshold, setReorderThreshold] = useState('')
  const [reorderQuantity, setReorderQuantity] = useState('')
  const [snTracking, setSnTracking] = useState(false)
  const [snPrefix, setSnPrefix] = useState('')

  const [error, setError] = useState<string | null>(null)

  async function handleLink(catalogItem: CatalogItem) {
    setError(null)
    try {
      if (line) {
        await updateLine.mutateAsync({
          itemId: line.id,
          input: { catalog_item_id: catalogItem.id },
        })
      }
      onCreated?.(catalogItem)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleCreate() {
    setError(null)
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    try {
      const created = await createCatalogItem.mutateAsync({
        type: 'product',
        name: name.trim(),
        sku: sku.trim() || null,
        short_description: shortDescription.trim() || null,
        internal_description: longDescription.trim() || null,
        default_bin_id: defaultBinId || null,
        supplier_name: supplierName.trim() || null,
        owner_cost_cents: initialUnitCostCents,
        reorder_threshold: reorderThreshold ? Number(reorderThreshold) : null,
        reorder_quantity: reorderQuantity ? Number(reorderQuantity) : null,
        sn_tracking_enabled: snTracking,
        sn_format_prefix: snTracking && snPrefix.trim() ? snPrefix.trim() : null,
        active: true,
      })
      if (line) {
        await updateLine.mutateAsync({
          itemId: line.id,
          input: { catalog_item_id: created.id },
        })
      }
      onCreated?.(created)
      onClose()
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError(err instanceof Error ? err.message : String(err))
    }
  }

  const isPending = updateLine.isPending || createCatalogItem.isPending

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        hasLine && line
          ? `Link catalog item — "${line.description}"`
          : 'New product'
      }
      size="lg"
    >
      <Modal.Body>
        <div className="space-y-4">
          {hasLine && (
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => setTab('create')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                  tab === 'create'
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Create new
              </button>
              <button
                type="button"
                onClick={() => setTab('link')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                  tab === 'link'
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Link existing
              </button>
            </div>
          )}

          {tab === 'create' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <ModalField label="Name" required>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={modalInputClass()}
                  />
                </ModalField>
                <ModalField label="SKU">
                  <input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className={modalInputClass()}
                    placeholder="(optional)"
                  />
                </ModalField>
              </div>
              <ModalField label="Short description (customer-facing — invoices, sticker, max 100)">
                <input
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  maxLength={100}
                  className={modalInputClass()}
                  placeholder='e.g. "Schlage L9080 Mortise Lock"'
                />
              </ModalField>
              <ModalField label="Long description (internal — searchable: vehicle fitment, FCC IDs, crossover part #s, alt names)">
                <textarea
                  value={longDescription}
                  onChange={(e) => setLongDescription(e.target.value)}
                  rows={3}
                  className={modalInputClass() + ' resize-y'}
                  placeholder='e.g. "2021 Ford F150 / FCC ID M3N-A2C31243800 / Schlage L9080 / L-9080 / 9080-PD"'
                />
              </ModalField>
              <ModalField label="Default bin (where this lives — drives auto-receive)">
                <select
                  value={defaultBinId}
                  onChange={(e) => setDefaultBinId(e.target.value)}
                  className={modalInputClass()}
                >
                  <option value="">— None (set on receive) —</option>
                  {bins.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.path_label || b.name || b.bin_code || b.id}
                    </option>
                  ))}
                </select>
              </ModalField>
              <div className="grid grid-cols-2 gap-3">
                <ModalField label="Supplier">
                  <input
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className={modalInputClass()}
                  />
                </ModalField>
                <ModalField label="Owner cost ($)">
                  <input
                    value={(initialUnitCostCents / 100).toFixed(2)}
                    disabled
                    className={modalInputClass() + ' bg-slate-50 text-slate-500'}
                  />
                </ModalField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ModalField label="Reorder threshold">
                  <input
                    type="number"
                    min="0"
                    value={reorderThreshold}
                    onChange={(e) => setReorderThreshold(e.target.value)}
                    className={modalInputClass()}
                    placeholder="When stock <=, show in low-stock"
                  />
                </ModalField>
                <ModalField label="Reorder quantity">
                  <input
                    type="number"
                    min="0"
                    value={reorderQuantity}
                    onChange={(e) => setReorderQuantity(e.target.value)}
                    className={modalInputClass()}
                    placeholder="Default qty when re-ordering"
                  />
                </ModalField>
              </div>
              <label className="flex items-center gap-2 text-sm pt-2 border-t border-slate-100">
                <input
                  type="checkbox"
                  checked={snTracking}
                  onChange={(e) => setSnTracking(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span>SN-tracked (mints individual units on receive)</span>
              </label>
              {snTracking && (
                <ModalField label="SN prefix">
                  <input
                    value={snPrefix}
                    onChange={(e) => setSnPrefix(e.target.value.toUpperCase())}
                    className={modalInputClass()}
                    maxLength={20}
                    placeholder="Defaults to SKU if blank"
                  />
                </ModalField>
              )}
            </div>
          )}

          {tab === 'link' && (
            <div className="space-y-3">
              <input
                type="search"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Search catalog by name or SKU…"
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                autoFocus
              />
              <div className="border border-slate-200 rounded max-h-72 overflow-y-auto">
                {pickerResults.isLoading && (
                  <div className="px-3 py-2 text-xs text-slate-500">Loading…</div>
                )}
                {pickerResults.isError && <div role="alert" className="px-3 py-2 text-xs text-red-700">
                  Product search could not be loaded.
                  <button type="button" disabled={pickerResults.isFetching} className="ml-2 underline disabled:opacity-50" onClick={() => void pickerResults.refetch()}>Try again</button>
                </div>}
                {!pickerResults.isLoading && !pickerResults.isError && (pickerResults.data?.data ?? []).length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-500">
                    {debouncedQuery ? 'No matches.' : 'Start typing to search.'}
                  </div>
                )}
                {!pickerResults.isError && (pickerResults.data?.data ?? []).map((it) => (
                  <button
                    type="button"
                    key={it.id}
                    onClick={() => handleLink(it)}
                    disabled={isPending}
                    className="block w-full text-left px-3 py-2 hover:bg-amber-50 text-sm border-b border-slate-100 last:border-0"
                  >
                    <div className="font-medium text-slate-800">{it.name}</div>
                    {it.sku && (
                      <div className="font-mono text-xs text-slate-400">{it.sku}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 px-3 py-2 bg-red-50 border border-red-100 rounded">
              {error}
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Cancel
        </button>
        {tab === 'create' && (
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Create + link'}
          </button>
        )}
      </Modal.Footer>
    </Modal>
  )
}

function ModalField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

function modalInputClass(): string {
  return 'w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
}

// ===========================================================================
// ReceiveConflictModal — safety net so an edited receive bin doesn't silently
// split stock across multiple placements when the same item already lives
// somewhere else.
// ===========================================================================

function ReceiveConflictModal({
  conflicts,
  onCancel,
  onMerge,
  onCreateNew,
}: {
  conflicts: {
    po_item_id: string
    itemName: string
    chosenLabel: string
    existing: { bin_id: string | null; label: string; qty: number }[]
  }[]
  onCancel: () => void
  /** Maps po_item_id → the existing placement to merge into. */
  onMerge: (merges: Record<string, { bin_id: string | null }>) => void
  onCreateNew: () => void
}) {
  // Per-line user choice: which existing placement to merge into.
  // Defaults to the first existing placement (highest qty, by API order).
  const [chosen, setChosen] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const c of conflicts) {
      init[c.po_item_id] = c.existing[0]?.bin_id ?? '__null__'
    }
    return init
  })

  function handleMerge() {
    const merges: Record<string, { bin_id: string | null }> = {}
    for (const c of conflicts) {
      const sel = chosen[c.po_item_id]
      const match = c.existing.find((e) => (e.bin_id ?? '__null__') === sel)
      if (match) merges[c.po_item_id] = { bin_id: match.bin_id }
    }
    onMerge(merges)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 26, 46, 0.55)' }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-amber-700">
            ⚠ This item already has stock somewhere else
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Receiving into a different bin will split this item across
            multiple placements. Merge into an existing bin instead, or
            confirm you want a new placement.
          </p>
        </div>
        <div className="overflow-y-auto p-6 space-y-4">
          {conflicts.map((c) => (
            <div key={c.po_item_id} className="border border-slate-200 rounded p-3">
              <div className="font-medium text-slate-900">{c.itemName}</div>
              <div className="text-xs text-slate-500 mt-1">
                Chosen: <span className="font-mono">{c.chosenLabel}</span>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">
                  Merge into existing
                </div>
                {c.existing.map((e) => {
                  const key = e.bin_id ?? '__null__'
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={`merge-${c.po_item_id}`}
                        checked={chosen[c.po_item_id] === key}
                        onChange={() =>
                          setChosen((p) => ({ ...p, [c.po_item_id]: key }))
                        }
                      />
                      <span className="flex-1">📍 {e.label}</span>
                      <span className="text-slate-500 tabular-nums">qty {e.qty}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm px-3 py-1.5 text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCreateNew}
            className="text-sm px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50"
            title="Receive into the originally chosen bin and accept the split"
          >
            Create new placement
          </button>
          <button
            type="button"
            onClick={handleMerge}
            className="text-sm px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            Merge into existing
          </button>
        </div>
      </div>
    </div>
  )
}
