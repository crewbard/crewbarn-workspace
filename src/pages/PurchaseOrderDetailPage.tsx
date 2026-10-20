import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  usePurchaseOrder,
  useUpdatePurchaseOrder,
  useDeletePurchaseOrder,
  useCreatePurchaseOrderItem,
  useUpdatePurchaseOrderItem,
  useSupplierCopy,
  useDeletePurchaseOrderItem,
  useReceivePurchaseOrder,
  purchaseOrderKeys,
} from '@/hooks/usePurchaseOrders'
import { useCatalogItems } from '@/hooks/useCatalogItems'
import { useVendors } from '@/hooks/useVendors'
import { useAllInventoryBins } from '@/hooks/useInventoryBins'
import { BinTreePicker } from '@/components/BinTreePicker'
import type { InventoryBin } from '@/types/inventoryBin'
import { listStockLevels } from '@/lib/inventoryStockLevels'
import type { InventoryStockLevel } from '@/types/inventoryStockLevel'
import { isCountableUnit, qtyStepFor } from '@/lib/unitsOfMeasure'
import { useInventoryLocations } from '@/hooks/useInventoryLocations'
import { useLowStock } from '@/hooks/useLowStock'
import { Modal } from '@/components/ui/Modal'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { ReceiveOverlay, type ReceiveOutcome } from '@/components/inventory/receive/ReceiveOverlay'
import { rememberSpot, rememberedSpot, spotPath } from '@/lib/receiveSpot'
import { ApiError, apiRequest, isDeleteCancelled } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { getPoParts } from '@/lib/poParts'
import { ReceiveJobDone, type JobHolder } from '@/components/inventory/receive/ReceiveJobDone'
import { AttachJobInline } from '@/components/inventory/receive/AttachJobInline'
import type { WorkOrder } from '@/types/workOrder'
import { continueAfterFailedConflictCheck } from '@/lib/conflictCheck'
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
import { PoPartsPanel } from '@/components/purchasing/PoPartsPanel'
import { LinkOrCreateCatalogItemModal } from '@/components/purchasing/LinkOrCreateCatalogItemModal'
import { CatalogItemQuickCreate } from '@/components/CatalogItemQuickCreate'
// The --bins-* theme roles used below ([data-bins-ui]).
import '@/components/inventory/bins/bins.css'

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

/** Past draft, an order needs a vendor (cancelling one does not). */
const NEEDS_VENDOR: PurchaseOrderStatus[] = ['ordered', 'partially_received', 'received', 'completed']

/**
 * Who a draft goes to. A draft can be started without one -- from the
 * catalog, say -- and the buyer chooses here, after looking it over.
 */
