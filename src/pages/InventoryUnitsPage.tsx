import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  useInventoryUnits,
  useUpdateInventoryUnit,
  inventoryUnitKeys,
} from '@/hooks/useInventoryUnits'
import { createInventoryMovement } from '@/lib/inventoryMovements'
import { inventoryMovementKeys } from '@/hooks/useInventoryMovements'
import { stockLevelKeys } from '@/hooks/useInventoryStockLevels'
import { useInventoryLocations } from '@/hooks/useInventoryLocations'
import { useCatalogItems } from '@/hooks/useCatalogItems'
import { BinTreePicker } from '@/components/BinTreePicker'
import { ApiError } from '@/lib/api'
import type {
  InventoryUnit,
  InventoryUnitStatus,
} from '@/types/inventoryUnit'
import type { InventoryBin } from '@/types/inventoryBin'
import { useTheme } from '@/hooks/useTheme'
import { EasyActionCards } from '@/components/easy/EasyActionCards'

/**
 * Inventory Units page — list of every SN-tracked physical instance,
 * filterable by status / item / location, with per-unit actions:
 *   - mark damaged / lost / available
 *   - transfer to a different bin
 *
 * SN units are minted on PO receive (one per qty for SN-tracked items)
 * or via the asset components installer. They live their own lifecycle
 * separate from bulk qty: status drives whether a unit counts toward
 * stock_levels.qty_on_hand (only `available` does).
 */
const STATUSES: InventoryUnitStatus[] = [
  'available',
  'reserved',
  'installed',
  'sold',
  'lost',
  'damaged',
]

