/**
 * Start PO from a bin, shelf, rack or row: the low items stored there and
 * anywhere inside it, ticked, with a suggested quantity. "Create PO" puts the
 * ticked ones in the parts cart (the same POST /v1/purchase-requests/bulk as
 * Needs ordering, source low_stock) and opens Order parts, where each line
 * already has its preferred supplier and that supplier's part number, and the
 * buyer can change or split suppliers (one PO per supplier).
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getBinContents } from '@/lib/inventoryBins'
import { inventoryBinKeys } from '@/hooks/useInventoryBins'
import { useLowStock } from '@/hooks/useLowStock'
import { CART_KEYS, addAsks } from '@/lib/purchaseRequests'
import { lowItemsInPlace } from '@/lib/startPo'
import { ItemThumb } from '@/components/needsOrdered/LowStockItemDetails'
import type { TreeNode } from '@/lib/binTree'
import { fmtNum } from './binStyle'

export function StartPoFromBinModal({ node, onClose }: { node: TreeNode; onClose: () => void }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const contents = useQuery({
    queryKey: inventoryBinKeys.contents(node.id),
    queryFn: () => getBinContents(node.id),
    staleTime: 15_000,
  })
  const low = useLowStock(true)
  const rows = useMemo(() => lowItemsInPlace(contents.data?.stock_levels ?? [], low.data ?? []), [contents.data, low.data])
  const [off, setOff] = useState<Record<string, boolean>>({})
  const [qtys, setQtys] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const qtyOf = (id: string, suggested: number) => qtys[id] ?? String(suggested)
  const picked = rows.filter((r) => !off[r.item.id] && Number(qtyOf(r.item.id, r.suggested)) > 0)
  const loading = contents.isLoading || low.isLoading
  const failed = contents.isError || low.isError
  const place = node.bin?.path_label || node.label

  async function create() {
    if (!picked.length) return
    setBusy(true)
    setError(null)
    try {
      await addAsks(picked.map((r) => ({ catalog_item_id: r.item.id, qty: Number(qtyOf(r.item.id, r.suggested)), for_kind: 'stock' as const, source: 'low_stock' as const })))
      for (const key of CART_KEYS) void qc.invalidateQueries({ queryKey: [...key] })
      navigate('/order-parts')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'They were not added. Try again.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-[color-mix(in_srgb,var(--bins-dark)_55%,transparent)] sm:items-center" role="dialog" aria-modal="true" aria-label="Start PO"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}
      onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose() } }}>
      <div className="flex max-h-[90vh] w-full max-w-[640px] flex-col rounded-t-2xl bg-[var(--bins-surface)] p-5 shadow-2xl sm:rounded-2xl" data-tour="start-po">
        <h2 className="text-[17px] font-bold text-[var(--bins-text)]">Start PO</h2>
        <p className="mt-1 text-[13px] text-[var(--bins-text-2)]">
          Low items kept in <b>{place}</b> and everything inside it. Low means the whole shop is at or under its reorder point.
        </p>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {loading && <p className="py-8 text-center text-[13px] text-[var(--bins-muted)]">Looking…</p>}
          {failed && (
            <p role="alert" className="rounded-lg bg-[var(--bins-soft)] px-3 py-2 text-[13px] text-[var(--bins-room)]">
              That did not load. <button type="button" className="underline" onClick={() => { void contents.refetch(); void low.refetch() }}>Try again</button>
            </p>
          )}
          {!loading && !failed && rows.length === 0 && (
            <div className="rounded-xl bg-[var(--bins-soft)] px-4 py-8 text-center" data-empty>
              <p className="text-[15px] font-semibold text-[var(--bins-text)]">Nothing low here</p>
              <p className="mt-1 text-[13px] text-[var(--bins-muted)]">Everything stored in {node.label} is above its reorder point.</p>
            </div>
          )}
          {!loading && !failed && rows.length > 0 && (
            <ul className="m-0 list-none space-y-2 p-0">
              {rows.map((r) => {
                const it = r.item
                const on = !off[it.id]
                return (
                  <li key={it.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${on ? 'border-[var(--bins-accent-line)] bg-[var(--bins-accent-soft)]' : 'border-[var(--bins-border)]'}`}>
                    <input type="checkbox" checked={on} aria-label={`Order ${it.name}`} className="h-5 w-5 shrink-0 accent-[var(--bins-accent)]"
                      onChange={(e) => setOff((p) => ({ ...p, [it.id]: !e.target.checked }))} />
                    <ItemThumb it={it} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold text-[var(--bins-text)]">{it.name}</div>
                      <div className="text-[12px] text-[var(--bins-muted)]">
                        <span className="tabular-nums">{fmtNum(r.here)} here</span>
                        {' · '}<span className="tabular-nums">{fmtNum(it.current_stock)} in the shop, reorder at {fmtNum(it.reorder_threshold)}</span>
                        {it.preferred_supplier && <> · {it.preferred_supplier.vendor_name}</>}
                      </div>
                      {(it.on_order_qty ?? 0) > 0 && (
                        <span className="mt-0.5 inline-block rounded-full bg-[var(--bins-soft)] px-2 text-[11.5px] font-semibold text-[var(--bins-text-2)]" data-on-order>
                          {fmtNum(it.on_order_qty ?? 0)} already on order
                        </span>
                      )}
                    </div>
                    <label className="flex shrink-0 flex-col items-end text-[11px] text-[var(--bins-muted)]">
                      Order
                      <input type="number" min={0} step="any" inputMode="decimal" value={qtyOf(it.id, r.suggested)} aria-label={`How many ${it.name} to order`}
                        onChange={(e) => setQtys((p) => ({ ...p, [it.id]: e.target.value.replace(/[^0-9.]/g, '') }))}
                        className="mt-0.5 h-10 w-20 rounded-lg border border-[var(--bins-border)] bg-[var(--bins-surface)] px-2 text-right text-[15px] text-[var(--bins-text)] focus:border-[var(--bins-accent)] focus:outline-none" />
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {error && <p role="alert" className="mt-2 rounded bg-[var(--bins-soft)] px-2 py-1.5 text-[12.5px] text-[var(--bins-room)]">{error}</p>}
        <div className="mt-4 flex items-center justify-end gap-2">
          {rows.length > 0 && <span className="mr-auto text-[12.5px] text-[var(--bins-muted)]">{picked.length} of {rows.length} ticked · you pick suppliers next</span>}
          <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-lg px-4 text-[14px] font-semibold text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]">{rows.length ? 'Cancel' : 'Close'}</button>
          {rows.length > 0 && (
            <button type="button" onClick={() => void create()} disabled={!picked.length || busy}
              className="h-11 rounded-lg bg-[var(--bins-accent)] px-5 text-[14px] font-bold text-[var(--bins-surface)] hover:bg-[var(--bins-accent-strong)] disabled:bg-[var(--bins-border)] disabled:text-[var(--bins-text-2)]">
              {busy ? 'Adding…' : 'Create PO'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
