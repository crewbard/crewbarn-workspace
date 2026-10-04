import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLowStock } from '@/hooks/useLowStock'
import { useVendors } from '@/hooks/useVendors'
import { useCreatePurchaseOrder, purchaseOrderKeys } from '@/hooks/usePurchaseOrders'
import { createPurchaseOrderItem } from '@/lib/purchaseOrders'
import { useQueryClient } from '@tanstack/react-query'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { tenantDate, useTenantTimezone } from '@/hooks/useTenantTime'
import { ApiError } from '@/lib/api'
import type { LowStockItem } from '@/types/lowStock'
import type { Vendor } from '@/types/vendor'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'

/**
 * Standalone "Needs Ordered" report. Surfaces every catalog item whose
 * total qty_on_hand has fallen at or below its reorder_threshold, with
 * a bulk-select + "Create PO from selected" workflow.
 *
 * Backed by GET /v1/inventory-stock-levels/low-stock (already filters
 * out is_stocked_item=false and active=false items). One PO per
 * Create-PO click — pick a vendor, all selected lines go in.
 *
 * Creating POs requires inventory.edit, matching the API.
 */
export function NeedsOrderedPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  // inventory.edit — the same permission POST /v1/purchase-orders enforces.
  // Gating on is_platform_admin meant no tenant could raise a PO from here,
  // including the owner, while the API would have accepted it.
  const canCreate = usePermissions().has(PERM.INVENTORY_EDIT)
  const navigate = useNavigate()

  const lowStockQuery = useLowStock(true)
  const items: LowStockItem[] = lowStockQuery.data ?? []

  // Per-row state: selected? + qty (defaults to suggested_qty)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [qtys, setQtys] = useState<Record<string, string>>({})

  useEffect(() => {
    // Seed qty defaults whenever the data refreshes — but only for rows
    // we haven't already touched, so user edits aren't clobbered.
    setQtys((prev) => {
      const next = { ...prev }
      for (const it of items) {
        if (next[it.id] === undefined) {
          next[it.id] = String(Math.ceil(it.suggested_qty || 0))
        }
      }
      return next
    })
  }, [items])

  const selectedCount = useMemo(
    () => items.filter((it) => selected[it.id] && Number(qtys[it.id]) > 0).length,
    [items, selected, qtys]
  )

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected({})
      return
    }
    const next: Record<string, boolean> = {}
    for (const it of items) next[it.id] = true
    setSelected(next)
  }

  const [creating, setCreating] = useState(false)

  return (
    <div className={easy ? 'w-full min-w-0 p-6 space-y-6' : 'max-w-6xl mx-auto p-6 space-y-6'}>
      {easy ? <EasyPageHeading title="What needs ordering" description="Review low stock, choose the items and quantities you need, then create a draft purchase order. Nothing is ordered by selecting a row." /> : <div>
        <h1 className="text-3xl font-semibold text-slate-900">Needs Ordered</h1>
        <p className="text-sm text-slate-600 mt-1">
          Items at or below their reorder threshold. Tick the ones you want to
          order, adjust qty if needed, then create a draft Purchase Order.
        </p>
      </div>}
      {easy && !lowStockQuery.isLoading && !lowStockQuery.isError && <section aria-label="Reorder summary" className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Items at their reorder threshold</p><p className="mt-1 text-2xl font-semibold">{items.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Selected with a positive quantity</p><p className="mt-1 text-2xl font-semibold">{selectedCount}</p></div>
      </section>}

      {lowStockQuery.isLoading && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center text-sm text-slate-500">
          Loading…
        </div>
      )}

      {lowStockQuery.isError && (
        <div role="alert" className="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">
          Failed to load low-stock items.
          {lowStockQuery.error instanceof Error ? ` ${lowStockQuery.error.message}` : ''}
          <button type="button" disabled={lowStockQuery.isFetching} onClick={() => void lowStockQuery.refetch()} className="ml-2 underline disabled:opacity-50">Retry</button>
        </div>
      )}

      {!lowStockQuery.isLoading && !lowStockQuery.isError && items.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
          <p className="text-sm text-slate-600">
            ✓ Nothing to reorder right now. Every stocked item is above its threshold.
          </p>
        </div>
      )}

      {!lowStockQuery.isLoading && !lowStockQuery.isError && items.length > 0 && (
        <div className={`bg-white border border-slate-200 rounded-xl shadow-sm ${easy ? 'overflow-x-auto' : 'overflow-hidden'}`}>
          <table className={`w-full text-sm ${easy ? 'min-w-[760px]' : ''}`}>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={items.length > 0 && items.every((it) => selected[it.id])}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-left px-4 py-3 font-medium">Supplier hint</th>
                <th className="text-right px-4 py-3 font-medium">On hand</th>
                <th className="text-right px-4 py-3 font-medium">Threshold</th>
                <th className="text-right px-4 py-3 font-medium">Order qty</th>
                <th className="text-right px-4 py-3 font-medium">Owner cost</th>
                <th className="text-right px-4 py-3 font-medium">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it) => {
                const qtyN = Number(qtys[it.id]) || 0
                const lineTotal = (qtyN * it.owner_cost_cents) / 100
                const checked = !!selected[it.id]
                return (
                  <tr key={it.id} className={checked ? 'bg-amber-50/40' : ''}>
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelected((p) => ({ ...p, [it.id]: e.target.checked }))
                        }
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{it.name}</div>
                      {it.sku && (
                        <div className="text-xs font-mono text-slate-500">{it.sku}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {it.supplier_name || <span className="text-slate-400">—</span>}
                      {it.supplier_sku && (
                        <div className="font-mono text-slate-400 text-[11px]">{it.supplier_sku}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-700 font-semibold">
                      {it.current_stock}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {it.reorder_threshold}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={qtys[it.id] ?? ''}
                        onChange={(e) =>
                          setQtys((p) => ({
                            ...p,
                            [it.id]: e.target.value.replace(/[^0-9]/g, ''),
                          }))
                        }
                        className="w-20 text-sm text-right px-2 py-1 border border-slate-300 rounded focus:outline-none focus:border-amber-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      ${(it.owner_cost_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-900 font-semibold">
                      ${lineTotal.toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            <span className="text-sm text-slate-600">
              {selectedCount} selected
            </span>
            <button
              type="button"
              onClick={() => setCreating(true)}
              disabled={!canCreate || selectedCount === 0}
              className="text-sm px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-medium transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
              title={!canCreate ? 'Admin only' : undefined}
            >
              Create PO from selected
            </button>
          </div>
        </div>
      )}

      {creating && (
        <CreatePoFromSelectionModal
          items={items.filter((it) => selected[it.id] && Number(qtys[it.id]) > 0)}
          qtys={qtys}
          onClose={() => setCreating(false)}
          onCreated={(poId) => {
            setCreating(false)
            setSelected({})
            navigate(`/purchase-orders/${poId}`)
          }}
        />
      )}
    </div>
  )
}

// ---- Create PO from selection modal ----

function CreatePoFromSelectionModal({
  items,
  qtys,
  onClose,
  onCreated,
}: {
  items: LowStockItem[]
  qtys: Record<string, string>
  onClose: () => void
  onCreated: (poId: string) => void
}) {
  const tenantTimezone = useTenantTimezone()
  const { data: vendorsData } = useVendors({ active: true, per_page: 200 })
  const vendors = vendorsData?.data ?? []
  const [vendorId, setVendorId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const createPoMutation = useCreatePurchaseOrder()
  const [creatingLines, setCreatingLines] = useState(false)

  const subtotalCents = items.reduce(
    (sum, it) => sum + (Number(qtys[it.id]) || 0) * it.owner_cost_cents,
    0
  )

  // Suggest a default vendor if exactly one supplier_name appears in selection
  // and we can match it to an existing vendor by name (case-insensitive).
  useEffect(() => {
    if (vendorId) return
    const suppliers = new Set(items.map((it) => it.supplier_name).filter(Boolean))
    if (suppliers.size === 1) {
      const supplier = Array.from(suppliers)[0] as string
      const match = vendors.find(
        (v: Vendor) => v.name.toLowerCase() === supplier.toLowerCase()
      )
      if (match) setVendorId(match.id)
    }
  }, [items, vendors, vendorId])

  const isPending = createPoMutation.isPending || creatingLines

  async function handleCreate() {
    if (!vendorId) {
      setError('Pick a vendor.')
      return
    }
    setError(null)
    try {
      setProgress('Creating PO…')
      const po = await createPoMutation.mutateAsync({
        vendor_id: vendorId,
        order_date: tenantDate(tenantTimezone),
        status: 'draft',
      })

      // Create line items sequentially. (Most users will reorder small
      // batches — a parallel push would be faster but harder to surface
      // partial-failure errors against.) Using the lib function directly
      // because poId is only known at runtime.
      setCreatingLines(true)
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const qty = Number(qtys[it.id]) || 0
        if (qty <= 0) continue
        setProgress(`Adding line ${i + 1} of ${items.length}…`)
        await createPurchaseOrderItem(po.id, {
          catalog_item_id: it.id,
          description: it.name,
          qty_ordered: qty,
          unit_cost_cents: it.owner_cost_cents,
        })
      }
      setCreatingLines(false)
      // Invalidate the PO detail/items so the line items show up there.
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(po.id) })

      setProgress(null)
      onCreated(po.id)
    } catch (err) {
      setProgress(null)
      setCreatingLines(false)
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 26, 46, 0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose()
      }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Create draft PO</h2>
          <p className="text-xs text-slate-500 mt-1">
            {items.length} line{items.length === 1 ? '' : 's'} · subtotal $
            {(subtotalCents / 100).toFixed(2)}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
              Vendor <span className="text-red-500">*</span>
            </label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
            >
              <option value="">— Pick a vendor —</option>
              {vendors.map((v: Vendor) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
            {vendors.length === 0 && (
              <p className="text-xs text-amber-700 mt-2">
                No active vendors yet. Add one from Tool Shed → Vendors first.
              </p>
            )}
          </div>

          {progress && (
            <div className="text-sm text-slate-600">{progress}</div>
          )}
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-sm px-3 py-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending || !vendorId}
            className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium transition-colors"
          >
            {isPending ? 'Creating…' : 'Create draft PO'}
          </button>
        </div>
      </div>
    </div>
  )
}