export function InventoryUnitsPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const [serial, setSerial] = useState('')
  const [debouncedSerial, setDebouncedSerial] = useState('')
  const [status, setStatus] = useState<InventoryUnitStatus | ''>('')
  const [itemId, setItemId] = useState('')
  const [locationId, setLocationId] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSerial(serial.trim()), 300)
    return () => clearTimeout(t)
  }, [serial])

  const { data: locationsData } = useInventoryLocations({ per_page: 200 })
  const locations = locationsData?.data ?? []
  const { data: itemsData } = useCatalogItems({
    type: 'product',
    active: true,
    per_page: 200,
  })
  const items = (itemsData?.data ?? []).filter((it) => it.sn_tracking.enabled)

  const query = useInventoryUnits({
    q: debouncedSerial || undefined,
    status: status || undefined,
    catalog_item_id: itemId || undefined,
    location_id: locationId || undefined,
    per_page: 100,
  })
  const units: InventoryUnit[] = query.data?.data ?? []
  const meta = query.data?.meta

  // Helper for ⇒ qty per status (header counts)
  const counts = units.reduce<Record<string, number>>((acc, u) => {
    acc[u.status] = (acc[u.status] ?? 0) + 1
    return acc
  }, {})

  function clearFilters() {
    setSerial('')
    setStatus('')
    setItemId('')
    setLocationId('')
  }
  const hasFilters = !!(serial || status || itemId || locationId)

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Inventory Units</h1>
        <p className="text-sm text-slate-600 mt-1">
          SN-tracked physical instances. Each unit has its own serial,
          status, and location. Stock counts for SN items are derived from
          the count of <span className="font-mono">available</span> units.
        </p>
      </div>

      {/* Filters */}
      {easy && <EasyActionCards label="Find serialized equipment" actions={[
        { key: 'available', title: 'Available', description: 'Find units available in stock.' },
        { key: 'reserved', title: 'Reserved', description: 'Review units already set aside.' },
        { key: 'installed', title: 'Installed', description: 'Find units recorded as installed.' },
        { key: 'damaged', title: 'Damaged', description: 'Review units flagged as damaged.' },
      ].map(action => ({ ...action, active: status === action.key, onClick: () => setStatus(status === action.key ? '' : action.key as InventoryUnitStatus) }))} />}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Serial</label>
            <input
              type="search"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="Partial SN match…"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as InventoryUnitStatus | '')}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Item</label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
            >
              <option value="">All SN-tracked items</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>{it.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Location</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
            >
              <option value="">All</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Status summary chips (from current page only) */}
      {units.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {STATUSES.map((s) => {
            const n = counts[s] ?? 0
            if (n === 0) return null
            return (
              <span
                key={s}
                className={`inline-flex items-center px-2 py-1 rounded font-medium ${STATUS_BADGES[s]}`}
              >
                {s}: {n}
              </span>
            )
          })}
        </div>
      )}

      {/* Results */}
      {query.isLoading && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center text-sm text-slate-500">
          Loading…
        </div>
      )}

      {!query.isLoading && units.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
          <p className="text-sm text-slate-600">
            No SN units{hasFilters ? ' matching the current filters' : ' yet — they get minted when SN-tracked products are received'}.
          </p>
        </div>
      )}

      {units.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Serial</th>
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-left px-4 py-3 font-medium">Where</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Installed at</th>
                <th className="text-left px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {units.map((u) => (
                <UnitRow key={u.id} u={u} />
              ))}
            </tbody>
          </table>
          {meta && (
            <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-200">
              Showing {units.length} of {meta.total} units
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const STATUS_BADGES: Record<InventoryUnitStatus, string> = {
  available: 'bg-emerald-50 text-emerald-700',
  reserved: 'bg-amber-50 text-amber-700',
  installed: 'bg-purple-50 text-purple-700',
  sold: 'bg-blue-50 text-blue-700',
  lost: 'bg-red-50 text-red-700',
  damaged: 'bg-red-50 text-red-700',
}

function UnitRow({ u }: { u: InventoryUnit }) {
  const update = useUpdateInventoryUnit()
  const queryClient = useQueryClient()
  const [showBinPicker, setShowBinPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)

  const where = u.bin?.place_label
    ?? u.bin?.name
    ?? u.location?.name
    ?? '—'

  const isInstalled = u.status === 'installed'
  const isSold = u.status === 'sold'
  // Installed / sold units are end-of-life from a stock perspective —
  // they shouldn't be moved back to "available" via this UI without
  // an explicit reversal flow. Keep them read-only here.
  const isLocked = isInstalled || isSold

  async function changeStatus(next: InventoryUnitStatus) {
    setError(null)
    try {
      await update.mutateAsync({ id: u.id, input: { status: next } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err))
    }
  }

  async function moveToBin(bin: InventoryBin | null) {
    if (!bin) return
    setError(null)
    setMoving(true)
    try {
      // Create a transfer movement (it updates the unit's location/bin AND
      // logs the move in the audit trail). Direct PATCH on the unit would
      // skip the movement record, leaving the audit log incomplete.
      await createInventoryMovement({
        type: 'transfer',
        catalog_item_id: u.catalog_item_id,
        quantity: 1,
        from_location_id: u.location_id,
        from_bin_id: u.bin_id,
        to_location_id: bin.location_id,
        to_bin_id: bin.id,
        inventory_unit_id: u.id,
        reason: 'Manual unit move',
      })
      // Refresh units, stock_levels, and movement audit log.
      queryClient.invalidateQueries({ queryKey: inventoryUnitKeys.lists() })
      queryClient.invalidateQueries({ queryKey: stockLevelKeys.lists() })
      // Bin counts on the tree derive from stock levels.
      queryClient.invalidateQueries({ queryKey: ['inventory-bins', 'stock-rollup'] })
      queryClient.invalidateQueries({ queryKey: inventoryMovementKeys.lists() })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err))
    } finally {
      setMoving(false)
    }
  }

  return (
    <>
      <tr className="hover:bg-slate-50">
        <td className="px-4 py-3 font-mono text-xs text-slate-800">{u.serial_number}</td>
        <td className="px-4 py-3 text-slate-800">
          <span className="text-[11px] font-mono text-slate-400 mr-1">{u.catalog_item_id}</span>
        </td>
        <td className="px-4 py-3 text-xs text-slate-700">📍 {where}</td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 text-xs rounded font-medium uppercase tracking-wide ${STATUS_BADGES[u.status]}`}
          >
            {u.status}
          </span>
        </td>
        <td className="px-4 py-3 text-xs">
          <InstallContext u={u} />
        </td>
        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
          {u.received_at ? new Date(u.received_at).toLocaleDateString() : '—'}
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          {isLocked ? (
            <span className="text-xs text-slate-400" title={`Status '${u.status}' is end-of-life — reverse via the original install / sale flow.`}>
              locked
            </span>
          ) : (
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setShowBinPicker(true)}
                disabled={update.isPending || moving}
                className="text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-50"
                title="Move to a different bin (logs a transfer movement)"
              >
                {moving ? '…' : 'Move'}
              </button>
              {u.status !== 'damaged' && (
                <button
                  type="button"
                  onClick={() => changeStatus('damaged')}
                  disabled={update.isPending}
                  className="text-xs px-2 py-1 text-red-700 border border-red-200 rounded hover:bg-red-50"
                >
                  Damaged
                </button>
              )}
              {u.status !== 'lost' && (
                <button
                  type="button"
                  onClick={() => changeStatus('lost')}
                  disabled={update.isPending}
                  className="text-xs px-2 py-1 text-red-700 border border-red-200 rounded hover:bg-red-50"
                >
                  Lost
                </button>
              )}
              {u.status !== 'available' && (
                <button
                  type="button"
                  onClick={() => changeStatus('available')}
                  disabled={update.isPending}
                  className="text-xs px-2 py-1 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-50"
                  title="Restore to available stock"
                >
                  Restore
                </button>
              )}
            </div>
          )}
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={7} className="px-4 py-2 bg-red-50 text-xs text-red-700 border-t border-red-100">
            {error}
          </td>
        </tr>
      )}
      {showBinPicker && (
        <BinTreePicker
          isOpen={true}
          onClose={() => setShowBinPicker(false)}
          allowNoBin={false}
          defaultLocationId={u.location_id}
          title="Move unit to bin"
          highlightItemId={u.catalog_item_id}
          onPick={(bin) => {
            moveToBin(bin)
            setShowBinPicker(false)
          }}
        />
      )}
    </>
  )
}

/**
 * Where this unit ended up — only meaningful for `installed` units (and
 * occasionally `sold`). Renders three optional links: customer → service
 * location → asset. Shows "—" for units that aren't installed.
 */
function InstallContext({ u }: { u: InventoryUnit }) {
  const inst = u.installation
  if (u.status !== 'installed' && u.status !== 'sold') {
    return <span className="text-slate-300">—</span>
  }

  const customerLink = inst.customer_id ? (
    <Link
      to={`/customers/${inst.customer_id}`}
      className="text-amber-700 hover:underline"
    >
      {inst.customer?.name ?? 'Customer'}
    </Link>
  ) : null

  const assetLink = inst.asset_id ? (
    <Link
      to={`/assets?id=${inst.asset_id}`}
      className="text-amber-700 hover:underline"
    >
      {inst.asset?.name ?? inst.asset?.asset_code ?? 'Asset'}
    </Link>
  ) : null

  const woLink = inst.work_order ? (
    <Link
      to={`/work-orders/${inst.work_order.id}`}
      className="text-amber-700 hover:underline"
    >
      WO #{inst.work_order.work_order_number ?? '—'}
    </Link>
  ) : null

  if (!customerLink && !assetLink && !woLink) {
    return <span className="text-slate-400 italic">unknown</span>
  }

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {customerLink && (
        <span>
          🏢 {customerLink}
          {inst.service_location?.name && (
            <span className="text-slate-500"> · {inst.service_location.name}</span>
          )}
        </span>
      )}
      {assetLink && <span>🔧 {assetLink}</span>}
      {woLink && <span>🧾 {woLink}</span>}
      {u.installed_at && (
        <span className="text-slate-400">
          {new Date(u.installed_at).toLocaleDateString()}
        </span>
      )}
    </div>
  )
}
