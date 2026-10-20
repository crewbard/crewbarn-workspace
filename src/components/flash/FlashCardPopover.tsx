import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { IconBook2, IconPlus, IconStarFilled, IconX } from '@tabler/icons-react'
import { AddToCartButton } from '@/components/parts/AddToCartButton'
import { ReferenceCardOverlay } from '@/components/ReferenceCardOverlay'
import { ReferenceCardEditor } from '@/components/ReferenceCardEditor'
import { useCardPicture } from '@/hooks/useCardPicture'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { money } from '@/lib/catalogOrders'
import { openCatalogs } from '@/lib/catalogs'
import { draftOf, linkLabel, type Draft } from '@/lib/referenceCards'
import { draftForPart, useFlashContext } from '@/lib/flashContext'
import {
  flashCardKey,
  leadTime,
  loadFlashCard,
  qty,
  stockLine,
  type FlashCard,
  type FlashRef,
} from '@/lib/flashWords'
import { createLineItem as addJobLine } from '@/lib/workOrders'
import { createLineItem as addEstimateLine } from '@/lib/estimates'

/**
 * The compact flash card: what somebody on the phone needs to know about a
 * part, in one glance. The picture and name, whether it is on the shelf or
 * a van, whether more is coming, which catalog page it is on, who sells it
 * and for how much, and buttons to order it, put it on the job, or open
 * the full card.
 */
