import { createElement } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { useProductCatalogCategories } from '@/hooks/useProductCatalogCategories'
import type { ProductCatalogCategory } from '@/types/productCatalogCategory'
import type { CatalogFilter } from '@/lib/catalogProducts'
import { productIconFor } from '@/components/catalog/catalogPlaceholders'
import '@/components/inventory/bins/bins.css'

/**
 * Shop by category — the catalog's front door.
 *
 * A flat table of 218 products answers "where is this SKU"; it does not answer
 * "what do we carry" or "what is running out", which is what someone opens the
 * catalog to find out. The tiles do, and each one is also the filter that takes
 * you into that slice of the table.
 *
 * The whole tile picks the category — image included. It used to make the
 * photo a file-upload target, which turned the top half of every tile into a
 * different action than the bottom half: clicking the picture opened a file
 * dialog when the obvious expectation is "show me this category". Setting the
 * photo belongs with the rest of category management, on the Product
 * Categories screen, which already does it.
 *
 * The counts come from a single server rollup rather than being added up here.
 * Computing them client-side would mean fetching every product AND every stock
 * level just to render eight headings.
 *
 * The Low/Out pill is its own button: it opens the category already filtered
 * to what's low or out. A category with no photo shows an icon for what it
 * holds (catalogPlaceholders productIconFor) instead of "No photo". Colours
 * are the bins.css theme roles.
 */

interface Rollup {
  category_id: string
  sku_count: number
  value_cents: number
  out_count: number
  low_count: number
}

const money = (cents: number) =>
  '$' + Math.round(cents / 100).toLocaleString('en-US')

export function CategoryTiles({
  onPick,
}: {
  onPick: (category: ProductCatalogCategory | null, filter?: CatalogFilter) => void
}) {
  const { data: catData } = useProductCatalogCategories({ shape: 'flat' })
  const categories = (catData?.data ?? []).filter((c) => c.active)

  const { data: rollupData } = useQuery({
    queryKey: ['product-category-rollup'],
    queryFn: () => apiRequest<{ data: Record<string, Rollup> }>('/v1/product-categories/rollup'),
    staleTime: 60_000,
  })
  const rollup = rollupData?.data ?? {}

  if (categories.length === 0) return null

  return (
    <div data-bins-ui="" className="bg-[var(--bins-surface)] border border-[var(--bins-border)] rounded-xl shadow-sm p-5">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-[var(--bins-text)]">Shop by category</h2>
        <button
          type="button"
          onClick={() => onPick(null)}
          data-tour="prod-category-all"
          className="text-sm px-3 py-1.5 rounded-md border border-[var(--bins-accent-line)] bg-[var(--bins-accent-soft)] text-[var(--bins-accent-ink)] font-medium hover:bg-[var(--bins-soft)]"
        >
          All products
        </button>
      </div>

      <div data-easy-auto-grid="" className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {categories.map((c) => (
          <CategoryTile key={c.id} category={c} rollup={rollup[c.id]} onPick={onPick} />
        ))}
      </div>
    </div>
  )
}

function CategoryTile({
  category,
  rollup,
  onPick,
}: {
  category: ProductCatalogCategory
  rollup?: Rollup
  onPick: (c: ProductCatalogCategory, filter?: CatalogFilter) => void
}) {
  const img = category.images?.medium_url ?? category.images?.thumb_url ?? null

  const out = rollup?.out_count ?? 0
  const low = rollup?.low_count ?? 0

  return (
    // The tile is a card with two buttons: the category (photo and name), and
    // the Low/Out pill, which opens the category filtered to those products.
    <div
      data-tour="prod-category-tile"
      className="flex flex-col overflow-hidden rounded-lg border border-[var(--bins-border)] bg-[var(--bins-surface)] hover:border-[var(--bins-accent-line)]"
    >
      <button type="button" onClick={() => onPick(category)} className="flex flex-1 flex-col text-left hover:bg-[var(--bins-softer)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--bins-accent)]">
        <div className="relative h-28 w-full bg-[var(--bins-accent-soft)]">
          {img ? (
            // A logo or collage is shown whole rather than cropped to a strip.
            <img src={img} alt="" className="h-full w-full object-contain bg-[var(--bins-surface)]" />
          ) : (
            // No call to action here — setting the photo lives on the Product
            // Categories screen. An icon for what's inside, not a blank panel.
            <span data-photo="none" className="flex h-full w-full items-center justify-center text-[var(--bins-accent-strong)]">
              {createElement(productIconFor(category.name, category.description), { size: 44, stroke: 1.4, 'aria-hidden': true })}
            </span>
          )}
          {rollup && (
            <span className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold text-white">
              {rollup.sku_count} SKU{rollup.sku_count === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="px-3 pt-3">
          <div className="font-semibold text-[var(--bins-text)] text-sm">{category.name}</div>
          {category.description && (
            <div className="text-xs text-[var(--bins-muted)] mt-0.5 line-clamp-2">{category.description}</div>
          )}
        </div>
      </button>

      <div className="mt-2 flex items-center gap-2 flex-wrap px-3 pb-3">
        {/* Out beats low: nothing on the shelf is the more urgent fact. */}
        {out > 0 ? (
          <button type="button" data-pill="out" onClick={() => onPick(category, 'out')} title="Show what's out"
            className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-100">
            {out} out
          </button>
        ) : low > 0 ? (
          <button type="button" data-pill="low" onClick={() => onPick(category, 'low')} title="Show what's low"
            className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-800 hover:bg-orange-100">
            {low} low
          </button>
        ) : (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
            Well stocked
          </span>
        )}
        {out > 0 && low > 0 && (
          <button type="button" data-pill="low" onClick={() => onPick(category, 'low')} title="Show what's low"
            className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-800 hover:bg-orange-100">
            {low} low
          </button>
        )}
        {rollup && (
          <span className="text-xs text-[var(--bins-muted)] font-mono" title="What it cost us, not what it sells for">
            {money(rollup.value_cents)} at cost
          </span>
        )}
      </div>
    </div>
  )
}
