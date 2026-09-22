import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * /accounting/card-processor — every card transaction GoDaddy reported,
 * and what CrewBarn did with it.
 *
 * A bank feed for the processor. Most rows match themselves (portal
 * payments, terminal pushes, field links, app matches all carry the
 * transaction id). What's left is money that went through GoDaddy without
 * CrewBarn seeing it — a tap in their app nobody matched, a phone order on
 * the virtual terminal — and that's the queue: attach it to an invoice,
 * put it on a customer's account, or say it isn't yours.
 */

type State = 'unmatched' | 'matched' | 'ignored' | 'reversal'

interface Tx {
  id: string
  external_id: string
  parent_external_id: string | null
  action: string | null
  status: string | null
  amount_cents: number
  tip_cents: number
  fee_cents: number | null
  card_brand: string | null
  card_last4: string | null
  source_device: string | null
  occurred_at: string | null
  match_state: State
  payment_id: string | null
  payment: { id: string; status: string; refunded_at: string | null; method: string } | null
  matched_at: string | null
  ignored_at: string | null
  ignored_reason: string | null
  is_captured_sale: boolean
}

interface ListResponse {
  data: Tx[]
  counts: Record<State, { n: number; cents: number }>
  synced_at: string | null
  sync_error: string | null
  connected: boolean
}

interface Suggestion {
  invoice_id: string
  invoice_number: string
  customer_id: string
  customer_name: string | null
  balance_due_cents: number
  issued_at: string | null
  exact: boolean
}

const money = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—')

const STATE_LABEL: Record<State, string> = { unmatched: 'Needs matching', matched: 'Matched', ignored: 'Ignored', reversal: 'Refunds & voids' }

export function ProcessorTransactionsPage() {
  const qc = useQueryClient()
  const [state, setState] = useState<State>('unmatched')
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const list = useQuery({
    queryKey: ['processor-transactions', state],
    queryFn: () => apiRequest<ListResponse>(`/v1/processor-transactions?state=${state}`),
  })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['processor-transactions'] })

  const sync = useMutation({
    mutationFn: () => apiRequest<{ data: { imported: number; updated: number; matched: number; reversals: number; error: string | null } }>('/v1/processor-transactions/sync', { method: 'POST' }),
    onSuccess: (r) => { setError(r.data.error); invalidate() },
    onError: (e: Error) => setError(e.message),
  })

  const d = list.data
  const counts = d?.counts

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link to="/accounting" className="text-sm font-medium text-amber-700 hover:underline">← Accounting</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Card processor</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Every card transaction on your GoDaddy Payments account. Most match themselves; what's left went through
            GoDaddy without CrewBarn seeing it — attach it to an invoice, or say it isn't yours.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <button
            type="button"
            onClick={() => sync.mutate()}
            disabled={sync.isPending || !d?.connected}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {sync.isPending ? 'Syncing…' : 'Sync now'}
          </button>
          <div className="mt-1.5">{d?.synced_at ? `Last synced ${when(d.synced_at)} · runs hourly` : d?.connected ? 'Never synced' : 'GoDaddy Payments not connected'}</div>
        </div>
      </div>

      {(error || d?.sync_error) && (
        <div className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error ?? d?.sync_error}</div>
      )}

      {/* State strip — the counts are the filter */}
      <div className="mt-6 flex flex-wrap gap-2">
        {(['unmatched', 'matched', 'reversal', 'ignored'] as State[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setState(s); setOpen(null) }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${state === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            {STATE_LABEL[s]} · {counts?.[s]?.n ?? 0}
            {s === 'unmatched' && (counts?.unmatched?.cents ?? 0) > 0 && <span className="ml-1 opacity-70">({money(counts!.unmatched.cents)})</span>}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
      ) : !d || d.data.length === 0 ? (
        <div className="mt-6 rounded-xl border-2 border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
          {state === 'unmatched' ? 'Nothing waiting. Every GoDaddy transaction is accounted for.' : `No ${STATE_LABEL[state].toLowerCase()} transactions.`}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Card</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">{state === 'matched' ? 'Payment' : state === 'ignored' ? 'Reason' : 'Source'}</th>
                <th className="px-4 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.data.map((t) => (
                <Row key={t.id} t={t} state={state} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} onChanged={() => { invalidate(); setOpen(null) }} onError={setError} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Row({ t, state, open, onToggle, onChanged, onError }: { t: Tx; state: State; open: boolean; onToggle: () => void; onChanged: () => void; onError: (m: string) => void }) {
  return (
    <>
      <tr className={open ? 'bg-amber-50/40' : ''}>
        <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{when(t.occurred_at)}</td>
        <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
          {t.action === 'REFUND' || t.action === 'VOID' ? '−' : ''}{money(t.amount_cents)}
          {t.tip_cents > 0 && <span className="ml-1 text-xs font-normal text-slate-400">incl. {money(t.tip_cents)} tip</span>}
        </td>
        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{[t.card_brand, t.card_last4 ? `•••• ${t.card_last4}` : null].filter(Boolean).join(' ') || '—'}</td>
        <td className="whitespace-nowrap px-4 py-2.5">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{t.action ?? '?'}</span>
          {t.status && t.status !== 'CAPTURED' && <span className="ml-1 text-[11px] text-slate-400">{t.status}</span>}
        </td>
        <td className="max-w-[16rem] truncate px-4 py-2.5 text-xs text-slate-500">
          {state === 'matched' && t.payment ? (
            <Link to="/accounting/cash-drawer" className="text-amber-700 hover:underline">
              {t.payment.method} · {t.payment.refunded_at ? 'refunded' : t.payment.status}
            </Link>
          ) : state === 'ignored' ? (t.ignored_reason ?? '—') : (t.source_device ?? '—')}
        </td>
        <td className="whitespace-nowrap px-4 py-2.5 text-right">
          {state === 'unmatched' && t.is_captured_sale && (
            <button type="button" onClick={onToggle} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-amber-300 hover:bg-amber-50">
              {open ? 'Close' : 'Match…'}
            </button>
          )}
          {state === 'ignored' && <UnignoreButton id={t.id} onChanged={onChanged} onError={onError} />}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="bg-amber-50/40 px-4 pb-4 pt-1">
            <MatchPanel t={t} onChanged={onChanged} onError={onError} />
          </td>
        </tr>
      )}
    </>
  )
}

