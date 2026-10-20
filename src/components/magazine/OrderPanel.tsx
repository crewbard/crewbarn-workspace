import { useImperativeHandle, useEffect, useRef, useState, type Ref } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconMinus,
  IconPlus,
  IconShoppingCart,
  IconX,
} from '@tabler/icons-react'
import { usePermissions, PERM } from '@/hooks/usePermissions'
import { onConnect } from '@/lib/workspaceScope'
import {
  composeCode,
  count,
  lookupParts,
  money,
  poLabel,
  readBuild,
  writeBuild,
  type Build,
  type CatalogPart,
  type EstimateContext,
  type PartStock,
  type PickedPart,
  type Piece,
} from '@/lib/catalogOrders'
import { CART_KEYS, addAsk, askFor, changeAsk, listAsks, removeAsk, type Ask, type NewAsk } from '@/lib/purchaseRequests'
import { bestHit, type Book, type SearchHit } from './pdfBook'
import { useBookFind, type FindState } from './useBookFind'

/**
 * What the book hands the panel: a part off a page, or out of the search.
 * `clearFind` takes the cart's search off the page, and says whether there
 * was one to take off.
 */
export type OrderPanelHandle = { add: (part: PickedPart) => void; clearFind: () => boolean }

/** Matches listed under the cart's search box. */
const FIND_MAX = 50

/** A phone: the cart covers the book, so a match is shown with the cart folded down. */
const narrow = () => typeof window !== 'undefined' && window.innerWidth < 640

/**
 * The parts cart beside the book.
 *
 * Nobody picks a supplier here. A part off the page goes in the cart; the
 * buyer sees every cart's parts together on Order parts, chooses who each
 * comes from (or splits it between suppliers) and makes the purchase
 * orders. The same part asked for twice is one line with more of it.
 * The cart stays while the pages turn and folds down to a bar.
 *
 * Opened from an estimate, it is that estimate's cart: the part can go on
 * the estimate at its sell price, and in the cart only as far as the
 * shelves cannot cover it. Its order waits for the customer's answer.
 */
