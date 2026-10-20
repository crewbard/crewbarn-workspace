import type { CatalogItem } from '@/types/catalogItem'
import { PriceText, ProductThumb, StockText } from '@/components/catalog/productBits'

/**
 * Product catalog grid: one card per product with its photo (or an icon for
 * what it is), price and stock. Same data and rules as the list; clicking a
 * card opens the same details. Render inside [data-bins-ui].
 */
export function ProductGrid({
  items,
  onView,
  onShowWhere,
}: {
  items: CatalogItem[]
  onView: (item: CatalogItem) => void
  onShowWhere: (item: CatalogItem) => void
}) {
  return (
    <div data-tour="prod-grid" data-easy-auto-grid="" className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.id}
          data-tour="prod-card"
          role="button"
          tabIndex={0}
          onClick={() => onView(item)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(item) } }}
          className={`flex flex-col overflow-hidden rounded-xl border border-[var(--bins-border)] bg-[var(--bins-surface)] text-left shadow-sm cursor-pointer hover:border-[var(--bins-accent-line)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bins-accent)] ${item.active ? '' : 'opacity-70'}`}
        >
          <ProductThumb item={item} size="lg" />
          <div className="flex flex-1 flex-col gap-1 p-3">
            <div className="font-semibold text-sm text-[var(--bins-text)] line-clamp-2">{item.name}</div>
            <div className="text-xs text-[var(--bins-muted)] truncate">
              {[item.sku, item.product_category?.name].filter(Boolean).join(' · ') || '\u00a0'}
            </div>
            {item.short_description && (
              <div className="text-xs text-[var(--bins-text-2)] line-clamp-1">{item.short_description}</div>
            )}
            <div className="mt-auto flex items-end justify-between gap-2 pt-2">
              <PriceText item={item} />
              <StockText item={item} onShowWhere={onShowWhere} />
            </div>
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-[var(--bins-muted)]">{item.active ? '' : 'Inactive'}</span>
              <a
                href={`/catalog-items/${item.id}/labels`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-[var(--bins-accent-ink)] hover:underline"
              >
                Print labels
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
