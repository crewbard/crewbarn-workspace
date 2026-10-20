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
import { Modal } from '@/components/ui/Modal'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { useInventorySettings } from '@/hooks/useInventorySettings'

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

export function InventoryUnitsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { theme } = useTheme()
  const canEdit = usePermissions().has(PERM.INVENTORY_EDIT)
  const easy = theme === 'easy-side' || theme === 'easy-top'
  // The empty state says whether serial numbers are switched on, and who can switch them on.
  const { data: invSettings } = useInventorySettings()
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
  const itemNames = new Map((itemsData?.data ?? []).map((it) => [it.id, { name: it.name, sku: it.sku }]))

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
      <div data-tour="units-header">
        {embedded ? (
          <h2 className="text-xl font-semibold text-slate-900">Units</h2>
        ) : (
          <h1 className="text-3xl font-semibold text-slate-900">Inventory Units</h1>
        )}
        <p className="text-sm text-slate-600 mt-1">
          Items you track by serial number. Each unit has its own serial,
          status and place. For these items, On hand is the number of units
          that are Available.
        </p>
      </div>

      {/* Filters */}
      {easy && <div data-tour="units-quick-filters"><EasyActionCards label="Find serialized equipment" actions={[
        { key: 'available', title: 'Available', description: 'Find units available in stock.' },
        { key: 'reserved', title: 'Reserved', description: 'Review units already set aside.' },
        { key: 'installed', title: 'Installed', description: 'Find units recorded as installed.' },
        { key: 'damaged', title: 'Damaged', description: 'Review units flagged as damaged.' },
      ].map(action => ({ ...action, active: status === action.key, onClick: () => setStatus(status === action.key ? '' : action.key as InventoryUnitStatus) }))} /></div>}
      <div data-tour="units-filters" className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Serial</label>
            <input
              type="search"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="Part of a serial number…"
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
              <option value="">All items with serial numbers</option>
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
        <div data-tour="units-status-chips" className="flex flex-wrap gap-2 text-xs">
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

      {!query.isLoading && query.isError && units.length === 0 && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-sm text-red-800">
          Couldn't load the units.
          <button
            type="button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            className="ml-2 font-semibold underline disabled:opacity-50"
          >
            Try again
          </button>
        </div>
      )}

      {!query.isLoading && !query.isError && units.length === 0 && (
        <div data-tour="units-empty" data-filtered={hasFilters ? 'yes' : 'no'} className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
          {hasFilters ? (
            <p className="text-sm text-slate-600">
              No units match these filters.{' '}
              <button type="button" onClick={clearFilters} className="font-medium underline">Clear filters</button>
            </p>
          ) : invSettings && !invSettings.inventory_show_sn_tracking ? (
            <div data-sn="off" className="mx-auto max-w-md space-y-2 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Serial numbers are turned off.</p>
              <p>A unit is one item with its own serial number. Turn on serial numbers to track items one by one.</p>
              {invSettings.can_change ? (
                <Link to="/inventory?tab=settings" data-tour="units-turn-on-sn" className="inline-block font-semibold text-amber-700 underline">Turn on serial numbers in Settings</Link>
              ) : (
                <p>Ask {(invSettings.ask ?? []).map((a) => a.name).join(' or ') || 'an owner or admin'} to turn them on in Inventory › Settings.</p>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-md space-y-2 text-sm text-slate-600">
              <p className="font-medium text-slate-900">No units yet.</p>
              <p>A unit is one item with its own serial number. Units appear here when you receive a product that tracks serial numbers (on a purchase order or with + Stock in), one for each serial.</p>
            </div>
          )}
        </div>
      )}

      {units.length > 0 && (
        <div data-tour="units-table" className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
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
                <UnitRow key={u.id} u={u} canEdit={canEdit} item={itemNames.get(u.catalog_item_id)} />
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

const STATUS_ACTION_LABEL: Partial<Record<InventoryUnitStatus, string>> = {
  damaged: 'Mark as damaged',
  lost: 'Mark as lost',
  available: 'Restore to available',
}

function UnitRow({
  u,
  canEdit,
  item,
}: {
  u: InventoryUnit
  canEdit: boolean
  item?: { name: string; sku: string | null }
}) {
  const update = useUpdateInventoryUnit()
  // Status change waiting for a confirm + reason (accountability: no
  // one-click damaged/lost/restore without a written why).
  const [pendingStatus, setPendingStatus] = useState<InventoryUnitStatus | null>(null)
  const [reason, setReason] = useState('')
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

  function askStatus(next: InventoryUnitStatus) {
    setReason('')
    setPendingStatus(next)
  }

  async function changeStatus(next: InventoryUnitStatus, why: string) {
    setError(null)
    // The unit PATCH has no reason field and writes no movement, so the
    // reason is recorded on the unit's notes (newest first), with the date.
    const stamp = new Date().toLocaleDateString()
    const line = `${stamp} · marked ${next}: ${why}`
    const notes = u.notes ? `${line}\n${u.notes}` : line
    try {
      await update.mutateAsync({ id: u.id, input: { status: next, notes } })
      setPendingStatus(null)
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
          {item ? (
            <>
              <span>{item.name}</span>
              {item.sku && <span className="block text-[11px] font-mono text-slate-400">{item.sku}</span>}
            </>
          ) : (
            <span className="text-[11px] font-mono text-slate-400 mr-1">{u.catalog_item_id}</span>
          )}
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
          ) : !canEdit ? (
            <span className="text-xs text-slate-400" title="You need Edit inventory to change units.">view only</span>
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
                  onClick={() => askStatus('damaged')}
                  disabled={update.isPending}
                  className="text-xs px-2 py-1 text-red-700 border border-red-200 rounded hover:bg-red-50"
                >
                  Damaged
                </button>
              )}
              {u.status !== 'lost' && (
                <button
                  type="button"
                  onClick={() => askStatus('lost')}
                  disabled={update.isPending}
                  className="text-xs px-2 py-1 text-red-700 border border-red-200 rounded hover:bg-red-50"
                >
                  Lost
                </button>
              )}
              {u.status !== 'available' && (
                <button
                  type="button"
                  onClick={() => askStatus('available')}
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
      {pendingStatus && (
        <Modal
          isOpen={true}
          onClose={() => setPendingStatus(null)}
          title={STATUS_ACTION_LABEL[pendingStatus] ?? `Mark as ${pendingStatus}`}
          subtitle={`Serial ${u.serial_number}`}
          size="sm"
          disableBackdropClose
        >
          <div className="p-5 space-y-3">
            <p className="text-sm text-slate-700">
              {pendingStatus === 'available'
                ? 'This puts the unit back into available stock, so it counts toward on hand again.'
                : `This takes the unit out of available stock and marks it ${pendingStatus}.`}{' '}
              The reason is saved in the unit's notes.
            </p>
            <label className="block text-xs font-medium text-slate-700">
              Reason <span className="text-red-600">*</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                autoFocus
                placeholder={pendingStatus === 'available' ? 'e.g. Found it on the shelf' : 'e.g. Dropped during install'}
                className="mt-1 w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
              />
            </label>
            {error && <p className="text-xs text-red-700">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingStatus(null)}
                className="text-sm px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => changeStatus(pendingStatus, reason.trim())}
                disabled={!reason.trim() || update.isPending}
                className="text-sm px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {update.isPending ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </Modal>
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
      to={`/jobs/${inst.work_order.id}`}
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