export function OrderPanel({
  ref,
  book,
  documentId,
  estimate,
  minimized,
  pageLabel,
  formula,
  onMinimize,
  onClose,
  onGoToPage,
  onFound,
}: {
  ref?: Ref<OrderPanelHandle>
  /** The book open beside the cart: what is typed is looked for in it too. */
  book: Book
  documentId: string
  estimate?: EstimateContext
  minimized: boolean
  /** How the book says to order, on the page open: a checklist while building. */
  formula?: string[] | null
  pageLabel: (page: number) => string
  onMinimize: (minimized: boolean) => void
  onClose: () => void
  onGoToPage: (page: number) => void
  /** Light up what the search found, with one of them open; `jump` turns to its page. */
  onFound: (hits: SearchHit[], active: number | null, jump: boolean) => void
}) {
  const qc = useQueryClient()
  const { has } = usePermissions()
  const buyer = has(PERM.INVENTORY_ORDER)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [alsoEstimate, setAlsoEstimate] = useState(true)
  /*
   * A build: several codes going onto one line. While one is open, every
   * code picked goes into it instead of into the cart. Kept in this
   * browser, so closing the book does not lose it.
   */
  const [build, setBuildState] = useState<Build | null>(() => readBuild())
  const setBuild = (next: Build | null) => {
    setBuildState(next)
    writeBuild(next)
  }

  const cart = useQuery({
    queryKey: ['parts-cart', estimate?.id ?? 'mine'],
    queryFn: () => listAsks(estimate ? { estimate_id: estimate.id } : {}),
  })
  const asks = cart.data?.asks ?? []

  const refresh = () => {
    for (const key of CART_KEYS) void qc.invalidateQueries({ queryKey: [...key] })
    void qc.invalidateQueries({ queryKey: ['parts-readiness'] })
    // The estimate behind the book may have new lines on it.
    if (estimate) void qc.invalidateQueries({ queryKey: ['estimates'] })
  }

  const run = async (work: () => Promise<{ note?: string | null } | unknown>) => {
    setBusy(true)
    setError(null)
    try {
      const res = await work()
      refresh()
      return res
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.')
      return null
    } finally {
      setBusy(false)
    }
  }

  const put = async (body: NewAsk, fallback: string) => {
    const res = (await run(() => addAsk({
      ...body,
      source: 'catalog',
      source_document_id: body.source_document_id ?? documentId,
      estimate_id: estimate?.id,
      for_kind: estimate ? 'estimate' : 'stock',
      add_to_estimate: estimate ? alsoEstimate : undefined,
    }))) as { note?: string | null; ask?: Ask | null } | null
    if (res) setNote(res.note ?? (res.ask ? fallback : 'Nothing to order: the shelves cover it.'))
    return res
  }

  const add = async (part: PickedPart) => {
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
    await put({
      catalog_item_id: part.catalog_item_id,
      part_number: part.part_number,
      description: part.description,
      qty: part.qty,
      list_price_cents: part.list_price_cents,
      source_document_id: part.source_document_id,
      source_page: part.source_page,
      source_page_label: part.source_page_label,
    }, `${part.part_number ?? part.description ?? 'That part'} is in the cart.`)
  }

  /*
   * What is typed in the search box, kept here rather than in the box so
   * it lasts while the cart is folded down to show a match on a phone.
   * The book is searched for it as well as the shop's own items.
   */
  const [text, setText] = useState('')
  const [qty, setQty] = useState(1)
  const [active, setActive] = useState<number | null>(null)
  const activeRef = useRef<number | null>(null)
  // A new search lands on its best match; once somebody steps through them, it stays put.
  const fresh = useRef(true)
  const chosen = useRef(false)
  const show = (hits: SearchHit[], at: number | null, jump: boolean) => {
    activeRef.current = at
    setActive(at)
    onFound(hits, at, jump)
  }

  const find = useBookFind(book, text, {
    max: FIND_MAX,
    onFound: (hits) => {
      if (hits.length === 0) {
        show([], null, false)
        return
      }
      const best = bestHit(hits)
      const now = activeRef.current
      if (fresh.current || now === null || (!chosen.current && best !== null && hits[best].score > (hits[now]?.score ?? 0))) {
        fresh.current = false
        show(hits, best, true)
      } else {
        show(hits, now, false)
      }
    },
  })

  const type = (next: string) => {
    setText(next)
    fresh.current = true
    chosen.current = false
  }

  const goToHit = (i: number, fold = false) => {
    const hit = find.hits[i]
    if (!hit) return
    chosen.current = true
    show(find.hits, i, true)
    if (fold && narrow()) onMinimize(true)
  }

  const step = (by: 1 | -1) => {
    const n = find.hits.length
    if (n === 0) return
    goToHit(active === null ? 0 : (active + by + n) % n)
  }

  const clearFind = () => {
    const had = text.trim() !== '' || activeRef.current !== null
    type('')
    show([], null, false)
    return had
  }

  /** The part number at a match, into the cart (or the open build), as many as typed. */
  const addFound = (hit: SearchHit) => {
    if (!hit.part) return
    void add({
      part_number: hit.part.text,
      description: hit.part.line,
      list_price_cents: hit.part.price,
      kind: hit.part.kind,
      source_document_id: documentId,
      source_page: hit.page,
      source_page_label: pageLabel(hit.page),
      qty,
    })
    clearFind()
    setQty(1)
  }

  useImperativeHandle(ref, () => ({ add: (part) => void add(part), clearFind }))

  /** The build, into the cart as one line. */
  const addBuild = async () => {
    if (!build || build.pieces.length === 0) return
    const res = await put({
      description: build.name.trim() || 'Build',
      components: build.pieces,
      order_code: build.code?.trim() || undefined,
      qty: build.qty,
    }, 'The build is in the cart as one line.')
    if (res) setBuild(null)
  }

  const waiting = asks.filter((a) => a.open > 0).length
  const summary = `Parts cart · ${asks.length} ${asks.length === 1 ? 'part' : 'parts'}`

  const current = active !== null ? find.hits[active] : undefined

  if (minimized) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-col items-center gap-2 px-3">
        {current && (
          <FoundBar
            find={find}
            active={active as number}
            hit={current}
            qty={qty}
            pageCount={book.pageCount}
            pageLabel={pageLabel}
            busy={busy}
            onStep={step}
            onAdd={() => addFound(current)}
            onClear={clearFind}
          />
        )}
        <button
          type="button"
          data-tour="book-order-min"
          onClick={() => onMinimize(false)}
          className="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-full bg-white py-2 pl-3 pr-2 text-sm text-slate-800 shadow-[0_8px_24px_rgba(0,0,0,0.45)] hover:bg-slate-50"
        >
          <IconShoppingCart size={17} className="shrink-0 text-amber-600" />
          <span className="truncate tabular-nums">{summary}</span>
          <span className="flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            <IconChevronUp size={14} /> Open
          </span>
        </button>
      </div>
    )
  }

  return (
    <aside
      aria-label="Parts cart"
      data-tour="book-order"
      data-order-for={estimate ? 'estimate' : 'stock'}
      data-order-state={asks.length > 0 ? 'cart' : 'new'}
      className="flex h-full w-[min(24rem,100vw)] shrink-0 flex-col border-l border-white/10 bg-white text-slate-900"
    >
      <div className="flex items-start gap-2 border-b border-slate-200 px-3 py-2.5">
        <IconShoppingCart size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Parts cart</h3>
          <p className="text-xs text-slate-500">
            {estimate ? `For estimate ${estimate.number}` : 'Parts you asked for, for stock'}
          </p>
        </div>
        <button type="button" onClick={() => onMinimize(true)} aria-label="Fold the cart down to keep reading" title="Fold down"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <IconChevronDown size={16} />
        </button>
        <button type="button" onClick={onClose} aria-label="Close the cart" title="Close (the cart is kept)"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <IconX size={16} />
        </button>
      </div>

      <p data-tour="book-order-vendor" className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        No supplier to pick here. {buyer ? 'You choose who each part comes from on Order parts.' : 'Whoever orders parts chooses who each part comes from.'}
        {estimate && ' Parts for an estimate are ordered once the customer approves.'}
      </p>

      <AddPart
        text={text}
        qty={qty}
        onText={type}
        onQty={setQty}
        find={find}
        active={active}
        pageCount={book.pageCount}
        pageLabel={pageLabel}
        onStep={step}
        onGoToHit={(i) => goToHit(i, true)}
        onAddFound={addFound}
        onClearFind={clearFind}
        busy={busy}
        estimate={!!estimate}
        building={!!build}
        alsoEstimate={alsoEstimate}
        onAlsoEstimate={setAlsoEstimate}
        onAdd={(part) => void add({ ...part, source_document_id: documentId })}
      />

      {!build && (
        <div data-tour="book-order-build" className="border-b border-slate-100 px-3 py-1.5">
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

      <ol data-tour="book-order-lines" className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
        {asks.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-500">
            {cart.isLoading ? 'Opening the cart…' : 'Click a part number on the page, use Find, or type one above.'}
          </li>
        )}
        {asks.map((ask) => (
          <CartLine
            key={ask.id}
            ask={ask}
            busy={busy}
            here={ask.source_document_id === documentId}
            pageLabel={pageLabel}
            onGoToPage={onGoToPage}
            onQty={(qty) => void run(() => changeAsk(ask.id, { qty }))}
            onRemove={() => void run(() => removeAsk(ask.id))}
          />
        ))}
      </ol>

      <div data-tour="book-order-send" className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-3 py-2.5 text-sm">
        <span className="text-slate-500">
          {waiting} {waiting === 1 ? 'part' : 'parts'} waiting to be ordered
        </span>
        <span className="grow" />
        {!onConnect() && (
          <Link to="/order-parts" className="rounded bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-800">
            {buyer ? 'Order parts' : 'See my parts'}
          </Link>
        )}
      </div>
    </aside>
  )
}

