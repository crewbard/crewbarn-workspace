import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * The office drawer — everything physically on hand, and the deposits that
 * empty it.
 *
 * This is the middle of the custody chain. Money arrives here two ways: a
 * tech's till is counted in, or the office takes it directly at the counter
 * or out of the post. It leaves one way, as a numbered deposit — which
 * matters because a deposit is ONE line on a bank statement, and matching
 * individual payments against a lumped line is what made reconciliation
 * guesswork.
 *
 * White rather than the concept's dark slab, with the figures in green: this
 * is money you are holding, and a black panel reads as a chart.
 */

interface DrawerItem {
  id: string
  amount_cents: number
  payment_method: string | null
  reference: string | null
  customer_name: string | null
  work_order_id: string | null
  received_at: string | null
  days_held: number | null
}

interface DrawerMeta {
  total_cents: number
  cash_cents: number
  check_cents: number
  count: number
  oldest_days: number
}

interface DepositRow {
  id: string
  number: number
  label: string
  deposited_on: string
  bank_account_label: string | null
  reference: string | null
  total_cents: number
  item_count: number
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function ageLabel(days: number | null): string {
  if (days === null) return ''
  if (days === 0) return 'Today'
  return `${days} day${days === 1 ? '' : 's'}`
}

export function OfficeDrawer() {
  const qc = useQueryClient()
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [justDeposited, setJustDeposited] = useState<DepositRow | null>(null)
  const [cutoff, setCutoff] = useState('')

  const drawer = useQuery({
    queryKey: ['drawer'],
    queryFn: () => apiRequest<{ data: DrawerItem[]; meta: DrawerMeta }>('/v1/cash-drawer'),
  })
  const deposits = useQuery({
    queryKey: ['drawer', 'deposits'],
    queryFn: () => apiRequest<{ data: DepositRow[] }>('/v1/cash-drawer/deposits?limit=10'),
  })

  const items = drawer.data?.data ?? []
  const meta = drawer.data?.meta
  const chosen = useMemo(() => items.filter((i) => picked[i.id]), [items, picked])
  const chosenTotal = chosen.reduce((n, i) => n + i.amount_cents, 0)
  const allPicked = items.length > 0 && chosen.length === items.length

  const deposit = useMutation({
    mutationFn: () =>
      apiRequest<{ data: DepositRow }>('/v1/cash-drawer/deposits', {
        method: 'POST',
        body: { payment_ids: chosen.map((i) => i.id) },
      }),
    onSuccess: (r) => {
      setError(null)
      setPicked({})
      setJustDeposited(r.data)
      void qc.invalidateQueries({ queryKey: ['drawer'] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not record that deposit.'),
  })

  // Undo rather than a confirm dialog: the slip was wrong, or it never went to
  // the bank. Items go back to the drawer; the money is not deleted.
  const undo = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/v1/cash-drawer/deposits/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setJustDeposited(null)
      void qc.invalidateQueries({ queryKey: ['drawer'] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not undo that deposit.'),
  })

  // Money sitting for months isn't really in a drawer — it's history the
  // backfill had to guess at, because "received" used to be the end of the
  // trail. Offer to bank it, but only when there's evidence of the problem.
  const STALE_DAYS = 60
  const stale = items.filter((i) => (i.days_held ?? 0) > STALE_DAYS)
  const staleTotal = stale.reduce((n, i) => n + i.amount_cents, 0)

  const openingBalance = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { created: boolean; label?: string; item_count?: number } }>(
        '/v1/cash-drawer/opening-balance',
        { method: 'POST', body: { before: cutoff } },
      ),
    onSuccess: () => {
      setError(null)
      setCutoff('')
      void qc.invalidateQueries({ queryKey: ['drawer'] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not record that.'),
  })

  return (
    <div className="mt-5">
      {stale.length > 0 && (
        <div className="mb-4 rounded-[13px] border-l-4 border-[#E8902C] border-y border-r border-slate-200 bg-white p-5">
          <p className="text-[14px] font-bold text-[#0A1220]">
            {stale.length} item{stale.length === 1 ? '' : 's'} here {stale.length === 1 ? 'is' : 'are'}{' '}
            more than {STALE_DAYS} days old
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
            That's <span className="tnum font-semibold">{money(staleTotal)}</span> the drawer says
            you're holding. Custody tracking only started recently, so everything received before
            then was assumed to still be on hand — almost all of it was banked long ago. Pick the
            date tracking became real for you and CrewBarn will file everything older as one
            deposit, marked as banked beforehand.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-[12.5px] text-slate-600">
              Everything received before
              <input
                type="date"
                value={cutoff}
                onChange={(e) => setCutoff(e.target.value)}
                className="tnum ml-2 rounded-md border border-slate-300 px-2 py-1 text-[12.5px]"
              />
            </label>
            <button
              type="button"
              disabled={!cutoff || openingBalance.isPending}
              onClick={() => openingBalance.mutate()}
              className="rounded-lg bg-[#0F1A2E] px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
            >
              {openingBalance.isPending ? 'Filing…' : 'File as already banked'}
            </button>
            <span className="text-[12px] text-slate-500">
              Creates a normal deposit — undo it below if the date was wrong.
            </span>
          </div>
        </div>
      )}
      {justDeposited && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[13px] border border-[#A7D9B8] bg-[#EFF7F1] px-5 py-3.5">
          <span className="flex-1 text-[13.5px] font-bold text-[#166534]">
            {justDeposited.label} recorded — {money(justDeposited.total_cents)} across{' '}
            {justDeposited.item_count} item{justDeposited.item_count === 1 ? '' : 's'}. Look for
            that one line on the statement.
          </span>
          <button
            type="button"
            onClick={() => undo.mutate(justDeposited.id)}
            disabled={undo.isPending}
            className="rounded-md border border-[#A7D9B8] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#166534] disabled:opacity-50"
          >
            {undo.isPending ? 'Undoing…' : 'Undo'}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-[11px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-[13px] border border-slate-200 bg-white p-6">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500">
            In the drawer right now
          </p>
          <p className="tnum mt-1 text-[34px] font-extrabold leading-none text-[#166534]">
            {money(meta?.total_cents ?? 0)}
          </p>
          <p className="mt-1.5 text-[12.5px] text-slate-500">
            {meta?.count ?? 0} item{(meta?.count ?? 0) === 1 ? '' : 's'}
            {(meta?.oldest_days ?? 0) > 0 &&
              ` · oldest has been sitting ${meta!.oldest_days} day${meta!.oldest_days === 1 ? '' : 's'}`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-lg border border-slate-200 px-4 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cash</p>
              <p className="tnum text-[17px] font-bold text-[#166534]">
                {money(meta?.cash_cents ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 px-4 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Checks</p>
              <p className="tnum text-[17px] font-bold text-[#166534]">
                {money(meta?.check_cents ?? 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[13px] border border-slate-200 bg-white p-5">
          <p className="text-[14px] font-bold text-[#0A1220]">Add money to the drawer</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
            Anything physical that lands in the office — a net-30 check in the mail, a customer
            paying at the counter.
          </p>
          <Link
            to="/accounting/invoices"
            className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-[13.5px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Take a payment on an invoice
            <span className="text-slate-400">›</span>
          </Link>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] leading-relaxed text-slate-500">
            Card and ACH never touch the drawer — they settle straight to the bank. Only cash and
            checks sit here.
          </p>
        </div>
      </div>

      {/* waiting to be deposited */}
      <div className="mt-4 overflow-hidden rounded-[13px] border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
          <span className="text-[14px] font-extrabold text-[#0A1220]">Waiting to be deposited</span>
          <span className="flex-1 text-[12.5px] text-slate-500">
            Tick what you're physically walking to the bank
          </span>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setPicked(allPicked ? {} : Object.fromEntries(items.map((i) => [i.id, true])))
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-600 hover:bg-slate-50"
            >
              {allPicked ? 'Clear' : 'Select all'}
            </button>
          )}
        </div>

        {drawer.isLoading && <p className="px-5 pb-4 text-sm text-slate-500">Opening the drawer…</p>}

        {!drawer.isLoading && items.length === 0 && (
          <p className="border-t border-slate-100 px-5 py-6 text-[13.5px] text-slate-500">
            The drawer is empty. Money appears here when a till is counted in, or when the office
            takes cash or a check directly.
          </p>
        )}

        {items.map((i) => {
          const on = !!picked[i.id]
          // Where it came from. A payment tied to a job came off a truck; one
          // without is a counter payment or something out of the post.
          const source = i.work_order_id ? 'JOB' : 'OFFICE'
          return (
            <label
              key={i.id}
              className="flex cursor-pointer flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-3.5"
              style={{ background: on ? '#FFFCF7' : '#fff' }}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() =>
                  setPicked((p) => {
                    const next = { ...p }
                    if (next[i.id]) delete next[i.id]
                    else next[i.id] = true
                    return next
                  })
                }
                className="h-4 w-4 shrink-0 accent-[#E8902C]"
              />
              <span
                className="shrink-0 rounded px-2 py-0.5 text-[10px] font-extrabold tracking-wide"
                style={
                  source === 'JOB'
                    ? { background: '#FDF3E4', color: '#86521A' }
                    : { background: '#E7F5EC', color: '#166534' }
                }
              >
                {source}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-bold text-[#0A1220]">
                  {i.customer_name ?? 'Payment'}
                </span>
                {i.reference && (
                  <span className="block truncate text-[12px] text-slate-500">
                    {i.payment_method === 'check' ? `check #${i.reference}` : i.reference}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[12.5px] capitalize text-slate-500">
                {i.payment_method}
              </span>
              <span className="w-16 shrink-0 text-right text-[12.5px] text-slate-500">
                {ageLabel(i.days_held)}
              </span>
              <span className="tnum w-24 shrink-0 text-right text-[14px] font-bold text-[#0A1220]">
                {money(i.amount_cents)}
              </span>
            </label>
          )
        })}

        {chosen.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
            <span className="text-[13px] font-semibold text-slate-600">
              {chosen.length} selected · <span className="tnum">{money(chosenTotal)}</span>
            </span>
            <button
              type="button"
              disabled={deposit.isPending}
              onClick={() => deposit.mutate()}
              className="rounded-lg bg-[#E8902C] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
            >
              {deposit.isPending ? 'Recording…' : `Deposit ${money(chosenTotal)}`}
            </button>
          </div>
        )}
      </div>

      {/* deposits */}
      <div className="mt-4 overflow-hidden rounded-[13px] border border-slate-200 bg-white">
        <div className="flex flex-wrap items-baseline gap-2 px-5 py-3.5">
          <span className="text-[14px] font-extrabold text-[#0A1220]">Deposits</span>
          <span className="text-[12.5px] text-slate-500">
            Each one is a single line on the bank statement — that's what makes reconciling
            possible
          </span>
        </div>

        {(deposits.data?.data?.length ?? 0) === 0 && (
          <p className="border-t border-slate-100 px-5 py-6 text-[13.5px] text-slate-500">
            No deposits recorded yet.
          </p>
        )}

        {(deposits.data?.data ?? []).map((d) => (
          <div
            key={d.id}
            className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-3.5"
          >
            <span className="w-16 shrink-0 text-[12.5px] text-slate-500">
              {new Date(d.deposited_on).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <span className="min-w-0 flex-1 text-[13.5px] font-bold text-[#0A1220]">
              {d.label}
              {d.bank_account_label && (
                <span className="font-normal text-slate-500"> — {d.bank_account_label}</span>
              )}
            </span>
            <span className="shrink-0 text-[12.5px] text-slate-500">
              {d.item_count} item{d.item_count === 1 ? '' : 's'}
            </span>
            <span className="tnum w-24 shrink-0 text-right text-[14px] font-bold text-[#0A1220]">
              {money(d.total_cents)}
            </span>
            <button
              type="button"
              onClick={() => undo.mutate(d.id)}
              disabled={undo.isPending}
              className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Undo
            </button>
          </div>
        ))}
      </div>

      {/* The concept shows Matched / Not on statement here. Not built: nothing
          ties a deposit to a bank_transactions row yet, and a green "Matched"
          badge that means nothing is worse on this page than no badge. */}
      <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
        Matching a deposit against the bank statement isn't wired up yet — deposits are recorded
        here, but bank reconciliation still works payment by payment.
      </p>
    </div>
  )
}
