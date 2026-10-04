import { useEffect, useImperativeHandle, useState, type Ref } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  IconChevronDown,
  IconChevronUp,
  IconMinus,
  IconPlus,
  IconShoppingCart,
  IconX,
} from '@tabler/icons-react'
import { ApiError } from '@/lib/api'
import { usePermissions, PERM } from '@/hooks/usePermissions'
import { onConnect } from '@/lib/workspaceScope'
import {
  STAGE_LABEL,
  activeOrderId,
  addToOrder,
  changeLine,
  changeVendor,
  composeCode,
  count,
  keepAsStock,
  listDrafts,
  listVendors,
  lookupParts,
  makeCatalogItem,
  markOrdered,
  money,
  poLabel,
  readBuild,
  readOrder,
  removeLine,
  setActiveOrderId,
  setVendorDiscount,
  vendorForDocument,
  writeBuild,
  type Build,
  type CatalogOrder,
  type CatalogPart,
  type EstimateContext,
  type OrderLine,
  type PartStock,
  type PickedPart,
  type Piece,
} from '@/lib/catalogOrders'

/** What the book hands the panel: a part off a page, or out of the search. */
export type OrderPanelHandle = { add: (part: PickedPart) => void }

/**
 * The order beside the book.
 *
 * A real draft purchase order, started by the first part put on it. It
 * stays while the pages turn and folds down to a bar to read past it.
 * Every line shows what the shop already has of it, so nobody orders
 * five of what is on the van.
 *
 * Opened from an estimate, it is that estimate's order: the part goes on
 * the estimate at its sell price and on the order only as far as the
 * shelves cannot cover it, and the order waits for the customer.
 */
