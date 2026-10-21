import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCardPicture } from '@/hooks/useCardPicture'
import { ImageLightbox } from '@/components/images/ImageLightbox'
import type { LowStockItem, LowStockSupplier } from '@/types/lowStock'

/*
 * The detail under each item on "What needs ordering": its picture, the
 * numbers it goes by, where the rest of it sits, what it last cost, and
 * who is waiting on it. Every line only shows when the shop has recorded
 * it -- an item with nothing on file looks the way it always did.
 */

/** True at tablet width and up, where the list is a table; below it, cards. */
export function useWideScreen(): boolean {
  const query = '(min-width: 768px)'
  const [wide, setWide] = useState(() => typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia(query).matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const on = () => setWide(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

const fold = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
const qtyText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))

function shortDate(date: string | null | undefined): string | null {
  if (!date) return null
  const d = new Date(date.length === 10 ? `${date}T00:00:00` : date)
  if (Number.isNaN(d.getTime())) return null
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** A supplier's name short enough to label a number with ("UHS #"). */
function supplierLabel(name: string): string {
  const n = name.trim()
  return n.length > 18 ? `${n.slice(0, 17)}…` : n
}

/** The numbers an item goes by, each labelled plainly, no repeats. */
export function partNumbers(it: LowStockItem): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = []
  const seen = new Set<string>()
  const add = (label: string, value: string | null | undefined) => {
    const key = fold(value)
    if (!value || !key || seen.has(key)) return
    seen.add(key)
    out.push({ label, value })
  }
  add('SKU', it.sku)
  const pref: LowStockSupplier | null | undefined = it.preferred_supplier
  add('Part #', pref?.part_number)
  if (pref) add(`${supplierLabel(pref.vendor_name)} #`, pref.vendor_sku)
  else if (it.supplier_sku) add(it.supplier_name ? `${supplierLabel(it.supplier_name)} #` : 'Supplier #', it.supplier_sku)
  return out
}

/** "Shop 3 (A-2) · Van 3: 0" — each place that holds it. */
function whereItLives(it: LowStockItem): string | null {
  const places = it.stock_by_location ?? []
  if (places.length === 0) return null
  return places
    .map((p) => `${p.name} ${qtyText(p.qty)}${p.bins.length ? ` (${p.bins.join(', ')})` : ''}`)
    .join(' · ')
}

function waitingText(it: LowStockItem): string | null {
  const w = it.jobs_waiting
  if (!w || w.count === 0) return null
  const ids = new Set<string>()
  let jobs = 0
  let estimates = 0
  for (const f of w.for) {
    const key = f.work_order_id ? `w:${f.work_order_id}` : `e:${f.estimate_id}`
    if (ids.has(key)) continue
    ids.add(key)
    if (f.work_order_id) jobs++
    else estimates++
  }
  const parts = [
    jobs ? `${jobs} job${jobs === 1 ? '' : 's'}` : null,
    estimates ? `${estimates} estimate${estimates === 1 ? '' : 's'}` : null,
  ].filter(Boolean)
  return `Waiting on it: ${parts.join(', ')}`
}

/** One link per job or estimate waiting on it (the number, opening it). */
function waitingLinks(it: LowStockItem): Array<{ to: string; label: string }> {
  const seen = new Set<string>()
  const out: Array<{ to: string; label: string }> = []
  for (const w of it.jobs_waiting?.for ?? []) {
    const to = w.work_order_id ? `/jobs/${encodeURIComponent(w.work_order_id)}` : w.estimate_id ? `/estimates/${encodeURIComponent(w.estimate_id)}` : null
    if (!to || seen.has(to)) continue
    seen.add(to)
    out.push({ to, label: w.label })
  }
  return out.slice(0, 4)
}

/** A generic picture, for a part with no photo yet (Order parts). */
function NoPictureIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="9.5" r="1.6" />
      <path d="m4 18 5-5 3 3 3-3 5 5" strokeLinejoin="round" />
    </svg>
  )
}

function PlaceholderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" strokeLinejoin="round" />
      <path d="m3 8 9 5 9-5M12 13v8" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The item's photo; else its reference card's picture; else a plain box.
 * Click a picture to see it large (zoom, rotate).
 */
