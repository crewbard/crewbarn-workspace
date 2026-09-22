import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useInventoryLocations } from '@/hooks/useInventoryLocations'
import { useAllInventoryBins } from '@/hooks/useInventoryBins'
import { useStockLevels } from '@/hooks/useInventoryStockLevels'
import type { InventoryBin } from '@/types/inventoryBin'

/**
 * Tree-based bin picker. Replaces the flat dropdown of every bin path
 * (which gets noisy past ~10 bins).
 *
 * UX:
 *   - Header: location dropdown.
 *   - Body: expandable tree of bins under that location.
 *   - Selectable when the bin says it holds stock; otherwise click-to-expand.
 *     This used to be "leaves only, because stock has to live in a leaf", which
 *     made loose stock in a bin that also has rows impossible to put away — a
 *     real arrangement the structure builder can now describe. The flag is
 *     backfilled from the old leaf rule, so nothing existing changed hands.
 *   - A bin with children AND holds_stock is both: click the row to pick it,
 *     the twisty to open it.
 *   - Optional "— None —" button at the top for "stock sits at the
 *     location level with no bin detail" (allowNoBin prop).
 *
 * Returns the picked bin (or null when "— None —" is allowed and
 * picked) via onPick.
 */
export function BinTreePicker({
  isOpen,
  onClose,
  onPick,
  allowNoBin = false,
  defaultLocationId,
  title = 'Pick a bin',
  highlightItemId,
}: {
  isOpen: boolean
  onClose: () => void
  onPick: (bin: InventoryBin | null) => void
  /** Show a "— None —" option that resolves to a null bin. */
  allowNoBin?: boolean
  defaultLocationId?: string
  title?: string
  /** When set, bins that already hold stock for THIS catalog item get
   *  a green highlight + qty hint (so the user can pick the existing
   *  bin and avoid splitting stock). */
  highlightItemId?: string
}) {
  const { data: locationsData } = useInventoryLocations({ per_page: 200 })
  const locations = locationsData?.data ?? []
  const [locationId, setLocationId] = useState<string>(defaultLocationId ?? '')

  // Default-pick the first location once the list loads (or the prop).
  useEffect(() => {
    if (!locationId && locations.length > 0) {
      setLocationId(defaultLocationId ?? locations[0].id)
    }
  }, [locations, locationId, defaultLocationId])

  // ALL pages. The API orders by parent_bin_id and Postgres sorts NULLs
  // LAST, so with >200 bins in a location page one is entirely CHILD bins and
  // contains no roots at all — this tree then has nothing to start from and
  // renders "No bins in this location yet" over a full shelf.
  const { data: binsData, isLoading } = useAllInventoryBins(
    locationId ? { location_id: locationId } : {}
  )
  const bins = (binsData?.data ?? []).filter((b) => b.location_id === locationId)
  const childByParent = new Map<string, InventoryBin[]>()
  for (const b of bins) {
    const key = b.parent_bin_id ?? '__root__'
    const arr = childByParent.get(key) ?? []
    arr.push(b)
    childByParent.set(key, arr)
  }
  const roots = childByParent.get('__root__') ?? []

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Reset expanded when location changes so we don't carry stale ids
  useEffect(() => {
    setExpanded(new Set())
  }, [locationId])

  // Pull stock_levels for this location so we can render two markers:
  //   - "open" badge on bins that have NO stock_levels rows referencing them
  //     (genuinely empty placements — visual cue for free space)
  //   - per-bin qty for the currently-being-placed item (highlightItemId),
  //     so users picking a bin can spot existing placements at a glance
  //     and avoid accidentally splitting stock.
  const stockQuery = useStockLevels(
    locationId ? { location_id: locationId, has_stock: false, per_page: 500 } : {}
  )
  const { occupiedBinIds, qtyForItemByBin, otherItemByBin } = useMemo(() => {
    const occupied = new Set<string>()
    const qtyForItem = new Map<string, number>()
    // Track bins occupied by an item OTHER than the one being placed.
    // When highlightItemId is unset (e.g. QuickCreate's Default Bin —
    // the new product doesn't have an id yet), every occupied bin counts
    // as "other" so the user still gets the 1-bin-1-product confirm.
    const otherItem = new Map<string, { name: string; qty: number }>()
    for (const sl of stockQuery.data?.data ?? []) {
      if (!sl.bin_id) continue
      const hasStock = sl.quantities.qty_on_hand > 0
      if (hasStock) occupied.add(sl.bin_id)
      const isThisItem = !!highlightItemId && sl.catalog_item_id === highlightItemId
      if (isThisItem) {
        qtyForItem.set(sl.bin_id, (qtyForItem.get(sl.bin_id) ?? 0) + sl.quantities.qty_on_hand)
      } else if (hasStock) {
        const existing = otherItem.get(sl.bin_id)
        otherItem.set(sl.bin_id, {
          name: sl.catalog_item?.name ?? 'another item',
          qty: (existing?.qty ?? 0) + sl.quantities.qty_on_hand,
        })
      }
    }
    return { occupiedBinIds: occupied, qtyForItemByBin: qtyForItem, otherItemByBin: otherItem }
  }, [stockQuery.data, highlightItemId])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <Modal.Body>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
              Location
            </label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
            >
              <option value="">— Pick a location —</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {allowNoBin && (
            <button
              type="button"
              onClick={() => {
                onPick(null)
                onClose()
              }}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 border border-slate-200 rounded hover:bg-slate-50"
            >
              <span className="italic text-slate-500">— None (stock at the location level, no bin detail) —</span>
            </button>
          )}

          {!locationId && (
            <p className="text-xs text-slate-500 italic">
              Pick a location above to see its bin tree.
            </p>
          )}

          {locationId && isLoading && (
            <div className="text-sm text-slate-500 py-6 text-center">Loading bins…</div>
          )}

          {locationId && !isLoading && roots.length === 0 && (
            <div className="text-sm text-slate-500 py-6 text-center">
              No bins in this location yet. Add bins from the Bins tab.
            </div>
          )}

          {locationId && roots.length > 0 && (
            <div className="border border-slate-200 rounded max-h-96 overflow-y-auto">
              {roots.map((b) => (
                <BinNode
                  key={b.id}
                  bin={b}
                  childByParent={childByParent}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggle}
                  occupiedBinIds={occupiedBinIds}
                  qtyForItemByBin={qtyForItemByBin}
                  otherItemByBin={otherItemByBin}
                  onPick={(picked) => {
                    // Strict "1 bin = 1 product" check — if the bin already
                    // holds a different catalog item, force a confirmation
                    // before splitting bin contents across products.
                    if (picked && otherItemByBin.has(picked.id)) {
                      const other = otherItemByBin.get(picked.id)!
                      const msg = `This bin already holds "${other.name}" (qty ${other.qty}).\n\nMixing products in one bin makes scanning + put-away unreliable. Use this bin anyway?`
                      if (!confirm(msg)) return
                    }
                    onPick(picked)
                    onClose()
                  }}
                />
              ))}
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
      </Modal.Footer>
    </Modal>
  )
}

