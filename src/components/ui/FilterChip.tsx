import '@/components/inventory/bins/bins.css'

/**
 * A rounded filter chip with a count: Inventory > Stock (All, Low, Out, Held
 * for jobs) and the Product catalog's quick filters. Colours are the bins.css
 * theme roles, so the picked chip follows the tenant accent on every theme.
 * Must sit inside a [data-bins-ui] element.
 */
export function FilterChip({
  chip,
  active,
  onClick,
  label,
  count,
}: {
  chip: string
  active: boolean
  onClick: () => void
  label: string
  count?: number | null
}) {
  return (
    <button
      type="button"
      data-chip={chip}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[13px] font-medium ${active ? 'border-[var(--bins-accent)] bg-[var(--bins-accent-soft)] text-[var(--bins-accent-ink)]' : 'border-[var(--bins-border)] bg-[var(--bins-surface)] text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]'}`}
    >
      {label}
      {count != null && <> <span className="tabular-nums">{count}</span></>}
    </button>
  )
}