export function OrderPanel({
  ref,
  documentId,
  estimate,
  minimized,
  pageLabel,
  formula,
  onMinimize,
  onClose,
  onGoToPage,
}: {
  ref?: Ref<OrderPanelHandle>
  documentId: string
  estimate?: EstimateContext
  minimized: boolean
  /** How the book says to order, on the page open: a checklist while building. */
  formula?: string[] | null
  pageLabel: (page: number) => string
  onMinimize: (minimized: boolean) => void
  onClose: () => void
  onGoToPage: (page: number) => void
}) {
  const qc = useQueryClient()
  const { has } = usePermissions()

  /*
   * The order on screen. Undefined until somebody picks one: then it is
   * the stock order this browser was building, or the estimate's draft to
   * this catalogue's vendor. Null is "a new order", chosen on purpose.
   */
  const [picked, setPicked] = useState<string | null | undefined>(undefined)
  const [remembered] = useState(() => (estimate ? null : activeOrderId()))
  const [vendorId, setVendorId] = useState<string | null>(null)
  // A part picked before anybody said who the order goes to.
  const [waiting, setWaiting] = useState<PickedPart | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [alsoEstimate, setAlsoEstimate] = useState(true)
  /*
   * A build: several codes going onto one line. While one is open, every
   * code picked goes into it instead of onto the order. Kept in this
   * browser, so closing the book does not lose it.
   */
  const [build, setBuildState] = useState<Build | null>(() => readBuild())
  const setBuild = (next: Build | null) => {
    setBuildState(next)
    writeBuild(next)
  }

  const vendors = useQuery({ queryKey: ['catalog-order-vendors'], queryFn: listVendors, staleTime: 5 * 60_000 })
  const suggested = useQuery({
    queryKey: ['catalog-order-vendor-for', documentId],
    queryFn: () => vendorForDocument(documentId),
    staleTime: 60_000,
  })
  const drafts = useQuery({
    queryKey: ['catalog-order-drafts', estimate?.id ?? null],
    queryFn: () => listDrafts(estimate?.id),
    enabled: !!estimate,
  })

  // An estimate's draft to carry on with: the one to this catalogue's vendor, else the latest.
  const preferredDraft = drafts.data?.find((d) => d.vendor?.id === suggested.data?.id) ?? drafts.data?.[0]
  const wantedId = picked !== undefined ? picked : (estimate ? (preferredDraft?.id ?? null) : remembered)

  const order = useQuery({
    queryKey: ['catalog-order', wantedId],
    queryFn: () => readOrder(wantedId as string).catch((e: unknown) => {
      // A stock order remembered from before that has since gone: start fresh.
      if (e instanceof ApiError && e.status === 404 && wantedId === activeOrderId()) setActiveOrderId(null)
      throw e
    }),
    enabled: wantedId !== null,
    retry: false,
  })
  const gone = order.error instanceof ApiError && order.error.status === 404
  const orderId = gone ? null : wantedId

  const state = gone ? undefined : order.data
  const chosenVendor = state?.order.vendor?.id ?? vendorId ?? suggested.data?.id ?? null
  const editable = !state || state.order.status === 'draft'

  const show = (next: CatalogOrder) => {
    qc.setQueryData(['catalog-order', next.order.id], next)
    void qc.invalidateQueries({ queryKey: ['catalog-order-drafts'] })
    void qc.invalidateQueries({ queryKey: ['parts-orders'] })
    void qc.invalidateQueries({ queryKey: ['parts-readiness'] })
    // The estimate behind the book has new lines on it.
    if (estimate) void qc.invalidateQueries({ queryKey: ['estimates'] })
    if (next.order.id !== orderId) {
      setPicked(next.order.id)
      if (next.order.kind === 'stock') setActiveOrderId(next.order.id)
    }
  }

  const run = async (work: () => Promise<CatalogOrder>) => {
    setBusy(true)
    setError(null)
    try {
      const next = await work()
      show(next)
      return next
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.')
      return null
    } finally {
      setBusy(false)
    }
  }

  const add = async (part: PickedPart, vendor = chosenVendor) => {
    onMinimize(false)
    setNote(null)
    if (build) {
      const piece: Piece = {
        part_number: part.part_number ?? null,
        description: part.description ?? null,
        kind: part.kind ?? 'part',
        list_price_cents: part.kind === 'option' ? null : (part.list_price_cents ?? null),
        source_page: part.source_page ?? null,
        source_page_label: part.source_page_label ?? null,
      }
      setBuild({ ...build, pieces: [...build.pieces, piece] })
      setNote(`${part.part_number ?? 'That'} is in the build.`)
      return
    }
    if (!orderId && !vendor) {
      setWaiting(part)
      return
    }
    if (state && !editable) {
      setError(`${poLabel(state.order.po_number)} has gone to the vendor. Start a new order to add to.`)
      return
    }
    setWaiting(null)
    const next = await run(() => addToOrder({
      ...part,
      purchase_order_id: orderId ?? undefined,
      vendor_id: orderId ? undefined : (vendor ?? undefined),
      estimate_id: estimate?.id,
      add_to_estimate: estimate ? alsoEstimate : undefined,
    }))
    if (next?.note) setNote(next.note)
  }

  useImperativeHandle(ref, () => ({ add: (part) => void add(part) }))

  /** The build, onto the order as one line. */
  const addBuild = async () => {
    if (!build || build.pieces.length === 0) return
    if (!orderId && !chosenVendor) {
      setError('Choose who this order is going to first.')
      return
    }
    const next = await run(() => addToOrder({
      description: build.name.trim() || 'Build',
      components: build.pieces,
      order_code: build.code?.trim() || undefined,
      qty: build.qty,
      source_document_id: documentId,
      purchase_order_id: orderId ?? undefined,
      vendor_id: orderId ? undefined : (chosenVendor ?? undefined),
      estimate_id: estimate?.id,
      add_to_estimate: estimate ? alsoEstimate : undefined,
    }))
    if (next) {
      setBuild(null)
      setNote(next.note ?? 'The build is on the order as one line.')
    }
  }

  const pickVendor = async (id: string) => {
    setVendorId(id)
    if (waiting) {
      await add(waiting, id)
      return
    }
    if (estimate) {
      // One order per vendor per estimate: switch to that vendor's, or start one with the next part.
      const existing = drafts.data?.find((d) => d.vendor?.id === id)
      setPicked(existing?.id ?? null)
      return
    }
    if (state && editable && state.order.vendor?.id !== id) {
      await run(() => changeVendor(state.order.id, id))
    }
  }

  const startNew = () => {
    setActiveOrderId(null)
    setPicked(null)
    setVendorId(null)
    setNote(null)
    setError(null)
  }

  const lines = state?.lines ?? []
  const summary = state
    ? `${poLabel(state.order.po_number)} · ${state.order.vendor?.name ?? 'No vendor'} · ${lines.length} ${lines.length === 1 ? 'line' : 'lines'} · ${money(state.order.subtotal_cents)}`
    : 'New order'

  if (minimized) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
        <button
          type="button"
          onClick={() => onMinimize(false)}
          className="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-full bg-white py-2 pl-3 pr-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(0,0,0,0.45)] hover:bg-slate-50"
        >
          <IconShoppingCart size={17} className="shrink-0 text-amber-600" />
          <span className="truncate tabular-nums">{summary}</span>
          {state && <StageChip stage={state.order.stage} />}
          <span className="flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            <IconChevronUp size={14} /> Open
          </span>
        </button>
      </div>
    )
  }

  return (
    <aside
      aria-label="Order"
      className="flex h-full w-[min(24rem,100vw)] shrink-0 flex-col border-l border-white/10 bg-white text-slate-900"
    >
      <div className="flex items-start gap-2 border-b border-slate-200 px-3 py-2.5">
        <IconShoppingCart size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
            {state ? poLabel(state.order.po_number) : 'New order'}
            {state && <StageChip stage={state.order.stage} />}
          </h3>
          <p className="text-xs text-slate-500">
            {estimate
              ? `For estimate ${estimate.number}${state?.order.estimate?.customer ? ` · ${state.order.estimate.customer}` : ''}`
              : 'Parts for stock'}
          </p>
        </div>
        <button type="button" onClick={() => onMinimize(true)} aria-label="Fold the order down to keep reading" title="Fold down"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <IconChevronDown size={16} />
        </button>
        <button type="button" onClick={onClose} aria-label="Close the order" title="Close (the draft is kept)"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <IconX size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm">
        <label htmlFor="order-vendor" className="shrink-0 text-xs text-slate-500">To</label>
        <select
          id="order-vendor"
          value={chosenVendor ?? ''}
          disabled={!editable || busy}
          onChange={(e) => void pickVendor(e.target.value)}
          className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm disabled:bg-slate-50"
        >
          <option value="" disabled>Choose a vendor…</option>
          {(vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      {chosenVendor && (
        <DiscountRow
          key={chosenVendor}
          vendorId={chosenVendor}
          vendorName={state?.order.vendor?.name ?? vendors.data?.find((v) => v.id === chosenVendor)?.name ?? 'this vendor'}
          pct={state?.order.vendor?.list_discount_pct ?? vendors.data?.find((v) => v.id === chosenVendor)?.list_discount_pct ?? null}
          canEdit={has(PERM.INVENTORY_EDIT)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ['catalog-order-vendors'] })
            if (orderId) void qc.invalidateQueries({ queryKey: ['catalog-order', orderId] })
          }}
        />
      )}

      {estimate && state?.order.stage === 'waiting_on_approval' && (
        <p className="border-b border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          Built with the estimate. It is ordered once the customer approves, and closes by itself if they decline.
        </p>
      )}
      {state?.order.status_note && (
        <StatusNote state={state} busy={busy} canSend={state.can_send}
          onKeep={() => void run(() => keepAsStock(state.order.id))} />
      )}

      {waiting && !chosenVendor && (
        <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Who is this order going to? Choose a vendor above and {waiting.part_number ?? 'the part'} goes on it.
        </p>
      )}

      {editable && (
        <AddPart
          busy={busy}
          estimate={!!estimate}
          building={!!build}
          alsoEstimate={alsoEstimate}
          onAlsoEstimate={setAlsoEstimate}
          onAdd={(part) => void add({ ...part, source_document_id: documentId })}
        />
      )}

      {editable && !build && (
        <div className="border-b border-slate-100 px-3 py-1.5">
          <button
            type="button"
            onClick={() => setBuild({ name: '', pieces: [], code: null, qty: 1 })}
            className="text-xs font-medium text-sky-700 hover:underline"
            title="Several codes on one line: a set, its finish, its handing"
          >
            + Start a build (several codes as one line)
          </button>
        </div>
      )}

      {build && (
        <BuildCard
          build={build}
          formula={formula ?? null}
          busy={busy}
          onChange={setBuild}
          onCancel={() => setBuild(null)}
          onDone={() => void addBuild()}
        />
      )}

      {(note || error) && (
        <p role="status" className={'px-3 py-2 text-xs ' + (error ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-900')}>
          {error ?? note}
        </p>
      )}

      <ol className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
        {lines.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-500">
            {state ? 'Nothing on this order yet.' : 'Click a part number on the page, use Find, or type one above.'}
          </li>
        )}
        {lines.map((line) => (
          <Line
            key={line.id}
            line={line}
            editable={editable}
            busy={busy}
            here={line.source_document_id === documentId}
            canMakeItem={has(PERM.CATALOG_EDIT)}
            pageLabel={pageLabel}
            onGoToPage={onGoToPage}
            onQty={(qty) => state && void run(() => changeLine(state.order.id, line.id, { qty }))}
            onRemove={() => state && void run(() => removeLine(state.order.id, line.id))}
            onMakeItem={(body) => state && run(() => makeCatalogItem(state.order.id, line.id, body))}
          />
        ))}
      </ol>

      {state && (
        <SendBar
          state={state}
          busy={busy}
          onSend={(body) => run(() => markOrdered(state.order.id, body))}
          onNew={startNew}
        />
      )}
    </aside>
  )
}