/** One part in the cart: how many, what for, and where it is once ordered. */
function CartLine({
  ask,
  busy,
  here,
  pageLabel,
  onGoToPage,
  onQty,
  onRemove,
}: {
  ask: Ask
  busy: boolean
  here: boolean
  pageLabel: (page: number) => string
  onGoToPage: (page: number) => void
  onQty: (qty: number) => void
  onRemove: () => void
}) {
  const editable = ask.on_order === 0
  return (
    <li className="border-b border-slate-100 px-3 py-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-slate-900" title={ask.description}>{ask.description}</p>
          {ask.components && ask.components.length > 0 && (
            <ul className="my-0.5 list-none p-0 text-[11.5px] text-slate-600">
              {ask.components.map((piece, i) => (
                <li key={i} className="truncate">
                  {piece.part_number && <span className="font-mono text-slate-800">{piece.part_number} </span>}
                  {piece.description && piece.description !== piece.part_number ? piece.description : ''}
                  {piece.list_price_cents ? <span className="tabular-nums text-slate-500"> · {money(piece.list_price_cents)}</span> : null}
                </li>
              ))}
            </ul>
          )}
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            {ask.part_number && ask.part_number !== ask.description && <span className="font-mono">{ask.part_number}</span>}
            {ask.list_price_cents ? <span className="tabular-nums" title="The price printed in the catalog">List {money(ask.list_price_cents)}</span> : null}
            {ask.source_page && (here ? (
              <button type="button" onClick={() => onGoToPage(ask.source_page as number)} className="text-sky-700 hover:underline">
                p. {pageLabel(ask.source_page)}
              </button>
            ) : (
              <span>p. {ask.source_page_label ?? ask.source_page}</span>
            ))}
            <span>for {askFor(ask)}</span>
            {ask.estimate_line_item_id && <span className="text-sky-700">on the estimate</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {editable ? (
            <>
              <button type="button" aria-label="One fewer" disabled={busy || ask.qty <= 1} onClick={() => onQty(ask.qty - 1)}
                className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><IconMinus size={14} /></button>
              <span className="w-7 text-center text-sm tabular-nums">{count(ask.qty)}</span>
              <button type="button" aria-label="One more" disabled={busy} onClick={() => onQty(ask.qty + 1)}
                className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><IconPlus size={14} /></button>
            </>
          ) : (
            <span className="text-sm tabular-nums">× {count(ask.qty)}</span>
          )}
        </div>
        {editable && (
          <button type="button" aria-label={`Take ${ask.description} out of the cart`} disabled={busy} onClick={onRemove}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-red-700"><IconX size={14} /></button>
        )}
      </div>
      {ask.orders.length > 0 && (
        <p className="mt-1 text-xs text-violet-800">
          {ask.orders.map((o) => `${count(o.qty)} on ${poLabel(o.po_number)}${o.vendor ? ` (${o.vendor})` : ''}${o.can_undo ? '' : ', ordered'}`).join(' · ')}
        </p>
      )}
    </li>
  )
}

/** Type a part number or a name; the shop's own items come up with their stock. */
function AddPart({
  text,
  qty,
  onText,
  onQty,
  find,
  active,
  pageCount,
  pageLabel,
  onStep,
  onGoToHit,
  onAddFound,
  onClearFind,
  busy,
  estimate,
  building,
  alsoEstimate,
  onAlsoEstimate,
  onAdd,
}: {
  text: string
  qty: number
  onText: (text: string) => void
  onQty: (qty: number) => void
  /** Where what is typed turns up in the book. */
  find: FindState
  active: number | null
  pageCount: number
  pageLabel: (page: number) => string
  onStep: (by: 1 | -1) => void
  onGoToHit: (index: number) => void
  onAddFound: (hit: SearchHit) => void
  onClearFind: () => boolean
  busy: boolean
  estimate: boolean
  /** A build is open: what is added goes into it. */
  building: boolean
  alsoEstimate: boolean
  onAlsoEstimate: (on: boolean) => void
  onAdd: (part: PickedPart) => void
}) {
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
    onText('')
    setDebounced('')
    onQty(1)
  }

  const matches = debounced.length >= 2 ? (found.data ?? []) : []
  const exact = matches.find((m) => m.exact)

  return (
    <div data-tour="book-order-add" className="border-b border-slate-100 px-3 py-2">
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          submit(exact)
        }}
      >
        <input
          value={text}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            // Enter steps through the matches in the book; Shift+Enter goes back. Ctrl+Enter still adds.
            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && find.hits.length > 0) {
              e.preventDefault()
              onStep(e.shiftKey ? -1 : 1)
            } else if (e.key === 'Escape' && onClearFind()) {
              // Only the search: the book stays open.
              e.preventDefault()
              e.stopPropagation()
            }
          }}
          placeholder={building ? 'A code for the build…' : 'Part number or name…'}
          aria-label="Part number or name"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 font-mono text-sm placeholder:font-sans"
        />
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => onQty(Math.max(1, Number(e.target.value) || 1))}
          aria-label="How many"
          className="w-14 rounded border border-slate-300 px-1.5 py-1 text-sm tabular-nums"
        />
        <button type="submit" disabled={busy || !text.trim()}
          className="rounded bg-amber-500 px-2.5 py-1 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-40">
          Add
        </button>
      </form>

      <FoundStrip
        text={text}
        find={find}
        active={active}
        qty={qty}
        busy={busy}
        pageCount={pageCount}
        pageLabel={pageLabel}
        onStep={onStep}
        onGoToHit={onGoToHit}
        onAddFound={onAddFound}
      />

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