export function FlashCardPopover({
  part,
  anchor,
  pinned,
  onClose,
  onPointerEnter,
  onPointerLeave,
}: {
  part: FlashRef & { said?: string }
  anchor: HTMLElement | null
  pinned: boolean
  onClose: () => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null)
  const [openCard, setOpenCard] = useState<string | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)

  const q = useQuery({
    queryKey: flashCardKey(part),
    queryFn: () => loadFlashCard(part),
    staleTime: 60_000,
    retry: false,
  })

  // Beside the word, below it when there is room and above it when not.
  useLayoutEffect(() => {
    const measure = () => {
      if (!anchor) return
      const r = anchor.getBoundingClientRect()
      const width = Math.min(340, window.innerWidth - 16)
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
      const below = window.innerHeight - r.bottom
      setPlace(below >= 300 || below >= r.top
        ? { top: r.bottom + 6, left, width }
        : { bottom: window.innerHeight - r.top + 6, left, width })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [anchor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (box.current?.contains(t) || anchor?.contains(t)) return
      // A dialog opened from the card sits outside it; leave the card be.
      if (openCard || editing) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [anchor, onClose, openCard, editing])

  if (!place) return null

  return createPortal(
    <>
      <div
        ref={box}
        role="dialog"
        aria-label="Part details"
        data-tour="flash-card"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        style={{ position: 'fixed', top: place.top, bottom: place.bottom, left: place.left, width: place.width }}
        className="z-[55] max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white text-left text-slate-900 shadow-2xl"
      >
        {pinned && (
          <button type="button" onClick={onClose} aria-label="Close"
            className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <IconX size={14} />
          </button>
        )}
        {q.isLoading && <p className="px-4 py-3 text-sm text-slate-500">Looking it up…</p>}
        {q.isError && (
          <div className="px-4 py-3 text-sm text-slate-600">
            <p className="font-medium text-slate-800">{part.said ?? part.term}</p>
            <p className="mt-1">Nothing in your cards or items goes by that yet.</p>
          </div>
        )}
        {q.data && (
          <FlashCardBody
            card={q.data}
            onOpenCard={(id) => setOpenCard(id)}
            onMakeCard={(d) => setEditing(d)}
          />
        )}
      </div>
      {openCard && (
        <ReferenceCardOverlay
          cardId={openCard}
          onClose={() => setOpenCard(null)}
          onEdit={(c) => { setOpenCard(null); setEditing(draftOf(c)) }}
        />
      )}
      {editing && <ReferenceCardEditor draft={editing} onClose={() => setEditing(null)} />}
    </>,
    document.body,
  )
}

/**
 * The flash card's body on its own, for a card that has the part already:
 * the fits card's rows open into it, so every action is this one.
 */
export function FlashCardBody({
  card,
  onOpenCard,
  onMakeCard,
}: {
  card: FlashCard
  onOpenCard: (cardId: string) => void
  onMakeCard: (draft: Draft) => void
}) {
  const { has, hasAny } = usePermissions()
  const context = useFlashContext()
  const p = card.part
  const picture = useCardPicture(p.has_picture ? p.card_id : null)
  const image = picture ?? p.image_url ?? null
  const numbers = [...new Set([...p.part_numbers, ...(p.sku ? [p.sku] : []), ...(p.supplier_sku ? [p.supplier_sku] : [])])]
  const stock = stockLine(card.stock)
  const inStock = !!card.stock && card.stock.on_hand > 0
  const orders = card.on_order.orders
  const asks = card.on_order.asks
  const sellers = card.sellers.slice(0, 3)
  const sell = card.price.sell_cents ?? null

  return (
    <div className="space-y-2.5 px-4 py-3 text-sm">
      <div className="flex items-start gap-3 pr-5">
        {image ? (
          <img src={image} alt="" className="h-14 w-14 shrink-0 rounded-md border border-slate-200 bg-white object-contain" />
        ) : null}
        <div className="min-w-0">
          <p className="font-semibold leading-snug text-slate-900">{p.title}</p>
          {numbers.length > 0 && (
            <p className="mt-0.5 truncate font-mono text-xs text-slate-500">{numbers.slice(0, 4).join(' · ')}</p>
          )}
          {sell != null && <p className="mt-0.5 text-xs text-slate-600">Sells for {money(sell)}{p.unit_label ? ` / ${p.unit_label}` : ''}</p>}
        </div>
      </div>

      {p.item_id ? (
        <p data-tour="flash-card-stock" className={'rounded-md px-2.5 py-1.5 text-sm font-medium ' + (inStock ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800')}>
          {stock}
          {card.stock && card.stock.on_hand > 0 && card.stock.available < card.stock.on_hand && (
            <span className="block text-xs font-normal">{qty(card.stock.available)} free, the rest set aside for jobs</span>
          )}
        </p>
      ) : (
        <p className="rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">Not one of your stocked items.</p>
      )}

      {(orders.length > 0 || asks.count > 0) && (
        <p className="text-sm text-slate-700">
          {orders.length > 0 && (
            <>On order: {orders.map((o, i) => (
              <span key={o.id}>
                {i > 0 && ', '}
                <Link to={`/purchase-orders/${o.id}`} className="font-medium text-[var(--accent-700)] hover:underline">{o.po_number ?? 'a purchase order'}</Link>
                {o.qty > 0 && ` (${qty(o.qty)})`}
              </span>
            ))}</>
          )}
          {orders.length > 0 && asks.count > 0 && <br />}
          {asks.count > 0 && <>In the parts cart: {qty(asks.qty)}, waiting to be ordered</>}
        </p>
      )}

      {card.catalogs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">In:</span>
          {card.catalogs.slice(0, 3).map((c) => (
            <button key={c.id} type="button"
              onClick={() => openCatalogs({ documentId: c.document_id, page: c.page ?? undefined })}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 hover:border-amber-400 hover:bg-amber-50">
              <IconBook2 size={12} aria-hidden />
              {linkLabel(c)}
            </button>
          ))}
        </div>
      )}

      {sellers.length > 0 && (
        <div>
          <p className="text-xs text-slate-500">Who sells it</p>
          <ul className="mt-0.5 list-none space-y-0.5 p-0">
            {sellers.map((s) => (
              <li key={s.id} className="flex items-center gap-1.5 text-sm text-slate-800">
                {s.preferred && <IconStarFilled size={12} className="shrink-0 text-amber-500" aria-label="Preferred" />}
                <span className="truncate">{s.vendor ?? 'A supplier'}</span>
                <span className="ml-auto shrink-0 tabular-nums text-slate-600">
                  {[s.last_cost_cents != null ? money(s.last_cost_cents) : null, leadTime(s.lead_time_days)].filter(Boolean).join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {card.jobs.length > 0 && (
        <p className="text-xs text-slate-600">
          Last used on{' '}
          {card.jobs.map((j, i) => (
            <span key={j.id}>
              {i > 0 && ', '}
              <Link to={`/jobs/${j.id}`} className="text-[var(--accent-700)] hover:underline">
                {j.number != null ? `#${j.number}` : 'a job'}{j.customer ? ` ${j.customer}` : ''}
              </Link>
            </span>
          ))}
        </p>
      )}
      {card.mentions.last_30_days > 1 && (
        <p className="text-xs text-slate-500">Asked about {card.mentions.last_30_days} times in the last 30 days.</p>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
        <AddToCartButton
          source={p.card_id ? 'reference_card' : 'item'}
          label="Add to cart"
          forJob={context.job}
          forEstimate={context.estimate}
          part={{
            catalog_item_id: p.item_id ?? undefined,
            reference_card_id: p.card_id ?? undefined,
            part_number: numbers[0],
            description: p.title,
            label: p.title,
            list_price_cents: card.price.list_cents ?? undefined,
          }}
          className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600"
        />
        {(context.job || context.estimate) && has(PERM.JOBS_EDIT) && <AddToContext card={card} />}
        {p.card_id ? (
          <button type="button" onClick={() => onOpenCard(p.card_id as string)}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Open card
          </button>
        ) : hasAny([PERM.CATALOG_EDIT]) && numbers[0] ? (
          <button type="button" onClick={() => onMakeCard(draftForPart(numbers[0], p.item_name ?? p.title))}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
            <IconPlus size={12} aria-hidden /> Make a card
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** "Add to job" or "Add to estimate": one of it, at its sell price. */
function AddToContext({ card }: { card: FlashCard }) {
  const context = useFlashContext()
  const qc = useQueryClient()
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const target = context.estimate ? 'estimate' : 'job'
  const p = card.part
  const price = card.price.sell_cents ?? 0
  const description = p.item_name ?? p.title

  const add = async () => {
    setState('busy')
    try {
      if (context.estimate) {
        await addEstimateLine(context.estimate.id, {
          type: 'product',
          line_type: 'item',
          description,
          quantity: 1,
          unit_price_cents: price,
          service_catalog_item_id: p.item_id,
        })
        void qc.invalidateQueries({ queryKey: ['estimates'] })
        void qc.invalidateQueries({ queryKey: ['estimate', context.estimate.id] })
      } else if (context.job) {
        await addJobLine(context.job.id, {
          line_type: 'item',
          description,
          quantity: 1,
          customer_cost_cents: price,
          owner_cost_cents: card.price.cost_cents ?? undefined,
          unit_label: p.unit_label ?? undefined,
          catalog_item_id: p.item_id,
        })
        void qc.invalidateQueries({ queryKey: ['work-order', context.job.id] })
        void qc.invalidateQueries({ queryKey: ['work-orders'] })
      }
      setState('done')
    } catch {
      setState('error')
    }
  }

  return (
    <button type="button" disabled={state === 'busy' || state === 'done'} onClick={() => void add()}
      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
      {state === 'done' ? `On the ${target}` : state === 'busy' ? 'Adding…' : state === 'error' ? 'Try again' : `Add to ${target}`}
    </button>
  )
}
