import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { useProductCatalogCategories } from '@/hooks/useProductCatalogCategories'
import type { ProductCatalogCategory } from '@/types/productCatalogCategory'

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
  onPick: (category: ProductCatalogCategory | null) => void
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-slate-900">Shop by category</h2>
        <button
          type="button"
          onClick={() => onPick(null)}
          className="text-sm px-3 py-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-800 font-medium hover:bg-amber-100"
        >
          All products
        </button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
  onPick: (c: ProductCatalogCategory) => void
}) {
  const img = category.images?.medium_url ?? category.images?.thumb_url ?? null

  const out = rollup?.out_count ?? 0
  const low = rollup?.low_count ?? 0

  return (
    // One button for the whole tile: every part of it does the same thing.
    <button
      type="button"
      onClick={() => onPick(category)}
      className="flex flex-col overflow-hidden rounded-lg border border-slate-200 text-left hover:border-amber-400 hover:bg-slate-50"
    >
      <div className="relative h-32 w-full bg-slate-100">
        {img ? (
          <img src={img} alt="" className="h-full w-full object-cover" />
        ) : (
          // No call to action here — setting the photo lives on the Product
          // Categories screen. A blank panel is honest; "Add a photo" invited a
          // click that did something other than open the category.
          <span className="flex h-full w-full items-center justify-center text-xs text-slate-300">
            No photo
          </span>
        )}
        {rollup && (
          <span className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold text-white">
            {rollup.sku_count} SKU{rollup.sku_count === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="flex-1 p-3">
        <div className="font-semibold text-slate-900 text-sm">{category.name}</div>
        {category.description && (
          <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{category.description}</div>
        )}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {/* Out beats low: nothing on the shelf is the more urgent fact. */}
          {out > 0 ? (
            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
              {out} out
            </span>
          ) : low > 0 ? (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
              {low} low
            </span>
          ) : (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              Well stocked
            </span>
          )}
          {rollup && (
            <span className="text-xs text-slate-500 font-mono">{money(rollup.value_cents)} on hand</span>
          )}
        </div>
      </div>
    </button>
  )
}
