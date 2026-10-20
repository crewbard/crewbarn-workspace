import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import '@/components/inventory/bins/bins.css'
import { PriceBreakdown } from '@/components/comms/PriceBreakdown'
import { formatPricingAmount } from '@/lib/intakePricing'
import { linePriceFor, suggestPrice, type PriceSuggestion } from '@/lib/priceSuggest'

/**
 * "Suggest price" on an estimate line (pricing plan part 1, step 3).
 *
 * Asks for the hours of work, then shows what the company's own costs say
 * this line should cost as a whole job: its parts plus that much work, at the
 * target margin and minimums. "Use this price" fills the line's unit price;
 * the estimate is only saved when the person saves it. People who can see
 * company costs also get where the money goes.
 * Colours are the bins.css theme roles; renders inside [data-bins-ui].
 */
export function SuggestPriceButton({ catalogItemId, description, quantity, disabled, onUse }: {
  catalogItemId: string | null | undefined
  description: string
  quantity: number
  disabled?: boolean
  onUse: (unitPriceCents: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [hours, setHours] = useState('1')
  const [afterHours, setAfterHours] = useState(false)
  const run = useMutation({
    mutationFn: () => suggestPrice({
      items: [{ catalog_item_id: catalogItemId ?? null, description, quantity }],
      labor_hours: Number(hours) > 0 ? Number(hours) : null,
      after_hours: afterHours,
    }),
  })
  const result: PriceSuggestion | undefined = run.data
  const total = result?.suggested_total_cents ?? null
  const plan = total !== null ? linePriceFor(total, quantity) : null
  const unit = plan?.unitCents ?? null
  const ready = result?.status === 'ready_for_review' && unit !== null

  if (!catalogItemId) return null

  return (
    <span className="relative inline-flex" data-bins-ui>
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} title="Suggest a price from your costs" aria-expanded={open}
        className="rounded border border-[var(--bins-border)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--bins-accent-ink)] hover:bg-[var(--bins-accent-soft)] disabled:opacity-40">
        Suggest
      </button>
      {open && (
        <div role="dialog" aria-label="Suggest price" className="absolute right-0 top-7 z-30 w-[22rem] rounded-xl border border-[var(--bins-border)] bg-[var(--bins-surface)] p-3 text-left shadow-lg">
          <div className="text-sm font-semibold text-[var(--bins-text)]">Suggest price</div>
          <p className="mt-0.5 text-xs text-[var(--bins-text-2)]">This line as a whole job: {quantity} × {description || 'item'} plus the hours of work below, priced from your company's costs.</p>
          <div className="mt-2 flex items-end gap-3">
            <label className="text-xs text-[var(--bins-text-2)]">Hours of work
              <input type="number" min="0" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)}
                className="mt-0.5 block w-20 rounded-md border border-[var(--bins-border)] bg-[var(--bins-surface)] px-2 py-1 text-right text-sm tabular-nums text-[var(--bins-text)]" />
            </label>
            <label className="flex items-center gap-1.5 pb-1 text-xs text-[var(--bins-text-2)]">
              <input type="checkbox" checked={afterHours} onChange={(e) => setAfterHours(e.target.checked)} /> After hours
            </label>
            <button type="button" onClick={() => run.mutate()} disabled={run.isPending}
              className="ml-auto rounded-md bg-[var(--bins-accent)] px-3 py-1.5 text-sm font-semibold text-[var(--bins-surface)] hover:bg-[var(--bins-accent-strong)] disabled:opacity-50">
              {run.isPending ? 'Working...' : 'Suggest'}
            </button>
          </div>
          {run.isError && <p className="mt-2 text-xs text-[var(--color-danger)]">Could not suggest a price. You may not have access to pricing.</p>}
          {result && (
            <div className="mt-3 border-t border-[var(--bins-border-soft)] pt-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-[var(--bins-muted)]">{ready ? 'Suggested, before tax' : 'Needs review'}</span>
                <span className="text-lg font-semibold tabular-nums text-[var(--bins-text)]">{formatPricingAmount(total, result.currency)}</span>
              </div>
              {ready && plan && quantity !== 1 && (
                <div className="text-right text-xs text-[var(--bins-muted)]">
                  {formatPricingAmount(plan.unitCents, result.currency)} each × {quantity} = {formatPricingAmount(plan.lineCents, result.currency)}
                  {plan.remainderCents > 0 && <span className="block">{formatPricingAmount(plan.remainderCents, result.currency)} under the suggestion so the line never goes over</span>}
                </div>
              )}
              {result.catalog_total_cents !== null && <div className="text-xs text-[var(--bins-muted)]">Catalog price: {formatPricingAmount(result.catalog_total_cents, result.currency)}</div>}
              {[...result.questions, ...result.warnings.filter((w) => !w.startsWith('Suggested prices exclude tax'))].map((line) => (
                <p key={line} className="mt-1 text-xs text-[var(--bins-text-2)]">{line}</p>
              ))}
              {result.costs_visible ? <PriceBreakdown pricing={result} />
                : <p className="mt-1 text-xs text-[var(--bins-muted)]">Based on your company's costs. Where the money goes is shown to people who can see revenue.</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--bins-border)] px-3 py-1.5 text-sm text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]">Close</button>
                <button type="button" disabled={!ready} onClick={() => { if (unit !== null) { onUse(unit); setOpen(false) } }}
                  className="rounded-md bg-[var(--bins-accent)] px-3 py-1.5 text-sm font-semibold text-[var(--bins-surface)] hover:bg-[var(--bins-accent-strong)] disabled:opacity-40">
                  Use this price
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </span>
  )
}