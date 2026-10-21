import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { IconMinus, IconPlus, IconStarFilled, IconX } from '@tabler/icons-react'
import { useLowStock } from '@/hooks/useLowStock'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'
import { ItemThumb } from '@/components/needsOrdered/LowStockItemDetails'
import { UndoToast } from '@/components/ui/UndoToast'
import { useUndoToast } from '@/hooks/useUndoToast'
import { CatalogItemOverlay } from '@/pages/ProductCatalogPage'
import { useAuth } from '@/hooks/useAuth'
import { listVendors, money, count, poLabel, type VendorChoice } from '@/lib/catalogOrders'
import {
  CART_KEYS,
  addAsks,
  askFor,
  changeAsk,
  createOrders,
  guessCost,
  listAsks,
  readReview,
  removeAsk,
  restoreAsk,
  undoOrder,
  type Ask,
  type PartGroup,
  type Review,
} from '@/lib/purchaseRequests'
import { OrderFilterChips } from '@/components/parts/OrderFilterChips'
import { applyFilter, filterCounts, groupKinds, type OrderFilter } from '@/lib/startPo'

/** One supplier's share of a part: who, how many, and the cost if typed. */
type Row = { vendor_id: string; qty: string; cost: string }

/**
 * Order parts: the one place parts get ordered from.
 *
 * Everything the crew put in the parts cart -- from catalogs, reference
 * cards, items, estimates and jobs -- grouped by part, with who asked and
 * what for. The buyer picks a supplier for each part (the preferred one is
 * picked already), splits a part between suppliers when one cannot cover
 * it, and makes the purchase orders: one per supplier. Low stock joins the
 * same list. Drafts made here can be put back in the cart until they are
 * marked ordered.
 *
 * Without the right to send orders, the page shows the parts this person
 * asked for and where they are.
 */
export function OrderPartsPage() {
  const { has } = usePermissions()
  return has(PERM.INVENTORY_ORDER) ? <BuyerView /> : <MyAsks />
}

