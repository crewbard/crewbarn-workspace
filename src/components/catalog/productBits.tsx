import { createElement, useState } from 'react'
import type { CatalogItem } from '@/types/catalogItem'
import { onHand, productStockStatus } from '@/lib/catalogProducts'
import { formatQty } from '@/lib/unitsOfMeasure'
import { StatusPill } from '@/components/ui/StockStatusPill'
import { productIconFor } from '@/components/catalog/catalogPlaceholders'

/**
 * The bits a product shows in both the Product catalog list and grid: its
 * picture, price and stock. Kept in one place so the two views can't disagree.
 * Colours are the bins.css theme roles; render inside [data-bins-ui].
 */

/** The product's photo, or an icon for what it is. */
export function ProductThumb({ item, size = 'sm' }: { item: CatalogItem; size?: 'sm' | 'lg' }) {
  const src = size === 'lg'
    ? item.images.medium_url ?? item.images.full_url ?? item.images.thumb_url
    : item.images.thumb_url ?? item.images.medium_url ?? item.images.full_url
  const box = size === 'lg' ? 'h-36 w-full' : 'h-10 w-10 rounded'
  if (src) {
    return <img src={src} alt="" loading="lazy" className={`${box} object-cover bg-[var(--bins-soft)] ${size === 'sm' ? 'border border-[var(--bins-border)]' : ''}`} />
  }
  return (
    <div
      data-photo="none"
      title="No photo yet"
      className={`${box} flex items-center justify-center bg-[var(--bins-accent-soft)] text-[var(--bins-accent-strong)] ${size === 'sm' ? 'border border-[var(--bins-border)]' : ''}`}
    >
      {createElement(productIconFor(item.name, item.product_category?.name), { size: size === 'lg' ? 48 : 20, stroke: 1.5, 'aria-hidden': true })}
    </div>
  )
}

/** The customer price, or a "No price" chip: $0.00 read like a real price. */
export function PriceText({ item, onSave }: {
  item: CatalogItem
  /** Given (catalog.edit only): click the price to change it in place; Enter saves, Esc cancels. */
  onSave?: (cents: number) => Promise<unknown>
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const cents = item.pricing.customer_cost_cents ?? 0

  if (onSave && draft !== null) {
    const commit = async () => {
      const value = Math.round(parseFloat(draft.replace(/[^0-9.]/g, '')) * 100)
      if (!Number.isFinite(value) || value < 0) { setFailed(true); return }
      if (value === cents) { setDraft(null); return }
      setSaving(true)
      try { await onSave(value); setDraft(null); setFailed(false) } catch { setFailed(true) } finally { setSaving(false) }
    }
    return (
      <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          aria-label={`Price for ${item.name}`}
          data-price-input
          inputMode="decimal"
          value={draft}
          disabled={saving}
          onChange={(e) => { setDraft(e.target.value); setFailed(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') void commit(); if (e.key === 'Escape') setDraft(null) }}
          onBlur={() => void commit()}
          className={`w-24 rounded-md border px-2 py-1 text-right font-mono text-sm bg-[var(--bins-surface)] text-[var(--bins-text)] ${failed ? 'border-[var(--color-danger)]' : 'border-[var(--bins-accent)]'}`}
        />
        {failed && <span className="text-xs text-[var(--color-danger)]">Not saved</span>}
      </span>
    )
  }

  const open = onSave
    ? (e: React.MouseEvent) => { e.stopPropagation(); setDraft(cents > 0 ? (cents / 100).toFixed(2) : '') }
    : undefined
  if (cents <= 0) {
    const chip = 'inline-block whitespace-nowrap rounded-md border border-dashed border-[var(--color-warning)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-warning)] font-sans'
    return open
      ? <button type="button" data-price="none" data-price-edit onClick={open} title="No customer price set. Click to add one." className={chip}>No price</button>
      : <span data-price="none" title="No customer price set. Edit the product to add one." className={chip}>No price</span>
  }
  return open
    ? (
      <button type="button" data-price-edit onClick={open} title="Click to change the price"
        className="rounded px-1 font-mono font-medium text-[var(--bins-text)] underline decoration-dotted decoration-[var(--bins-muted)] underline-offset-4 hover:bg-[var(--bins-soft)]">
        {item.pricing.customer_cost_formatted}
      </button>
    )
    : <span className="font-mono font-medium text-[var(--bins-text)]">{item.pricing.customer_cost_formatted}</span>
}

/**
 * Stock for a stocked product: the server's total as a status pill (click to
 * see where), then the top places. A dash for products with no count.
 */
export function StockText({
  item,
  onShowWhere,
  align = 'end',
}: {
  item: CatalogItem
  onShowWhere: (item: CatalogItem) => void
  align?: 'start' | 'end'
}) {
  if (!item.is_stocked_item) {
    return <span className="text-xs text-[var(--bins-muted)]" title="Not a stocked item.">—</span>
  }
  const qty = onHand(item)
  const status = productStockStatus(item)
  const threshold = item.inventory.reorder_threshold
  const places = item.stock_summary?.locations ?? []
  return (
    <div className={`flex flex-col gap-0.5 ${align === 'end' ? 'items-end text-right' : 'items-start text-left'}`}>
      <button
        type="button"
        data-stock={status}
        onClick={(e) => { e.stopPropagation(); onShowWhere(item) }}
        title={status === 'low' ? `At or below the reorder point (${threshold}). Click to see where.` : 'Click to see where these are'}
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bins-accent)]"
      >
        <StatusPill status={status} label={formatQty(qty, item.unit_label)} />
      </button>
      {places.length > 0 && (
        <span
          className="text-[11px] leading-tight text-[var(--bins-muted)]"
          title={places.map((p) => `${p.location}${p.bin ? ` / ${p.bin}` : ''}: ${p.qty}`).join('\n')}
        >
          {places.slice(0, 2).map((p) => (p.bin ? `${p.location} / ${p.bin}` : p.location)).join(', ')}
          {places.length > 2 && ` +${places.length - 2}`}
        </span>
      )}
    </div>
  )
}