function BinNode({
  bin,
  childByParent,
  depth,
  expanded,
  onToggle,
  onPick,
  occupiedBinIds,
  qtyForItemByBin,
  otherItemByBin,
}: {
  bin: InventoryBin
  childByParent: Map<string, InventoryBin[]>
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onPick: (bin: InventoryBin) => void
  occupiedBinIds: Set<string>
  qtyForItemByBin: Map<string, number>
  otherItemByBin: Map<string, { name: string; qty: number }>
}) {
  const children = childByParent.get(bin.id) ?? []
  const hasChildren = children.length > 0
  const isOpen = expanded.has(bin.id)
  const indentPx = 12 + depth * 18

  // Stock-bearing rows are pickable even when they have children; a container
  // row only expands. holds_stock is undefined on payloads from before the
  // column existed, so fall back to the old leaf rule rather than refusing
  // everything.
  const canHoldStock = bin.holds_stock ?? !hasChildren

  // Markers describe what is IN a bin, so they follow can-hold-stock rather than
  // leaf-ness. Keyed off the leaf test they vanished from a stock-bearing bin
  // that also had rows — exactly the bin whose contents you most need to see.
  //   - "O" = no stock_levels rows reference this bin (any item)
  //   - "qty N" = current pick context's item already has stock here
  //   - "⚠ Name" = a DIFFERENT item is already in this bin
  //     (1 bin = 1 product rule — picking still works, with a confirm)
  const isOpenBin = canHoldStock && !occupiedBinIds.has(bin.id)
  const thisItemQty = qtyForItemByBin.get(bin.id) ?? 0
  const otherItem = otherItemByBin.get(bin.id) ?? null

  const rowLabels = (
    <>
      <span className={`font-medium ${canHoldStock ? 'text-slate-900' : 'text-slate-700'}`}>
        {bin.name || bin.bin_code || bin.id}
      </span>
      {bin.kind && (
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded font-medium uppercase tracking-wide">
          {bin.kind}
        </span>
      )}
      {bin.bin_code && bin.name && bin.bin_code !== bin.name && (
        <span className="font-mono text-xs text-slate-400">{bin.bin_code}</span>
      )}
      {canHoldStock && thisItemQty > 0 && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 rounded font-medium"
          title="This item already has stock here. Picking this bin merges into it."
        >
          qty {thisItemQty}
        </span>
      )}
      {canHoldStock && otherItem && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-red-50 text-red-700 rounded font-medium truncate max-w-[160px]"
          title={`Holds "${otherItem.name}" (qty ${otherItem.qty}). 1 bin = 1 product is recommended — picking will ask for confirmation.`}
        >
          ⚠ {otherItem.name}
        </span>
      )}
      {isOpenBin && (
        <span
          className="inline-flex items-center justify-center w-5 h-5 text-[10px] border border-slate-300 text-slate-500 rounded-full font-bold"
          title="Open bin — no stock recorded here yet"
        >
          O
        </span>
      )}
      {canHoldStock && (
        <span className="ml-auto text-xs text-amber-700 font-medium">Pick</span>
      )}
    </>
  )

  return (
    <div>
      {/* Two targets, not one. The whole row used to be a single button, so a bin
          that BOTH holds stock and has children could only be picked — the ▸ was
          decoration with nothing behind it, and its rows were unreachable. The
          twisty opens; the rest of the row picks. */}
      <div
        className={`w-full flex items-center gap-2 ${canHoldStock ? 'hover:bg-amber-50' : 'hover:bg-slate-50'}`}
        style={{ paddingLeft: indentPx, paddingRight: 12 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(bin.id)}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${bin.name || bin.bin_code || bin.id}`}
            className="w-4 shrink-0 py-2 text-xs text-slate-400 hover:text-slate-700"
          >
            {isOpen ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4 shrink-0 text-center text-xs text-slate-400">·</span>
        )}
        <button
          type="button"
          onClick={canHoldStock ? () => onPick(bin) : () => onToggle(bin.id)}
          className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
          title={canHoldStock ? 'Pick this bin' : 'Holds other things, not stock — click to open'}
        >
          {rowLabels}
        </button>
      </div>
      {hasChildren && isOpen &&
        children.map((c) => (
          <BinNode
            key={c.id}
            bin={c}
            childByParent={childByParent}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onPick={onPick}
            occupiedBinIds={occupiedBinIds}
            qtyForItemByBin={qtyForItemByBin}
            otherItemByBin={otherItemByBin}
          />
        ))}
    </div>
  )
}