/** "Add CU10", or "Add 3 × CU10" when more than one is wanted. */
const addLabel = (code: string, qty: number) => (qty > 1 ? `Add ${count(qty)} × ${code}` : `Add ${code}`)

/** "3 matches · page 12 of 40": how many, and where the one lit up is. */
function foundSummary(find: FindState, active: number | null, pageCount: number, pageLabel: (page: number) => string) {
  const n = find.hits.length
  const many = `${n}${n >= FIND_MAX ? '+' : ''} ${n === 1 ? 'match' : 'matches'}`
  const hit = active !== null ? find.hits[active] : undefined
  return hit ? `${many} · page ${pageLabel(hit.page)} of ${pageLabel(pageCount)}` : many
}

/**
 * Under the search box: where what is typed turns up in the book. The
 * best match is open on the page; the arrows (or Enter and Shift+Enter)
 * step through the rest, and a part number at the match goes in the cart
 * in one press.
 */
function FoundStrip({
  text,
  find,
  active,
  qty,
  busy,
  pageCount,
  pageLabel,
  onStep,
  onGoToHit,
  onAddFound,
}: {
  text: string
  find: FindState
  active: number | null
  qty: number
  busy: boolean
  pageCount: number
  pageLabel: (page: number) => string
  onStep: (by: 1 | -1) => void
  onGoToHit: (index: number) => void
  onAddFound: (hit: SearchHit) => void
}) {
  const list = useRef<HTMLOListElement>(null)

  // Keep the open match in sight in the list as Enter steps through them.
  useEffect(() => {
    if (active === null) return
    list.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (text.trim().length < 2) return null
  const hit = active !== null ? find.hits[active] : undefined

  if (find.hits.length === 0) {
    return (
      <p data-tour="book-order-find" data-find-state={find.running ? 'reading' : 'none'} className="mt-1.5 text-xs text-slate-500" aria-live="polite">
        {find.running || find.query !== text.trim()
          ? `Looking through the book${find.readTo ? `, page ${find.readTo} of ${pageCount}` : ''}…`
          : 'Not on any page of this book.'}
      </p>
    )
  }

  return (
    <div data-tour="book-order-find" data-find-state="found" className="mt-1.5 overflow-hidden rounded border border-amber-200 bg-amber-50/50">
      <div className="flex items-center gap-1 px-1.5 py-1">
        <button type="button" onClick={() => onStep(-1)} aria-label="The match before" title="The match before (Shift+Enter)"
          className="rounded p-0.5 text-slate-600 hover:bg-amber-100"><IconChevronLeft size={15} /></button>
        <button type="button" onClick={() => onStep(1)} aria-label="The next match" title="The next match (Enter)"
          className="rounded p-0.5 text-slate-600 hover:bg-amber-100"><IconChevronRight size={15} /></button>
        <span className="min-w-0 flex-1 truncate text-xs tabular-nums text-slate-700" aria-live="polite">
          {foundSummary(find, active, pageCount, pageLabel)}
          {find.running && <span className="text-slate-400"> · still looking</span>}
        </span>
        {hit?.part && (
          <button type="button" disabled={busy} onClick={() => onAddFound(hit)}
            title={`Put ${count(qty)} of ${hit.part.text} in the cart, as if you pressed it on the page`}
            className="shrink-0 rounded bg-amber-500 px-2 py-0.5 font-mono text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-40">
            {addLabel(hit.part.text, qty)}
          </button>
        )}
      </div>
      <ol ref={list} className="m-0 max-h-32 list-none overflow-y-auto border-t border-amber-100 bg-white p-0">
        {find.hits.map((h, i) => (
          <li key={`${h.page}-${i}`}>
            <button
              type="button"
              onClick={() => onGoToHit(i)}
              aria-current={i === active ? 'true' : undefined}
              className={'flex w-full items-baseline gap-2 border-b border-slate-100 px-2 py-1 text-left text-xs last:border-0 hover:bg-amber-50 '
                + (i === active ? 'bg-amber-100/70' : '')}
            >
              <span className="w-11 shrink-0 tabular-nums text-slate-400">p. {pageLabel(h.page)}</span>
              <span className="min-w-0 flex-1 truncate text-slate-800" title={h.text}>{h.text}</span>
              {h.part && <span className="shrink-0 font-mono text-[11px] text-amber-800">{h.part.text}</span>}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** The cart folded down on a phone to show a match: step through them, or add it, without opening the cart. */
function FoundBar({
  find,
  active,
  hit,
  qty,
  pageCount,
  pageLabel,
  busy,
  onStep,
  onAdd,
  onClear,
}: {
  find: FindState
  active: number
  hit: SearchHit
  qty: number
  pageCount: number
  pageLabel: (page: number) => string
  busy: boolean
  onStep: (by: 1 | -1) => void
  onAdd: () => void
  onClear: () => void
}) {
  return (
    <div data-tour="book-order-find-bar" className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full bg-white py-1 pl-1.5 pr-1.5 text-sm text-slate-800 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
      <button type="button" onClick={() => onStep(-1)} aria-label="The match before"
        className="rounded-full p-1 text-slate-600 hover:bg-slate-100"><IconChevronLeft size={16} /></button>
      <span className="min-w-0 truncate text-xs tabular-nums">{foundSummary(find, active, pageCount, pageLabel)}</span>
      <button type="button" onClick={() => onStep(1)} aria-label="The next match"
        className="rounded-full p-1 text-slate-600 hover:bg-slate-100"><IconChevronRight size={16} /></button>
      {hit.part && (
        <button type="button" disabled={busy} onClick={onAdd}
          className="shrink-0 rounded-full bg-amber-500 px-2.5 py-0.5 font-mono text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-40">
          {addLabel(hit.part.text, qty)}
        </button>
      )}
      <button type="button" onClick={onClear} aria-label="Clear the search"
        className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><IconX size={14} /></button>
    </div>
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