function Heading({ description, actions }: { description: string; actions?: React.ReactNode }) {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  return (
    <div data-tour="order-parts-header">
      {easy ? <EasyPageHeading title="Order parts" description={description} actions={actions} /> : (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold text-slate-900">Order parts</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
    </div>
  )
}

function useRefreshCart() {
  const qc = useQueryClient()
  return () => {
    for (const key of CART_KEYS) void qc.invalidateQueries({ queryKey: [...key] })
    void qc.invalidateQueries({ queryKey: ['low-stock'] })
    void qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    void qc.invalidateQueries({ queryKey: ['parts-orders'] })
  }
}

function costOf(group: PartGroup, row: Row, vendors: VendorChoice[]): number | null {
  if (row.cost.trim() !== '') {
    const n = Math.round(Number(row.cost.replace(/[$,\s]/g, '')) * 100)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  const seller = group.sellers.find((s) => s.vendor_id === row.vendor_id)
  if (seller?.unit_cost_cents != null) return seller.unit_cost_cents
  return guessCost(group, vendors.find((v) => v.id === row.vendor_id))
}

function BuyerView() {
  const qc = useQueryClient()
  const refresh = useRefreshCart()
  const review = useQuery({ queryKey: ['order-parts'], queryFn: readReview })
  const vendorsQ = useQuery({ queryKey: ['catalog-order-vendors'], queryFn: listVendors, staleTime: 5 * 60_000 })
  const lowStock = useLowStock(true)
  const vendors = vendorsQ.data ?? []
  const allGroups = useMemo(() => review.data?.groups ?? [], [review.data])
  // All / For stock / For jobs / For estimates. Suppliers, Use preferred and Create work on the parts shown.
  const [filter, setFilter] = useState<OrderFilter>('all')
  const counts = useMemo(() => filterCounts(allGroups, (g) => groupKinds(g.asks)), [allGroups])
  const groups = useMemo(() => applyFilter(allGroups, filter, (g) => groupKinds(g.asks)), [allGroups, filter])
  const drafts = review.data?.drafts ?? []

  const [rows, setRows] = useState<Record<string, Row[]>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [made, setMade] = useState<Array<{ id: string; po_number: string; vendor: string; lines: number; total_cents: number }> | null>(null)

  // Each part starts with one row: its preferred supplier, everything still open.
  useEffect(() => {
    setRows((prev) => {
      const next: Record<string, Row[]> = {}
      for (const g of allGroups) {
        if (g.open <= 0) continue
        next[g.key] = prev[g.key] ?? [{ vendor_id: g.preferred_vendor_id ?? '', qty: count(g.open), cost: '' }]
      }
      return next
    })
  }, [allGroups])

  const show = (data: Review) => qc.setQueryData(['order-parts'], data)
  const [toast, setToast] = useUndoToast()
  const [opened, setOpened] = useState<string | null>(null)

  /**
   * Remove from cart: the existing take-out (DELETE /v1/purchase-requests/{id})
   * for each ask, then Undo puts each back with what it had. What is already
   * on an order stays there.
   */
  const removeFromCart = async (asks: PartGroup['asks'], what: string) => {
    setBusy(true)
    setError(null)
    const back: Array<{ id: string; qty: number }> = []
    try {
      for (const a of asks) {
        const res = await removeAsk(a.id)
        back.push(res.undo ?? { id: a.id, qty: a.qty })
      }
      setToast({
        text: `${what} taken out of the cart.`,
        undo: async () => {
          setToast(null)
          try {
            for (const b of back) await restoreAsk(b.id, b.qty)
            setToast({ text: `${what} is back in the cart.` })
          } catch (e) {
            setError(e instanceof Error ? e.message : 'It did not go back in the cart.')
          }
          refresh()
        },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not come out of the cart.')
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const usePreferred = () => {
    setRows((prev) => {
      const next = { ...prev }
      for (const g of groups) {
        if (g.open <= 0 || !g.preferred_vendor_id) continue
        next[g.key] = [{ vendor_id: g.preferred_vendor_id, qty: count(g.open), cost: '' }]
      }
      return next
    })
  }

  const ready = groups.filter((g) => g.open > 0 && (rows[g.key] ?? []).some((r) => r.vendor_id && Number(r.qty) > 0))
  const waiting = groups.filter((g) => g.open > 0)
  const unpicked = waiting.length - ready.length
  const anyPreferred = waiting.some((g) => g.preferred_vendor_id)

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const parts = ready.map((g) => ({
        key: g.key,
        shares: (rows[g.key] ?? [])
          .filter((r) => r.vendor_id && Number(r.qty) > 0)
          .map((r) => ({ vendor_id: r.vendor_id, qty: Number(r.qty), unit_cost_cents: costOf(g, r, vendors) })),
      }))
      const res = await createOrders(parts)
      setMade(res.orders)
      setRows({})
      show(res)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The orders were not made.')
    } finally {
      setBusy(false)
    }
  }

  const undo = async (poId: string, itemId?: string) => {
    setBusy(true)
    setError(null)
    try {
      show(await undoOrder(poId, itemId))
      setMade(null)
      setRows({})
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not go back in the cart.')
    } finally {
      setBusy(false)
    }
  }

  // Low on the shelves, and not already in the cart for stock.
  const inCartForStock = new Set(allGroups.flatMap((g) => g.asks.filter((a) => a.for_kind === 'stock' && a.open > 0).map((a) => a.catalog_item_id)).filter(Boolean))
  const low = (lowStock.data ?? []).filter((it) => !inCartForStock.has(it.id) && Math.ceil((it.suggested_qty || 0) - (it.on_order_qty || 0)) > 0)
  const addLow = async () => {
    setBusy(true)
    setError(null)
    try {
      await addAsks(low.map((it) => ({
        catalog_item_id: it.id,
        qty: Math.ceil((it.suggested_qty || 0) - (it.on_order_qty || 0)),
        for_kind: 'stock' as const,
        source: 'low_stock' as const,
      })))
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The low items were not added.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
      <Heading description="Everything your crew asked for, grouped by part. Pick who each part comes from, then make the orders: one for each supplier." />

      {made && made.length > 0 && (
        <div role="status" data-tour="order-parts-made" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-medium">{made.length === 1 ? 'One purchase order is ready' : `${made.length} purchase orders are ready`} as drafts. Check them, then mark each one ordered.</p>
          <ul className="mt-1 list-none space-y-0.5 p-0">
            {made.map((o) => (
              <li key={o.id}>
                <Link to={`/purchase-orders/${o.id}`} className="font-medium underline">{poLabel(o.po_number)}</Link>
                {` · ${o.vendor} · ${o.lines} ${o.lines === 1 ? 'line' : 'lines'} · ${money(o.total_cents)}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {low.length > 0 && (
        <div data-tour="order-parts-low-stock" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="min-w-0 flex-1">
            {low.length === 1 ? `${low[0].name} is low on the shelves.` : `${low.length} items are low on the shelves.`}
            {' '}Add {low.length === 1 ? 'it' : 'them'} here to order with everything else.
          </span>
          <Link to="/purchase-orders/needs-ordered" className="text-sm font-medium text-amber-900 underline">See what is low</Link>
          <button type="button" disabled={busy} onClick={() => void addLow()}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
            Add to the list
          </button>
        </div>
      )}

      {review.isLoading && <p className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading…</p>}
      {review.isError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-700">
          The parts list did not load. <button type="button" className="underline" onClick={() => void review.refetch()}>Try again</button>
        </p>
      )}

      {allGroups.length > 0 && (
        <OrderFilterChips value={filter} counts={counts} onChange={setFilter} />
      )}

      {review.isSuccess && allGroups.length > 0 && groups.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Nothing in the cart is for that. <button type="button" className="underline" onClick={() => setFilter('all')}>Show all</button>
        </div>
      )}

      {review.isSuccess && allGroups.length === 0 && (
        <div data-tour="order-parts-empty" className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
          Nothing waiting to be ordered. Parts your crew adds to the cart from catalogs, reference cards, items, estimates and jobs show up here.
        </div>
      )}

      {groups.length > 0 && (
        <div data-tour="order-parts-toolbar" data-ready={ready.length > 0 ? 'yes' : 'no'} className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <span className="text-sm text-slate-600">
            {waiting.length} {waiting.length === 1 ? 'part' : 'parts'} waiting
            {unpicked > 0 && ` · ${unpicked} without a supplier yet`}
          </span>
          <span className="grow" />
          <button type="button" data-tour="order-parts-preferred" disabled={!anyPreferred || busy} onClick={usePreferred}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            title={anyPreferred ? 'Every part to its preferred supplier' : 'No part has a preferred supplier yet'}>
            <IconStarFilled size={14} className="text-amber-500" aria-hidden /> Use preferred for all
          </button>
          <button type="button" data-tour="order-parts-create" disabled={ready.length === 0 || busy} onClick={() => void create()}
            className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40">
            {busy ? 'Working…' : 'Create purchase orders'}
          </button>
        </div>
      )}

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}

      {groups.length > 0 && (
        <ol data-tour="order-parts-list" className="m-0 list-none space-y-3 p-0">
          {groups.map((g, i) => (
            <PartCard
              key={g.key}
              first={i === 0}
              group={g}
              rows={rows[g.key] ?? []}
              vendors={vendors}
              busy={busy}
              onRows={(next) => setRows((prev) => ({ ...prev, [g.key]: next }))}
              onUndo={(poId, itemId) => void undo(poId, itemId)}
              onRemove={(asks, what) => void removeFromCart(asks, what)}
              onOpen={g.catalog_item_id ? () => setOpened(g.catalog_item_id) : undefined}
            />
          ))}
        </ol>
      )}

      {opened && <CatalogItemOverlay id={opened} onClose={() => setOpened(null)} />}
      <UndoToast toast={toast} tour="order-parts-undo" />

      {drafts.length > 0 && (
        <section data-tour="order-parts-drafts" className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Drafts made here</h2>
          <p className="text-xs text-slate-500">Not sent yet. Put one back in the cart to choose again, or open it to mark it ordered.</p>
          <ul className="mt-2 list-none divide-y divide-slate-100 p-0 text-sm">
            {drafts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                <Link to={`/purchase-orders/${d.id}`} className="font-medium text-sky-700 hover:underline">{poLabel(d.po_number)}</Link>
                <span className="text-slate-700">{d.vendor}</span>
                {d.estimate_number && <span className="text-xs text-slate-500">for estimate {d.estimate_number}</span>}
                <span className="text-xs text-slate-500">{d.lines} {d.lines === 1 ? 'line' : 'lines'}</span>
                <span className="tabular-nums text-slate-700">{money(d.total_cents)}</span>
                <span className="grow" />
                <button type="button" disabled={busy} onClick={() => void undo(d.id)} className="text-xs font-medium text-sky-700 hover:underline disabled:opacity-50">
                  Put back in the cart
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function PartCard({
  group,
  first,
  rows,
  vendors,
  busy,
  onRows,
  onUndo,
  onRemove,
  onOpen,
}: {
  group: PartGroup
  first: boolean
  rows: Row[]
  vendors: VendorChoice[]
  busy: boolean
  onRows: (rows: Row[]) => void
  onUndo: (poId: string, itemId?: string) => void
  /** Take these asks out of the cart (with Undo); `what` names it in the note. */
  onRemove: (asks: PartGroup['asks'], what: string) => void
  /** Open the item in an overlay; only for the shop's own items. */
  onOpen?: () => void
}) {
  const { account } = useAuth()
  const { has } = usePermissions()
  // Whoever orders parts may take anything out; anyone else only their own.
  const mayRemove = (a: PartGroup['asks'][number]) => has(PERM.INVENTORY_ORDER) || a.requested_by?.id === account?.id
  const removable = group.asks.filter((a) => a.open > 0 && mayRemove(a))
  const split = rows.reduce((n, r) => n + (Number(r.qty) || 0), 0)
  const left = Math.max(0, Math.round((group.open - split) * 100) / 100)
  const known = new Set(group.sellers.map((s) => s.vendor_id))
  const others = vendors.filter((v) => !known.has(v.id))
  const set = (i: number, patch: Partial<Row>) => onRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <li data-tour={first ? 'order-parts-part' : undefined} className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <ItemThumb it={{ name: group.description, image: group.image ?? null }} onOpen={onOpen ?? null} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                {onOpen ? (
                  <button type="button" data-tour={first ? 'order-parts-open-item' : undefined} onClick={onOpen} title="Open this item"
                    className="text-left text-base font-semibold text-slate-900 hover:text-amber-700 hover:underline">
                    {group.description}
                  </button>
                ) : <h3 className="text-base font-semibold text-slate-900">{group.description}</h3>}
                {group.part_number && group.part_number !== group.description && (onOpen ? (
                  <button type="button" onClick={onOpen} title="Open this item" className="font-mono text-sm text-slate-500 hover:text-amber-700 hover:underline">{group.part_number}</button>
                ) : <span className="font-mono text-sm text-slate-500">{group.part_number}</span>)}
                <span className="grow" />
                {removable.length > 0 && (
                  <button type="button" data-tour={first ? 'order-parts-remove' : undefined} disabled={busy}
                    onClick={() => onRemove(removable, group.description)}
                    title={removable.length < group.asks.filter((a) => a.open > 0).length ? 'Takes out the asks you may change' : 'Takes every ask for this part out of the cart'}
                    className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50">
                    Remove from cart
                  </button>
                )}
              </div>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
            {group.open > 0 ? <span className="font-medium text-slate-700">{count(group.open)} to order</span> : <span>All on draft orders</span>}
            {group.needed_by && <span>Needed by {group.needed_by}</span>}
            {group.stock && <span>{count(group.stock.available)} available on the shelves</span>}
            {group.list_price_cents != null && <span>List {money(group.list_price_cents)}</span>}
          </p>
          {group.components && group.components.length > 0 && (
            <p className="mt-1 text-xs text-slate-600">A build: {group.components.map((p) => p.part_number ?? p.description).filter(Boolean).join(' · ')}</p>
          )}
            </div>
          </div>

          <ul data-tour={first ? 'order-parts-asks' : undefined} className="mt-2 list-none space-y-1 p-0 text-sm">
            {group.asks.map((a) => (
              <li key={a.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="tabular-nums font-medium">{count(a.qty)}</span>
                  <span className="text-slate-700">for <AskForLink a={a} /></span>
                  {a.estimate && a.estimate.status !== 'approved' && a.for_kind === 'estimate' && (
                    <span className="rounded-full bg-sky-100 px-2 py-px text-[11px] text-sky-800">Waiting on the customer</span>
                  )}
                  <span className="text-xs text-slate-500">
                    {a.requested_by?.name ? `asked by ${a.requested_by.name}` : ''}
                    {a.needed_by ? ` · by ${a.needed_by}` : ''}
                  </span>
                  {a.open > 0 && mayRemove(a) && group.asks.length > 1 && (
                    <>
                      <span className="grow" />
                      <button type="button" disabled={busy} onClick={() => onRemove([a], `${count(a.qty)} for ${askFor(a)}`)}
                        aria-label={`Remove ${count(a.qty)} for ${askFor(a)} from the cart`}
                        className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50">Remove</button>
                    </>
                  )}
                </div>
                {a.notes && <p className="text-xs italic text-slate-600">“{a.notes}”</p>}
                {a.orders.length > 0 && (
                  <div data-tour={first ? 'order-parts-on-po' : undefined} className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-600">
                    {a.orders.map((o) => (
                      <span key={o.purchase_order_item_id + a.id}>
                        {count(o.qty)} on{' '}
                        <Link to={`/purchase-orders/${o.purchase_order_id}`} className="font-medium text-sky-700 hover:underline">{poLabel(o.po_number)}</Link>
                        {o.vendor ? ` (${o.vendor})` : ''}
                        {o.can_undo ? (
                          <>
                            {' · '}
                            <button type="button" disabled={busy} onClick={() => onUndo(o.purchase_order_id, o.purchase_order_item_id)}
                              className="font-medium text-sky-700 hover:underline disabled:opacity-50">Undo</button>
                          </>
                        ) : ' · ordered'}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        {group.open > 0 && (
          <div data-tour={first ? 'order-parts-supplier' : undefined} className="space-y-2">
            {rows.map((row, i) => {
              const cost = costOf(group, row, vendors)
              const seller = group.sellers.find((s) => s.vendor_id === row.vendor_id)
              return (
                <div key={i} className="rounded-lg border border-slate-200 p-2">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={row.vendor_id}
                      onChange={(e) => set(i, { vendor_id: e.target.value, cost: '' })}
                      aria-label="Supplier"
                      className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                    >
                      <option value="">Choose a supplier…</option>
                      {group.sellers.length > 0 && (
                        <optgroup label="Sells this">
                          {group.sellers.map((s) => (
                            <option key={s.vendor_id} value={s.vendor_id}>
                              {s.preferred ? '★ ' : ''}{s.vendor}
                              {s.unit_cost_cents != null ? ` · ${money(s.unit_cost_cents)}` : ''}
                              {s.lead_time_days != null ? ` · ${s.lead_time_days}d` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {others.length > 0 && (
                        <optgroup label={group.sellers.length > 0 ? 'Any other vendor' : 'Your vendors'}>
                          {others.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </optgroup>
                      )}
                    </select>
                    <input value={row.qty} onChange={(e) => set(i, { qty: e.target.value.replace(/[^0-9.]/g, '') })} inputMode="decimal"
                      aria-label="How many from this supplier" className="w-16 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums" />
                    {rows.length > 1 && (
                      <button type="button" aria-label="Remove this supplier" onClick={() => onRows(rows.filter((_, j) => j !== i))}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-700"><IconX size={14} /></button>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <label className="flex items-center gap-1">
                      Each
                      <input value={row.cost} onChange={(e) => set(i, { cost: e.target.value })} inputMode="decimal"
                        placeholder={cost != null ? (cost / 100).toFixed(2) : '0.00'} aria-label="Cost each"
                        className="w-20 rounded border border-slate-300 px-1.5 py-0.5 text-right tabular-nums" />
                    </label>
                    {seller?.last_ordered_at && <span>last bought {seller.last_ordered_at.slice(0, 10)}</span>}
                    <span className="grow" />
                    {cost != null && Number(row.qty) > 0 && <span className="tabular-nums text-slate-700">{money(Math.round(cost * Number(row.qty)))}</span>}
                  </div>
                </div>
              )
            })}
            <div className="flex items-center justify-between text-xs">
              <button type="button" data-tour={first ? 'order-parts-split' : undefined} disabled={busy}
                onClick={() => onRows([...rows, { vendor_id: '', qty: count(left > 0 ? left : 1), cost: '' }])}
                className="font-medium text-sky-700 hover:underline disabled:opacity-50">
                + Split with another supplier
              </button>
              <span className={split > group.open ? 'text-amber-700' : 'text-slate-500'}>
                {split > group.open
                  ? `${count(split - group.open)} extra, for the shelves`
                  : left > 0 ? `${count(left)} left in the cart` : 'All of it'}
              </span>
            </div>
          </div>
        )}
      </div>
    </li>
  )
}

/** Someone who asks for parts but does not order them: what they asked for, and where it is. */
function MyAsks() {
  const refresh = useRefreshCart()
  const q = useQuery({ queryKey: ['parts-asks', 'mine'], queryFn: () => listAsks() })
  const asks: Ask[] = q.data?.asks ?? []
  const [error, setError] = useState<string | null>(null)

  const act = async (work: () => Promise<unknown>) => {
    setError(null)
    try {
      await work()
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.')
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6">
      <Heading description="The parts you asked for. Whoever orders parts picks the supplier and sends the order; you can change how many until then." />
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}
      {q.isSuccess && asks.length === 0 && (
        <div data-tour="order-parts-empty" className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
          You have no parts waiting. Add them from a catalog, a reference card, an item, an estimate or a job.
        </div>
      )}
      {asks.length > 0 && (
        <ul data-tour="order-parts-mine" className="m-0 list-none divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white p-0">
          {asks.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{a.description}</p>
                <p className="text-xs text-slate-500">
                  For <AskForLink a={a} />
                  {a.needed_by ? ` · needed by ${a.needed_by}` : ''}
                  {a.on_order > 0 ? ` · ${count(a.on_order)} on order` : ''}
                </p>
              </div>
              {a.open > 0 && a.on_order === 0 ? (
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="One fewer" disabled={a.qty <= 1} onClick={() => void act(() => changeAsk(a.id, { qty: a.qty - 1 }))}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><IconMinus size={14} /></button>
                  <span className="w-8 text-center text-sm tabular-nums">{count(a.qty)}</span>
                  <button type="button" aria-label="One more" onClick={() => void act(() => changeAsk(a.id, { qty: a.qty + 1 }))}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"><IconPlus size={14} /></button>
                  <button type="button" onClick={() => void act(() => removeAsk(a.id))}
                    className="ml-2 text-xs font-medium text-red-700 hover:underline">Take out</button>
                </div>
              ) : (
                <span className="text-sm tabular-nums text-slate-600">× {count(a.qty)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** "Job 1042 · Smith" or "Estimate EST-001137 · Susan Vaughn", opening the job or estimate; plain "Stock" otherwise. */
function AskForLink({ a }: { a: Pick<Ask, 'for_kind' | 'job' | 'estimate'> }) {
  const to = a.for_kind === 'estimate' && a.estimate
    ? `/estimates/${encodeURIComponent(a.estimate.id)}`
    : a.job ? `/jobs/${encodeURIComponent(a.job.id)}` : null
  return to ? <Link to={to} className="font-medium text-sky-700 hover:underline" data-for-link>{askFor(a)}</Link> : <>{askFor(a)}</>
}
