import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventoryMovements } from '@/hooks/useInventoryMovements'
import { useInventoryLocations } from '@/hooks/useInventoryLocations'
import { useCatalogItems } from '@/hooks/useCatalogItems'
import {
  INVENTORY_MOVEMENT_TYPES,
  type InventoryMovementType,
  type InventoryMovement,
} from '@/types/inventoryMovement'
import { formatQty } from '@/lib/unitsOfMeasure'

/**
 * Inventory Movements page — read-only audit log of every stock-changing
 * event (receive, transfer, issue, install, write_off, adjustment, return).
 *
 * Append-only. Fixes happen via counter-movements, not edits. Surfaces who
 * did what, when, and from→to so when stock looks weird you can find the
 * row that caused it.
 */
export function InventoryMovementsPage() {
  const [type, setType] = useState<InventoryMovementType | ''>('')
  const [itemId, setItemId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedMovement, setSelectedMovement] = useState<InventoryMovement | null>(null)

  const { data: locationsData } = useInventoryLocations({ per_page: 200 })
  const locations = locationsData?.data ?? []

  const { data: itemsData } = useCatalogItems({ type: 'product', per_page: 200 })
  const items = itemsData?.data ?? []

  const query = useInventoryMovements({
    type: type || undefined,
    catalog_item_id: itemId || undefined,
    location_id: locationId || undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
    per_page: 100,
  })
  const movements: InventoryMovement[] = query.data?.data ?? []
  const meta = query.data?.meta

  function clearFilters() {
    setType('')
    setItemId('')
    setLocationId('')
    setFromDate('')
    setToDate('')
  }

  const hasFilters = !!(type || itemId || locationId || fromDate || toDate)

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Inventory Movements</h1>
        <p className="text-sm text-slate-600 mt-1">
          Append-only audit log. Every stock-changing event lands here.
          Fixes happen via counter-movements, not edits.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as InventoryMovementType | '')}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
            >
              <option value="">All</option>
              {INVENTORY_MOVEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {({
                    receive: 'Receive',
                    transfer: 'Transfer',
                    issue: 'Issue',
                    install: 'Install',
                    write_off: 'Write off',
                    adjustment: 'Adjustment',
                    return: 'Return',
                    vendor_rma: 'RMA',
                  } as Record<string, string>)[t] ?? t}
                </option>
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
              <option value="">All items</option>
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
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">From date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">To date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            />
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

      {/* Results */}
      {query.isLoading && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center text-sm text-slate-500">
          Loading…
        </div>
      )}

      {!query.isLoading && movements.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
          <p className="text-sm text-slate-600">
            No movements yet{hasFilters ? ' matching the current filters' : ''}.
          </p>
        </div>
      )}

      {movements.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium">When</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-right px-4 py-3 font-medium">Qty</th>
                <th className="text-left px-4 py-3 font-medium">From → To</th>
                <th className="text-left px-4 py-3 font-medium">Source / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((m) => (
                <MovementRow key={m.id} m={m} onClick={() => setSelectedMovement(m)} />
              ))}
            </tbody>
          </table>
          {meta && (
            <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-200">
              Showing {movements.length} of {meta.total} movements
            </div>
          )}
        </div>
      )}

      {selectedMovement && (
        <MovementDetailModal
          movement={selectedMovement}
          onClose={() => setSelectedMovement(null)}
        />
      )}
    </div>
  )
}

const TYPE_BADGES: Record<InventoryMovementType, string> = {
  receive: 'bg-emerald-50 text-emerald-700',
  transfer: 'bg-blue-50 text-blue-700',
  issue: 'bg-amber-50 text-amber-700',
  install: 'bg-purple-50 text-purple-700',
  write_off: 'bg-red-50 text-red-700',
  adjustment: 'bg-slate-100 text-slate-700',
  return: 'bg-cyan-50 text-cyan-700',
  vendor_rma: 'bg-orange-50 text-orange-700',
}

const TYPE_LABELS: Record<InventoryMovementType, string> = {
  receive: 'Receive',
  transfer: 'Transfer',
  issue: 'Issue',
  install: 'Install',
  write_off: 'Write off',
  adjustment: 'Adjustment',
  return: 'Return',
  vendor_rma: 'RMA',
}

