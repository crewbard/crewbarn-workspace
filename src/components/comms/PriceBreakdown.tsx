import { formatPricingAmount, formatPricingPercent, getPricingBreakdown, pricingBreakdownLabels, pricingShare, type PricingSuggestion } from '@/lib/intakePricing'

const styles = {
  materials: { bar: 'bg-sky-500', dot: 'bg-sky-500', tint: 'bg-sky-50' },
  labor: { bar: 'bg-indigo-500', dot: 'bg-indigo-500', tint: 'bg-indigo-50' },
  overhead: { bar: 'bg-violet-500', dot: 'bg-violet-500', tint: 'bg-violet-50' },
  insurance: { bar: 'bg-amber-500', dot: 'bg-amber-500', tint: 'bg-amber-50' },
  profit: { bar: 'bg-emerald-500', dot: 'bg-emerald-500', tint: 'bg-emerald-50' },
  growth: { bar: 'bg-teal-600', dot: 'bg-teal-600', tint: 'bg-teal-50' },
}
const explanations = {
  materials: 'Parts and supplies for this job.',
  labor: 'This job’s share of payroll and owner pay.',
  overhead: 'This job’s share of running the business.',
  insurance: 'Company-paid premiums recorded separately from payroll.',
  profit: 'The planned amount remaining after costs and growth.',
  growth: 'The planned share for investing in the business.',
}

export function PriceBreakdown({ pricing }: { pricing: PricingSuggestion }) {
  const breakdown = getPricingBreakdown(pricing)
  if (!breakdown) return null
  const complete = breakdown.status === 'complete'
  const amount = (cents: number | null) => cents === null ? 'Needs review' : formatPricingAmount(cents, pricing.currency)
  return <section aria-label="Price breakdown" className="mt-4 overflow-hidden rounded-xl border border-slate-200">
    <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-navy-900">Where the price goes</h4>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${complete ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{complete ? 'Six parts, one price' : 'Needs review'}</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">Cover the work, support the business, and leave room to grow.</p>
    </div>
    <div className="p-4">
      {complete && breakdown.price_total_cents !== null && breakdown.price_total_cents > 0 && <div aria-hidden="true" className="mb-4 flex h-3 overflow-hidden rounded-full bg-slate-100">{breakdown.rows.map(row => <span key={row.key} className={styles[row.key].bar} style={{ width: `${pricingShare(row.amount_cents, breakdown.price_total_cents) ?? 0}%` }} />)}</div>}
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {breakdown.rows.map(row => <div key={row.key} className={`rounded-lg p-3 ${styles[row.key].tint}`}>
          <dt className="flex items-center gap-2 text-xs font-medium text-slate-700"><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${styles[row.key].dot}`} />{pricingBreakdownLabels[row.key]}</dt>
          <dd className="mt-1 break-words text-lg font-semibold tabular-nums text-slate-900">{amount(row.amount_cents)}</dd>
          <dd className="mt-1 text-xs leading-relaxed text-slate-600">{explanations[row.key]}</dd>
          {complete && pricingShare(row.amount_cents, breakdown.price_total_cents) !== null && <dd className="mt-2 text-xs text-slate-600">{formatPricingPercent(pricingShare(row.amount_cents, breakdown.price_total_cents))} of price</dd>}
        </div>)}
      </dl>
      <dl className="mt-4 space-y-2 border-t border-slate-200 pt-3">
        <div className="flex flex-wrap justify-between gap-2"><dt className="text-slate-600">Cost subtotal <span className="text-xs">(first four parts)</span></dt><dd className="font-semibold tabular-nums">{amount(breakdown.cost_total_cents)}</dd></div>
        <div className="flex flex-wrap justify-between gap-2"><dt className="font-semibold text-navy-900">Recommended price <span className="text-xs font-normal">before tax</span></dt><dd className="text-lg font-bold tabular-nums text-navy-900">{amount(breakdown.price_total_cents)}</dd></div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-slate-600">Insurance already included in payroll or other costs stays in that category. It is never added a second time. These are planned amounts; no money is moved.</p>
      {!complete && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Some costs still need confirmation. Missing amounts are marked Needs review; confirm them before preparing an estimate.</p>}
      <details className="mt-3 text-xs text-slate-600">
        <summary className="cursor-pointer rounded py-1 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">How these amounts are calculated</summary>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div><dt>Time for this job</dt><dd className="font-medium">{breakdown.labor_hours === null ? 'Needs review' : `${breakdown.labor_hours} hours`}</dd></div>
          <div><dt>Company billable time per month</dt><dd className="font-medium">{breakdown.monthly_billable_hours === null ? 'Needs review' : `${breakdown.monthly_billable_hours} hours`}</dd></div>
        </dl>
        <p className="mt-2 leading-relaxed">Profit is the planned amount left after the other five parts. It may be above the company’s profit target. Growth is set aside as a share of the final price.</p>
        {breakdown.rows.filter(row => row.target_percent != null).map(row => <p className="mt-1" key={row.key}>{pricingBreakdownLabels[row.key]} target: {formatPricingPercent(row.target_percent ?? null)} of price</p>)}
        {breakdown.notes.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4">{breakdown.notes.map((note, i) => <li key={i}>{note}</li>)}</ul>}
      </details>
    </div>
  </section>
}
