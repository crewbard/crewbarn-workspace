import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * Money desk — the Accounting landing page.
 *
 * Accounting used to open on an Overview: charts and totals, i.e. a report to
 * read. Nothing on it told you what to *do*, so the actual work — checking in
 * a tech's cash, sending an invoice that was never sent, chasing what's late —
 * lived on five different pages you had to already know about.
 *
 * This is a queue instead. Five groups, worked top to bottom, each with the
 * one action that clears it. Every row here is something a person has to
 * decide on; anything you'd merely look at belongs in Reports.
 *
 * Design and copy follow the Accounting concept, emoji included — they read
 * faster than icons at the scale these group headers sit at, and each one is
 * the same mark used elsewhere for that kind of money.
 */

type GroupId = 'in' | 'bill' | 'late' | 'approve' | 'match'

interface DeskRow {
  key: string
  title: string
  sub: string
  amountCents: number
  flag?: string
}

interface GroupSpec {
  id: GroupId
  icon: string
  tone: string
  bg: string
  title: string
  sub: string
  action: string
  batch: string
  /** Shown once the group has been worked through. */
  clearedNote: (n: number, total: string) => string
}

// Colours are the concept's, not Tailwind's nearest neighbour — each group
// keeps the same hue wherever that kind of money shows up in the app.
const GROUPS: GroupSpec[] = [
  {
    id: 'in',
    icon: '📥',
    tone: '#166534',
    bg: '#E7F5EC',
    title: 'Money in hand',
    sub: 'Techs collected it — check it in so the books match the bag',
    action: 'Check in',
    batch: 'Check in',
    clearedNote: (_n, total) => `Drawer cleared — ${total} checked in`,
  },
  {
    id: 'bill',
    icon: '✉️',
    tone: '#86521A',
    bg: '#FDF3E4',
    title: 'Finished but not billed',
    sub: 'Work is done and signed off — the invoice was never sent',
    action: 'Send',
    batch: 'Send',
    clearedNote: (n, total) => `${n} invoice${n === 1 ? '' : 's'} sent — ${total} now owed`,
  },
  {
    id: 'late',
    icon: '⏱',
    tone: '#9F1239',
    bg: '#FBE8ED',
    title: 'Late',
    sub: 'Sent, past due, no payment — a reminder goes out with a pay link',
    action: 'Remind',
    batch: 'Send reminders',
    clearedNote: (n, total) => `${n} reminder${n === 1 ? '' : 's'} sent — ${total} chased`,
  },
  {
    id: 'approve',
    icon: '🧾',
    tone: '#2F5F86',
    bg: '#E9F1F7',
    title: 'Spending to approve',
    sub: 'Receipts your techs submitted for reimbursement',
    action: 'Approve',
    batch: 'Approve',
    clearedNote: (n, total) => `${n} receipt${n === 1 ? '' : 's'} approved — ${total} to reimburse`,
  },
  {
    id: 'match',
    icon: '🏦',
    tone: '#5B21B6',
    bg: '#F0E9FB',
    title: 'Bank deposits to match',
    sub: 'Money landed — CrewBarn guessed which payments it was',
    action: 'Review',
    batch: 'Open bank match',
    clearedNote: (n) => `${n} deposit${n === 1 ? '' : 's'} matched — bank is reconciled`,
  },
]


/* ── period ───────────────────────────────────────────────────────────
   Quick presets plus an explicit from/to, because "this month" answers
   most days and none of the ones where somebody is reconciling a specific
   week or closing a period that doesn't align to a preset. */

type PeriodId = 'today' | 'week' | 'month' | 'quarter' | 'custom'

const PERIODS: { id: PeriodId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'custom', label: 'Custom' },
]

function isoDay(d: Date): string {
  // Local calendar day, not UTC — toISOString() would roll the date back for
  // anyone west of Greenwich after 7pm.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function presetRange(id: PeriodId): { from: string; to: string } {
  const now = new Date()
  const to = isoDay(now)
  if (id === 'today') return { from: to, to }
  if (id === 'week') {
    const d = new Date(now)
    // Week starts Monday; getDay() is 0 for Sunday.
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return { from: isoDay(d), to }
  }
  if (id === 'quarter') {
    const q = Math.floor(now.getMonth() / 3) * 3
    return { from: isoDay(new Date(now.getFullYear(), q, 1)), to }
  }
  return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to }
}

