/**
 * All / For stock / For jobs / For estimates, with counts. Used on Needs
 * ordering and Order parts; what is ticked and ordered follows the lines
 * the chip shows.
 */
import { ORDER_FILTERS, type OrderFilter } from '@/lib/startPo'

export function OrderFilterChips({ value, counts, onChange }: {
  value: OrderFilter
  counts: Record<OrderFilter, number>
  onChange: (f: OrderFilter) => void
}) {
  return (
    <div role="radiogroup" aria-label="Show parts needed for" data-tour="order-filter" className="flex flex-wrap gap-2">
      {ORDER_FILTERS.map((f) => {
        const on = value === f.id
        return (
          <button key={f.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(f.id)}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors ${
              on
                ? 'border-[var(--accent-500,#e8902c)] bg-[var(--accent-50,#fdf7ee)] text-[var(--accent-800,#75450f)]'
                : 'border-[var(--easy-border,#e2e8f0)] bg-[var(--color-surface,#fff)] text-[var(--easy-muted,#475569)] hover:border-[var(--accent-300,#eebd6f)]'
            }`}>
            {f.label}
            <span className="tabular-nums text-xs opacity-80">{counts[f.id]}</span>
          </button>
        )
      })}
    </div>
  )
}
