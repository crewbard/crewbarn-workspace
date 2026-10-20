import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { BinTreePicker } from '@/components/BinTreePicker'
import { useStockLevels, stockLevelKeys } from '@/hooks/useInventoryStockLevels'
import { useInventoryLocations } from '@/hooks/useInventoryLocations'
import { listInventoryUnits } from '@/lib/inventoryUnits'
import { inventoryUnitKeys } from '@/hooks/useInventoryUnits'
import { createInventoryMovement } from '@/lib/inventoryMovements'
import { inventoryMovementKeys } from '@/hooks/useInventoryMovements'
import { ApiError, apiRequest } from '@/lib/api'
import { isCountableUnit, qtyStepFor, formatQty } from '@/lib/unitsOfMeasure'
import type { InventoryBin } from '@/types/inventoryBin'
import type { InventoryStockLevel } from '@/types/inventoryStockLevel'

/**
 * TransferStockModal — multi-row "load the van" workflow.
 *
 * Pick a source (location + optional bin), pick a destination (same), then
 * tick the items + qtys you're moving. Submit fires one transfer movement
 * per non-SN row; SN-tracked rows fire N movements (one per auto-picked
 * available unit at the source).
 *
 * The applier handles the actual stock_levels deltas + unit transitions
 * atomically per movement. We just orchestrate the per-line dispatch.
 *
 * A van on either side is different: the API won't move van stock directly.
 * Each line becomes a transfer request (POST /v1/inventory-transfers) that
 * the van's tech accepts on their phone, and the stock moves when they do.
 */
