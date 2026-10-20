import '@/components/inventory/bins/bins.css'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { IconChevronDown, IconChevronRight, IconExternalLink } from '@tabler/icons-react'
import { FlashCardBody } from '@/components/flash/FlashCardPopover'
import { ReferenceCardOverlay } from '@/components/ReferenceCardOverlay'
import { ReferenceCardEditor } from '@/components/ReferenceCardEditor'
import { money } from '@/lib/catalogOrders'
import { flashCardKey, loadFlashCard, stockLine } from '@/lib/flashWords'
import { draftOf, type Draft } from '@/lib/referenceCards'
import { fitDetails, fitTitle, type FitsCardData, type FitsCardItem } from '@/lib/fitment'
import { DraftBadge } from './FitsSection'

/**
 * "Parts that fit": the company's products whose fits match one subject, in
 * stock first. Shared by the vehicle card's Parts that fit tab and the fits
 * card for every other subject, so both read the same.
 *
 * Each row is the part at a glance -- photo, name, SKU, the fit that matched,
 * sell price and the flash card's stock line -- and opens into the flash
 * card itself (FlashCardBody): stock by place and van, on order, catalog
 * pages, who sells it, last jobs, and its actions (Add to cart, Add to job /
 * estimate, Open card / Make a card). Nothing here re-implements those.
 *
 * Theme colours only: the bins.css roles, inside [data-bins-ui].
 */
export function PartsThatFit({ data, title, children }: {
  data: FitsCardData
  /** What was asked, as a line: "2016 Ford F-150". */
  title: string
  /** Shown under the rows, e.g. the vehicle card's shelf matches. */
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [openCard, setOpenCard] = useState<string | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)
  const label = data.subject.label.toLowerCase()

  return (
    <div data-bins-ui="" data-parts-that-fit="" className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-sm text-[var(--bins-text)]">
          {data.total === 0
            ? <>No product has a fit for this {label} yet.</>
            : <><span className="font-semibold">{data.total}</span> {data.total === 1 ? 'part fits' : 'parts fit'} {title}</>}
        </p>
        {data.status === 'draft' && <DraftBadge />}
      </div>
      {data.matched_on === 'model_prefix' && data.total > 0 && (
        <p className="rounded-md border border-[var(--bins-accent-line)] bg-[var(--bins-accent-soft)] px-2.5 py-1.5 text-xs text-[var(--bins-accent-ink)]">
          No fit names that exact model, so these fit a shorter name for it ({String(data.asked.model ?? '')} without the trim). Check the fit line before fitting.
        </p>
      )}
      {data.total === 0 && (
        <p className="text-xs text-[var(--bins-muted)]">
          Add what a product fits in its Fits section (Product catalog → a product → Fits). It shows here straight away.
        </p>
      )}

      {data.items.length > 0 && (
        <ul className="divide-y divide-[var(--bins-border-soft)] rounded-lg border border-[var(--bins-border)] bg-[var(--bins-surface)]">
          {data.items.map((item) => (
            <PartRow
              key={item.item_id}
              item={item}
              data={data}
              open={open === item.item_id}
              onToggle={() => setOpen((o) => (o === item.item_id ? null : item.item_id))}
              onOpenCard={setOpenCard}
              onMakeCard={setEditing}
            />
          ))}
        </ul>
      )}
      {data.truncated && (
        <p className="text-xs text-[var(--bins-muted)]">Showing the first {data.items.length} of {data.total}. The catalog's Fits filter lists them all.</p>
      )}
      {children}

      {openCard && (
        <ReferenceCardOverlay
          cardId={openCard}
          onClose={() => setOpenCard(null)}
          onEdit={(c) => { setOpenCard(null); setEditing(draftOf(c)) }}
        />
      )}
      {editing && <ReferenceCardEditor draft={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function PartRow({ item, data, open, onToggle, onOpenCard, onMakeCard }: {
  item: FitsCardItem
  data: FitsCardData
  open: boolean
  onToggle: () => void
  onOpenCard: (id: string) => void
  onMakeCard: (d: Draft) => void
}) {
  const inStock = (item.stock?.on_hand ?? 0) > 0
  const stock = stockLine(item.stock)
  const ref = { item_id: item.item_id }
  const cardQ = useQuery({ queryKey: flashCardKey(ref), queryFn: () => loadFlashCard(ref), enabled: open, staleTime: 60_000, retry: false })

  return (
    <li data-fit-part={item.item_id}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-[var(--bins-softer)]">
        {item.image ? (
          <img src={item.image} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-md border border-[var(--bins-border)] bg-[var(--bins-surface)] object-contain" />
        ) : (
          <span aria-hidden className="h-10 w-10 shrink-0 rounded-md border border-dashed border-[var(--bins-border)] bg-[var(--bins-soft)]" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold text-[var(--bins-text)]">{item.name}</span>
            {item.sku && <span className="shrink-0 font-mono text-[11px] text-[var(--bins-muted)]">{item.sku}</span>}
          </span>
          {item.fits.slice(0, 2).map((fit) => {
            const details = fitDetails(data.subject, fit.attrs)
            return (
              <span key={fit.id} className="block text-xs text-[var(--bins-text-2)]">
                Fits {fitTitle(data.subject, fit.attrs)}{details ? ` · ${details}` : ''}
                {fit.note && <span className="block text-[var(--bins-muted)]">{fit.note}</span>}
              </span>
            )
          })}
          {item.fits.length > 2 && <span className="block text-[11px] text-[var(--bins-muted)]">and {item.fits.length - 2} more matching fits</span>}
          <span className={'mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ' + (inStock ? 'bg-[var(--bins-accent-soft)] text-[var(--bins-accent-ink)]' : 'bg-[var(--bins-soft)] text-[var(--color-danger)]')}>
            {stock ?? 'Not stocked'}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {item.sell_cents != null && (
            <span className="text-sm tabular-nums text-[var(--bins-text)]">{money(item.sell_cents)}{item.unit_label ? <span className="text-[11px] text-[var(--bins-muted)]"> / {item.unit_label}</span> : null}</span>
          )}
          {open ? <IconChevronDown size={16} className="text-[var(--bins-muted)]" aria-hidden /> : <IconChevronRight size={16} className="text-[var(--bins-muted)]" aria-hidden />}
        </span>
      </button>
      {open && (
        <div data-fit-part-card="" className="border-t border-[var(--bins-border-soft)] bg-[var(--bins-softer)]">
          {cardQ.isLoading && <p className="px-4 py-3 text-sm text-[var(--bins-muted)]">Looking it up…</p>}
          {cardQ.isError && <p className="px-4 py-3 text-sm text-[var(--bins-muted)]">Could not load this part's card.</p>}
          {cardQ.data && <FlashCardBody card={cardQ.data} onOpenCard={onOpenCard} onMakeCard={onMakeCard} />}
          <div className="px-4 pb-3">
            <Link to={`/catalog/products?item=${encodeURIComponent(item.item_id)}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-700)] hover:underline">
              <IconExternalLink size={12} aria-hidden /> Open product
            </Link>
          </div>
        </div>
      )}
    </li>
  )
}