/** Money to the cent, always — this page is reconciled against a bank statement. */
function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000))
}

/* ── data ─────────────────────────────────────────────────────────────
   Each group is one existing endpoint. Nothing new was added for this
   page; it re-files work that was already scattered across five screens. */

interface PaymentRow {
  id: string
  amount_cents: number
  payment_method: string | null
  collected_by_name?: string | null
  collected_by?: { name?: string | null } | null
  work_order_number?: string | null
  created_at?: string | null
}

interface InvoiceLite {
  id: string
  invoice_number: string | number
  status: string
  balance_due_cents: number
  total_cents: number
  is_overdue: boolean
  due_at?: string | null
  issued_at?: string | null
  customer?: { display_name?: string | null } | null
}

interface ExpenseRow {
  id: string
  description?: string | null
  vendor_name?: string | null
  amount_cents: number
  spent_on?: string | null
  reimbursement_status?: string | null
  staff_name?: string | null
}

interface BankTxnRow {
  id: string
  description?: string | null
  amount_cents: number
  posted_on?: string | null
  transacted_at?: string | null
  match_confidence?: string | null
  suggested_match_count?: number | null
}

export function MoneyDeskPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [cleared, setCleared] = useState<Partial<Record<GroupId, number>>>({})
  const [busy, setBusy] = useState<GroupId | null>(null)
  const [period, setPeriod] = useState<PeriodId>('month')
  const [range, setRange] = useState(() => presetRange('month'))
  const [error, setError] = useState<string | null>(null)

  const payments = useQuery({
    queryKey: ['desk', 'pending-turnover'],
    queryFn: () =>
      apiRequest<{ data: PaymentRow[] }>('/v1/payments?status=pending_turnover&per_page=50'),
  })
  const invoices = useQuery({
    queryKey: ['desk', 'invoices'],
    queryFn: () => apiRequest<{ data: InvoiceLite[] }>('/v1/invoices?per_page=100'),
  })
  const expenses = useQuery({
    queryKey: ['desk', 'expenses'],
    queryFn: () => apiRequest<{ data: ExpenseRow[] }>('/v1/expenses?per_page=100'),
  })
  // The window only scopes the money summary. The queue below is everything
  // still outstanding — hiding a 90-day-old overdue invoice because someone
  // picked "Today" would be the worst thing this page could do.
  const inflow = useQuery({
    queryKey: ['desk', 'in', range.from, range.to],
    queryFn: () =>
      apiRequest<{ data: PaymentRow[] }>(
        `/v1/payments?status=received,pending_turnover&date_from=${range.from}&date_to=${range.to}&per_page=500`,
      ),
  })
  const outflow = useQuery({
    queryKey: ['desk', 'out', range.from, range.to],
    queryFn: () =>
      apiRequest<{ data: ExpenseRow[] }>(
        `/v1/expenses?date_from=${range.from}&date_to=${range.to}&per_page=500`,
      ),
  })

  const bank = useQuery({
    queryKey: ['desk', 'bank'],
    queryFn: () =>
      apiRequest<{ data: BankTxnRow[] }>('/v1/bank-transactions?match_status=unmatched&per_page=50'),
  })

  const loading =
    payments.isLoading || invoices.isLoading || expenses.isLoading || bank.isLoading

  const rowsByGroup: Record<GroupId, DeskRow[]> = useMemo(() => {
    const inv = invoices.data?.data ?? []

    return {
      in: (payments.data?.data ?? []).map((p) => ({
        key: p.id,
        title: `${p.collected_by_name ?? p.collected_by?.name ?? 'Tech'} · ${p.payment_method ?? 'cash'}`,
        sub: [p.work_order_number ? `WO-${p.work_order_number}` : null, shortDate(p.created_at)]
          .filter(Boolean)
          .join(' · '),
        amountCents: p.amount_cents,
      })),

      // Drafts are work that finished and never got billed — the invoice
      // exists, nobody sent it.
      bill: inv
        .filter((i) => i.status === 'draft' && i.total_cents > 0)
        .map((i) => ({
          key: i.id,
          title: i.customer?.display_name ?? `Invoice ${i.invoice_number}`,
          sub: `Invoice ${i.invoice_number}${i.issued_at ? ` · ${shortDate(i.issued_at)}` : ''}`,
          amountCents: i.total_cents,
        })),

      late: inv
        .filter((i) => i.is_overdue && i.balance_due_cents > 0)
        .map((i) => {
          const d = daysSince(i.due_at)
          return {
            key: i.id,
            title: i.customer?.display_name ?? `Invoice ${i.invoice_number}`,
            sub: `Invoice ${i.invoice_number}${i.issued_at ? ` · sent ${shortDate(i.issued_at)}` : ''}`,
            amountCents: i.balance_due_cents,
            flag: d ? `${d} days` : undefined,
          }
        }),

      approve: (expenses.data?.data ?? [])
        .filter((e) => e.reimbursement_status === 'pending')
        .map((e) => ({
          key: e.id,
          title: [e.description, e.vendor_name].filter(Boolean).join(' — ') || 'Receipt',
          sub: [e.staff_name, shortDate(e.spent_on)].filter(Boolean).join(' · '),
          amountCents: e.amount_cents,
        })),

      match: (bank.data?.data ?? []).map((b) => ({
        key: b.id,
        title: b.description ?? `Deposit ${shortDate(b.posted_on ?? b.transacted_at)}`,
        sub: b.suggested_match_count
          ? `Matches ${b.suggested_match_count} payment${b.suggested_match_count === 1 ? '' : 's'}${b.match_confidence ? ` · ${b.match_confidence} confidence` : ''}`
          : 'No suggestion yet — open to match by hand',
        amountCents: b.amount_cents,
        flag: b.match_confidence && b.match_confidence !== 'high' ? 'Review' : undefined,
      })),
    }
  }, [payments.data, invoices.data, expenses.data, bank.data])

  const totalItems = GROUPS.reduce((n, g) => n + rowsByGroup[g.id].length, 0)
  const doneItems = GROUPS.reduce((n, g) => n + (cleared[g.id] ?? 0), 0)
  const pct = totalItems + doneItems === 0 ? 0 : Math.round((doneItems / (totalItems + doneItems)) * 100)

  /**
   * One row's action, and the batch, are the same call repeated — done in
   * series rather than parallel so a partial failure stops rather than firing
   * fifty writes and reporting one error.
   */
  const run = useMutation({
    mutationFn: async ({ group, keys }: { group: GroupId; keys: string[] }) => {
      for (const id of keys) {
        if (group === 'in') {
          await apiRequest(`/v1/payments/${id}/mark-received`, { method: 'PATCH' })
        } else if (group === 'bill') {
          // /send only accepts a draft — it 422s on anything already sent.
          await apiRequest(`/v1/invoices/${id}/send`, { method: 'POST' })
        } else if (group === 'late') {
          // A late invoice is already sent, so chasing it is another email,
          // not a re-send. Recipient comes from the customer on file.
          await apiRequest(`/v1/invoices/${id}/email`, { method: 'POST', body: {} })
        } else if (group === 'approve') {
          await apiRequest(`/v1/expenses/${id}`, {
            method: 'PATCH',
            body: { reimbursement_status: 'approved' },
          })
        }
        // 'match' never reaches here — see navigateFor(). Confirming needs a
        // matched_type and matched_id, and picking which payments a deposit
        // covers is the judgement the review screen exists for. A one-click
        // "Confirm" here would either 422 or guess with someone's books.
      }
      return keys.length
    },
    onMutate: ({ group }) => {
      setBusy(group)
      setError(null)
    },
    onSuccess: (n, { group, keys }) => {
      setCleared((c) => ({ ...c, [group]: (c[group] ?? 0) + n }))
      setSelected((s) => {
        const next = { ...s }
        keys.forEach((k) => delete next[`${group}:${k}`])
        return next
      })
      void qc.invalidateQueries({ queryKey: ['desk'] })
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : 'That action could not be completed.'),
    onSettled: () => setBusy(null),
  })

  const moneyIn = (inflow.data?.data ?? []).reduce((n, p) => n + p.amount_cents, 0)
  const moneyOut = (outflow.data?.data ?? []).reduce((n, e) => n + e.amount_cents, 0)
  const periodLabel =
    period === 'today'
      ? 'today'
      : period === 'week'
        ? 'this week'
        : period === 'month'
          ? 'this month'
          : period === 'quarter'
            ? 'this quarter'
            : 'in range'

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#B45309]">
            {today}
          </p>
          <h1 className="mt-1 text-[25px] font-extrabold tracking-[-0.02em] text-[#0A1220]">
            Money desk
          </h1>
          <p className="mt-1 text-[13.5px] text-slate-600">
            {loading
              ? 'Checking what needs you…'
              : totalItems === 0
                ? 'Nothing needs you right now. Anything you just want to look at is in Reports.'
                : `${totalItems} thing${totalItems === 1 ? '' : 's'} need you. Clear them top to bottom — nothing here is a report to read.`}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500">
              Covering
            </span>
            <div className="flex flex-wrap gap-1 rounded-lg bg-white p-1">
              {PERIODS.map((p) => {
                const on = period === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPeriod(p.id)
                      if (p.id !== 'custom') setRange(presetRange(p.id))
                    }}
                    className={[
                      'rounded-md px-3 py-1.5 text-[12px] font-semibold transition',
                      on ? 'bg-[#0F1A2E] text-white' : 'text-slate-600 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Always visible, not hidden behind Custom — reading the exact
              window is as useful as setting it, and typing a date is often
              faster than deciding which preset contains it. */}
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => {
                setPeriod('custom')
                setRange((r) => ({ ...r, from: e.target.value }))
              }}
              className="tnum rounded-md border border-slate-300 bg-white px-2 py-1 text-[12px]"
            />
            <span>to</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => {
                setPeriod('custom')
                setRange((r) => ({ ...r, to: e.target.value }))
              }}
              className="tnum rounded-md border border-slate-300 bg-white px-2 py-1 text-[12px]"
            />
          </div>
        </div>
      </div>

      {/* progress */}
      <div className="mt-5 rounded-[13px] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-[13.5px] font-bold text-[#0A1220]">Cleared today</span>
          <div className="flex flex-wrap items-center gap-5">
            <span className="tnum text-[12.5px] font-semibold text-slate-500">
              {doneItems} of {totalItems + doneItems}
            </span>
            <Flow label={`In ${periodLabel}`} cents={moneyIn} tone="#166534" />
            <Flow label={`Out ${periodLabel}`} cents={moneyOut} tone="#9F1239" />
            <Flow label="Net" cents={moneyIn - moneyOut} tone="#0A1220" signed />
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[#E8902C] transition-all"
            style={{ width: `${Math.max(pct, doneItems > 0 ? 4 : 0)}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-[11px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          {error}
        </div>
      )}

      {/* groups */}
      <div className="mt-4 flex flex-col gap-3">
        {GROUPS.map((g) => {
          const rows = rowsByGroup[g.id]
          const clearedCount = cleared[g.id] ?? 0
          const sum = rows.reduce((n, r) => n + r.amountCents, 0)
          const picked = rows.filter((r) => selected[`${g.id}:${r.key}`])
          const allPicked = rows.length > 0 && picked.length === rows.length

          if (rows.length === 0 && clearedCount === 0) return null

          return (
            <section
              key={g.id}
              className="overflow-hidden rounded-[13px] border border-slate-200 bg-white"
              style={{ opacity: rows.length === 0 ? 0.72 : 1 }}
            >
              <div className="flex flex-wrap items-center gap-3 px-[18px] py-3.5">
                <span
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-base"
                  style={{ background: g.bg }}
                  aria-hidden="true"
                >
                  {g.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-extrabold text-[#0A1220]">{g.title}</span>
                  <span className="mt-0.5 block text-[12.5px] text-slate-500">
                    {rows.length === 0
                      ? g.clearedNote(clearedCount, money(sum))
                      : g.sub}
                  </span>
                </span>

                {rows.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setSelected((s) => {
                          const next = { ...s }
                          rows.forEach((r) => delete next[`${g.id}:${r.key}`])
                          if (!allPicked) rows.forEach((r) => (next[`${g.id}:${r.key}`] = true))
                          return next
                        })
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-600 hover:bg-slate-50"
                    >
                      {allPicked ? 'Clear' : 'Select all'}
                    </button>
                    <span
                      className="tnum shrink-0 text-[14px] font-bold"
                      style={{ color: g.tone }}
                    >
                      {money(sum)}
                    </span>
                  </>
                )}
              </div>

              {rows.map((r, i) => {
                const on = !!selected[`${g.id}:${r.key}`]
                return (
                  <div
                    key={r.key}
                    className="flex items-center gap-3 px-[18px] py-[11px]"
                    style={{
                      borderTop: i > 0 ? '1px solid #F8FAFC' : '1px solid #F1F5F9',
                      background: on ? '#FFFCF7' : '#fff',
                    }}
                  >
                    <button
                      type="button"
                      aria-label={on ? `Deselect ${r.title}` : `Select ${r.title}`}
                      onClick={() =>
                        setSelected((s) => {
                          const next = { ...s }
                          const k = `${g.id}:${r.key}`
                          if (next[k]) delete next[k]
                          else next[k] = true
                          return next
                        })
                      }
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold text-white"
                      style={{
                        border: `1.5px solid ${on ? '#E8902C' : '#CBD5E1'}`,
                        background: on ? '#E8902C' : '#fff',
                      }}
                    >
                      {on ? '✓' : ''}
                    </button>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-[#0A1220]">
                        {r.title}
                      </span>
                      {r.sub && (
                        <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                          {r.sub}
                        </span>
                      )}
                    </span>

                    {r.flag && (
                      <span
                        className="shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                        style={{ color: g.tone, background: g.bg }}
                      >
                        {r.flag}
                      </span>
                    )}

                    <span className="tnum shrink-0 text-[13.5px] font-bold text-[#0A1220]">
                      {money(r.amountCents)}
                    </span>

                    {g.id === 'match' ? (
                      <Link
                        to="/accounting/bank-match/review"
                        className="shrink-0 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-700 hover:bg-slate-50"
                      >
                        {g.action}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={busy === g.id}
                        onClick={() => run.mutate({ group: g.id, keys: [r.key] })}
                        className="shrink-0 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {g.action}
                      </button>
                    )}
                  </div>
                )
              })}

              {picked.length > 0 && (
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-[18px] py-3">
                  <span className="text-[12.5px] font-semibold text-slate-600">
                    {picked.length} selected ·{' '}
                    <span className="tnum">
                      {money(picked.reduce((n, r) => n + r.amountCents, 0))}
                    </span>
                  </span>
                  {g.id === 'match' ? (
                    <Link
                      to="/accounting/bank-match/review"
                      className="rounded-lg px-4 py-2 text-[12.5px] font-bold text-white"
                      style={{ background: '#E8902C' }}
                    >
                      {g.batch}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={busy === g.id}
                      onClick={() => run.mutate({ group: g.id, keys: picked.map((r) => r.key) })}
                      className="rounded-lg px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
                      style={{ background: '#E8902C' }}
                    >
                      {busy === g.id ? 'Working…' : `${g.batch} ${picked.length}`}
                    </button>
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>

      {!loading && totalItems === 0 && doneItems === 0 && (
        <div className="mt-4 rounded-[13px] border border-[#A7D9B8] bg-[#EFF7F1] px-5 py-4 text-[14px] font-bold text-[#166534]">
          Desk is clear. Nothing is waiting on you.
        </div>
      )}
    </div>
  )
}

/** One figure in the money strip. Net is signed, because a negative net is
 *  the whole point of showing it. */
function Flow({
  label,
  cents,
  tone,
  signed,
}: {
  label: string
  cents: number
  tone: string
  signed?: boolean
}) {
  const sign = signed && cents > 0 ? '+' : ''
  return (
    <span className="text-right">
      <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </span>
      <span className="tnum block text-[15px] font-extrabold" style={{ color: tone }}>
        {sign}
        {money(cents)}
      </span>
    </span>
  )
}
