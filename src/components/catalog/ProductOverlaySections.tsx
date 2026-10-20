import { Link } from 'react-router-dom'
import '@/components/inventory/bins/bins.css'
import { useInventoryMovements } from '@/hooks/useInventoryMovements'
import { useReceivablePurchaseOrders } from '@/hooks/useReceivablePurchaseOrders'
import { formatDateValue } from '@/hooks/useTenantTime'
import { poLabel } from '@/lib/catalogOrders'
import { formatQty } from '@/lib/unitsOfMeasure'
import { INVENTORY_MOVEMENT_TYPE_LABELS, type InventoryMovement } from '@/types/inventoryMovement'
import type { InventoryStockLevel } from '@/types/inventoryStockLevel'

/**
 * The extra parts of the product overlay (ProductViewModal): where it is, by
 * shop and by van; the orders still to come in; what moved lately. Each one
 * reads an endpoint that already exists. Theme colours via the --bins-* roles
 * with plain fallbacks, as the Stock tab does.
 */

const head = 'text-xs font-medium uppercase tracking-wide text-[var(--bins-muted)]'

/** Stock grouped by place: shops and warehouses first, then vans, each bin on its own line. */
export function StockByPlace({ placements, unit }: { placements: InventoryStockLevel[]; unit: string }) {
  const groups = new Map<string, { name: string; van: boolean; rows: InventoryStockLevel[]; total: number }>()
  for (const sl of placements) {
    const key = sl.location_id
    const g = groups.get(key) ?? { name: sl.location?.name ?? 'Unknown place', van: sl.location?.type === 'truck', rows: [], total: 0 }
    g.rows.push(sl)
    g.total += sl.quantities.qty_on_hand
    groups.set(key, g)
  }
  const ordered = [...groups.values()].sort((a, b) => Number(a.van) - Number(b.van) || a.name.localeCompare(b.name))
  if (ordered.length === 0) return null
  return (
    <div data-bins-ui data-tour="prod-view-places" className="mt-3 grid gap-2 sm:grid-cols-2">
      {ordered.map((g) => (
        <div key={g.name + String(g.van)} className="rounded-lg border border-[var(--bins-border)] px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-[var(--bins-text)]">
              {g.van ? '🚐' : '🏬'} {g.name}
              {g.van && <span className="ml-1.5 rounded bg-[var(--bins-soft)] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase text-[var(--bins-muted)]">Van</span>}
            </span>
            <span className="tabular-nums text-sm font-semibold text-[var(--bins-text)]">{formatQty(g.total, unit)}</span>
          </div>
          <ul className="mt-1 space-y-0.5 text-[12.5px] text-[var(--bins-text-2)]">
            {g.rows.map((sl) => (
              <li key={sl.id} className="flex justify-between gap-2">
                <span className="truncate">{sl.bin ? (sl.bin.place_label || sl.bin.path_label || sl.bin.name || sl.bin.bin_code) : 'No bin'}</span>
                <span className="tabular-nums">{formatQty(sl.quantities.qty_on_hand, unit)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Orders with some of this product still to come in (GET /v1/purchase-orders/receivable?catalog_item_id=). */
export function OpenOrders({ itemId, unit }: { itemId: string; unit: string }) {
  const q = useReceivablePurchaseOrders(true, itemId)
  const orders = q.data?.data ?? []
  return (
    <div data-bins-ui data-tour="prod-view-open-pos">
      <div className={head}>Open purchase orders</div>
      {q.isLoading ? <p className="mt-1 text-sm text-[var(--bins-muted)]">…</p>
        : q.isError ? <p className="mt-1 text-sm text-[var(--color-danger)]">Couldn't load the orders. <button type="button" className="underline" onClick={() => void q.refetch()}>Try again</button></p>
          : orders.length === 0 ? <p className="mt-1 text-sm italic text-[var(--bins-muted)]">Nothing on order.</p>
            : (
              <ul className="mt-1 divide-y divide-[var(--bins-border-soft)] text-sm">
                {orders.map((o) => {
                  // Only this product's lines: the order may carry other parts too.
                  const waiting = o.lines.filter((l) => l.catalog_item?.id === itemId).reduce((n, l) => n + l.qty_remaining, 0)
                  return (
                    <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                      <Link to={`/purchase-orders/${o.id}`} className="font-mono font-medium text-[var(--bins-accent-ink)] hover:underline">{poLabel(o.po_number)}</Link>
                      <span className="min-w-0 flex-1 truncate text-[var(--bins-text-2)]">{o.vendor?.name ?? 'No supplier'}</span>
                      <span className="tabular-nums text-[var(--bins-text)]">{formatQty(waiting, unit)} to come</span>
                      {o.expected_delivery && <span className="text-xs text-[var(--bins-muted)]">due {formatDateValue(o.expected_delivery, { month: 'short', day: 'numeric' }, 'en-US')}</span>}
                    </li>
                  )
                })}
              </ul>
            )}
    </div>
  )
}

function where(m: InventoryMovement): string {
  const to = m.to_bin?.path_label || m.to_location?.name
  const from = m.from_bin?.path_label || m.from_location?.name
  if (from && to) return `${from} → ${to}`
  return to ?? from ?? ''
}

/** The last few movements of this product, newest first, with a way to all of them. */
export function RecentMovements({ itemId, unit }: { itemId: string; unit: string }) {
  const q = useInventoryMovements({ catalog_item_id: itemId, per_page: 5 })
  const rows: InventoryMovement[] = q.data?.data ?? []
  return (
    <div data-bins-ui data-tour="prod-view-movements">
      <div className="flex items-baseline justify-between">
        <div className={head}>Recent movements</div>
        <Link to={`/inventory?tab=movements&item=${encodeURIComponent(itemId)}`} className="text-xs font-medium text-[var(--bins-accent-ink)] hover:underline">All movements</Link>
      </div>
      {q.isLoading ? <p className="mt-1 text-sm text-[var(--bins-muted)]">…</p>
        : q.isError ? <p className="mt-1 text-sm text-[var(--color-danger)]">Couldn't load the movements. <button type="button" className="underline" onClick={() => void q.refetch()}>Try again</button></p>
          : rows.length === 0 ? <p className="mt-1 text-sm italic text-[var(--bins-muted)]">Nothing has moved yet.</p>
            : (
              <ul className="mt-1 divide-y divide-[var(--bins-border-soft)] text-sm">
                {rows.map((m) => (
                  <li key={m.id} className="grid grid-cols-[7.5rem_1fr_auto] items-baseline gap-2 py-1.5">
                    <span className="truncate font-medium text-[var(--bins-text)]">{INVENTORY_MOVEMENT_TYPE_LABELS[m.type] ?? m.type}</span>
                    <span className="truncate text-[12.5px] text-[var(--bins-text-2)]">
                      {where(m)}
                      {(m.created_by_name || m.applied_at) && (
                        <span className="text-[var(--bins-muted)]">
                          {' · '}{m.created_by_name ?? ''}{m.created_by_name && m.applied_at ? ', ' : ''}
                          {m.applied_at ? formatDateValue(m.applied_at, { month: 'short', day: 'numeric' }, 'en-US') : ''}
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums font-medium text-[var(--bins-text)]">{formatQty(m.quantity, unit)}</span>
                  </li>
                ))}
              </ul>
            )}
    </div>
  )
}