export function ItemThumb({ it, size = 'md', tour, onOpen }: {
  it: Pick<LowStockItem, 'name' | 'image'> & { reference_card?: LowStockItem['reference_card'] | null }
  size?: 'md' | 'lg'
  tour?: boolean
  /**
   * Order parts: a click opens the item (its overlay) instead of the large
   * picture, and a part with no picture shows a theme-coloured picture icon
   * that opens it too. null: the same look, for a part that is not one of
   * the shop's items, with nothing to open.
   */
  onOpen?: (() => void) | null
}) {
  const card = it.reference_card
  const own = it.image?.thumb_url ?? null
  const cardPicture = useCardPicture(card?.has_picture ? card.id : null, !own && !!card?.has_picture)
  const thumb = own ?? cardPicture
  const full = it.image?.full_url ?? cardPicture
  const [open, setOpen] = useState(false)
  const box = size === 'lg' ? 'h-16 w-16' : 'h-12 w-12'
  const from = own ? 'Photo' : cardPicture ? 'From its reference card' : null

  if (onOpen === null) {
    return (
      <div data-thumb={thumb ? 'photo' : 'none'} title={thumb ? it.name : 'Not one of your items, so there is no picture'}
        className={`${box} shrink-0 overflow-hidden rounded-md border ${thumb ? 'border-slate-200 bg-white' : 'flex items-center justify-center border-amber-200 bg-amber-50 text-amber-500'}`}>
        {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-contain" /> : <NoPictureIcon />}
      </div>
    )
  }
  if (onOpen) {
    return (
      <button
        type="button"
        data-tour={tour ? 'needs-picture' : undefined}
        data-thumb={thumb ? 'photo' : 'none'}
        onClick={onOpen}
        title={thumb ? `Open ${it.name}` : `${it.name}: no picture yet. Open the item.`}
        aria-label={`Open ${it.name}`}
        className={`${box} shrink-0 overflow-hidden rounded-md border focus:outline-none focus:ring-2 focus:ring-amber-400 ${thumb ? 'border-slate-200 bg-white hover:border-amber-400' : 'flex items-center justify-center border-amber-200 bg-amber-50 text-amber-500 hover:border-amber-400'}`}
      >
        {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-contain" /> : <NoPictureIcon />}
      </button>
    )
  }

  return (
    <>
      {thumb ? (
        <button
          type="button"
          data-tour={tour ? 'needs-picture' : undefined}
          onClick={() => setOpen(true)}
          title={`${from}. Click to see it large.`}
          aria-label={`See a larger picture of ${it.name}`}
          className={`${box} shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400`}
        >
          <img src={thumb} alt="" loading="lazy" className="h-full w-full object-contain" />
        </button>
      ) : (
        <div
          data-tour={tour ? 'needs-picture' : undefined}
          title="No picture yet. Add one on the item."
          className={`${box} shrink-0 flex items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50`}
        >
          <PlaceholderIcon />
        </div>
      )}
      {open && full && (
        <ImageLightbox images={[full]} index={0} onClose={() => setOpen(false)} title={it.name} />
      )}
    </>
  )
}

/** Part numbers, chips, where it lives, last bought, who's waiting. */
export function ItemFacts({ it, tour }: { it: LowStockItem; tour?: boolean }) {
  const numbers = partNumbers(it)
  const where = whereItLives(it)
  const waiting = waitingText(it)
  const last = it.last_bought
  const homeBin = it.default_bin
  const chips = [it.category].filter(Boolean) as string[]

  return (
    <div className="mt-0.5 space-y-0.5 text-xs text-slate-500">
      {numbers.length > 0 && (
        <div data-tour={tour ? 'needs-part-numbers' : undefined} className="flex flex-wrap gap-x-3 gap-y-0.5">
          {numbers.map((n) => (
            <span key={n.label} className="whitespace-nowrap">
              <span className="text-slate-400">{n.label}</span>{' '}
              <span className="font-mono text-slate-700 select-all">{n.value}</span>
            </span>
          ))}
        </div>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {chips.map((c) => (
            <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{c}</span>
          ))}
        </div>
      )}
      <div data-tour={tour ? 'needs-where' : undefined}>
        <span className="text-slate-400">Where it is:</span>{' '}
        {where ?? <span className="text-slate-400">none on any shelf or truck</span>}
        {homeBin && !(it.stock_by_location ?? []).some((p) => p.bins.length > 0) && (
          <span> · home bin {homeBin.label}{homeBin.location ? ` (${homeBin.location})` : ''}</span>
        )}
      </div>
      {(last || waiting) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {last && (
            <span data-tour={tour ? 'needs-last-bought' : undefined}>
              <span className="text-slate-400">Last bought</span> {money(last.unit_cost_cents)}
              {shortDate(last.date) ? ` · ${shortDate(last.date)}` : ''}
              {last.vendor_name ? ` · ${last.vendor_name}` : ''}
            </span>
          )}
          {waiting && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">{waiting}</span>
          )}
          {waitingLinks(it).map((w) => (
            <Link key={w.to} to={w.to} className="text-[11.5px] font-medium text-sky-700 hover:underline" data-waiting-link>{w.label}</Link>
          ))}
        </div>
      )}
    </div>
  )
}

