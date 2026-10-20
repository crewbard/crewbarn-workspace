import { useState } from 'react'
import '@/components/inventory/bins/bins.css'
import { FilterChip } from '@/components/ui/FilterChip'
import { useBulkSetPrice, useUpdateCatalogItem } from '@/hooks/useCatalogItems'
import type { UndoToastState } from '@/hooks/useUndoToast'

/**
 * The bar that appears once products are ticked on the Product catalog list:
 * price them all as a markup over each one's own cost, in one save. Products
 * with no cost are left alone and counted. Undo puts every old price back.
 */
export function BulkPriceBar({ picked, onClear, onToast }: {
  picked: string[]
  onClear: () => void
  onToast: (t: UndoToastState) => void
}) {
  const [markup, setMarkup] = useState('40')
  const [rounding, setRounding] = useState<'nearest_cent' | 'up_to_dollar'>('nearest_cent')
  const [error, setError] = useState<string | null>(null)
  const bulk = useBulkSetPrice()
  const update = useUpdateCatalogItem()
  const pct = parseFloat(markup)
  const valid = Number.isFinite(pct) && pct >= 0 && pct <= 10000

  async function apply() {
    if (!valid) return
    setError(null)
    try {
      const res = await bulk.mutateAsync({ items: picked, markup_percent: pct, rounding })
      const skipped = res.skipped.length ? `; ${res.skipped.length} with no cost left alone` : ''
      onToast({
        text: `Priced ${res.changed.length} at cost + ${pct}%${skipped}`,
        undo: res.changed.length
          ? () => {
              void Promise.all(res.changed.map((c) => update.mutateAsync({ id: c.id, input: { customer_cost_cents: c.previous_customer_cost_cents } })))
                .then(() => onToast({ text: 'Prices put back' }))
                .catch(() => onToast({ text: "Couldn't put every price back" }))
            }
          : undefined,
      })
      onClear()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prices not saved')
    }
  }

  return (
    <div data-bins-ui data-tour="prod-bulk-price" className="sticky bottom-3 z-20 mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--bins-accent)] bg-[var(--bins-surface)] px-4 py-3 shadow-lg">
      <span className="text-sm font-semibold text-[var(--bins-text)]">{picked.length} picked</span>
      <label className="flex items-center gap-2 text-sm text-[var(--bins-text-2)]">
        Price = cost +
        <input
          aria-label="Markup over cost, percent"
          inputMode="decimal"
          value={markup}
          onChange={(e) => setMarkup(e.target.value)}
          className={`w-16 rounded-md border px-2 py-1 text-right text-sm bg-[var(--bins-surface)] text-[var(--bins-text)] ${valid ? 'border-[var(--bins-border)]' : 'border-[var(--color-danger)]'}`}
        />
        %
      </label>
      <div className="flex items-center gap-1.5">
        <FilterChip chip="nearest_cent" label="To the cent" active={rounding === 'nearest_cent'} onClick={() => setRounding('nearest_cent')} />
        <FilterChip chip="up_to_dollar" label="Up to the dollar" active={rounding === 'up_to_dollar'} onClick={() => setRounding('up_to_dollar')} />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {error && <span className="text-sm text-[var(--color-danger)]">{error}</span>}
        <button type="button" onClick={onClear} className="rounded-md px-3 py-1.5 text-sm text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]">Clear</button>
        <button
          type="button"
          data-tour="prod-bulk-apply"
          disabled={!valid || bulk.isPending}
          onClick={() => void apply()}
          className="rounded-md bg-[var(--bins-accent)] px-3 py-1.5 text-sm font-semibold text-[var(--bins-surface)] hover:bg-[var(--bins-accent-strong)] disabled:opacity-50"
        >
          {bulk.isPending ? 'Saving…' : 'Set prices'}
        </button>
      </div>
    </div>
  )
}