function StageChip({ stage }: { stage: CatalogOrder['order']['stage'] }) {
  const tone = stage === 'waiting_on_approval'
    ? 'bg-sky-100 text-sky-800'
    : stage === 'ready_to_order'
      ? 'bg-emerald-100 text-emerald-800'
      : stage === 'cancelled'
        ? 'bg-slate-200 text-slate-600'
        : stage === 'draft'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-violet-100 text-violet-800'
  return <span className={`rounded-full px-2 py-px text-[11px] font-medium ${tone}`}>{STAGE_LABEL[stage] ?? stage}</span>
}

/** Type a part number or a name; the shop's own items come up with their stock. */
function AddPart({
  busy,
  estimate,
  building,
  alsoEstimate,
  onAlsoEstimate,
  onAdd,
}: {
  busy: boolean
  estimate: boolean
  /** A build is open: what is added goes into it. */
  building: boolean
  alsoEstimate: boolean
  onAlsoEstimate: (on: boolean) => void
  onAdd: (part: PickedPart) => void
}) {
  const [text, setText] = useState('')
  const [qty, setQty] = useState(1)
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(text.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [text])

  const found = useQuery({
    queryKey: ['catalog-parts', debounced],
    queryFn: () => lookupParts(debounced),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  })

  const submit = (item?: CatalogPart) => {
    const typed = text.trim()
    if (!item && !typed) return
    onAdd(item
      ? { catalog_item_id: item.id, qty }
      : /\d/.test(typed) ? { part_number: typed, qty } : { description: typed, qty })
    setText('')
    setDebounced('')
    setQty(1)
  }

  const matches = debounced.length >= 2 ? (found.data ?? []) : []
  const exact = matches.find((m) => m.exact)

  return (
    <div className="border-b border-slate-100 px-3 py-2">
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          submit(exact)
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={building ? 'A code for the build…' : 'Part number or name…'}
          aria-label="Part number or name"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 font-mono text-sm placeholder:font-sans"
        />
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          aria-label="How many"
          className="w-14 rounded border border-slate-300 px-1.5 py-1 text-sm tabular-nums"
        />
        <button type="submit" disabled={busy || !text.trim()}
          className="rounded bg-amber-500 px-2.5 py-1 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-40">
          Add
        </button>
      </form>

      {estimate && (
        <label className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={alsoEstimate} onChange={(e) => onAlsoEstimate(e.target.checked)} />
          Also put it on the estimate, at its sell price
        </label>
      )}

      {matches.length > 0 && (
        <ul className="mt-1.5 max-h-48 list-none overflow-y-auto rounded border border-slate-200 p-0">
          {matches.map((m) => (
            <li key={m.id}>
              <button type="button" disabled={busy} onClick={() => submit(m)}
                className="flex w-full items-baseline gap-2 border-b border-slate-100 px-2 py-1.5 text-left text-xs last:border-0 hover:bg-amber-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-900">{m.name}</span>
                  <span className="block truncate font-mono text-slate-500">
                    {[m.sku, m.supplier_sku].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {m.stock && <StockLine stock={m.stock} compact />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {debounced.length >= 2 && found.isSuccess && matches.length === 0 && (
        <p className="mt-1.5 text-xs text-slate-500">Not in your catalog. Add it as typed; you can make it an item after.</p>
      )}
    </div>
  )
}

function Line({
  line,
  editable,
  busy,
  here,
  canMakeItem,
  pageLabel,
  onGoToPage,
  onQty,
  onRemove,
  onMakeItem,
}: {
  line: OrderLine
  editable: boolean
  busy: boolean
  here: boolean
  canMakeItem: boolean
  pageLabel: (page: number) => string
  onGoToPage: (page: number) => void
  onQty: (qty: number) => void
  onRemove: () => void
  onMakeItem: (body: { name: string; customer_cost_cents?: number }) => Promise<CatalogOrder | null> | null | false | undefined
}) {
  const [making, setMaking] = useState(false)

  return (
    <li className="border-b border-slate-100 px-3 py-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-slate-900" title={line.description}>{line.description}</p>
          {line.components && line.components.length > 0 && (
            <ul className="my-0.5 list-none p-0 text-[11.5px] text-slate-600">
              {line.components.map((piece, i) => (
                <li key={i} className="truncate">
                  {piece.part_number && <span className="font-mono text-slate-800">{piece.part_number} </span>}
                  {piece.description && piece.description !== piece.part_number ? piece.description : ''}
                  {piece.list_price_cents ? <span className="tabular-nums text-slate-500"> · {money(piece.list_price_cents)}</span> : null}
                </li>
              ))}
            </ul>
          )}
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            {line.part_number && <span className="font-mono">{line.part_number}</span>}
            {line.list_price_cents ? <span className="tabular-nums" title="The price printed in the catalog">List {money(line.list_price_cents)}</span> : null}
            {line.source_page && (here ? (
              <button type="button" onClick={() => onGoToPage(line.source_page as number)} className="text-sky-700 hover:underline">
                p. {pageLabel(line.source_page)}
              </button>
            ) : (
              <span>p. {line.source_page_label ?? line.source_page}</span>
            ))}
            {line.estimate_line_item_id && <span className="text-sky-700">on the estimate</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {editable ? (
            <>
              <button type="button" aria-label="One fewer" disabled={busy || line.qty <= 1} onClick={() => onQty(line.qty - 1)}
                className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><IconMinus size={14} /></button>
              <span className="w-7 text-center text-sm tabular-nums">{count(line.qty)}</span>
              <button type="button" aria-label="One more" disabled={busy} onClick={() => onQty(line.qty + 1)}
                className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><IconPlus size={14} /></button>
            </>
          ) : (
            <span className="text-sm tabular-nums">× {count(line.qty)}</span>
          )}
        </div>
        <span className="w-16 shrink-0 text-right text-sm tabular-nums">{money(line.line_total_cents)}</span>
        {editable && (
          <button type="button" aria-label={`Take ${line.description} off the order`} disabled={busy} onClick={onRemove}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-red-700"><IconX size={14} /></button>
        )}
      </div>
      <div className="mt-1">
        {line.components && line.components.length > 0 ? (
          <p className="text-xs text-slate-500">A build, ordered as one line.</p>
        ) : line.catalog_item && line.stock ? (
          <StockLine stock={line.stock} wanted={line.qty} />
        ) : making ? (
          <MakeItem
            line={line}
            busy={busy}
            onCancel={() => setMaking(false)}
            onMake={async (body) => {
              const done = await onMakeItem(body)
              if (done) setMaking(false)
            }}
          />
        ) : (
          <p className="flex items-center gap-2 text-xs text-slate-500">
            Not in your catalog.
            {canMakeItem && (
              <button type="button" disabled={busy} onClick={() => setMaking(true)} className="font-medium text-sky-700 hover:underline">
                Make it an item
              </button>
            )}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * A part the shop does not carry, made into one of its items: the name
 * it will go by (the words off the page are often only the row of a
 * table) and what it sells for. The part number, cost and vendor come
 * from the line.
 */
function MakeItem({
  line,
  busy,
  onCancel,
  onMake,
}: {
  line: OrderLine
  busy: boolean
  onCancel: () => void
  onMake: (body: { name: string; customer_cost_cents?: number }) => void
}) {
  const [name, setName] = useState(/[A-Za-z]{3}/.test(line.description) ? line.description.slice(0, 120) : '')
  // The book's price is the customer's: the sell price to start from.
  const [price, setPrice] = useState(line.list_price_cents ? (line.list_price_cents / 100).toFixed(2) : '')

  return (
    <form
      className="mt-1 space-y-1.5 rounded border border-slate-200 bg-slate-50 p-2"
      onSubmit={(e) => {
        e.preventDefault()
        const cents = Math.round(Number(price.replace(/[$,\s]/g, '')) * 100)
        onMake({ name: name.trim(), customer_cost_cents: Number.isFinite(cents) && cents > 0 ? cents : undefined })
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={255}
        placeholder={`What to call ${line.part_number ?? 'it'}`} aria-label="Item name"
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
      <div className="flex items-center gap-1.5">
        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal"
          placeholder="Sells for" aria-label="Sells for"
          className="w-24 rounded border border-slate-300 px-2 py-1 text-sm tabular-nums" />
        <span className="grow text-[11px] text-slate-500">Cost {money(line.unit_cost_cents)}</span>
        <button type="button" onClick={onCancel} className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">Cancel</button>
        <button type="submit" disabled={busy || !name.trim()}
          className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-40">
          Make item
        </button>
      </div>
    </form>
  )
}

/**
 * A build being put together: its pieces in the order picked, the book's
 * ordering formula beside them as a checklist, and how it will be ordered.
 */
function BuildCard({
  build,
  formula,
  busy,
  onChange,
  onCancel,
  onDone,
}: {
  build: Build
  formula: string[] | null
  busy: boolean
  onChange: (build: Build) => void
  onCancel: () => void
  onDone: () => void
}) {
  const [choice, setChoice] = useState('')
  const auto = composeCode(build.pieces)
  const list = build.pieces.reduce((n, p) => n + (p.list_price_cents ?? 0), 0)

  const addChoice = () => {
    const text = choice.trim()
    if (!text) return
    onChange({ ...build, pieces: [...build.pieces, { kind: 'choice', description: text.slice(0, 300) }] })
    setChoice('')
  }

  return (
    <div className="border-b-2 border-amber-300 bg-amber-50/60 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="rounded bg-amber-500 px-1.5 py-px text-[10.5px] font-bold uppercase tracking-wide text-white">Build</span>
        <input
          value={build.name}
          onChange={(e) => onChange({ ...build, name: e.target.value.slice(0, 200) })}
          placeholder="Name it: Front door handleset"
          aria-label="What the build is"
          className="min-w-0 flex-1 rounded border border-amber-200 bg-white px-2 py-1 text-sm"
        />
      </div>

      <p className="mt-1.5 text-xs text-amber-900">
        Click codes on the page: each one goes into this build, not onto the order.
      </p>

      {formula && formula.length > 0 && (
        <div className="mt-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">This book orders as</p>
          <ol className="mt-0.5 flex list-none flex-wrap gap-1 p-0">
            {formula.map((step, i) => (
              <li key={i} className="rounded-full border border-slate-300 bg-white px-2 py-px text-[11px] text-slate-700">{step}</li>
            ))}
          </ol>
        </div>
      )}

      <ol className="mt-2 list-none space-y-1 p-0">
        {build.pieces.length === 0 && <li className="text-xs text-slate-500">Nothing in it yet.</li>}
        {build.pieces.map((piece, i) => (
          <li key={i} className="flex items-baseline gap-2 rounded bg-white px-2 py-1 text-xs">
            <span className="w-4 shrink-0 text-right tabular-nums text-slate-400">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">
              {piece.part_number && <span className="font-mono font-semibold text-slate-900">{piece.part_number} </span>}
              <span className="text-slate-600">{piece.description !== piece.part_number ? piece.description : ''}</span>
            </span>
            {piece.list_price_cents ? <span className="shrink-0 tabular-nums text-slate-600">{money(piece.list_price_cents)}</span> : null}
            <button type="button" aria-label="Take this out of the build"
              onClick={() => onChange({ ...build, pieces: build.pieces.filter((_, j) => j !== i) })}
              className="shrink-0 text-slate-400 hover:text-red-700"><IconX size={12} /></button>
          </li>
        ))}
      </ol>

      <form className="mt-1.5 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); addChoice() }}>
        <input value={choice} onChange={(e) => setChoice(e.target.value)}
          placeholder="A choice not printed as a code: LH, 2-3/4 backset…"
          aria-label="A choice to add to the build"
          className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs" />
        <button type="submit" disabled={!choice.trim()}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">Add</button>
      </form>

      <label className="mt-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500" htmlFor="build-code">Ordered as</label>
      <input
        id="build-code"
        value={build.code ?? auto}
        onChange={(e) => onChange({ ...build, code: e.target.value.slice(0, 100) })}
        placeholder="The codes, in order"
        className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
      />

      <div className="mt-2 flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-slate-600">
          How many
          <input type="number" min={1} value={build.qty}
            onChange={(e) => onChange({ ...build, qty: Math.max(1, Number(e.target.value) || 1) })}
            className="w-12 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs tabular-nums" />
        </label>
        <span className="grow text-right text-xs tabular-nums text-slate-600">{list > 0 ? `List ${money(list)}` : ''}</span>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded px-2.5 py-1 text-xs text-slate-600 hover:bg-white">Drop the build</button>
        <button type="button" disabled={busy || build.pieces.length === 0} onClick={onDone}
          className="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-40">
          Put it on the order
        </button>
      </div>
    </div>
  )
}

/**
 * What the shop pays this vendor, as a percent off the printed list price.
 * Set once, it turns every catalog price from this vendor into a cost.
 */
function DiscountRow({
  vendorId,
  vendorName,
  pct,
  canEdit,
  onSaved,
}: {
  vendorId: string
  vendorName: string
  pct: number | null
  canEdit: boolean
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(pct !== null ? String(pct) : '')
  const [error, setError] = useState<string | null>(null)

  if (!editing) {
    return (
      <p className="flex items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-xs text-slate-500">
        {pct !== null ? `Your cost: list less ${pct}%.` : `Catalog prices are list prices.`}
        {canEdit && (
          <button type="button" onClick={() => { setText(pct !== null ? String(pct) : ''); setEditing(true) }}
            className="font-medium text-sky-700 hover:underline">
            {pct !== null ? 'Change' : `Set your discount from ${vendorName}`}
          </button>
        )}
      </p>
    )
  }

  return (
    <form
      className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-1.5 text-xs"
      onSubmit={async (e) => {
        e.preventDefault()
        setError(null)
        const value = text.trim() === '' ? null : Number(text)
        if (value !== null && (!Number.isFinite(value) || value < 0 || value > 95)) {
          setError('Between 0 and 95.')
          return
        }
        try {
          await setVendorDiscount(vendorId, value)
          setEditing(false)
          onSaved()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'It did not save.')
        }
      }}
    >
      <span className="text-slate-600">{vendorName}: list less</span>
      <input value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" autoFocus aria-label="Discount off list, percent"
        className="w-14 rounded border border-slate-300 px-1.5 py-0.5 tabular-nums" />
      <span className="text-slate-600">%</span>
      <button type="submit" className="rounded bg-slate-900 px-2 py-0.5 font-medium text-white">Save</button>
      <button type="button" onClick={() => setEditing(false)} className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100">Cancel</button>
      {error && <span className="text-red-700">{error}</span>}
    </form>
  )
}

/** "2 available · 3 on hand · 4 on order", with where they are on hover. */
function StockLine({ stock, wanted, compact = false }: { stock: PartStock; wanted?: number; compact?: boolean }) {
  const where = [
    ...stock.locations.map((l) => `${l.name}: ${count(l.on_hand)} on hand`),
    ...(stock.held_for ?? []).map((h) => `Held for ${h.label}: ${count(h.qty)}`),
  ].join('\n')
  const tone = stock.available <= 0 ? 'text-slate-500' : wanted !== undefined && stock.available >= wanted ? 'text-emerald-700' : 'text-amber-700'

  if (compact) {
    return (
      <span className={`shrink-0 tabular-nums ${tone}`} title={where || 'None in stock'}>
        {count(stock.available)} avail.
      </span>
    )
  }

  return (
    <p className="text-xs tabular-nums" title={where || 'None in stock'}>
      <span className={`font-medium ${tone}`}>
        {stock.available > 0 ? `${count(stock.available)} available` : 'None available'}
      </span>
      <span className="text-slate-500">
        {` · ${count(stock.on_hand)} on hand`}
        {stock.held > 0 && ` · ${count(stock.held)} held for jobs`}
        {stock.on_order > 0 && ` · ${count(stock.on_order)} on order`}
        {stock.in_drafts > 0 && ` · ${count(stock.in_drafts)} on other drafts`}
      </span>
    </p>
  )
}

/** A note the order picked up by itself, and the choice it leaves a person. */
function StatusNote({ state, busy, canSend, onKeep }: { state: CatalogOrder; busy: boolean; canSend: boolean; onKeep: () => void }) {
  const decide = state.order.kind === 'estimate' && state.order.status !== 'draft' && state.order.status !== 'cancelled'
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <p>{state.order.status_note}</p>
      {decide && canSend && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={onKeep}
            className="rounded border border-amber-300 bg-white px-2 py-0.5 font-medium hover:bg-amber-100">
            Keep the parts as stock
          </button>
          {!onConnect() && (
            <Link to={`/purchase-orders/${state.order.id}`} className="rounded px-2 py-0.5 font-medium underline">
              Cancel it on the order
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

/** The total, and sending it. An estimate's order waits for approval unless somebody says why not. */
function SendBar({
  state,
  busy,
  onSend,
  onNew,
}: {
  state: CatalogOrder
  busy: boolean
  onSend: (body: { reason?: string; vendor_order_number?: string }) => Promise<CatalogOrder | null>
  onNew: () => void
}) {
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const draft = state.order.status === 'draft'
  const early = state.order.stage === 'waiting_on_approval'
  const lines = state.lines.length

  return (
    <div className="space-y-2 border-t border-slate-200 px-3 py-2.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-slate-500">{lines} {lines === 1 ? 'line' : 'lines'}</span>
        <span className="font-semibold tabular-nums">{money(state.order.subtotal_cents)}</span>
      </div>

      {asking && (
        <div className="space-y-1.5">
          <label className="block text-xs text-slate-600" htmlFor="order-early-reason">
            The customer has not approved yet. Why order now?
          </label>
          <input id="order-early-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
            placeholder="Long lead time, customer said yes by phone…"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!onConnect() && (
          <Link to={`/purchase-orders/${state.order.id}`} className="text-xs font-medium text-sky-700 hover:underline">
            Open the order
          </Link>
        )}
        <span className="grow" />
        {!draft || state.order.status === 'cancelled' ? (
          <button type="button" onClick={onNew}
            className="rounded border border-slate-300 px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-50">
            Start a new order
          </button>
        ) : state.can_send ? (
          <button
            type="button"
            disabled={busy || lines === 0 || (asking && !reason.trim())}
            onClick={async () => {
              if (early && !asking) {
                setAsking(true)
                return
              }
              const done = await onSend(early ? { reason: reason.trim() } : {})
              if (done) setAsking(false)
            }}
            className="rounded bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {early ? (asking ? 'Order anyway' : 'Order before approval…') : 'Mark as ordered'}
          </button>
        ) : (
          <span className="text-xs text-slate-500">Saved as a draft for the office to send.</span>
        )}
      </div>
    </div>
  )
}
