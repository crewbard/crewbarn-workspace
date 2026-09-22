import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'
import { BinTreePicker } from '@/components/BinTreePicker'
import { useCatalogItems } from '@/hooks/useCatalogItems'
import type { InventoryBin } from '@/types/inventoryBin'

/**
 * Stock arriving — put it somewhere and say what it cost.
 *
 * Posts a `receive` movement rather than editing a stock level directly. That
 * matters: the movement is the record of WHY the number changed, the applier
 * updates the level, and the accounting poster books the value. Writing the
 * level straight would move the quantity with nothing explaining it and nothing
 * in the ledger.
 *
 * Deliberately not a purchase-order receipt. Receiving against a PO already
 * exists at POST /v1/purchase-orders/{po}/receive and knows the ordered lines
 * and costs; this is the other case — a counter pickup, a walk-in delivery,
 * opening stock — where there is no PO to reconcile against.
 */

export function ReceiveStockModal({
  isOpen,
  onClose,
  defaultLocationId,
}: {
  isOpen: boolean
  onClose: () => void
  defaultLocationId?: string
}) {
  const qc = useQueryClient()
  const [itemId, setItemId] = useState('')
  const [itemLabel, setItemLabel] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [bin, setBin] = useState<InventoryBin | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [quantity, setQuantity] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const [supplier, setSupplier] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Products only. You cannot receive stock of a labour service, and the
  // catalog table holds services, products and bundles behind one discriminator.
  const items = useCatalogItems({ q: itemSearch, type: 'product', per_page: 20 })
  const itemResults = items.data?.data ?? []

  const qtyNum = Number(quantity)
  const canSave =
    !!itemId && !!bin && Number.isFinite(qtyNum) && qtyNum > 0

  const receive = useMutation({
    mutationFn: () =>
      apiRequest('/v1/inventory-movements', {
        method: 'POST',
        body: {
          type: 'receive',
          catalog_item_id: itemId,
          quantity: qtyNum,
          // Receiving has no origin — that's what makes it a receive rather
          // than a transfer. Only the destination is set.
          to_location_id: bin?.location_id,
          to_bin_id: bin?.id,
          unit_cost_cents: unitCost.trim() === '' ? undefined : Math.round(Number(unitCost) * 100),
          supplier_name: supplier.trim() || undefined,
          reference_number: reference.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: () => {
      // The level, the movement log and the location totals all move.
      void qc.invalidateQueries({ queryKey: ['inventory-stock-levels'] })
      void qc.invalidateQueries({ queryKey: ['inventory-movements'] })
      void qc.invalidateQueries({ queryKey: ['inventory-locations'] })
      reset()
      onClose()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not record that.'),
  })

  const reset = () => {
    setItemId(''); setItemLabel(''); setItemSearch(''); setBin(null)
    setQuantity('1'); setUnitCost(''); setSupplier(''); setReference(''); setNotes('')
    setError(null)
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Receive stock">
        <div className="space-y-4 p-6">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Item <span className="text-red-500">*</span>
            </label>
            {itemId ? (
              <div className="flex items-center gap-2 rounded border border-slate-200 px-3 py-2">
                <span className="flex-1 truncate text-sm font-medium text-slate-900">{itemLabel}</span>
                <button type="button" onClick={() => { setItemId(''); setItemLabel('') }}
                  className="text-xs font-semibold text-amber-700 hover:underline">Change</button>
              </div>
            ) : (
              <>
                <input
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Search by name or SKU…"
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
                {itemSearch.trim().length > 0 && (
                  <div className="mt-1 max-h-44 overflow-y-auto rounded border border-slate-200">
                    {itemResults.length === 0 && (
                      <p className="px-3 py-2 text-xs text-slate-500">
                        {items.isLoading ? 'Searching…' : 'Nothing matches.'}
                      </p>
                    )}
                    {itemResults.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => {
                          setItemId(it.id)
                          setItemLabel(it.sku ? `${it.name} · ${it.sku}` : it.name)
                          // Prefill what it normally costs, still editable —
                          // this delivery may have been priced differently.
                          const cost = it.pricing?.owner_cost_cents
                          if (cost) setUnitCost((cost / 100).toFixed(2))
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50"
                      >
                        <span className="flex-1 truncate">{it.name}</span>
                        {it.sku && <span className="font-mono text-xs text-slate-400">{it.sku}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Put it in <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center gap-2 rounded border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className={`flex-1 truncate ${bin ? 'text-slate-900' : 'text-slate-400'}`}>
                {bin ? (bin.path_label || bin.name || bin.bin_code) : 'Pick a bin…'}
              </span>
              <span className="text-xs font-semibold text-amber-700">
                {bin ? 'Change' : 'Choose'}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number" min="0.01" step="any" value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Unit cost
              </label>
              <input
                type="number" min="0" step="0.01" value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">What you paid, per unit.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Supplier
              </label>
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Reference
              </label>
              <input value={reference} onChange={(e) => setReference(e.target.value)}
                placeholder="Invoice or packing slip #"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
          </div>

          <p className="text-[11px] text-slate-500">
            Receiving against a purchase order? Open the PO instead — it knows what was ordered and
            what it cost, and marks the lines received.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button
            type="button"
            disabled={!canSave || receive.isPending}
            onClick={() => { setError(null); receive.mutate() }}
            className="rounded bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {receive.isPending ? 'Receiving…' : 'Receive stock'}
          </button>
        </div>
      </Modal>

      <BinTreePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        defaultLocationId={defaultLocationId}
        title="Where is it going?"
        highlightItemId={itemId || undefined}
        onPick={(picked) => { setBin(picked); setPickerOpen(false) }}
      />
    </>
  )
}
