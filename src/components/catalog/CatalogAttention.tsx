import { IconAlertTriangle } from '@tabler/icons-react'
import { FilterChip } from '@/components/ui/FilterChip'
import {
  CATALOG_FILTERS,
  CATALOG_FILTER_LABEL,
  attentionItems,
  filterCount,
  type CatalogFilter,
} from '@/lib/catalogProducts'
import type { CatalogAttentionCounts } from '@/types/catalogItem'

/**
 * Product catalog: the "Needs attention" strip and the quick-filter chips.
 * Every number is a button that shows those products. Counts come from
 * GET /v1/catalog-items/attention, the filtering from the list's ?attention=,
 * so both cover the whole catalog, not just the page on screen.
 * Render inside [data-bins-ui].
 */
export function CatalogAttention({
  counts,
  filter,
  onFilter,
}: {
  counts: CatalogAttentionCounts | undefined
  filter: CatalogFilter
  onFilter: (f: CatalogFilter) => void
}) {
  const problems = attentionItems(counts as Record<string, number> | undefined)
  return (
    <div className="space-y-3">
      {problems.length > 0 && (
        <div
          data-tour="prod-attention"
          role="note"
          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[var(--bins-accent-line)] bg-[var(--bins-accent-soft)] px-4 py-2.5 text-sm text-[var(--bins-text)]"
        >
          <IconAlertTriangle size={18} stroke={1.75} className="text-[var(--bins-accent-strong)]" aria-hidden />
          <span className="font-medium">Needs attention:</span>
          {problems.map((p, i) => (
            <span key={p.filter} className="inline-flex items-center gap-2">
              {i > 0 && <span aria-hidden className="text-[var(--bins-muted)]">·</span>}
              <button
                type="button"
                data-attention={p.filter}
                onClick={() => onFilter(p.filter)}
                className="font-semibold text-[var(--bins-accent-ink)] underline decoration-dotted underline-offset-2 hover:decoration-solid"
              >
                {p.count} {p.text}
              </button>
            </span>
          ))}
        </div>
      )}
      <div data-tour="prod-filters" className="flex flex-wrap items-center gap-2" role="group" aria-label="Show">
        {CATALOG_FILTERS.map((f) => (
          <FilterChip
            key={f}
            chip={f}
            active={filter === f}
            onClick={() => onFilter(f)}
            label={CATALOG_FILTER_LABEL[f]}
            count={filterCount(f, counts as Record<string, number> | undefined)}
          />
        ))}
      </div>
    </div>
  )
}