function MovementRow({ m, onClick }: { m: InventoryMovement; onClick: () => void }) {
  const fromLabel = m.from_bin?.path_label ?? m.from_location?.name ?? null
  const toLabel = m.to_bin?.path_label ?? m.to_location?.name ?? null
  const arrow = fromLabel && toLabel ? `${fromLabel}  →  ${toLabel}` : (toLabel ? `→ ${toLabel}` : (fromLabel ? `${fromLabel} →` : '—'))

  const sourceBits: string[] = []
  if (m.reference_number) sourceBits.push(`PO ${m.reference_number}`)
  if (m.supplier_name) sourceBits.push(`vendor: ${m.supplier_name}`)
  if (m.work_order_line_item_id) sourceBits.push(`WO line`)
  if (m.installation.customer_id) sourceBits.push(`installed at customer`)
  if (m.reason) sourceBits.push(m.reason)

  const when = m.applied_at ?? m.created_at
  const whenDisplay = when ? new Date(when).toLocaleString() : '—'

  return (
    <tr
      className="hover:bg-amber-50 cursor-pointer"
      onClick={onClick}
      title="Click to view full log"
    >
      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{whenDisplay}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 text-xs rounded font-medium uppercase tracking-wide ${TYPE_BADGES[m.type] ?? 'bg-slate-100 text-slate-700'}`}
        >
          {TYPE_LABELS[m.type] ?? m.type.replace('_', ' ')}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="text-slate-900">{m.catalog_item?.name ?? <span className="text-slate-400">(deleted item)</span>}</div>
        {m.catalog_item?.sku && (
          <div className="text-[11px] font-mono text-slate-400">{m.catalog_item.sku}</div>
        )}
        {m.inventory_unit?.serial_number && (
          <div className="text-[11px] font-mono text-blue-600 mt-0.5">SN {m.inventory_unit.serial_number}</div>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-medium">
        {formatQty(m.quantity, m.catalog_item?.unit_label)}
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">{arrow}</td>
      <td className="px-4 py-3 text-xs text-slate-600">
        {sourceBits.length > 0 ? sourceBits.join(' · ') : <span className="text-slate-400">—</span>}
      </td>
    </tr>
  )
}

/**
 * Modal showing every field on a movement row — the "log detail" view.
 * Includes raw IDs (helpful for support / debugging), timestamps, and
 * linked context (PO, WO line, installation customer/asset).
 */
function MovementDetailModal({
  movement,
  onClose,
}: {
  movement: InventoryMovement
  onClose: () => void
}) {
  const m = movement
  const created = m.created_at ? new Date(m.created_at).toLocaleString() : '—'
  const applied = m.applied_at ? new Date(m.applied_at).toLocaleString() : '—'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 text-xs rounded font-medium uppercase tracking-wide ${TYPE_BADGES[m.type] ?? 'bg-slate-100 text-slate-700'}`}
              >
                {TYPE_LABELS[m.type] ?? m.type}
              </span>
              <h3 className="text-lg font-semibold text-slate-900">
                Movement log
              </h3>
            </div>
            <div className="text-xs text-slate-500 font-mono mt-1">{m.id}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm">
          <Section title="Item">
            <Row label="Name">{m.catalog_item?.name ?? <em className="text-slate-400">(deleted)</em>}</Row>
            <Row label="SKU">{m.catalog_item?.sku || '—'}</Row>
            <Row label="Quantity"><span className="font-medium">{formatQty(m.quantity, m.catalog_item?.unit_label)}</span></Row>
            {m.inventory_unit?.serial_number && (
              <Row label="Serial #"><span className="font-mono text-blue-700">{m.inventory_unit.serial_number}</span></Row>
            )}
          </Section>

          <Section title="Movement">
            {m.from_location && <Row label="From location">{m.from_location.name}</Row>}
            {m.from_bin && <Row label="From bin">📦 {m.from_bin.path_label}</Row>}
            {m.to_location && <Row label="To location">{m.to_location.name}</Row>}
            {m.to_bin && <Row label="To bin">📦 {m.to_bin.path_label}</Row>}
            {m.reason && <Row label="Reason">{m.reason}</Row>}
          </Section>

          {(m.reference_number || m.supplier_name || m.unit_cost_cents) && (
            <Section title="Source / cost">
              {m.reference_number && <Row label="PO #"><span className="font-mono">{m.reference_number}</span></Row>}
              {m.supplier_name && <Row label="Supplier">{m.supplier_name}</Row>}
              {m.unit_cost_cents != null && (
                <Row label="Unit cost">${(m.unit_cost_cents / 100).toFixed(2)}</Row>
              )}
            </Section>
          )}

          {/* Names and links, not ids. "cust_sgdsxdxvkfkpmx5y" is a correct
              answer to a question nobody asked — the log is read to find out
              who got the part and which job it went on, and both of those are
              somewhere you want to click through to. Ids stay visible
              underneath, because they are what you quote in a support thread. */}
          {(m.work_order?.id || m.work_order_line_item_id || m.installation.customer_id) && (
            <Section title="Linked records">
              {m.work_order?.id ? (
                <Row label="Job">
                  <Link
                    to={`/jobs/${m.work_order.id}`}
                    className="text-amber-700 hover:underline font-medium"
                  >
                    {m.work_order.number ? `#${m.work_order.number}` : 'Open job'}
                    {m.work_order.title ? ` — ${m.work_order.title}` : ''}
                  </Link>
                </Row>
              ) : m.work_order_line_item_id ? (
                <Row label="WO line item"><span className="font-mono">{m.work_order_line_item_id}</span></Row>
              ) : null}
              {m.installation.customer_id && (
                <Row label="Customer">
                  <Link
                    to={`/customers/${m.installation.customer_id}`}
                    className="text-amber-700 hover:underline font-medium"
                  >
                    {m.installation.customer_name || m.installation.customer_id}
                  </Link>
                </Row>
              )}
              {m.installation.service_location_id && (
                <Row label="Service location">
                  {m.installation.service_location_label || (
                    <span className="font-mono">{m.installation.service_location_id}</span>
                  )}
                </Row>
              )}
            </Section>
          )}

          <Section title="Timestamps">
            <Row label="Created">{created}</Row>
            <Row label="Applied">{applied}</Row>
            {m.created_by_account_id && (
              <Row label="Created by">
                {m.created_by_name || <span className="font-mono">{m.created_by_account_id}</span>}
              </Row>
            )}
          </Section>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-1.5 text-slate-700 hover:text-slate-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{title}</div>
      <div className="divide-y divide-slate-100 border border-slate-100 rounded">
        {children}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="col-span-2 text-slate-800 text-sm">{children}</div>
    </div>
  )
}
