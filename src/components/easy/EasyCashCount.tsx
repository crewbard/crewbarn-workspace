import { useState } from 'react'

export const CASH_DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 200, 100, 25, 10, 5, 1]
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

export function cashCountTotal(counts: Record<number, number>) {
  return CASH_DENOMINATIONS.reduce((sum, cents) => {
    const count = counts[cents] ?? 0
    return sum + (Number.isInteger(count) && count >= 0 && count <= 999999 ? count * cents : 0)
  }, 0)
}

/** Local scratchpad only: no payment mutations, persisted balances or close action. */
export function EasyCashCount() {
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [expected, setExpected] = useState('')
  const total = cashCountTotal(counts)
  const expectedCents = /^\d+(\.\d{1,2})?$/.test(expected) && Number(expected) <= 999999999
    ? Math.round(Number(expected) * 100) : null
  const difference = expectedCents === null ? null : total - expectedCents
  const change = (cents: number, value: number) => setCounts(previous => ({ ...previous, [cents]: Math.max(0, Math.min(999999, Math.trunc(value) || 0)) }))
  return <section data-easy-cash-count aria-label="Cash count helper" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="text-lg font-semibold">Count the cash in front of you</h2>
    <p className="mt-1 text-sm text-slate-500">USD bills and coins only—not checks or cards. This unsaved helper clears when you leave; it does not receive payments or close a drawer.</p>
    <div data-easy-cash-grid className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {CASH_DENOMINATIONS.map(cents => <div key={cents} className="rounded-lg border border-slate-200 p-3">
        <label htmlFor={`cash-count-${cents}`} className="text-sm font-semibold">{money(cents)}</label>
        <div className="mt-2 flex items-center gap-2">
          <button type="button" aria-label={`Remove one ${money(cents)}`} disabled={!counts[cents]} onClick={() => change(cents, (counts[cents] ?? 0) - 1)} className="rounded border px-3 py-2 disabled:opacity-40">−</button>
          <input id={`cash-count-${cents}`} type="number" inputMode="numeric" min={0} max={999999} step={1} value={counts[cents] ?? 0} onChange={event => change(cents, Number(event.target.value))} className="min-w-0 w-full rounded border border-slate-300 px-2 py-2 text-center" />
          <button type="button" aria-label={`Add one ${money(cents)}`} disabled={counts[cents] === 999999} onClick={() => change(cents, (counts[cents] ?? 0) + 1)} className="rounded border px-3 py-2 disabled:opacity-40">+</button>
        </div>
      </div>)}
    </div>
    <div className="mt-5 flex flex-wrap items-end gap-5">
      <label className="text-sm">Expected physical cash (USD)<input type="text" inputMode="decimal" value={expected} onChange={event => setExpected(event.target.value)} placeholder="Enter your expected amount" className="mt-1 block rounded border border-slate-300 px-3 py-2" /></label>
      <p className="text-lg font-semibold">Counted: {money(total)}</p>
      <p role="status" className="text-sm">{difference === null ? expected ? 'Enter a valid expected amount with up to two decimals.' : 'Enter an expected amount to compare.' : difference === 0 ? 'Count matches your entered amount.' : `${money(Math.abs(difference))} ${difference < 0 ? 'short' : 'over'} your entered amount.`}</p>
    </div>
  </section>
}
