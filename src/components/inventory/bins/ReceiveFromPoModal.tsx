/**
 * "Add from a purchase order": pick lines still waiting on open orders and
 * receive them straight into one bin or row. Receiving goes through the same
 * endpoint as the order page (POST /v1/purchase-orders/{po}/receive), so the
 * checks, tracked units, stock movement and audit trail are identical.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { receivePurchaseOrder } from '@/lib/purchaseOrders'
import { purchaseOrderKeys } from '@/hooks/usePurchaseOrders'
import { inventoryBinKeys } from '@/hooks/useInventoryBins'
import { receivableKey, useReceivablePurchaseOrders } from '@/hooks/useReceivablePurchaseOrders'
import { LinkOrCreateCatalogItemModal } from '@/components/purchasing/LinkOrCreateCatalogItemModal'
import type { InventoryBin } from '@/types/inventoryBin'
import { useInventorySettings } from '@/hooks/useInventorySettings'
import { buildReceiveRequests, capacityWarning, checkQty, labelSheetHref, parseSerials, receivableRows, type ReceivableRow } from '@/lib/binReceive'
import { ancestorsOf, type BinTree, type TreeNode } from '@/lib/binTree'
import { TypeIcon } from './binUi'
import { BinTile } from './BinTile'
import { fmtNum } from './binStyle'

/** Drag type for a PO line dropped on a spot. */
const DRAG_TYPE = 'application/x-crewbarn-po-line'