export function TransferStockModal({ onClose, defaultFromLocationId }: { onClose: () => void; /** Stock tab details: start from this row's location. */ defaultFromLocationId?: string }) {
  const queryClient = useQueryClient()
  const [fromLocation, setFromLocation] = useState<string>(defaultFromLocationId ?? '')
  const [fromBin, setFromBin] = useState<InventoryBin | null>(null)
  const [toLocation, setToLocation] = useState<string>('')
  const [toBin, setToBin] = useState<InventoryBin | null>(null)
  const [pickingFrom, setPickingFrom] = useState(false)
  const [pickingTo, setPickingTo] = useState(false)

  const { data: locsData } = useInventoryLocations({ per_page: 200 })
  const locations = locsData?.data ?? []
  // A van on either side: the van's tech accepts it (the source van first).
  const fromLoc = locations.find((l) => l.id === fromLocation)
  const toLoc = locations.find((l) => l.id === toLocation)
  const van = fromLoc?.type === 'truck' ? fromLoc : toLoc?.type === 'truck' ? toLoc : null
  const vanTech = van?.assigned_tech?.display_name ?? (van?.assigned_tech_account_id ? 'the van’s tech' : null)
  const [sent, setSent] = useState<string | null>(null)

  // Fetch stock at source. We always filter by location; bin filter only
  // applied when fromBin is set, otherwise we list everything at the
  // location level.
  const stockQuery = useStockLevels(
    fromLocation
      ? {
          location_id: fromLocation,
          ...(fromBin ? { bin_id: fromBin.id } : {}),
          has_stock: true,
          per_page: 200,
        }
      : {}
  )
  const sourceRows: InventoryStockLevel[] = stockQuery.data?.data ?? []
  // Also filter client-side by bin in case the backend `bin_id` filter is
  // permissive (returns rows with bin_id NULL when filtering "any bin").
  const filteredSourceRows = fromBin
    ? sourceRows.filter((sl) => sl.bin_id === fromBin.id)
    : sourceRows

  // Per-row state: picked? + qty
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [qtys, setQtys] = useState<Record<string, string>>({})

  // Seed qtys with full-available whenever new rows arrive
  useEffect(() => {
    setQtys((prev) => {
      const next = { ...prev }
      for (const sl of filteredSourceRows) {
        if (next[sl.id] === undefined) {
          // Reserved stock is spoken for, so default to what's free to move.
          next[sl.id] = String(Math.max(0, sl.quantities.qty_available ?? sl.quantities.qty_on_hand))
        }
      }
      return next
    })
  }, [filteredSourceRows])

  const selectedCount = filteredSourceRows.filter(
    (sl) => picked[sl.id] && Number(qtys[sl.id]) > 0
  ).length

  const sameSpot =
    !!fromLocation &&
    !!toLocation &&
    fromLocation === toLocation &&
    (fromBin?.id ?? null) === (toBin?.id ?? null)

  const canSubmit =
    !!fromLocation && !!toLocation && !sameSpot && selectedCount > 0 && (!van || !!van.assigned_tech_account_id)

  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleAll(checked: boolean) {
    if (!checked) {
      setPicked({})
      return
    }
    const next: Record<string, boolean> = {}
    for (const sl of filteredSourceRows) next[sl.id] = true
    setPicked(next)
  }

  async function handleSubmit() {
    setError(null)
    if (!canSubmit) return
    setSubmitting(true)

    const linesToTransfer = filteredSourceRows
      .filter((sl) => picked[sl.id] && Number(qtys[sl.id]) > 0)
      .map((sl) => ({
        sl,
        qty: Number(qtys[sl.id]),
      }))

    // Lines go one at a time with no rollback, so if one fails the person
    // has to know which ones already moved.
    const done: string[] = []
    try {
      if (van) {
        // Van stock moves only when the van's tech accepts on their phone.
        let n = 0
        for (const { sl, qty } of linesToTransfer) {
          n++
          const itemName = sl.catalog_item?.name ?? sl.catalog_item_id
          setProgress(`Sending ${n} of ${linesToTransfer.length} to ${vanTech}: ${itemName}`)
          await apiRequest('/v1/inventory-transfers', {
            method: 'POST',
            body: {
              catalog_item_id: sl.catalog_item_id,
              quantity: qty,
              from_location_id: sl.location_id,
              from_bin_id: sl.bin_id ?? null,
              to_location_id: toLocation,
              to_bin_id: toBin?.id ?? null,
              note: 'Sent from the office',
            },
          })
          done.push(itemName)
        }
        setPicked({})
        setSent(`Sent ${done.length} ${done.length === 1 ? 'item' : 'items'} to ${vanTech}. The stock moves when they check it in on their phone.`)
        return
      }
      let i = 0
      for (const { sl, qty } of linesToTransfer) {
        i++
        const itemName = sl.catalog_item?.name ?? sl.catalog_item_id
        setProgress(`Transferring ${i} of ${linesToTransfer.length}: ${itemName}`)

        if (sl.quantities.sn_tracked) {
          // SN items: one movement per unit. Fetch up to qty available units
          // at this source spot, then dispatch N transfers.
          const unitsResp = await listInventoryUnits({
            catalog_item_id: sl.catalog_item_id,
            location_id: sl.location_id,
            bin_id: sl.bin_id ?? undefined,
            status: 'available',
            per_page: Math.ceil(qty),
          })
          const units = unitsResp.data.slice(0, Math.ceil(qty))
          if (units.length < qty) {
            throw new Error(
              `${itemName}: only ${units.length} available units at source, asked to transfer ${qty}.`
            )
          }
          for (const u of units) {
            await createInventoryMovement({
              type: 'transfer',
              catalog_item_id: sl.catalog_item_id,
              quantity: 1,
              from_location_id: sl.location_id,
              from_bin_id: sl.bin_id ?? null,
              to_location_id: toLocation,
              to_bin_id: toBin?.id ?? null,
              inventory_unit_id: u.id,
              reason: 'Manual transfer',
            })
          }
        } else {
          // Bulk qty: single movement
          await createInventoryMovement({
            type: 'transfer',
            catalog_item_id: sl.catalog_item_id,
            quantity: qty,
            from_location_id: sl.location_id,
            from_bin_id: sl.bin_id ?? null,
            to_location_id: toLocation,
            to_bin_id: toBin?.id ?? null,
            reason: 'Manual transfer',
          })
        }
        done.push(itemName)
      }

      queryClient.invalidateQueries({ queryKey: stockLevelKeys.lists() })
      // Bin counts on the tree derive from stock levels.
      queryClient.invalidateQueries({ queryKey: ['inventory-bins', 'stock-rollup'] })
      queryClient.invalidateQueries({ queryKey: inventoryUnitKeys.lists() })
      queryClient.invalidateQueries({ queryKey: inventoryMovementKeys.lists() })
      onClose()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err)
      if (done.length > 0) {
        // Earlier lines did move; refresh so the table shows that.
        queryClient.invalidateQueries({ queryKey: stockLevelKeys.lists() })
        queryClient.invalidateQueries({ queryKey: ['inventory-bins', 'stock-rollup'] })
        queryClient.invalidateQueries({ queryKey: inventoryUnitKeys.lists() })
        queryClient.invalidateQueries({ queryKey: inventoryMovementKeys.lists() })
        setError(`${van ? 'Already sent' : 'Already moved'}: ${done.join(', ')}. Stopped there: ${msg}`)
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
      setProgress(null)
    }
  }

  return (
    <Modal isOpen={true} onClose={submitting ? () => {} : onClose} title="Transfer Stock" size="xl">
      <Modal.Body>
        <div data-tour="inv-transfer" className="space-y-4">
          {/* Source / destination */}
          <div className="grid grid-cols-2 gap-4">
            <BinSlot
              label="From"
              accent="amber"
              locationId={fromLocation}
              bin={fromBin}
              locations={locations}
              onLocationChange={(id) => {
                setFromLocation(id)
                setFromBin(null)
                setPicked({})
              }}
              onPickBin={() => setPickingFrom(true)}
              onClearBin={() => setFromBin(null)}
            />
            <BinSlot
              label="To"
              accent="emerald"
              locationId={toLocation}
              bin={toBin}
              locations={locations}
              onLocationChange={(id) => {
                setToLocation(id)
                setToBin(null)
              }}
              onPickBin={() => setPickingTo(true)}
              onClearBin={() => setToBin(null)}
            />
          </div>

          {sameSpot && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Source and destination are the same. Pick a different destination.
            </p>
          )}
          {van && !sameSpot && !sent && (
            van.assigned_tech_account_id ? (
              <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-3 py-2">
                {van.name} is a van, so each item goes to {vanTech}. The stock moves when they check it in on their phone.
              </p>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                {van.name} has no tech assigned to accept transfers. Assign one on its location first.
              </p>
            )
          )}
          {sent && (
            <p role="status" className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
              {sent}
            </p>
          )}

          {/* Source stock table */}
          {!fromLocation && (
            <p className="text-sm text-slate-500 italic py-6 text-center">
              Pick a source location to see available stock.
            </p>
          )}

          {fromLocation && stockQuery.isLoading && (
            <p className="text-sm text-slate-500 italic py-6 text-center">Loading stock at source…</p>
          )}

          {fromLocation && !stockQuery.isLoading && filteredSourceRows.length === 0 && (
            <p className="text-sm text-slate-500 italic py-6 text-center">
              No stock at this source bin / location.
            </p>
          )}

          {filteredSourceRows.length > 0 && (
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={
                          filteredSourceRows.length > 0 &&
                          filteredSourceRows.every((sl) => picked[sl.id])
                        }
                        onChange={(e) => toggleAll(e.target.checked)}
                      />
                    </th>
                    <th className="text-left px-3 py-2">Item</th>
                    <th className="text-left px-3 py-2">Bin</th>
                    <th className="text-right px-3 py-2">Available</th>
                    <th className="text-right px-3 py-2">Transfer qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSourceRows.map((sl) => {
                    const checked = !!picked[sl.id]
                    const unit = sl.catalog_item?.unit_label ?? 'each'
                    const isCount = isCountableUnit(unit)
                    const available = sl.quantities.qty_available ?? sl.quantities.qty_on_hand
                    const enteredQty = Number(qtys[sl.id]) || 0
                    const overAvail = enteredQty > available
                    return (
                      <tr key={sl.id} className={checked ? 'bg-amber-50/40' : ''}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setPicked((p) => ({ ...p, [sl.id]: e.target.checked }))
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">
                            {sl.catalog_item?.name ?? '(deleted)'}
                          </div>
                          {sl.quantities.sn_tracked && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded font-mono">
                              SN
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          {sl.bin?.path_label ?? sl.location?.name ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatQty(available, unit)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            max={available}
                            step={qtyStepFor(unit)}
                            value={qtys[sl.id] ?? ''}
                            onChange={(e) => {
                              const allow = isCount
                                ? e.target.value.replace(/[^0-9]/g, '')
                                : e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1')
                              setQtys((p) => ({ ...p, [sl.id]: allow }))
                            }}
                            disabled={!checked}
                            className={`w-24 text-sm text-right px-2 py-1 border rounded focus:outline-none ${
                              overAvail
                                ? 'border-red-400 focus:border-red-500 bg-red-50'
                                : 'border-slate-300 focus:border-amber-500'
                            } disabled:bg-slate-50 disabled:text-slate-400`}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {progress && (
            <p className="text-sm text-slate-600">{progress}</p>
          )}
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <span className="text-sm text-slate-600 mr-auto">
          {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
        </span>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50"
        >
          Cancel
        </button>
        {sent ? (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white"
          >
            Done
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="px-4 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {submitting
              ? van ? 'Sending…' : 'Transferring…'
              : `${van ? `Send to ${vanTech}` : 'Transfer'} ${selectedCount > 0 ? `(${selectedCount})` : ''}`}
          </button>
        )}
      </Modal.Footer>

      {pickingFrom && (
        <BinTreePicker
          isOpen={true}
          onClose={() => setPickingFrom(false)}
          allowNoBin={true}
          defaultLocationId={fromLocation || undefined}
          title="From — bin"
          onPick={(bin) => {
            setFromBin(bin)
            if (bin && bin.location_id !== fromLocation) {
              setFromLocation(bin.location_id)
            }
            setPickingFrom(false)
            setPicked({})
          }}
        />
      )}
      {pickingTo && (
        <BinTreePicker
          isOpen={true}
          onClose={() => setPickingTo(false)}
          allowNoBin={true}
          defaultLocationId={toLocation || undefined}
          title="To — bin"
          onPick={(bin) => {
            setToBin(bin)
            if (bin && bin.location_id !== toLocation) {
              setToLocation(bin.location_id)
            }
            setPickingTo(false)
          }}
        />
      )}
    </Modal>
  )
}

function BinSlot({
  label,
  accent,
  locationId,
  bin,
  locations,
  onLocationChange,
  onPickBin,
  onClearBin,
}: {
  label: string
  accent: 'amber' | 'emerald'
  locationId: string
  bin: InventoryBin | null
  locations: { id: string; name: string }[]
  onLocationChange: (id: string) => void
  onPickBin: () => void
  onClearBin: () => void
}) {
  const accentClass =
    accent === 'amber'
      ? 'border-amber-300 bg-amber-50/40'
      : 'border-emerald-300 bg-emerald-50/40'
  const display = bin?.path_label || bin?.name || bin?.bin_code
  return (
    <div className={`border rounded p-3 ${accentClass}`}>
      <div className="text-xs uppercase tracking-wide font-medium text-slate-700 mb-2">{label}</div>
      <select
        value={locationId}
        onChange={(e) => onLocationChange(e.target.value)}
        className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-amber-500 bg-white"
      >
        <option value="">— Pick a location —</option>
        {locations.map((loc) => (
          <option key={loc.id} value={loc.id}>{loc.name}</option>
        ))}
      </select>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 text-xs text-slate-700 truncate">
          {display ? <>📍 {display}</> : <span className="italic text-slate-400">— Any bin / location level —</span>}
        </div>
        <button
          type="button"
          onClick={onPickBin}
          disabled={!locationId}
          className="text-xs px-2.5 py-1 border border-slate-300 rounded hover:bg-white disabled:opacity-50"
        >
          🗂️
        </button>
        {bin && (
          <button
            type="button"
            onClick={onClearBin}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