/** The chevron that opens a row's full detail. */
export function MoreToggle({ open, onToggle, tour }: { open: boolean; onToggle: () => void; tour?: boolean }) {
  return (
    <button
      type="button"
      data-tour={tour ? 'needs-more' : undefined}
      onClick={onToggle}
      aria-expanded={open}
      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
    >
      <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
      </svg>
      {open ? 'Less' : 'More about it'}
    </button>
  )
}

/** Everything else on file: description, every supplier, who's waiting, links. */
export function ItemMore({ it, onOpenCard }: { it: LowStockItem; onOpenCard: (cardId: string) => void }) {
  const description = it.description || it.short_description
  const suppliers = it.suppliers ?? []
  const waiting = it.jobs_waiting?.for ?? []
  const last = it.last_bought

  return (
    <div className="grid gap-4 text-xs text-slate-600 sm:grid-cols-2">
      <div className="space-y-2">
        <div>
          <div className="font-medium text-slate-700">Description</div>
          {description
            ? <p className="mt-0.5 whitespace-pre-line">{description}</p>
            : <p className="mt-0.5 text-slate-400">No description on the item.</p>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {it.unit_label && <><dt className="text-slate-400">Sold by</dt><dd>{it.unit_label}</dd></>}
          {it.barcode && <><dt className="text-slate-400">Barcode</dt><dd className="font-mono">{it.barcode}</dd></>}
          {it.category && <><dt className="text-slate-400">Category</dt><dd>{it.category}</dd></>}
          {it.default_bin && <><dt className="text-slate-400">Home bin</dt><dd>{it.default_bin.label}{it.default_bin.location ? ` (${it.default_bin.location})` : ''}</dd></>}
        </dl>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          <Link to={`/catalog/products?item=${encodeURIComponent(it.id)}`} className="font-medium text-sky-700 hover:underline">Open the item</Link>
          {it.reference_card && (
            <button type="button" onClick={() => onOpenCard(it.reference_card!.id)} className="font-medium text-sky-700 hover:underline">
              Open its reference card
            </button>
          )}
          {last && (
            <Link to={`/purchase-orders/${encodeURIComponent(last.purchase_order_id)}`} className="font-medium text-sky-700 hover:underline">
              Last order{last.po_number ? ` (PO ${last.po_number})` : ''}
            </Link>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <div className="font-medium text-slate-700">Who sells it</div>
          {suppliers.length === 0 ? (
            <p className="mt-0.5 text-slate-400">
              {it.supplier_name ? `${it.supplier_name}${it.supplier_sku ? ` · ${it.supplier_sku}` : ''} (from the item)` : 'Not ordered from anyone yet.'}
            </p>
          ) : (
            <ul className="mt-0.5 space-y-0.5">
              {suppliers.map((s) => (
                <li key={s.vendor_id}>
                  <span className="text-slate-800">{s.vendor_name}</span>
                  {s.preferred && <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] font-medium text-amber-700">preferred</span>}
                  {s.vendor_sku && <span className="font-mono"> · their # {s.vendor_sku}</span>}
                  {s.part_number && fold(s.part_number) !== fold(s.vendor_sku) && <span className="font-mono"> · part # {s.part_number}</span>}
                  {s.last_cost_cents != null && <span> · {money(s.last_cost_cents)}</span>}
                  {shortDate(s.last_ordered_at) && <span> · {shortDate(s.last_ordered_at)}</span>}
                  {s.lead_time_days != null && <span> · about {s.lead_time_days} day{s.lead_time_days === 1 ? '' : 's'} to arrive</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="font-medium text-slate-700">Waiting on it</div>
          {waiting.length === 0 ? (
            <p className="mt-0.5 text-slate-400">No jobs or estimates are waiting on it.</p>
          ) : (
            <ul className="mt-0.5 space-y-0.5">
              {waiting.map((w, i) => (
                <li key={`${w.kind}-${w.work_order_id ?? w.estimate_id}-${i}`}>
                  <Link
                    to={w.work_order_id ? `/jobs/${encodeURIComponent(w.work_order_id)}` : `/estimates/${encodeURIComponent(w.estimate_id ?? '')}`}
                    className="text-sky-700 hover:underline"
                  >
                    {w.label}
                  </Link>
                  {' '}· {qtyText(w.qty)} {w.kind === 'held' ? 'set aside for it' : 'asked for, not ordered yet'}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