function pathOf(tree: BinTree, id: string): string {
  const n = tree.nodes.get(id)
  if (!n) return ''
  return [...ancestorsOf(tree, id).filter((a) => a.type !== 'location'), n].map((a) => a.code || a.label).join(' / ')
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  const dt = new Date(`${d}T12:00:00`)
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const noMenu = () => {}

function siblingsOf(tree: BinTree, n: TreeNode): TreeNode[] {
  const p = n.parentId ? tree.nodes.get(n.parentId) : null
  return p ? p.children.map((c) => tree.nodes.get(c)).filter((x): x is TreeNode => !!x) : [n]
}

const STATUS_WORDS: Record<string, string> = { ordered: 'Ordered', partially_received: 'Partly received' }

export function ReceiveFromPoModal({
  tree, targetId, targets, onClose, onWithoutPo,
}: {
  tree: BinTree
  /** The bin or row the stock goes into. */
  targetId: string
  /** Every spot the user could pick here (the bin and its rows). */
  targets: TreeNode[]
  onClose: () => void
  /** People with the PO-only override: add it by hand instead (the Add stock window, with its override box). */
  onWithoutPo?: (targetId: string) => void
}) {
  const qc = useQueryClient()
  const { data, isLoading, isError, refetch } = useReceivablePurchaseOrders()
  const [target, setTarget] = useState(targetId)
  const [search, setSearch] = useState('')
  const [qty, setQty] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState<{ total: number; orders: string[]; items: Array<{ id: string; name: string; qty: number; binId: string }> } | null>(null)
  // A line's own spot (dragged onto a tile, or "Put it somewhere else"),
  // the serials typed for tracked lines, and the line waiting for a spot.
  const [spots, setSpots] = useState<Record<string, string>>({})
  const [serials, setSerials] = useState<Record<string, string>>({})
  const [placing, setPlacing] = useState<string | null>(null)
  const [dropOn, setDropOn] = useState<string | null>(null)
  // A line not in the catalog yet, being made into a product.
  const [creating, setCreating] = useState<ReceivableRow | null>(null)
  const perUnit = !!useInventorySettings().data?.inventory_stock_unit_tracking_enabled

  const node = tree.nodes.get(target)!
  const rows = useMemo(() => receivableRows(data?.data ?? [], target), [data, target])
  const q = search.trim().toLowerCase()
  const shown = q
    ? rows.filter((r) => `${r.poNumber} ${r.vendor} ${r.name} ${r.line.catalog_item?.sku ?? ''} ${r.line.description}`.toLowerCase().includes(q))
    : rows
  const plan = buildReceiveRequests(rows, qty, target, { spots, serials })
  const warns = Object.entries(plan.byBin)
    .map(([id, n]) => { const t = tree.nodes.get(id); return t ? capacityWarning(t, n) : null })
    .filter((w): w is string => !!w)
  const setLine = (r: ReceivableRow, v: string) => setQty((prev) => ({ ...prev, [r.key]: v }))
  const rowOf = (key: string) => rows.find((r) => r.key === key)
  // Give a line its own spot. Dropping a line that has no quantity yet
  // receives all of it there.
  const placeLine = (key: string, spotId: string) => {
    const r = rowOf(key)
    if (!r || r.blocked) return
    setSpots((prev) => {
      const next = { ...prev }
      if (spotId === target) delete next[key]; else next[key] = spotId
      return next
    })
    if (!(Number(qty[key]) > 0)) setLine(r, String(r.remaining))
    setPlacing(null)
  }
  const pickSpot = (id: string) => { if (placing) placeLine(placing, id); else setTarget(id) }
  const dropProps = (id: string) => ({
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); setDropOn(id) } },
    onDragLeave: () => setDropOn((cur) => (cur === id ? null : cur)),
    onDrop: (e: React.DragEvent) => { const key = e.dataTransfer.getData(DRAG_TYPE); setDropOn(null); if (key) { e.preventDefault(); placeLine(key, id) } },
    'data-drop-spot': id,
  })

  async function receive() {
    if (plan.requests.length === 0) return
    setBusy(true)
    setErrors([])
    const failed: string[] = []
    const ok: string[] = []
    let total = 0
    const items = new Map<string, { id: string; name: string; qty: number; binId: string }>()
    for (const req of plan.requests) {
      try {
        await receivePurchaseOrder(req.poId, req.body)
        ok.push(req.poNumber)
        total += req.body.lines.reduce((s, l) => s + l.qty, 0)
        for (const l of req.body.lines) {
          const row = rows.find((r) => r.line.id === l.po_item_id)
          const c = row?.line.catalog_item
          if (!c) continue
          const k = `${c.id}:${l.bin_id}`
          const it = items.get(k) ?? { id: c.id, name: c.name, qty: 0, binId: l.bin_id }
          it.qty += l.qty
          items.set(k, it)
        }
      } catch (e) {
        failed.push(`${req.poNumber}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: receivableKey }),
      qc.invalidateQueries({ queryKey: purchaseOrderKeys.all }),
      qc.invalidateQueries({ queryKey: inventoryBinKeys.all }),
      qc.invalidateQueries({ queryKey: ['inventory-stock-levels'] }),
      qc.invalidateQueries({ queryKey: ['inventory-units'] }),
      qc.invalidateQueries({ queryKey: ['low-stock'] }),
    ])
    setBusy(false)
    setErrors(failed)
    if (ok.length) {
      setQty({})
      setSpots({})
      setSerials({})
      setDone({ total, orders: ok, items: [...items.values()] })
    }
  }

  // Grouped by order for display, in the rows' order.
  const groups: Array<{ poId: string; rows: ReceivableRow[] }> = []
  for (const r of shown) {
    const g = groups.find((x) => x.poId === r.poId)
    if (g) g.rows.push(r); else groups.push({ poId: r.poId, rows: [r] })
  }
  const orderOf = (poId: string) => data?.data.find((o) => o.id === poId)

  const withoutPo = onWithoutPo ? (
    <button type="button" data-without-po onClick={() => onWithoutPo(target)} disabled={busy}
      className="rounded-lg border border-[var(--bins-border)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]">
      Add without a purchase order (override)
    </button>
  ) : null

  return (
    <>
    {/* The New product window (ui/Modal) sits below this overlay's layer, so
        the overlay steps aside while it is open and comes back as it was. */}
    <div className={`fixed inset-0 z-[130] ${creating ? 'hidden' : 'flex'} items-end justify-center bg-[color-mix(in_srgb,var(--bins-dark)_55%,transparent)] sm:items-center sm:p-6`} role="dialog" aria-modal="true" aria-label="Add from a purchase order"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}
      onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose() } }}>
      <div data-tour="inv-bin-receive-po" className="flex max-h-[92vh] w-full max-w-[860px] flex-col overflow-hidden rounded-t-2xl bg-[var(--bins-surface)] shadow-2xl sm:rounded-2xl">
        <div className="border-b border-[var(--bins-border-soft)] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-start gap-3">
            <TypeIcon type={node.type} size={34} />
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-bold text-[var(--bins-text)]">Add from a purchase order</h2>
              <p className="text-[13px] text-[var(--bins-text-2)]">
                Into <b className="text-[var(--bins-text)]">{pathOf(tree, target)}</b>
                {' · '}{node.total.amount > 0 ? `${fmtNum(node.total.amount)}${node.capacity ? ` of ${fmtNum(node.capacity)}` : ''} in it now` : 'empty now'}
              </p>
            </div>
            <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-lg text-[var(--bins-muted)] hover:bg-[var(--bins-soft)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
            </button>
          </div>
          {placing && rowOf(placing) && (
            <div role="status" className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--bins-accent)] bg-[var(--bins-accent-soft)] px-3 py-2 text-[13.5px] text-[var(--bins-accent-ink)]">
              Pick a spot for <b>{rowOf(placing)!.name}</b>.
              <button type="button" onClick={() => setPlacing(null)} className="ml-auto rounded-md px-2 py-1 font-semibold underline">Cancel</button>
            </div>
          )}
          {targets.length > 8 ? (
            <div className="mt-3">
              <p className="mb-1.5 text-[13.5px] font-semibold text-[var(--bins-text-2)]">Where should it go?{targets.length > 1 && <span className="ml-1 font-normal text-[var(--bins-muted)]">Drag a line onto a spot to put just that line there.</span>}</p>
              <div role="radiogroup" aria-label="Which spot" className="grid max-h-[220px] gap-2 overflow-y-auto pr-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))' }}>
                {targets.map((t) => (
                  <div key={t.id} {...dropProps(t.id)} className={`rounded-xl ${dropOn === t.id ? 'ring-2 ring-[var(--bins-accent)] ring-offset-2' : ''}`}>
                    <BinTile node={t} siblings={siblingsOf(tree, t)} selected={!placing && t.id === target} role="radio" size="sm"
                      subtitle={pathOf(tree, t.id)} onMenu={noMenu} onPick={pickSpot} />
                  </div>
                ))}
              </div>
            </div>
          ) : targets.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Which spot">
              {targets.map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={!placing && t.id === target} onClick={() => pickSpot(t.id)} {...dropProps(t.id)}
                  className={`min-h-[40px] rounded-full border px-3 text-[13px] font-semibold ${dropOn === t.id ? 'ring-2 ring-[var(--bins-accent)] ' : ''}${!placing && t.id === target ? 'border-[var(--bins-accent)] bg-[var(--bins-accent-soft)] text-[var(--bins-accent-ink)]' : 'border-[var(--bins-border)] bg-[var(--bins-surface)] text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]'}`}>
                  {t.id === targetId && t.children.length ? `${t.label} itself` : t.label}
                </button>
              ))}
            </div>
          )}
          {rows.length > 4 && (
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find an order, vendor or item…" aria-label="Find an order, vendor or item"
              className="mt-3 h-11 w-full rounded-lg border border-[var(--bins-border)] px-3 text-[14px] focus:border-amber-500 focus:outline-none" />
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6">
          {isLoading && <div className="py-10 text-center text-sm text-[var(--bins-muted)]">Looking for open orders…</div>}
          {isError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Couldn't load the open orders. <button type="button" className="underline" onClick={() => void refetch()}>Try again</button>
            </div>
          )}
          {done && (
            <div role="status" className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[14px] text-emerald-900">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
              Received {fmtNum(done.total)} into {new Set(done.items.map((i) => i.binId)).size > 1 ? `${new Set(done.items.map((i) => i.binId)).size} places` : tree.nodes.get(done.items[0]?.binId ?? node.id)?.label ?? node.label} ({done.orders.join(', ')}).
              <span className="ml-auto flex flex-wrap gap-2">
                {done.items.map((it) => (
                  <Link key={`${it.id}:${it.binId}`} data-print-labels={it.id}
                    to={labelSheetHref(it.id, { locationId: tree.nodes.get(it.binId)?.locationId ?? node.locationId, binId: it.binId, binLabel: pathOf(tree, it.binId), qty: it.qty, perUnit })}
                    className="rounded-lg border border-emerald-700 px-3 py-2 text-[13px] font-semibold text-emerald-900 hover:bg-emerald-100">
                    Print {fmtNum(it.qty)} label{it.qty === 1 ? '' : 's'}{done.items.length > 1 ? ` · ${it.name}` : ''}{it.binId !== node.id ? ` · ${tree.nodes.get(it.binId)?.label ?? ''}` : ''}
                  </Link>
                ))}
                <button type="button" onClick={onClose} className="rounded-lg bg-emerald-700 px-3 py-2 text-[13px] font-semibold text-white">Done</button>
              </span>
            </div>
          )}
          {!isLoading && !isError && rows.length === 0 && !done && (
            <div className="rounded-xl border-[1.5px] border-dashed border-[var(--bins-border)] p-6 text-center">
              <p className="text-[15px] font-semibold text-[var(--bins-text)]">No open purchase orders to receive</p>
              <p className="mt-1 text-[13px] text-[var(--bins-muted)]">When an order is sent to a vendor, its lines show up here until they arrive.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link to="/purchase-orders/new" className="rounded-lg bg-amber-500 px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-amber-600">Start a purchase order</Link>
                <Link to="/purchase-orders" className="rounded-lg border border-[var(--bins-border)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]">Open purchase orders</Link>
                {withoutPo}
              </div>
            </div>
          )}
          {groups.map((g) => {
            const po = orderOf(g.poId)
            return (
              <section key={g.poId} className="mb-3 overflow-hidden rounded-xl border border-[var(--bins-border)]">
                <header className="flex flex-wrap items-center gap-x-3 gap-y-0.5 bg-[var(--bins-softer)] px-3 py-2 text-[13px]">
                  <Link to={`/purchase-orders/${g.poId}`} className="font-bold text-[var(--bins-text)] hover:underline">{po?.po_number}</Link>
                  <span className="text-[var(--bins-text-2)]">{po?.vendor?.name}</span>
                  <span className="text-[var(--bins-muted)]">{fmtDate(po?.order_date ?? null)}</span>
                  <span className="ml-auto rounded-full bg-[var(--bins-surface)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--bins-text-2)] ring-1 ring-[var(--bins-border)]">{STATUS_WORDS[po?.status ?? ''] ?? po?.status}</span>
                </header>
                {g.rows.map((r) => {
                  const raw = qty[r.key] ?? ''
                  const error = checkQty(raw, r).error ?? plan.errors[r.key] ?? null
                  const n = Number(raw) || 0
                  const spot = spots[r.key]
                  const typed = parseSerials(serials[r.key]).length
                  return (
                    <div key={r.key} draggable={!r.blocked && !busy}
                      onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, r.key); e.dataTransfer.effectAllowed = 'move' }}
                      data-po-line={r.key}
                      className={`grid gap-2 border-t ${!r.blocked ? 'cursor-grab active:cursor-grabbing ' : ''}${placing === r.key ? 'outline outline-2 outline-[var(--bins-accent)] ' : ''} border-[var(--bins-border-soft)] px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${n > 0 && !error ? 'bg-amber-50/60' : ''}`}>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-[var(--bins-text)]">{r.name}</div>
                        <div className="flex flex-wrap gap-x-3 text-[12px] text-[var(--bins-muted)]">
                          {r.line.catalog_item?.sku && <span className="font-mono">{r.line.catalog_item.sku}</span>}
                          <span>Ordered {fmtNum(r.line.qty_ordered)} · Received {fmtNum(r.line.qty_received)} · <b className="text-[var(--bins-text)]">{fmtNum(r.remaining)} still to come</b></span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11.5px]">
                          {r.usual === 'here' && <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">Usually kept here</span>}
                          {r.usual && r.usual !== 'here' && tree.nodes.has(r.usual) && (
                            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-800">Usually kept in {pathOf(tree, r.usual)}</span>
                          )}
                          {r.tracked && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700">Tracked: each one gets its own serial and sticker</span>}
                          {r.blocked && !r.line.catalog_item && (
                            <span className="text-[var(--bins-text-2)]">Not in the catalog yet.</span>
                          )}
                          {r.blocked && r.line.catalog_item && <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">{r.blocked}</span>}
                        </div>
                        {spot && tree.nodes.has(spot) && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px]">
                            <span data-line-spot={spot} className="rounded-full bg-[var(--bins-accent-soft)] px-2 py-0.5 font-semibold text-[var(--bins-accent-ink)]">Goes to {pathOf(tree, spot)}</span>
                            <button type="button" onClick={() => placeLine(r.key, target)} className="font-semibold text-[var(--bins-text-2)] underline">Back to {node.code || node.label}</button>
                          </div>
                        )}
                        {!r.blocked && targets.length > 1 && !spot && (
                          <button type="button" onClick={() => setPlacing(placing === r.key ? null : r.key)}
                            className="mt-1 text-[12.5px] font-semibold text-[var(--bins-text-2)] underline">
                            {placing === r.key ? 'Pick a spot above…' : 'Put this line somewhere else'}
                          </button>
                        )}
                        {r.tracked && n > 0 && (
                          <label className="mt-1.5 block">
                            <span className="text-[12.5px] font-semibold text-[var(--bins-text-2)]">
                              Serial numbers <span className="font-normal text-[var(--bins-muted)]">(optional: scan or type one per line; {typed ? `${typed} of ${fmtNum(n)} typed, ` : ''}the rest get numbers made for them)</span>
                            </span>
                            <textarea value={serials[r.key] ?? ''} rows={Math.min(4, Math.max(2, typed + 1))}
                              onChange={(e) => setSerials((prev) => ({ ...prev, [r.key]: e.target.value }))}
                              onKeyDown={(e) => e.stopPropagation()}
                              aria-label={`Serial numbers for ${r.name}`} data-serials={r.key}
                              className="mt-1 w-full rounded-lg border border-[var(--bins-border)] bg-[var(--bins-surface)] px-2.5 py-1.5 font-mono text-[13px] text-[var(--bins-text)] focus:border-amber-500 focus:outline-none" />
                          </label>
                        )}
                        {error && <div className="mt-0.5 text-[12px] font-medium text-red-600">{error}</div>}
                      </div>
                      {r.blocked && !r.line.catalog_item && (
                        <button type="button" data-create-product={r.key} onClick={() => setCreating(r)} disabled={busy}
                          className="h-11 rounded-lg bg-[var(--bins-accent)] px-4 text-[13.5px] font-bold text-white hover:bg-[var(--bins-accent-strong)]">
                          Create product
                        </button>
                      )}
                      {!r.blocked && (
                        <div className="flex items-center gap-1.5">
                          <button type="button" aria-label={`One fewer ${r.name}`} onClick={() => setLine(r, String(Math.max(0, n - 1) || ''))}
                            className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--bins-border)] text-lg font-bold text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]">−</button>
                          <input inputMode="decimal" value={raw} onChange={(e) => setLine(r, e.target.value)} placeholder="0" aria-label={`How many ${r.name}`}
                            className={`h-11 w-16 rounded-lg border text-center text-[15px] font-semibold tabular-nums focus:outline-none ${error ? 'border-red-400' : 'border-[var(--bins-border)] focus:border-amber-500'}`} />
                          <button type="button" aria-label={`One more ${r.name}`} onClick={() => setLine(r, String(Math.min(r.remaining, n + 1)))}
                            className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--bins-border)] text-lg font-bold text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]">+</button>
                          <button type="button" onClick={() => setLine(r, String(r.remaining))}
                            className="h-11 rounded-lg px-2.5 text-[12.5px] font-semibold text-amber-700 hover:bg-amber-50">All {fmtNum(r.remaining)}</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </section>
            )
          })}
          {data?.truncated && <p className="py-2 text-center text-[12px] text-[var(--bins-muted)]">Showing the 100 newest open orders. Search to find older ones.</p>}
        </div>

        {rows.length > 0 && (
          <div className="border-t border-[var(--bins-border-soft)] px-4 py-3 sm:px-6">
            {warns.map((w) => <div key={w} role="alert" className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{w}</div>)}
            {errors.map((e) => <div key={e} className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{e}</div>)}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-[var(--bins-muted)]">
                {plan.total > 0 ? `${fmtNum(plan.total)} to receive from ${plan.requests.length} order${plan.requests.length === 1 ? '' : 's'}` : 'Choose how many of each arrived.'}
              </span>
              {withoutPo}
              <button type="button" onClick={onClose} disabled={busy} className="ml-auto h-11 rounded-lg px-4 text-[14px] font-semibold text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]">Cancel</button>
              <button type="button" onClick={() => void receive()} disabled={busy || plan.total <= 0 || Object.keys(plan.errors).length > 0}
                className="h-11 rounded-lg bg-amber-500 px-5 text-[14px] font-bold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-[var(--bins-border)] disabled:text-[var(--bins-text-2)]">
                {busy ? 'Receiving…' : plan.total > 0 ? `Receive ${fmtNum(plan.total)} into ${Object.keys(plan.byBin).length > 1 ? `${Object.keys(plan.byBin).length} places` : (tree.nodes.get(Object.keys(plan.byBin)[0])?.code || node.code || node.label)}` : 'Receive'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
      {creating && (
        <LinkOrCreateCatalogItemModal
          poId={creating.poId}
          line={creating.line}
          vendorLabel={creating.vendor || null}
          vendorId={creating.vendorId}
          // Its home is where it is being received: the spot this line goes to.
          // Same rule as Add to bin (addStockVerdict): a rack or shelf that only
          // holds other places is no Default Bin; the picker is left for it.
          defaultBin={(() => {
            const n = tree.nodes.get(spots[creating.key] || target)
            return n?.holdsStock ? ((n.bin as InventoryBin | null | undefined) ?? null) : null
          })()}
          onClose={() => setCreating(null)}
          onLinked={() => {
            const key = creating.key
            const left = creating.remaining
            void qc.invalidateQueries({ queryKey: receivableKey }).then(() => setQty((prev) => ({ ...prev, [key]: String(left) })))
          }}
        />
      )}
    </>
  )
}
