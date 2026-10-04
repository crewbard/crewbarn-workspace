import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { useInvoices } from '@/hooks/useInvoices'
import { MiniBarChart } from '@/components/dashboard/MiniBarChart'
import { paymentMethodLabel } from '@/lib/paymentMethod'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'
import { EasyCashCount } from '@/components/easy/EasyCashCount'

/**
 * Cash drawer — queue of tech-collected payments waiting for a
 * cash-flow manager to physically receive the cash/check + confirm
 * in the app. Pending payments DO NOT bump invoice.amount_paid until
 * confirmed here.
 *
 * Tabs:
 *   - Pending turnover (the action queue)
 *   - Received (last 30 days)
 *   - Voided   (last 30 days)
 *
 * Approve = mark received. Service-side checks the caller is a
 * cash-flow manager (or falls back to tenant owner/admin when no
 * one's configured); 403 otherwise.
 */

interface PaymentRow {
  id: string
  customer_id: string
  customer_name: string | null
  amount_cents: number
  tip_cents: number
  customer_credit_cents: number
  payment_method: string
  payment_reference: string | null
  transaction_number: string | null
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  processor: 'stripe' | 'godaddy' | null
  processor_ref: string | null
  is_net_account: boolean
  processing_fee_cents: number
  net_deposit_cents: number
  notes: string | null
  status: 'pending_turnover' | 'pending_stripe' | 'pending_godaddy' | 'received' | 'voided'
  received_at: string | null
  collected_by_email: string | null
  received_by_email: string | null
  voided_at: string | null
  void_reason: string | null
  refunded_at: string | null
  refunded_cents: number
  refund_reason: string | null
  stripe_refund_id: string | null
  stripe_dispute_id: string | null
  dispute_status: string | null
  dispute_reason: string | null
  disputed_cents: number | null
  disputed_at: string | null
  dispute_closed_at: string | null
  dispute_reversed_at: string | null
  allocations: Array<{ invoice_id: string; invoice_number: string | null; amount_cents: number }>
  created_at: string | null
}

function dollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** White KPI card matching the cash-drawer card style. */
function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function QueryRead({ query, children }: { query: { isPending: boolean; isError: boolean; refetch: () => unknown }; children: React.ReactNode }) {
  if (query.isError) return <div role="alert" className="text-sm text-rose-700">Unavailable. <button type="button" onClick={() => query.refetch()} className="underline">Retry</button></div>
  if (query.isPending) return <p role="status" className="text-sm text-slate-500">Loading…</p>
  return <>{children}</>
}

// AR aging bucket colors: current → 90+ (calm to alarming).
const AGING_COLORS = ['#3b82f6', '#f59e0b', '#f97316', '#fb7185', '#ef4444']
interface TechRegisterRow {
  key: string
  tech: string
  cash_cents: number
  check_cents: number
  card_cents: number
  net_deposit_cents: number
  other_cents: number
  total_cents: number
  on_hand_cents: number
  // Open NET-term invoice balances from this tech's jobs — office
  // collects these; display only, never received through the drawer.
  net_balance_cents: number
  count: number
}

function collectorLabel(email: string | null): string {
  if (!email) return 'Unknown tech'
  return email.split('@')[0] || email
}

function methodBucket(method: string): 'cash' | 'check' | 'card' | 'other' {
  if (method === 'cash') return 'cash'
  if (method === 'check') return 'check'
  // GoDaddy = off-site card processing — it's card money, not "other".
  if (
    method === 'card' ||
    method === 'card_manual' ||
    method === 'card_terminal' ||
    method === 'portal_stripe' ||
    method === 'godaddy'
  )
    return 'card'
  return 'other'
}