function MatchPanel({ t, onChanged, onError }: { t: Tx; onChanged: () => void; onError: (m: string) => void }) {
  const sugg = useQuery({
    queryKey: ['processor-transactions', 'suggestions', t.id],
    queryFn: () => apiRequest<{ data: Suggestion[] }>(`/v1/processor-transactions/${t.id}/suggestions`),
  })
  const [search, setSearch] = useState('')
  const found = useQuery({
    queryKey: ['processor-transactions', 'invoice-search', search],
    queryFn: () => apiRequest<{ data: Array<{ id: string; invoice_number: string; customer?: { display_name?: string }; money: { balance_due_cents: number } }> }>(`/v1/invoices?balance=open&q=${encodeURIComponent(search)}&per_page=8`),
    enabled: search.trim().length >= 2,
  })
  const [overflow, setOverflow] = useState<'credit' | 'tip'>('credit')
  const [reason, setReason] = useState('')

  const match = useMutation({
    mutationFn: (body: { invoice_id?: string; customer_id?: string }) =>
      apiRequest(`/v1/processor-transactions/${t.id}/match`, { method: 'POST', body: { ...body, overflow } }),
    onSuccess: onChanged,
    onError: (e: Error) => onError(e.message),
  })
  const ignore = useMutation({
    mutationFn: () => apiRequest(`/v1/processor-transactions/${t.id}/ignore`, { method: 'POST', body: { reason: reason.trim() || null } }),
    onSuccess: onChanged,
    onError: (e: Error) => onError(e.message),
  })

  const candidates = (found.data?.data ?? []).map((i) => ({
    invoice_id: i.id,
    invoice_number: i.invoice_number,
    customer_name: i.customer?.display_name ?? null,
    balance_due_cents: i.money.balance_due_cents,
    exact: i.money.balance_due_cents === t.amount_cents,
  }))
  const rows = search.trim().length >= 2 ? candidates : (sugg.data?.data ?? [])

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Attach {money(t.amount_cents)} to</div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoice # or customer…"
          className="mt-1.5 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
        />
        <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
          {rows.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">{sugg.isLoading || found.isLoading ? 'Looking…' : 'No open invoices match. Search, or put it on a customer account.'}</li>
          ) : rows.map((s) => {
            const over = t.amount_cents - s.balance_due_cents
            return (
              <li key={s.invoice_id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0 text-sm">
                  <span className="font-mono font-semibold text-slate-900">#{s.invoice_number}</span>
                  <span className="ml-2 text-slate-700">{s.customer_name ?? '—'}</span>
                  <span className="ml-2 text-xs text-slate-500">{money(s.balance_due_cents)} due{over > 0 ? ` · ${money(over)} over` : ''}</span>
                  {s.exact && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">exact</span>}
                </div>
                <button
                  type="button"
                  disabled={match.isPending}
                  onClick={() => match.mutate({ invoice_id: s.invoice_id })}
                  className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Match
                </button>
              </li>
            )
          })}
        </ul>
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          If the card paid more than the invoice, treat the extra as
          <select value={overflow} onChange={(e) => setOverflow(e.target.value as 'credit' | 'tip')} className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs">
            <option value="credit">customer credit</option>
            <option value="tip">a tip</option>
          </select>
        </label>
      </div>
      <div className="space-y-2 border-l border-slate-200 pl-4">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Or</div>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional) — test, not ours, already recorded…"
          className="block w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
        />
        <button
          type="button"
          disabled={ignore.isPending}
          onClick={() => ignore.mutate()}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Ignore this transaction
        </button>
        <p className="text-[11px] text-slate-400">Ignored rows stay listed under Ignored and can be brought back.</p>
      </div>
    </div>
  )
}

function UnignoreButton({ id, onChanged, onError }: { id: string; onChanged: () => void; onError: (m: string) => void }) {
  const un = useMutation({
    mutationFn: () => apiRequest(`/v1/processor-transactions/${id}/unignore`, { method: 'POST' }),
    onSuccess: onChanged,
    onError: (e: Error) => onError(e.message),
  })
  return (
    <button type="button" onClick={() => un.mutate()} disabled={un.isPending} className="text-xs font-semibold text-slate-500 hover:text-amber-700">
      Bring back
    </button>
  )
}
