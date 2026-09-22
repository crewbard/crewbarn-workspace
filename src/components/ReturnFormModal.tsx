import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createReturn, uploadReturnLabel } from '@/lib/inventoryReturns'
import { useVendors } from '@/hooks/useVendors'
import { ApiError } from '@/lib/api'
import type { InventoryStockLevel } from '@/types/inventoryStockLevel'

const REASON_OPTIONS = [
  { value: 'damaged', label: 'Damaged / Defective' },
  { value: 'wrong_item', label: 'Wrong item received' },
  { value: 'recalled', label: 'Recalled' },
  { value: 'overstock', label: 'Overstock / Unused' },
  { value: 'other', label: 'Other' },
]

/**
 * Vendor RMA / damage return modal. Opens from a stock-level row's "Return"
 * action. On save: writes the inventory_returns record + decrements stock
 * (TYPE_WRITE_OFF movement), then uploads the supplier's shipping label.
 * Redirects to the 4×6 print page when both steps succeed.
 */
export function ReturnFormModal({
  stockLevel,
  onClose,
  onSavedRedirectTo,
}: {
  stockLevel: InventoryStockLevel
  onClose: () => void
  onSavedRedirectTo: (returnId: string) => void
}) {
  const queryClient = useQueryClient()
  const vendorsQuery = useVendors({ per_page: 200 })

  const [reason, setReason] = useState<string>('damaged')
  const [reasonOther, setReasonOther] = useState('')
  const [vendorId, setVendorId] = useState<string>('')
  const [rmaNumber, setRmaNumber] = useState('')
  const [qty, setQty] = useState<string>(() => {
    const oh = Number(stockLevel.quantities.qty_on_hand ?? 0)
    return String(oh > 0 ? oh : 1)
  })
  const [notes, setNotes] = useState('')
  const [labelFile, setLabelFile] = useState<File | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      const reasonText = reason === 'other' ? reasonOther : (REASON_OPTIONS.find((r) => r.value === reason)?.label ?? reason)
      const created = await createReturn({
        type: 'vendor',
        vendor_id: vendorId || null,
        rma_number: rmaNumber.trim() || null,
        reason: reasonText,
        notes: notes.trim() || null,
        items: [
          {
            catalog_item_id: stockLevel.catalog_item_id!,
            quantity: Number(qty) || 0,
            source_location_id: stockLevel.location_id ?? null,
            source_bin_id: stockLevel.bin_id ?? null,
            reason: reasonText,
          },
        ],
      })

      if (labelFile) {
        await uploadReturnLabel(created.data.id, labelFile)
      }
      return created
    },
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-stock-levels'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      onSavedRedirectTo(resp.data.id)
    },
    onError: (e) => {
      setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e))
    },
  })

  const qtyNum = Number(qty) || 0
  const onHand = Number(stockLevel.quantities.qty_on_hand ?? 0)
  const exceedsOnHand = qtyNum > onHand
  const canSubmit =
    !mutation.isPending &&
    qtyNum > 0 &&
    (reason !== 'other' || reasonOther.trim().length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white max-w-xl w-full rounded-xl shadow-2xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">Return / RMA</h3>
          <div className="text-sm text-slate-600 mt-0.5">
            {stockLevel.catalog_item?.name ?? stockLevel.catalog_item_id}
            {stockLevel.bin?.path_label && <> · 📍 {stockLevel.bin.path_label}</>}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Current on hand: {String(stockLevel.quantities.qty_on_hand ?? 0)}
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
              >
                {REASON_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Qty to return</label>
              <input
                type="number"
                min="0"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ''))}
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded text-right focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {reason === 'other' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Reason — explain</label>
              <input
                type="text"
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
                autoFocus
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Vendor</label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
              >
                <option value="">— Select vendor —</option>
                {vendorsQuery.data?.data.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">RMA # (optional)</label>
              <input
                type="text"
                value={rmaNumber}
                onChange={(e) => setRmaNumber(e.target.value)}
                placeholder="e.g. RMA-12345"
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Supplier return label</label>
            <label
              htmlFor="return-label-file"
              className={`flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-4 cursor-pointer transition-colors ${
                labelFile
                  ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100'
                  : 'border-amber-300 bg-amber-50 hover:bg-amber-100'
              }`}
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                labelFile ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
              }`}>
                {labelFile ? '✓' : '📎'}
              </div>
              <div className="flex-1 min-w-0">
                {labelFile ? (
                  <>
                    <div className="text-sm font-medium text-emerald-900 truncate">{labelFile.name}</div>
                    <div className="text-xs text-emerald-700">
                      {Math.round(labelFile.size / 1024)} KB · click to replace
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-medium text-amber-900">Click to upload supplier label</div>
                    <div className="text-xs text-amber-800">PDF, PNG, or JPG — max 10 MB</div>
                  </>
                )}
              </div>
              {labelFile && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setLabelFile(null) }}
                  className="text-xs text-emerald-800 hover:text-emerald-900 underline"
                >
                  Remove
                </button>
              )}
            </label>
            <input
              id="return-label-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,image/*,application/pdf"
              onChange={(e) => setLabelFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Resized to 4″×6″ for printing and permanently attached to this return for audit logs.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            />
          </div>

          {exceedsOnHand && qtyNum > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-800">
              ⚠️ Qty to return ({qtyNum}) is greater than current on hand ({onHand}). Stock will go negative — you may need an adjustment movement after to reconcile.
            </div>
          )}

          {err && (
            <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">
              {err}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="text-sm px-4 py-1.5 text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { setErr(null); mutation.mutate() }}
            disabled={!canSubmit}
            className="text-sm px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium"
          >
            {mutation.isPending ? 'Saving…' : 'Create return + print label'}
          </button>
        </div>
      </div>
    </div>
  )
}