export function CashDrawerPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const [tab, setTab] = useState<'pending' | 'received' | 'voided' | 'disputed' | 'all'>('pending')

  const q = useQuery({
    queryKey: ['payments', tab],
    queryFn: () =>
      apiRequest<{ data: PaymentRow[] }>(
        tab === 'all'
          ? '/v1/payments?per_page=500'
          : tab === 'disputed'
            ? '/v1/payments?filter=disputed&per_page=500'
            : `/v1/payments?status=${tab === 'pending' ? 'pending_turnover' : tab}&per_page=500`,
      ),
    refetchInterval: 30_000,
  })

  const allPaymentsQ = useQuery({
    queryKey: ['payments', 'cash-drawer-ledger'],
    queryFn: () => apiRequest<{ data: PaymentRow[] }>('/v1/payments?per_page=500'),
    refetchInterval: 30_000,
  })

  const rows = q.data?.data ?? []
  const ledgerRows = allPaymentsQ.data?.data ?? rows

  // Open NET-term balances per lead tech — display only in the register;
  // NET money is invoiced + collected by the office, never drawer-received.
  const netBalancesQ = useQuery({
    queryKey: ['payments-net-balances'],
    queryFn: () =>
      apiRequest<{ data: Array<{ tech_email: string | null; balance_cents: number; invoices: number }> }>(
        '/v1/payments/net-balances',
      ),
    refetchInterval: 60_000,
  })

  const techRegisterRows = useMemo<TechRegisterRow[]>(() => {
    const emptyRow = (key: string, email: string | null): TechRegisterRow => ({
      key,
      tech: collectorLabel(email),
      cash_cents: 0,
      check_cents: 0,
      card_cents: 0,
      net_deposit_cents: 0,
      other_cents: 0,
      total_cents: 0,
      on_hand_cents: 0,
      net_balance_cents: 0,
      count: 0,
    })

    const byTech = new Map<string, TechRegisterRow>()
    for (const row of ledgerRows) {
      if (row.status === 'voided') continue
      const key = row.collected_by_email ?? 'unknown'
      const current = byTech.get(key) ?? emptyRow(key, row.collected_by_email)

      const bucket = methodBucket(row.payment_method)
      if (bucket === 'cash') current.cash_cents += row.amount_cents
      else if (bucket === 'check') current.check_cents += row.amount_cents
      else if (bucket === 'card') current.card_cents += row.amount_cents
      else current.other_cents += row.amount_cents

      current.net_deposit_cents += row.net_deposit_cents ?? row.amount_cents
      current.total_cents += row.amount_cents
      if (row.status === 'pending_turnover' && (bucket === 'cash' || bucket === 'check')) {
        current.on_hand_cents += row.amount_cents
      }
      current.count += 1
      byTech.set(key, current)
    }

    // Fold in net-term balances — a tech with only NET work still gets a row.
    for (const nb of netBalancesQ.data?.data ?? []) {
      const key = nb.tech_email ?? 'unknown'
      const current = byTech.get(key) ?? emptyRow(key, nb.tech_email)
      current.net_balance_cents += nb.balance_cents
      byTech.set(key, current)
    }

    return [...byTech.values()].sort((a, b) => b.on_hand_cents - a.on_hand_cents || b.total_cents - a.total_cents)
  }, [ledgerRows, netBalancesQ.data])
  // --- Accounting summary cards (always-on, independent of the active tab) ---
  const invoicesQ = useInvoices({ per_page: 500 })
  const receivedQ = useQuery({
    queryKey: ['payments-summary', 'received'],
    queryFn: () => apiRequest<{ data: PaymentRow[] }>('/v1/payments?status=received'),
    refetchInterval: 60_000,
  })
  const voidedQ = useQuery({
    queryKey: ['payments-summary', 'voided'],
    queryFn: () => apiRequest<{ data: PaymentRow[] }>('/v1/payments?status=voided'),
    refetchInterval: 60_000,
  })

  // Previous calendar month → sales-tax owed card.
  const lastMonth = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { from: iso(start), to: iso(end), label: start.toLocaleDateString('en-US', { month: 'long' }) }
  }, [])
  const salesTaxQ = useQuery({
    queryKey: ['sales-tax-report', lastMonth.from, lastMonth.to],
    queryFn: () =>
      apiRequest<{ data: { totals: { tax_collected_cents: number } } }>(
        `/v1/reports/sales-tax?from=${lastMonth.from}&to=${lastMonth.to}`,
      ),
    refetchInterval: 300_000,
  })
  const salesTaxCents = salesTaxQ.data?.data.totals.tax_collected_cents ?? 0

  const summary = useMemo(() => {
    const invoices = invoicesQ.data ?? []
    // Owed = outstanding balance on sent (unpaid/partial/overdue) invoices.
    let owedCents = 0
    let unpaidCount = 0
    let paidCount = 0
    for (const inv of invoices) {
      if (inv.status === 'paid') paidCount++
      if (inv.status === 'sent') {
        owedCents += inv.money.balance_due_cents
        if (inv.money.balance_due_cents > 0) unpaidCount++
      }
    }

    const received = receivedQ.data?.data ?? []
    const receivedCents = received.reduce((a, r) => a + r.amount_cents, 0)
    const lastReceivedAt = received.reduce<string | null>((latest, r) => {
      if (!r.received_at) return latest
      return !latest || r.received_at > latest ? r.received_at : latest
    }, null)

    const voided = voidedQ.data?.data ?? []
    const voidedCents = voided.reduce((a, r) => a + r.amount_cents, 0)

    return {
      owedCents, unpaidCount, paidCount,
      receivedCents, lastReceivedAt,
      voidedCents, voidedCount: voided.length,
    }
  }, [invoicesQ.data, receivedQ.data, voidedQ.data])

  // Chart data — AR aging buckets (by days past due) + received-by-method.
  const charts = useMemo(() => {
    const invoices = invoicesQ.data ?? []
    const now = Date.now()
    const b = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 }
    for (const inv of invoices) {
      if (inv.status !== 'sent' || inv.money.balance_due_cents <= 0) continue
      const bal = inv.money.balance_due_cents
      if (!inv.due_at) { b.current += bal; continue }
      const days = Math.floor((now - new Date(inv.due_at).getTime()) / 86_400_000)
      if (days <= 0) b.current += bal
      else if (days <= 30) b.d30 += bal
      else if (days <= 60) b.d60 += bal
      else if (days <= 90) b.d90 += bal
      else b.d90plus += bal
    }
    const aging = [
      { label: 'Current', cents: b.current },
      { label: '1–30', cents: b.d30 },
      { label: '31–60', cents: b.d60 },
      { label: '61–90', cents: b.d90 },
      { label: '90+', cents: b.d90plus },
    ]

    const received = receivedQ.data?.data ?? []
    const byMethod = new Map<string, number>()
    for (const r of received) {
      byMethod.set(r.payment_method, (byMethod.get(r.payment_method) ?? 0) + r.amount_cents)
    }
    const methods = [...byMethod.entries()]
      .sort((a, z) => z[1] - a[1])
      .map(([m, cents]) => ({ label: paymentMethodLabel(m), cents }))

    return { aging, methods }
  }, [invoicesQ.data, receivedQ.data])

  return (
    <div className="mx-auto w-full max-w-none px-4 py-4 sm:px-6 sm:py-6 2xl:px-8">
      {easy ? <EasyPageHeading title="Cash drawer" description="Count physical cash, then review the payment turnover below. Confirm only money you have actually received." /> : <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Cash drawer</h1>
        <p className="text-sm text-slate-500 mt-1">
          Track cash/checks held by tech, confirm field collections, and audit voided payments.
        </p>
      </div>}

      {easy && <EasyCashCount />}

      {/* Summary cards */}
      <p className="mb-3 text-xs text-slate-500">Payment and invoice summaries below cover loaded records, not an audited full-ledger balance. Open the reports for complete period review.</p>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <SummaryCard label="Owed to us">
          <QueryRead query={invoicesQ}>
          <div className={`text-2xl font-mono font-bold ${summary.owedCents === 0 ? 'text-emerald-600' : 'text-amber-700'}`}>
            ${dollars(summary.owedCents)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {summary.owedCents === 0
              ? 'No balance in loaded invoices'
              : `${summary.unpaidCount} unpaid invoice${summary.unpaidCount === 1 ? '' : 's'}`}
          </div>
          </QueryRead>
        </SummaryCard>

        <SummaryCard label="Received">
          <QueryRead query={receivedQ}>
          <div className="text-2xl font-mono font-bold text-slate-900">${dollars(summary.receivedCents)}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {summary.lastReceivedAt ? `Last received ${fmtDate(summary.lastReceivedAt)}` : 'None yet'}
          </div>
          </QueryRead>
        </SummaryCard>

        <SummaryCard label="Voided">
          <QueryRead query={voidedQ}>
          <div className={`text-2xl font-mono font-bold ${summary.voidedCents > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            ${dollars(summary.voidedCents)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {summary.voidedCount} payment{summary.voidedCount === 1 ? '' : 's'}
          </div>
          </QueryRead>
        </SummaryCard>

        <SummaryCard label="Invoices">
          <QueryRead query={invoicesQ}>
          <div className="flex items-baseline gap-4">
            <div>
              <div className="text-2xl font-bold text-amber-700">{summary.unpaidCount}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">unpaid</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600">{summary.paidCount}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">paid</div>
            </div>
          </div>
          <Link to="/accounting/invoices" className="text-xs text-amber-700 hover:underline mt-1 inline-block">
            View all →
          </Link>
          </QueryRead>
        </SummaryCard>

        {/* Sales tax — previous month owed; click → full report. */}
        <Link
          to="/accounting/sales-tax"
          className="bg-white border border-slate-200 rounded-xl p-4 hover:border-amber-300 hover:bg-amber-50/30 transition-colors block"
        >
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
            Sales tax · {lastMonth.label}
          </div>
          <div className="text-2xl font-mono font-bold mt-1 text-slate-900">
            {salesTaxQ.isError ? 'Unavailable' : salesTaxQ.isPending ? 'Loading…' : '$' + dollars(salesTaxCents)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Tax collected last month · review report →
          </div>
        </Link>
      </div>

      {/* Charts — AR aging + received-by-payment-type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">
            Receivables aging (days past due)
          </div>
          <QueryRead query={invoicesQ}>{charts.aging.every((a) => a.cents === 0) ? (
            <div className="text-sm text-slate-400 py-10 text-center">No outstanding balance in loaded invoices</div>
          ) : (
            <MiniBarChart data={charts.aging} height={160} colorAt={(i) => AGING_COLORS[i] ?? '#94a3b8'} />
          )}</QueryRead>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">
            Received by payment type
          </div>
          <QueryRead query={receivedQ}>{charts.methods.length === 0 ? (
            <div className="text-sm text-slate-400 py-10 text-center">No received payments yet</div>
          ) : (
            <MiniBarChart data={charts.methods} height={160} color="#10b981" />
          )}</QueryRead>
        </div>
      </div>

      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">Tech cash register</h2>
        <p className="text-sm text-slate-500">
          Track every payment by tech: cash, checks, cards, NET deposits, and what is still physically on hand.
        </p>
      </div>

      <div className="border-b border-slate-200 mb-4 overflow-x-auto">
        <nav className="flex gap-4 sm:gap-6 min-w-max">
          <TabBtn active={tab === 'pending'} onClick={() => setTab('pending')}>
            Pending turnover
            {tab === 'pending' && rows.length > 0 && (
              <span className="ml-2 text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                {rows.length}
              </span>
            )}
          </TabBtn>
          <TabBtn active={tab === 'received'} onClick={() => setTab('received')}>
            Received
          </TabBtn>
          <TabBtn active={tab === 'voided'} onClick={() => setTab('voided')}>
            Voided
          </TabBtn>
          <TabBtn active={tab === 'disputed'} onClick={() => setTab('disputed')}>
            Disputed
          </TabBtn>
          <TabBtn active={tab === 'all'} onClick={() => setTab('all')}>
            All transactions
          </TabBtn>
        </nav>
      </div>

      {tab === 'pending' && q.isSuccess && rows.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-sm text-amber-900">
          <strong>${dollars(rows.reduce((sum, row) => sum + row.amount_cents, 0))}</strong> across {rows.length} payment
          {rows.length === 1 ? '' : 's'} waiting for turnover.
        </div>
      )}

      <QueryRead query={allPaymentsQ}><QueryRead query={netBalancesQ}><TechRegisterSummary rows={techRegisterRows} /></QueryRead></QueryRead>

      {q.isLoading && <div className="text-sm text-slate-500">Loading…</div>}
      {q.isError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">Payments could not be loaded. <button type="button" className="underline" onClick={() => q.refetch()}>Try again</button></div>}

      {q.isSuccess && rows.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          {tab === 'pending'
            ? 'Nothing waiting. Tech-collected payments will show up here.'
            : tab === 'received'
              ? 'No received payments in this view yet.'
              : tab === 'voided'
                ? 'No voided payments.'
                : tab === 'disputed'
                  ? 'No disputed payments. Card disputes will show up here with alerts.'
                  : 'No payments in the ledger yet.'}
        </div>
      )}

      <div className="space-y-3">
        {!q.isError && rows.map((r) => (
          <PaymentCard key={r.id} payment={r} />
        ))}
      </div>
    </div>
  )
}

function TechRegisterSummary({ rows }: { rows: TechRegisterRow[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-900">Tech cash register</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          All non-voided payments grouped by collector. On hand is pending cash/check still with the
          tech. Net balance is open net-term invoices from the tech's jobs — the office collects
          those, they never pass through the drawer.
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-slate-500 text-center">
          No payment movement found for techs yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Tech</th>
                <th className="px-4 py-2 text-right font-semibold">Cash</th>
                <th className="px-4 py-2 text-right font-semibold">Checks</th>
                <th className="px-4 py-2 text-right font-semibold">Cards</th>
                <th className="px-4 py-2 text-right font-semibold">Net deposit</th>
                <th className="px-4 py-2 text-right font-semibold">Other</th>
                <th className="px-4 py-2 text-right font-semibold">On hand</th>
                <th className="px-4 py-2 text-right font-semibold" title="Open net-term invoices from this tech's jobs — office collects, display only">
                  Net balance
                </th>
                <th className="px-4 py-2 text-right font-semibold">Total</th>
                <th className="px-4 py-2 text-right font-semibold">Items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.key} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.tech}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700">${dollars(row.cash_cents)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sky-700">${dollars(row.check_cents)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">${dollars(row.card_cents)}</td>
                  <td className="px-4 py-3 text-right font-mono text-violet-700">${dollars(row.net_deposit_cents)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">${dollars(row.other_cents)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-amber-700">${dollars(row.on_hand_cents)}</td>
                  <td className="px-4 py-3 text-right font-mono text-violet-700">
                    {row.net_balance_cents > 0 ? `$${dollars(row.net_balance_cents)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">${dollars(row.total_cents)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pb-3 -mb-px text-sm font-medium border-b-2 ${
        active
          ? 'border-amber-600 text-amber-700'
          : 'border-transparent text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  )
}

function PaymentCard({ payment }: { payment: PaymentRow }) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [showVoidPanel, setShowVoidPanel] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [showRefundPanel, setShowRefundPanel] = useState(false)
  const [editingMethod, setEditingMethod] = useState(false)
  const [methodDraft, setMethodDraft] = useState(payment.payment_method)
  const [txnRef, setTxnRef] = useState(payment.payment_reference ?? '')

  // A settled Stripe card payment can't be "voided" (that only reverses
  // the ledger, leaving the customer's card charged) — it must be
  // refunded, which pushes the money back to the card AND reverses the
  // ledger. Office-only, cash-flow-manager gated on the server.
  const isCardStripe = !!payment.stripe_payment_intent_id
  // Same rule for a GoDaddy-charged card: refund at the processor, then
  // reverse the ledger — never a bare void.
  const isCardGoDaddy = payment.processor === 'godaddy' && !!payment.processor_ref
  const isCardProcessor = isCardStripe || isCardGoDaddy
  const isRefunded = !!payment.refunded_at
  // An open dispute (created, not yet closed) blocks a manual refund —
  // Stripe rejects refunding a charge that's under dispute.
  const hasOpenDispute = !!payment.stripe_dispute_id && !payment.dispute_closed_at

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['payments'] })
    qc.invalidateQueries({ queryKey: ['payments-summary'] })
    qc.invalidateQueries({ queryKey: ['payments-pending-count'] })
    qc.invalidateQueries({ queryKey: ['invoices'] })
  }

  const markReceived = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/payments/${payment.id}/mark-received`, {
        method: 'PATCH',
        body: isOffsiteCard && txnRef.trim() ? { payment_reference: txnRef.trim() } : {},
      }),
    onSuccess: () => invalidate(),
    onError: (e: { payload?: { message?: string } } | Error) => {
      setError((e as { payload?: { message?: string } })?.payload?.message ?? (e as Error).message)
    },
  })

  const voidPayment = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/payments/${payment.id}/void`, {
        method: 'PATCH',
        body: { reason: voidReason.trim() || null },
      }),
    onSuccess: () => {
      setShowVoidPanel(false)
      setVoidReason('')
      invalidate()
    },
    onError: (e: { payload?: { message?: string } } | Error) => {
      setError((e as { payload?: { message?: string } })?.payload?.message ?? (e as Error).message)
    },
  })

  const refundPayment = useMutation({
    mutationFn: () =>
      isCardGoDaddy
        ? apiRequest(`/v1/payments/${payment.id}/refund`, {
            method: 'POST',
            body: { reason: refundReason.trim() || null },
          })
        : apiRequest('/v1/payments/stripe-terminal/refund', {
            method: 'POST',
            body: { payment_id: payment.id, reason: refundReason.trim() || null },
          }),
    onSuccess: () => {
      setShowRefundPanel(false)
      setRefundReason('')
      invalidate()
    },
    onError: (e: { payload?: { message?: string } } | Error) => {
      setError((e as { payload?: { message?: string } })?.payload?.message ?? (e as Error).message)
    },
  })

  // Tool Shed method list, fetched only once someone opens the editor.
  // React-query dedupes the key across all rows on the page.
  const methodsQ = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => apiRequest<{ data: Array<{ value: string; label: string }> }>('/v1/payment-methods'),
    enabled: editingMethod,
    staleTime: 5 * 60_000,
  })

  const updateMethod = useMutation({
    mutationFn: (m: string) =>
      apiRequest(`/v1/payments/${payment.id}/method`, {
        method: 'PATCH',
        body: { payment_method: m },
      }),
    onSuccess: () => {
      setEditingMethod(false)
      invalidate()
    },
    onError: (e: { payload?: { message?: string } } | Error) => {
      setError((e as { payload?: { message?: string } })?.payload?.message ?? (e as Error).message)
    },
  })

  // Stripe-processed payments keep their method (server enforces too).
  const canEditMethod =
    payment.status !== 'voided' &&
    !isCardProcessor &&
    payment.payment_method !== 'card_terminal' &&
    payment.payment_method !== 'portal_stripe' &&
    payment.payment_method !== 'portal_godaddy'

  // Card money charged through an outside provider (GoDaddy etc.):
  // confirming requires the provider's transaction id so the invoice is
  // tied to the off-site transaction. Integrated Stripe payments settle
  // themselves and never sit in this queue.
  const isOffsiteCard = methodBucket(payment.payment_method) === 'card' && !isCardProcessor

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await markReceived.mutateAsync()
    } finally {
      setBusy(false)
    }
  }

  const pillCls =
    payment.status === 'pending_turnover'
      ? 'bg-amber-100 text-amber-800'
      : payment.status === 'pending_stripe' || payment.status === 'pending_godaddy'
        ? 'bg-sky-100 text-sky-800'
        : payment.status === 'received'
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-slate-200 text-slate-700'

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded ${pillCls}`}>
              {payment.status.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-slate-500 inline-flex items-center gap-1.5">
              {editingMethod ? (
                <>
                  <select
                    value={methodDraft}
                    onChange={(e) => setMethodDraft(e.target.value)}
                    className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-800"
                  >
                    {/* Keep the current value pickable even if it was since disabled in Tool Shed. */}
                    {!(methodsQ.data?.data ?? []).some((m) => m.value === payment.payment_method) && (
                      <option value={payment.payment_method}>
                        {paymentMethodLabel(payment.payment_method)}
                      </option>
                    )}
                    {(methodsQ.data?.data ?? []).map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={updateMethod.isPending || methodDraft === payment.payment_method}
                    onClick={() => updateMethod.mutate(methodDraft)}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline disabled:opacity-40"
                  >
                    {updateMethod.isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMethod(false)
                      setMethodDraft(payment.payment_method)
                    }}
                    className="text-[11px] text-slate-500 hover:underline"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {paymentMethodLabel(payment.payment_method)}
                  {canEditMethod && (
                    <button
                      type="button"
                      title="Correct how this payment was taken — fixes the register bucket"
                      onClick={() => {
                        setMethodDraft(payment.payment_method)
                        setEditingMethod(true)
                      }}
                      className="text-[10px] text-amber-700 hover:underline"
                    >
                      change
                    </button>
                  )}
                </>
              )}
              {payment.is_net_account && <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-700">NET</span>}
            </span>
          </div>
          <div className="text-base text-slate-900 font-semibold">
            {payment.customer_id ? (
              <Link
                to={`/customers/${payment.customer_id}`}
                className="text-amber-700 hover:underline"
              >
                {payment.customer_name ?? '(customer)'}
              </Link>
            ) : (
              payment.customer_name ?? '(customer)'
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Collected by {payment.collected_by_email ?? '—'}
            {payment.created_at && ` · ${new Date(payment.created_at).toLocaleString()}`}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {payment.payment_method === 'check' ? (
              <span>
                Check #:{' '}
                <span className={`font-mono font-semibold ${payment.payment_reference ? 'text-slate-900' : 'text-rose-700'}`}>
                  {payment.payment_reference || 'Missing'}
                </span>
              </span>
            ) : methodBucket(payment.payment_method) === 'card' ? (
              <span>
                Card transaction:{' '}
                <span className="font-mono text-slate-800">
                  {payment.transaction_number || 'Pending verification'}
                </span>
              </span>
            ) : payment.payment_reference ? (
              <span>
                Reference: <span className="font-mono text-slate-800">{payment.payment_reference}</span>
              </span>
            ) : null}
            {payment.processing_fee_cents > 0 && (
              <span>
                Fee <span className="font-mono">${dollars(payment.processing_fee_cents)}</span>
              </span>
            )}
            <span>
              Net <span className="font-mono">${dollars(payment.net_deposit_cents ?? payment.amount_cents)}</span>
            </span>
          </div>
          {payment.notes && (
            <div className="mt-2 text-xs text-slate-700 italic whitespace-pre-line">
              {payment.notes}
            </div>
          )}
          {payment.allocations.length > 0 && (
            <div className="mt-2 text-xs text-slate-600">
              <span className="text-slate-500">Applies to: </span>
              {payment.allocations.map((a, i) => (
                <span key={a.invoice_id}>
                  {i > 0 && ', '}
                  <Link to={`/invoices/${a.invoice_id}`} className="font-semibold text-amber-700 hover:underline">
                    Invoice #{a.invoice_number ?? a.invoice_id}
                  </Link>{' '}
                  <span className="font-mono">${dollars(a.amount_cents)}</span>
                </span>
              ))}
            </div>
          )}
          {payment.tip_cents > 0 && (
            <div className="text-xs text-amber-700 mt-1">
              Includes ${dollars(payment.tip_cents)} tip
            </div>
          )}
          {payment.customer_credit_cents > 0 && (
            <div className="text-xs text-sky-700 mt-1">
              ${dollars(payment.customer_credit_cents)} added as customer credit
            </div>
          )}
          {payment.status === 'received' && (
            <div className="text-xs text-emerald-700 mt-1">
              Confirmed by {payment.received_by_email ?? '—'}{' '}
              {payment.received_at && new Date(payment.received_at).toLocaleString()}
            </div>
          )}
          {payment.status === 'voided' && payment.void_reason && (
            <div className="text-xs text-rose-700 mt-1">Voided: {payment.void_reason}</div>
          )}
          {isRefunded && (
            <div className="text-xs text-rose-700 mt-1">
              Refunded ${dollars(payment.refunded_cents)} to card
              {payment.refunded_at && ` · ${new Date(payment.refunded_at).toLocaleString()}`}
              {payment.refund_reason && ` · ${payment.refund_reason}`}
            </div>
          )}
          {payment.stripe_dispute_id && (
            <div className={`mt-2 rounded border px-2 py-1.5 text-xs ${
              payment.dispute_reversed_at
                ? 'border-rose-300 bg-rose-50 text-rose-800'
                : payment.dispute_status === 'won'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-amber-300 bg-amber-50 text-amber-900'
            }`}>
              {payment.dispute_reversed_at ? (
                <>
                  <strong>Chargeback lost.</strong> $
                  {dollars(payment.disputed_cents ?? payment.amount_cents)} pulled back — invoice reopened
                  {payment.dispute_closed_at && ` · ${new Date(payment.dispute_closed_at).toLocaleDateString()}`}
                </>
              ) : payment.dispute_status === 'won' ? (
                <>
                  <strong>Dispute won.</strong> No money was pulled back
                  {payment.dispute_closed_at && ` · ${new Date(payment.dispute_closed_at).toLocaleDateString()}`}
                </>
              ) : (
                <>
                  <strong>⚠ Disputed{payment.dispute_reason ? ` (${payment.dispute_reason})` : ''}.</strong>{' '}
                  Respond in Stripe before the deadline — gather your evidence now.
                </>
              )}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase text-slate-500">Total</div>
          <div className="text-xl font-mono font-bold text-slate-900">
            ${dollars(payment.amount_cents)}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2">
          {error}
        </div>
      )}

      {payment.status === 'pending_turnover' && !showVoidPanel && (
        <div className="pt-1 space-y-2">
          {isOffsiteCard && (
            <div className="text-xs text-slate-600">
              Off-site card charge — enter the provider's transaction id to confirm it settled.
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {isOffsiteCard && (
              <input
                value={txnRef}
                onChange={(e) => setTxnRef(e.target.value)}
                placeholder="Provider transaction id (required)"
                className="text-xs border border-slate-300 rounded px-2 py-1.5 w-60 bg-white"
              />
            )}
            <button
              type="button"
              onClick={confirm}
              disabled={busy || (isOffsiteCard && !txnRef.trim())}
              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded px-3 py-1.5 disabled:opacity-50"
            >
              {busy
                ? 'Confirming…'
                : isOffsiteCard
                  ? '✓ Confirm card settled'
                  : payment.payment_method === 'cash'
                    ? '✓ Verify cash received'
                    : payment.payment_method === 'check'
                      ? '✓ Verify check received'
                      : '✓ Confirm received'}
            </button>
            <button
              type="button"
              onClick={() => setShowVoidPanel(true)}
              className="text-xs font-semibold border border-red-300 text-red-700 hover:bg-red-50 rounded px-3 py-1.5"
            >
              Void
            </button>
          </div>
        </div>
      )}

      {payment.status === 'received' && !isRefunded && !payment.dispute_reversed_at && !hasOpenDispute && !showRefundPanel && (
        isCardProcessor ? (
          <button
            type="button"
            onClick={() => setShowRefundPanel(true)}
            className="text-xs font-semibold border border-red-300 text-red-700 hover:bg-red-50 rounded px-3 py-1.5"
          >
            Refund to card (reverses invoice)
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowVoidPanel(true)}
            className="text-xs font-semibold border border-red-300 text-red-700 hover:bg-red-50 rounded px-3 py-1.5"
          >
            Void (reverses invoice + credit)
          </button>
        )
      )}

      {showRefundPanel && (
        <div className="bg-red-50 border border-red-200 rounded p-3 space-y-2">
          <div className="text-xs text-red-800">
            Refunds <strong>${dollars(payment.amount_cents + payment.tip_cents)}</strong> to the
            customer's card via {isCardGoDaddy ? 'GoDaddy Payments' : 'Stripe'} and reverses the invoice. This can't be undone.
          </div>
          <textarea
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            rows={2}
            placeholder="Reason (optional but recommended)"
            className="w-full text-sm border border-red-300 bg-white rounded px-2 py-1.5"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowRefundPanel(false); setRefundReason('') }}
              disabled={refundPayment.isPending}
              className="text-xs text-slate-600 px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => refundPayment.mutate()}
              disabled={refundPayment.isPending}
              className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded px-3 py-1.5 disabled:opacity-50"
            >
              {refundPayment.isPending ? 'Refunding…' : 'Confirm refund'}
            </button>
          </div>
        </div>
      )}

      {showVoidPanel && (
        <div className="bg-red-50 border border-red-200 rounded p-3 space-y-2">
          <textarea
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            rows={2}
            placeholder="Reason (optional but recommended)"
            className="w-full text-sm border border-red-300 bg-white rounded px-2 py-1.5"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowVoidPanel(false); setVoidReason('') }}
              disabled={voidPayment.isPending}
              className="text-xs text-slate-600 px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => voidPayment.mutate()}
              disabled={voidPayment.isPending}
              className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded px-3 py-1.5 disabled:opacity-50"
            >
              {voidPayment.isPending ? 'Voiding…' : 'Confirm void'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