function VendorPicker({ po, onError }: { po: PurchaseOrder; onError: (message: string | null) => void }) {
  const vendorsQuery = useVendors({ active: true, per_page: 200 })
  const updateMutation = useUpdatePurchaseOrder()
  const vendors = vendorsQuery.data?.data ?? []
  // The one on the order, even if it has since been made inactive.
  const current = po.vendor && !vendors.some((v) => v.id === po.vendor?.id) ? po.vendor : null

  return (
    <select
      id="po-vendor"
      aria-label="Who this order is going to"
      value={po.vendor_id ?? ''}
      disabled={updateMutation.isPending}
      onChange={async (e) => {
        onError(null)
        try {
          await updateMutation.mutateAsync({ id: po.id, input: { vendor_id: e.target.value || null } })
        } catch (error) {
          onError(error instanceof Error ? error.message : 'Could not change who this order is going to.')
        }
      }}
      className="ml-1 max-w-[16rem] rounded border border-slate-300 bg-white px-2 py-0.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
    >
      <option value="">Not chosen yet</option>
      {current && <option value={current.id}>{current.label}</option>}
      {vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
    </select>
  )
}

const STATUS_OPTIONS: PurchaseOrderStatus[] = [
  'draft',
  'ordered',
  'partially_received',
  'received',
  'completed',
  'cancelled',
]

/** recordId: the order, when shown inside a task rather than at its own address. */
export function PurchaseOrderDetailPage({ recordId }: { recordId?: string } = {}) {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const [statusError, setStatusError] = useState<string | null>(null)
  const { id: routeId } = useParams<{ id: string }>()
  const id = recordId ?? routeId
  const navigate = useNavigate()
  const poQuery = usePurchaseOrder(id)
  const updateMutation = useUpdatePurchaseOrder()
  const deleteMutation = useDeletePurchaseOrder()
  // Every write on this page goes through inventory.edit on the server.
  const canEdit = usePermissions().has(PERM.INVENTORY_EDIT)

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
    // Ordering, receiving or closing out needs somebody to order from.
    if (!po.vendor_id && NEEDS_VENDOR.includes(next)) {
      setStatusError('Choose who this order is going to first.')
      document.getElementById('po-vendor')?.focus()
      return
    }
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
    } catch (err) {
      if (!isDeleteCancelled(err)) {
        setStatusError(err instanceof Error ? err.message : 'Could not delete this purchase order.')
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="mb-4">
        <Link to="/purchase-orders" className="text-sm text-amber-700 hover:underline">
          ← Back to purchase orders
        </Link>
      </div>

      <div data-tour="po-detail-header" data-status={po.status} data-vendor={po.vendor_id ? 'set' : 'none'} data-auto={po.auto_reorder ? 'yes' : 'no'} data-for={po.estimate_id ? 'estimate' : po.work_order_id ? 'job' : 'stock'} data-can-edit={canEdit ? 'yes' : 'no'} className={easy ? 'mb-6 flex flex-wrap items-start justify-between gap-5 rounded-2xl bg-emerald-950 p-5 sm:p-7' : 'flex flex-wrap items-start justify-between mb-6 gap-6'}>
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
            {po.auto_reorder && (
              <span
                className="px-2 py-0.5 text-xs font-medium rounded bg-sky-100 text-sky-800"
                title="CrewBarn started this draft when these items reached their reorder threshold. Check the quantities, then mark it ordered."
              >
                Low-stock reorder
              </span>
            )}
            {po.source_call && (
              <Link
                to={po.source_call.conversation_id ? `/communications?conversation=${encodeURIComponent(po.source_call.conversation_id)}` : '/communications'}
                className="px-2 py-0.5 text-xs font-medium rounded bg-violet-100 text-violet-800 hover:underline"
                title="Written from a call with the vendor. Listen to it and check the parts, quantities and prices before sending."
              >
                From a call · listen
              </Link>
            )}
            {po.source_takeoff_id && (
              <Link
                to={`/purchase-orders/blueprints/${po.source_takeoff_id}`}
                className="px-2 py-0.5 text-xs font-medium rounded bg-teal-100 text-teal-800 hover:underline"
                title="Parts read off a blueprint. Check them against the drawing before sending."
              >
                From a blueprint · open
              </Link>
            )}
          </div>
          <p data-tour="po-detail-vendor" className={`text-sm mt-1 ${easy ? 'text-emerald-100' : 'text-slate-600'}`}>
            Vendor:{' '}
            {canEdit && po.status === 'draft'
              ? <VendorPicker po={po} onError={setStatusError} />
              : <span className="font-medium">{po.vendor?.label ?? 'Not chosen yet'}</span>}
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
        <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/purchase-orders/${po.id}/supplier-copy`}
          data-bins-ui
          data-tour="po-supplier-copy"
          className="rounded-md border border-[var(--bins-border)] bg-[var(--bins-surface)] px-3 py-1.5 text-sm font-medium text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]"
          title="The order for the supplier, to print or save as PDF: their part numbers, no bins, no internal SKUs, no notes"
        >
          Supplier copy
        </Link>
        {canEdit && <div data-tour="po-detail-status" className={easy ? 'flex flex-wrap items-center gap-2 rounded-xl bg-white p-2' : 'flex items-center gap-2'}>
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
        </div>}
        </div>
      </div>

      {statusError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{statusError}</p>}
      {easy && <nav aria-label="Purchase order sections" className="mb-5 flex flex-wrap gap-2">
        <a href="#po-details" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">Order details</a>
        <a href="#po-items" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">Items & quantities</a>
        {['draft', 'ordered', 'partially_received', 'received'].includes(po.status) && <a href="#po-receive" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">Receive delivery</a>}
      </nav>}

      <div id="po-details" data-tour="po-detail-headercard" className="scroll-mt-24"><HeaderCard po={po} canEdit={canEdit} /></div>
      <div id="po-items" data-tour="po-detail-lines" className="scroll-mt-24"><LineItemsCard po={po} canEdit={canEdit} /></div>
      {canEdit && (po.status === 'draft' ||
        po.status === 'ordered' ||
        po.status === 'partially_received' ||
        po.status === 'received') && <div id="po-receive" data-tour="po-detail-receive" className="scroll-mt-24"><ReceivePanel po={po} /></div>}
      <div id="po-for" className="scroll-mt-24"><PoPartsPanel poId={po.id} status={po.status} /></div>
    </div>
  )
}

// ============================================================
// Header card — order date, expected delivery, totals, notes
// ============================================================

function HeaderCard({ po, canEdit }: { po: PurchaseOrder; canEdit: boolean }) {
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
          canEdit ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-amber-700 hover:underline font-medium"
            >
              Edit
            </button>
          ) : null
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setOrderDate(po.order_date ?? '')
                setExpected(po.expected_delivery ?? '')
                setNotes(po.notes ?? '')
                setTaxDollars(po.money.tax_cents == null ? '' : (po.money.tax_cents / 100).toFixed(2))
                setShipDollars(po.money.shipping_cents == null ? '' : (po.money.shipping_cents / 100).toFixed(2))
                setVendorOrderNumber(po.vendor_order_number ?? '')
                setError(null)
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

function LineItemsCard({ po, canEdit }: { po: PurchaseOrder; canEdit: boolean }) {
  const items = po.items ?? []
  const [adding, setAdding] = useState(false)
  const [showLowStock, setShowLowStock] = useState(false)

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Line items{items.length > 0 && ` (${items.length})`}
        </h2>
        {canEdit && <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLowStock(true)}
            data-tour="po-low-stock-button"
            className="text-xs px-3 py-1.5 bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 rounded font-medium"
          >
            ⚠ Low stock
          </button>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              data-tour="po-add-line"
              className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium"
            >
              + Add line
            </button>
          )}
        </div>}
      </div>

      {adding && (
        <NewLineItemPanel
          poId={po.id}
          vendorLabel={po.vendor?.label ?? null}
          onClose={() => setAdding(false)}
        />
      )}

      {items.length === 0 && !adding && (
        <div data-tour="po-lines-empty" className="px-5 py-8 text-center text-sm text-slate-500">
          {canEdit ? 'No line items yet. Click "+ Add line" or "⚠ Low stock" to start.' : 'No line items yet.'}
        </div>
      )}

      {items.length > 0 && (
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
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
              <LineItemRow key={it.id} poId={po.id} item={it} poStatus={po.status} canEdit={canEdit} />
            ))}
          </tbody>
        </table>
        </div>
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
  canEdit,
}: {
  poId: string
  item: PurchaseOrderItem
  poStatus: PurchaseOrderStatus
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  // Shared query: one fetch for every line. True when the supplier copy has no number for this line.
  const supplierCopy = useSupplierCopy(poId)
  const noSupplierNumber = !!supplierCopy.data?.lines.find((l) => l.id === item.id)?.missing_part_number
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
        {noSupplierNumber && (
          <div data-bins-ui data-tour="po-line-no-supplier-number" className="mt-1 inline-flex rounded bg-[color-mix(in_srgb,var(--color-warning)_12%,var(--bins-surface))] px-1.5 py-0.5 text-[11px] font-medium text-[var(--bins-text)]"
            title="The supplier copy shows only the description for this line. Add the supplier's part number on the line or under Who sells this.">
            No supplier part number: the supplier copy shows the description only
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
        {canEdit && (
          <>
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
          </>
        )}
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
    <div data-tour="po-new-line" className="border-b border-slate-200 bg-amber-50/40 px-5 py-4 space-y-3">
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
          data-tour="po-new-line-cancel"
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
        <CatalogItemQuickCreate
          defaultName={pickerQuery || description}
          defaultUnitCostCents={Math.round(Number(unitDollars) * 100) || 0}
          defaultSupplierName={vendorLabel ?? ''}
          stockComesFromPo
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
        <div data-tour="po-detail-lowstock" className="space-y-3">
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
          data-tour="po-lowstock-cancel"
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
  // Receive delivery overlay (location → spot → receive → print). The panel
  // below stays as it was ("Classic"), every feature still there.
  const [overlayOpen, setOverlayOpen] = useState(false)
  // "Choose spot" in Receive into: the same overlay, spot step only.
  const [pickingPanelSpot, setPickingPanelSpot] = useState(false)
  const canAddPlaces = usePermissions().has(PERM.INVENTORY_EDIT)
  // An order for a job or estimate: who it's for, the tech, the van, the asset.
  const forSomething = !!po.work_order_id || !!po.estimate_id
  const poParts = useQuery({ queryKey: [...purchaseOrderKeys.detail(po.id), 'parts'], queryFn: () => getPoParts(po.id), enabled: forSomething })
  const jobId = poParts.data?.job?.id ?? po.work_order_id ?? null
  const job = useQuery({
    queryKey: ['work-order', jobId, 'lead-tech'],
    queryFn: () => apiRequest<{ data: WorkOrder }>(`/v1/work-orders/${jobId}`).then((r) => r.data),
    enabled: !!jobId,
  })
  const tech = job.data?.lead_tech ?? null
  // Everyone on the job, lead first: whoever will hold the part gets it in their van.
  const vanOf = (accountId: string) => locations.find((l) => l.type === 'truck' && l.assigned_tech_account_id === accountId) ?? null
  const holders: JobHolder[] = [
    ...(tech ? [{ id: tech.id, name: tech.full_name, van: vanOf(tech.id) }] : []),
    ...(job.data?.crew_members ?? []).filter((m) => m.id !== tech?.id).map((m) => ({ id: m.id, name: m.name, van: vanOf(m.id) })),
  ]
  const [notStocked, setNotStocked] = useState(false)
  const canJobs = usePermissions().hasAny([PERM.JOBS_VIEW, PERM.JOBS_EDIT])
  const techVan = tech ? locations.find((l) => l.type === 'truck' && l.assigned_tech_account_id === tech.id) ?? null : null
  const jobAsset = (() => {
    const a = poParts.data?.assets ?? []
    const on = a.filter((x) => x.on_job)
    return on.length === 1 ? on[0].label : on.length > 1 ? ` assets` : null
  })()
  const forLabel = poParts.data?.job
    ? [`Job #${poParts.data.job.number}`, tech ? `Tech: ${tech.full_name}` : null, jobAsset ? `Asset: ${jobAsset}` : null].filter(Boolean).join(' · ')
    : poParts.data?.estimate ? `Estimate ${poParts.data.estimate.number}` : null
  // When the overlay's receive needs the merge/split question, the overlay
  // waits here until the question is answered, then finishes on Done.
  const conflictWaiter = useRef<((outcome: ReceiveOutcome) => void) | null>(null)
  function settleConflict(outcome: ReceiveOutcome) {
    const done = conflictWaiter.current
    conflictWaiter.current = null
    done?.(outcome)
  }
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
  async function handleSubmit(intoBin?: InventoryBin): Promise<ReceiveOutcome> {
    setError(null)
    const explicitLocation = panelLocationId || undefined
    const explicitBin = panelBinId || undefined
    const lines: ResolvedReceiveLine[] = Object.entries(draftQty)
      .map(([po_item_id, qtyStr]) => {
        // A per-line pick still wins; the overlay's spot fills the rest.
        const perLineBin = lineBin[po_item_id] ?? intoBin
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
      return 'error'
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
        if (!intoBin) return 'conflict'
        const catalogIds = lines.map((l) => items.find((it) => it.id === l.po_item_id)?.catalog_item_id)
        return await new Promise<ReceiveOutcome>((resolve) => {
          conflictWaiter.current = (outcome) => {
            if (outcome === 'done') rememberSpot(catalogIds, intoBin.id)
            resolve(outcome)
          }
        })
      }
    } catch (e) {
      // Can't see stock levels (403): receive as before. Any other failure
      // means the check didn't run, so ask rather than split stock unseen.
      if (!continueAfterFailedConflictCheck(e, 'stock already in other bins')) return 'error'
    } finally {
      setCheckingConflicts(false)
    }

    const ok = await executeReceive(lines)
    if (ok && intoBin) {
      rememberSpot(lines.map((l) => items.find((it) => it.id === l.po_item_id)?.catalog_item_id), intoBin.id)
    }
    return ok ? 'done' : 'error'
  }

  async function executeReceive(lines: ResolvedReceiveLine[]): Promise<boolean> {
    setError(null)
    try {
      await receiveMutation.mutateAsync({ lines })
      setDraftQty({})
      setLineBin({})
      setPendingReceive(null)
      return true
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
      return false
    }
  }

  function openOverlay() {
    // Mindless: nothing typed yet means "all of it".
    if (!Object.values(draftQty).some((q) => Number(q) > 0)) fillRemaining()
    setError(null)
    setOverlayOpen(true)
  }

  // Lines the overlay will receive: what's typed, or everything left.
  const overlayLines = receivable
    .filter((it) => !!it.catalog_item_id)
    .map((it) => {
      const typed = Number(draftQty[it.id])
      const left = Math.floor((it.qty_ordered ?? 0) - (it.qty_received ?? 0))
      return { id: it.id, name: it.description ?? 'item', qty: draftQty[it.id] !== undefined ? (typed || 0) : left, catalogItemId: it.catalog_item_id ?? null }
    })
    .filter((l) => l.qty > 0)
  // Free-text lines can't go on a shelf until they're a product; the overlay
  // offers Create product for them first (the same window as the table's).
  const overlayUnlinked = receivable
    .filter((it) => !it.catalog_item_id)
    .map((it) => {
      const left = Math.floor((it.qty_ordered ?? 0) - (it.qty_received ?? 0))
      return { id: it.id, name: it.description ?? 'item', qty: draftQty[it.id] !== undefined ? (Number(draftQty[it.id]) || 0) : left }
    })
    .filter((l) => l.qty > 0)
  const panelSpotPath = panelBinId ? spotPath(bins, panelBinId) : ''
  const firstLine = receivable.find((it) => overlayLines.some((l) => l.id === it.id))
  const overlayStartBin = (firstLine && lineBin[firstLine.id]?.id)
    || rememberedSpot(firstLine?.catalog_item_id)
    || panelBinId
    || firstLine?.catalog_item?.default_bin?.id
    || null
  // A job's parts go to the job's tech: start in their van when they have one.
  const overlayStartLoc = techVan?.id || panelLocationId || null
  const overlayStartSpot = techVan
    ? (bins.find((b) => b.id === overlayStartBin)?.location_id === techVan.id ? overlayStartBin : null)
    : overlayStartBin

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
          data-tour="po-receive-fill"
          className="text-xs px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded font-medium"
        >
          Fill remaining
        </button>
      </div>

      <div data-tour="po-receive-into" className="px-5 py-3 border-b border-slate-200 bg-white">
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
{panelLocationId ? (
            // The spot opens the Bins tree (and the builder, for a new one).
            <button
              type="button"
              onClick={() => setPickingPanelSpot(true)}
              data-tour="po-receive-choose-spot"
              className="text-sm px-3 py-1.5 border border-slate-300 rounded bg-white min-w-[200px] max-w-[420px] text-left truncate hover:border-[var(--accent-500)]"
              title={panelBinId ? panelSpotPath : 'Choose the exact spot, or leave it as any bin in this location'}
            >
              {panelBinId
                ? <><span className="text-slate-500">Spot:</span> <span className="font-medium text-slate-800">{panelSpotPath}</span></>
                : <><span className="font-medium text-[var(--accent-600)]">Choose spot</span> <span className="text-slate-400">· any bin for now</span></>}
            </button>
          ) : (
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
          )}
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
            No inventory locations yet. Add one on the Locations tab of Inventory before receiving.
          </p>
        )}
      </div>

      <div data-tour="po-receive-lines" className="overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
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
                      Create product
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>

      {error && (
        <div className="mx-5 my-3 text-xs text-red-600 px-3 py-2 bg-red-50 border border-red-100 rounded">
          {error}
        </div>
      )}

      <div data-tour="po-receive-submit" className="flex items-center justify-end gap-3 px-5 py-3 bg-slate-50 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setDraftQty({})}
          className="text-sm px-3 py-1.5 text-slate-600 hover:text-slate-900"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={openOverlay}
          disabled={receiveMutation.isPending || checkingConflicts}
          data-tour="po-receive-overlay"
          className="text-sm px-4 py-2 sm:py-1.5 bg-[var(--accent-500)] hover:bg-[var(--accent-600)] text-white rounded font-semibold disabled:opacity-50"
        >
          Put away &amp; receive
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={receiveMutation.isPending || checkingConflicts}
          className="text-sm px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium disabled:opacity-50"
        >
          {checkingConflicts ? 'Checking…' : receiveMutation.isPending ? 'Receiving…' : 'Receive selected'}
        </button>
      </div>

      {pickingPanelSpot && (
        <ReceiveOverlay
          mode="pick"
          poId={po.id}
          lines={overlayLines}
          locations={locations}
          canEdit={canAddPlaces}
          unlinked={overlayUnlinked}
          notStocked={notStocked}
          onNotStocked={canAddPlaces ? setNotStocked : undefined}
          jobLink={<AttachJobInline poId={po.id} linked={poParts.data?.job ? `Job #${poParts.data.job.number}` : null} canSearch={canJobs} />}
          onLink={(id) => { const it = items.find((x) => x.id === id); if (it) setNeedsCatalog(it) }}
          paused={!!needsCatalog}
          initialBinId={panelBinId || null}
          initialLocationId={panelLocationId || null}
          error={null}
          onPicked={(bin) => { setPanelLocationId(bin.location_id); setPanelBinId(bin.id) }}
          onReceive={async () => 'cancelled'}
          onClose={() => setPickingPanelSpot(false)}
        />
      )}
      {/* Before the Create product window, so that window opens over the overlay. */}
      {overlayOpen && (
        <ReceiveOverlay
          poId={po.id}
          lines={overlayLines}
          locations={locations}
          canEdit={canAddPlaces}
          initialBinId={overlayStartSpot}
          initialLocationId={overlayStartLoc}
          forLabel={forLabel}
          renderDone={poParts.data && (poParts.data.job || poParts.data.estimate) ? ({ bin, lines }) => (
            <ReceiveJobDone poId={po.id} parts={poParts.data!} bin={bin} lines={lines} holders={holders} canEdit={canAddPlaces} />
          ) : undefined}
          error={error}
          unlinked={overlayUnlinked}
          notStocked={notStocked}
          onNotStocked={canAddPlaces ? setNotStocked : undefined}
          jobLink={<AttachJobInline poId={po.id} linked={poParts.data?.job ? `Job #${poParts.data.job.number}` : null} canSearch={canJobs} />}
          paused={!!needsCatalog || !!pendingReceive}
          onLink={(id) => { const it = items.find((x) => x.id === id); if (it) setNeedsCatalog(it) }}
          onSkipUnlinked={() => setDraftQty((p) => {
            const next = { ...p }
            for (const u of overlayUnlinked) delete next[u.id]
            return next
          })}
          onReceive={(bin) => handleSubmit(bin)}
          onClose={() => setOverlayOpen(false)}
        />
      )}
      {needsCatalog && (
        <LinkOrCreateCatalogItemModal
          poId={po.id}
          line={needsCatalog}
          vendorLabel={po.vendor?.label ?? null}
          defaultStocked={!notStocked}
          // Only a place that takes stock (holds_stock, as in the bin tree and
          // BinRules on the server) becomes the Default Bin.
          defaultBin={[lineBin[needsCatalog.id], filteredBins.find((b) => b.id === panelBinId)]
            .find((b) => b && b.holds_stock !== false) ?? null}
          onClose={() => setNeedsCatalog(null)}
          onLinked={() => {
            // Straight back to receiving it: everything still to come.
            const left = (needsCatalog.qty_ordered ?? 0) - (needsCatalog.qty_received ?? 0)
            if (left > 0) setQty(needsCatalog.id, String(left))
          }}
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
          onCancel={() => { setPendingReceive(null); settleConflict('cancelled') }}
          onMerge={(merges) => {
            // Replace the chosen bin on each conflicting line with the
            // existing bin the user picked to merge into.
            const lines = pendingReceive.lines.map((line) => {
              const chosen = merges[line.po_item_id]
              if (!chosen) return line
              return { ...line, bin_id: chosen.bin_id, location_id: undefined as string | undefined }
            })
            void executeReceive(lines).then((ok) => settleConflict(ok ? 'merged' : 'error'))
          }}
          onCreateNew={() => { void executeReceive(pendingReceive.lines).then((ok) => settleConflict(ok ? 'done' : 'error')) }}
        />
      )}
    </div>
  )
}

// ============================================================
// Link/Create catalog item modal — for free-text PO lines that need a
// catalog ref before receive can apply stock.
// ============================================================

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
