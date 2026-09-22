import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { useInvoices } from '@/hooks/useInvoices'
import { MiniBarChart, DualBarChart } from '@/components/dashboard/MiniBarChart'
import { PeriodPicker } from '@/components/dashboard/PeriodPicker'
import { paymentMethodLabel } from '@/lib/paymentMethod'
import type { ReportPeriod } from '@/hooks/useDashboardSummary'
import type { Invoice } from '@/types/invoice'

type Range = 'day' | 'week' | 'month' | 'quarter' | 'year'
type WorkflowTab = 'collect' | 'spend' | 'pay' | 'close'

/** Header-card framing — "Month" means THIS month, not a 12-month window. */
const PERIOD_LABEL: Record<Range, string> = {
  day: 'today',
  week: 'this week',
  month: 'this month',
  quarter: 'this quarter',
  year: 'this year',
}

type CashflowResp = {
  data: {
    /** The DISCRETE calendar period these figures cover. */
    period: ReportPeriod
    /** Recent periods, newest first — closed ones can be opened as fixed units. */
    periods: ReportPeriod[]
    buckets: Array<{ label: string; invoiced_cents: number; in_cents: number; out_cents: number }>
    /** THIS period (today / this week / this month / this quarter / this year). */
    current?: { label: string; invoiced_cents: number; in_cents: number; out_cents: number; net_cents: number }
    previous?: { label: string; invoiced_cents: number; in_cents: number; out_cents: number }
    /** Scoped to the selected period — never a cross-year rolling sum. */
    totals: { invoiced_cents: number; in_cents: number; out_cents: number; net_cents: number }
  }
}

type ReceivablesResp = {
  data: {
    total_open_cents: number
    open_count: number
    aging: Array<{ key: string; label: string; cents: number }>
    by_term: Array<{ term: string; cents: number }>
  }
}

type PaymentRow = {
  id: string
  customer_name: string | null
  amount_cents: number
  payment_method: string
  status: 'pending_turnover' | 'received' | 'voided'
  received_at: string | null
  collected_by_email: string | null
  created_at: string | null
}

type CustomerCreditRegisterResp = {
  data: {
    totals: {
      credit_count: number
      amount_cents: number
      applied_cents: number
      refunded_cents: number
      balance_cents: number
    }
  }
}

type TrialBalanceResp = {
  data: {
    totals: {
      debit_cents: number
      credit_cents: number
      is_balanced: boolean
    }
  }
}

type IncomeStatementResp = {
  data: {
    totals: {
      gross_revenue_cents: number
      discounts_cents: number
      net_revenue_cents: number
      expenses_cents: number
      net_income_cents: number
    }
  }
}

type BalanceSheetResp = {
  data: {
    totals: {
      assets_cents: number
      liabilities_cents: number
      equity_cents: number
      current_earnings_cents: number
      liabilities_and_equity_cents: number
      is_balanced: boolean
    }
  }
}

type Contractor1099SummaryResp = {
  data: {
    threshold_cents: number
    totals: {
      contractor_count: number
      paid_cents: number
      review_count: number
      missing_w9_count: number
      review_cents: number
    }
  }
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function exactMoney(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function balanceOf(inv: Invoice): number {
  return inv.money?.balance_due_cents ?? 0
}

export function AccountingPage() {
  const [range, setRange] = useState<Range>('month')
  // WHICH calendar period. null = the current (open) one. Switching the range
  // invalidates the key (a "2025" key is meaningless for Month), so it resets.
  const [period, setPeriod] = useState<string | null>(null)
  const [workflowTab, setWorkflowTab] = useState<WorkflowTab>('collect')
  const [showGrids, setShowGrids] = useState(() => {
    try {
      return localStorage.getItem('crewbarn_accounting_show_grids') === '1'
    } catch {
      return false
    }
  })

  const setGridPreference = (next: boolean) => {
    setShowGrids(next)
    try {
      localStorage.setItem('crewbarn_accounting_show_grids', next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const lastMonth = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return {
      from: isoDate(start),
      to: isoDate(end),
      label: start.toLocaleDateString('en-US', { month: 'long' }),
    }
  }, [])

  const creditWindow = useMemo(() => {
    const now = new Date()
    return {
      from: `${now.getFullYear() - 2}-01-01`,
      to: isoDate(now),
    }
  }, [])

  const cashflowQ = useQuery({
    queryKey: ['accounting', 'cashflow', range, period ?? 'current'],
    queryFn: () =>
      apiRequest<CashflowResp>(
        `/v1/dashboard/cashflow?range=${range}${period ? `&period=${encodeURIComponent(period)}` : ''}`,
      ),
    staleTime: 60_000,
  })
  const selectedPeriod = cashflowQ.data?.data.period

  /**
   * The ledger statements (trial balance, P&L, balance sheet) and the exports
   * follow the SELECTED calendar period. The server resolves the boundaries in
   * the shop's timezone — so Jan 1 is Jan 1 *here*, not 7 PM on Dec 31 — and
   * hands back inclusive local dates. The local calc below is only a first-paint
   * fallback while that request is in flight.
   */
  const statementWindow = useMemo(() => {
    if (selectedPeriod) {
      return {
        from: selectedPeriod.start_date,
        to: selectedPeriod.end_date,
        label: selectedPeriod.label,
      }
    }
    const now = new Date()
    if (range === 'year') {
      return {
        from: `${now.getFullYear()}-01-01`,
        to: `${now.getFullYear()}-12-31`,
        label: String(now.getFullYear()),
      }
    }
    if (range === 'quarter') {
      const q = Math.floor(now.getMonth() / 3)
      const start = new Date(now.getFullYear(), q * 3, 1)
      const end = new Date(now.getFullYear(), q * 3 + 3, 0)
      return { from: isoDate(start), to: isoDate(end), label: `Q${q + 1} ${now.getFullYear()}` }
    }
    if (range === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return {
        from: isoDate(start),
        to: isoDate(end),
        label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      }
    }
    if (range === 'week') {
      const start = new Date(now)
      start.setDate(now.getDate() - ((now.getDay() + 6) % 7)) // Monday
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return { from: isoDate(start), to: isoDate(end), label: 'This week' }
    }
    return { from: isoDate(now), to: isoDate(now), label: 'Today' }
  }, [range, selectedPeriod])

  const receivablesQ = useQuery({
    queryKey: ['accounting', 'receivables'],
    queryFn: () => apiRequest<ReceivablesResp>('/v1/dashboard/receivables'),
    staleTime: 60_000,
  })

  const pendingQ = useQuery({
    queryKey: ['accounting', 'pending-turnover'],
    queryFn: () => apiRequest<{ data: PaymentRow[] }>('/v1/payments?status=pending_turnover&per_page=500'),
    refetchInterval: 60_000,
  })

  const receivedQ = useQuery({
    queryKey: ['accounting', 'received-payments'],
    queryFn: () => apiRequest<{ data: PaymentRow[] }>('/v1/payments?status=received&per_page=500'),
    staleTime: 60_000,
  })

  const salesTaxQ = useQuery({
    queryKey: ['accounting', 'sales-tax', lastMonth.from, lastMonth.to],
    queryFn: () =>
      apiRequest<{ data: { totals: { tax_collected_cents: number } } }>(
        `/v1/reports/sales-tax?from=${lastMonth.from}&to=${lastMonth.to}`,
      ),
    staleTime: 300_000,
  })

  const customerCreditsQ = useQuery({
    queryKey: ['accounting', 'customer-credits', creditWindow.from, creditWindow.to],
    queryFn: () =>
      apiRequest<CustomerCreditRegisterResp>(
        `/v1/reports/customer-credit-register?from=${creditWindow.from}&to=${creditWindow.to}&status_state=open`,
      ),
    staleTime: 60_000,
  })

  const trialBalanceQ = useQuery({
    queryKey: ['accounting', 'overview-trial-balance', statementWindow.to],
    queryFn: () => apiRequest<TrialBalanceResp>(`/v1/accounting/trial-balance?as_of=${statementWindow.to}`),
    staleTime: 60_000,
  })

  const incomeStatementQ = useQuery({
    queryKey: ['accounting', 'overview-income-statement', statementWindow.from, statementWindow.to],
    queryFn: () =>
      apiRequest<IncomeStatementResp>(
        `/v1/accounting/income-statement?from=${statementWindow.from}&to=${statementWindow.to}`,
      ),
    staleTime: 60_000,
  })

  const balanceSheetQ = useQuery({
    queryKey: ['accounting', 'overview-balance-sheet', statementWindow.to],
    queryFn: () => apiRequest<BalanceSheetResp>(`/v1/accounting/balance-sheet?as_of=${statementWindow.to}`),
    staleTime: 60_000,
  })

  const contractor1099Year = new Date(`${statementWindow.to}T00:00:00`).getFullYear()
  const contractor1099Q = useQuery({
    queryKey: ['accounting', 'overview-1099', contractor1099Year],
    queryFn: () =>
      apiRequest<Contractor1099SummaryResp>(
        `/v1/reports/contractor-1099-summary?year=${encodeURIComponent(String(contractor1099Year))}`,
      ),
    staleTime: 300_000,
  })

  const invoicesQ = useInvoices({ per_page: 500 })
  const invoices = invoicesQ.data ?? []
  const cashflow = cashflowQ.data?.data
  const receivables = receivablesQ.data?.data
  const pendingPayments = pendingQ.data?.data ?? []
  const receivedPayments = receivedQ.data?.data ?? []
  const customerCredits = customerCreditsQ.data?.data
  const trialBalance = trialBalanceQ.data?.data
  const incomeStatement = incomeStatementQ.data?.data
  const balanceSheet = balanceSheetQ.data?.data
  const pendingTotal = pendingPayments.reduce((sum, p) => sum + p.amount_cents, 0)
  const openInvoices = invoices.filter((inv) => balanceOf(inv) > 0)
  const overdueInvoices = openInvoices.filter((inv) => inv.is_overdue)
  const draftInvoices = invoices.filter((inv) => inv.status === 'draft')
  const overdueTotal = overdueInvoices.reduce((sum, inv) => sum + balanceOf(inv), 0)
  const attentionCount =
    (overdueInvoices.length > 0 ? 1 : 0) +
    (pendingPayments.length > 0 ? 1 : 0) +
    (draftInvoices.length > 0 ? 1 : 0) +
    ((contractor1099Q.data?.data.totals.missing_w9_count ?? 0) > 0 ? 1 : 0)

  const paymentMethodRows = useMemo(() => {
    const byMethod = new Map<string, number>()
    for (const payment of receivedPayments) {
      byMethod.set(payment.payment_method, (byMethod.get(payment.payment_method) ?? 0) + payment.amount_cents)
    }
    return [...byMethod.entries()]
      .map(([method, cents]) => ({ label: paymentMethodLabel(method), cents }))
      .sort((a, b) => b.cents - a.cents)
  }, [receivedPayments])

  const invoiceStatusRows = useMemo(() => [
    {
      label: 'Draft',
      count: draftInvoices.length,
      balanceCents: draftInvoices.reduce((sum, inv) => sum + balanceOf(inv), 0),
    },
    {
      label: 'Sent',
      count: openInvoices.filter((inv) => inv.status === 'sent' && !inv.is_overdue).length,
      balanceCents: openInvoices
        .filter((inv) => inv.status === 'sent' && !inv.is_overdue)
        .reduce((sum, inv) => sum + balanceOf(inv), 0),
    },
    {
      label: 'Overdue',
      count: overdueInvoices.length,
      balanceCents: overdueTotal,
    },
    {
      label: 'Paid',
      count: invoices.filter((inv) => inv.status === 'paid').length,
      balanceCents: invoices
        .filter((inv) => inv.status === 'paid')
        .reduce((sum, inv) => sum + (inv.money?.total_cents ?? 0), 0),
    },
  ], [draftInvoices, invoices, openInvoices, overdueInvoices, overdueTotal])

  return (
    <div data-tour="accounting-root" className="mx-auto w-full max-w-none space-y-6 px-4 py-4 sm:px-6 sm:py-6 2xl:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Accounting</h1>
          <p className="mt-1 text-sm text-slate-500">
            Money dashboard for receivables, collections, taxes, payroll, and margin review.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* WHICH period — closed years/quarters open as fixed, final units. */}
          <PeriodPicker
            periods={cashflowQ.data?.data.periods ?? []}
            selected={selectedPeriod?.key ?? ''}
            onChange={setPeriod}
          />
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white">
            {(['day', 'week', 'month', 'quarter', 'year'] as Range[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setRange(option)
                  setPeriod(null) // a "2025" key is meaningless for Month, etc.
                }}
                className={[
                  'px-3 py-2 text-sm font-semibold capitalize',
                  range === option ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {option}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setGridPreference(!showGrids)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {showGrids ? 'Hide grids' : 'Show grids'}
          </button>
          <Link className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800" to="/reports?layout=browser&report=invoice-register">
            Export reports
          </Link>
        </div>
      </div>

      <main className="space-y-5">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label={`Money in (${PERIOD_LABEL[range]})`} value={cashflowQ.isLoading ? '...' : money(cashflow?.current?.in_cents ?? cashflow?.totals.in_cents ?? 0)} tone="green" />
          <MetricCard label={`Money out (${PERIOD_LABEL[range]})`} value={cashflowQ.isLoading ? '...' : money(cashflow?.current?.out_cents ?? cashflow?.totals.out_cents ?? 0)} tone="red" />
          <MetricCard label={`Net cash (${PERIOD_LABEL[range]})`} value={cashflowQ.isLoading ? '...' : money(cashflow?.current?.net_cents ?? cashflow?.totals.net_cents ?? 0)} tone={(cashflow?.current?.net_cents ?? cashflow?.totals.net_cents ?? 0) >= 0 ? 'green' : 'red'} />
          <MetricCard label="Open A/R" value={receivablesQ.isLoading ? '...' : money(receivables?.total_open_cents ?? 0)} tone="amber" />
          <MetricCard label="Overdue" value={invoicesQ.isLoading ? '...' : money(overdueTotal)} tone={overdueTotal > 0 ? 'red' : 'green'} />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <span aria-hidden>⚡</span>
              <h2 className="text-lg font-bold text-slate-950">Needs attention</h2>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                {attentionCount} items
              </span>
            </div>
            <span className="hidden text-sm text-slate-400 sm:block">Work top-down — this is your money to-do list</span>
          </div>
          <div className="divide-y divide-slate-100">
            {overdueInvoices.length > 0 && (
              <AccountingAttentionRow icon="🔴" tone="red" title="Chase overdue invoices" detail={`${overdueInvoices.length} invoices are past due`} amount={money(overdueTotal)} action="Review overdue" to="/accounting/invoices?filter=overdue" />
            )}
            {pendingPayments.length > 0 && (
              <AccountingAttentionRow icon="💵" tone="amber" title="Check in field cash" detail={`${pendingPayments.length} payments are pending office turnover`} amount={money(pendingTotal)} action="Review drawer" to="/accounting/cash-drawer" />
            )}
            {draftInvoices.length > 0 && (
              <AccountingAttentionRow icon="📨" tone="amber" title="Send draft invoices" detail={`${draftInvoices.length} invoices have not been sent`} amount={money(draftInvoices.reduce((sum, inv) => sum + (inv.money?.total_cents ?? 0), 0))} action="Review drafts" to="/accounting/invoices?filter=draft" />
            )}
            {(contractor1099Q.data?.data.totals.missing_w9_count ?? 0) > 0 && (
              <AccountingAttentionRow icon="📋" tone="red" title="Collect missing W-9" detail={`${contractor1099Q.data?.data.totals.missing_w9_count ?? 0} contractors need tax documents`} amount={money(contractor1099Q.data?.data.totals.review_cents ?? 0)} action="Open 1099 report" to="/reports?layout=browser&report=contractor-1099" />
            )}
            {overdueInvoices.length === 0 && pendingPayments.length === 0 && draftInvoices.length === 0 && (contractor1099Q.data?.data.totals.missing_w9_count ?? 0) === 0 && (
              <div className="px-5 py-8 text-center text-sm font-medium text-emerald-700">Everything is caught up for this view.</div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
            <AccountingWorkflowTab active={workflowTab === 'collect'} onClick={() => setWorkflowTab('collect')}>📥 Collect</AccountingWorkflowTab>
            <AccountingWorkflowTab active={workflowTab === 'spend'} onClick={() => setWorkflowTab('spend')}>📤 Spend</AccountingWorkflowTab>
            <AccountingWorkflowTab active={workflowTab === 'pay'} onClick={() => setWorkflowTab('pay')}>👥 Team pay</AccountingWorkflowTab>
            <AccountingWorkflowTab active={workflowTab === 'close'} onClick={() => setWorkflowTab('close')}>📚 Close the books</AccountingWorkflowTab>
          </div>
          <div className="grid gap-4">
            {workflowTab === 'collect' && <AccountingWorkflowCard title="Collect" icon="📥" description="Invoice, collect, and apply customer money.">
              <AccountingToolLink to="/accounting/invoices" label="Invoices & A/R" detail={`${openInvoices.length} open · ${overdueInvoices.length} overdue`} />
              <AccountingToolLink to="/accounting/cash-drawer" label="Cash drawer" detail={`${pendingPayments.length} pending turnover`} />
              <AccountingToolLink to="/accounting/customer-credits" label="Customer credits" detail={`${customerCredits?.totals.credit_count ?? 0} open credits`} />
            </AccountingWorkflowCard>}
            {workflowTab === 'spend' && <AccountingWorkflowCard title="Spend" icon="📤" description="Capture, approve, and pay business costs.">
              <AccountingToolLink to="/accounting/expenses" label="Expense workspace" detail="Review spend and reimbursements" />
              <AccountingToolLink to="/accounting/expenses/register" label="Expense register" detail="Search, categorize, and export" />
              <AccountingToolLink to="/accounting/expenses/bills" label="Vendor bills" detail="Bills, due dates, and payments" />
              <AccountingToolLink to="/accounting/inventory-cost" label="Inventory cost" detail="Value and cost movement" />
              <AccountingToolLink to="/sub-payouts" label="Sub payouts" detail="Subcontractor payout register" />
            </AccountingWorkflowCard>}
            {workflowTab === 'pay' && <AccountingWorkflowCard title="Team pay" icon="👥" description="Pay the team and keep tax records ready.">
              <AccountingToolLink to="/accounting/payroll" label="Payroll & reimbursements" detail="Runs, payments, PTO, closeout" />
              <AccountingToolLink to="/accounting/payroll/profiles" label="Payroll profiles" detail="Rates, commission, and leave" />
              <AccountingToolLink to="/reports?layout=browser&report=tech-performance" label="Tech performance" detail="Revenue, cost, and margin" />
              <AccountingToolLink to="/reports?layout=browser&report=contractor-1099" label="1099 tracking" detail={`${contractor1099Q.data?.data.totals.missing_w9_count ?? 0} missing W-9`} />
            </AccountingWorkflowCard>}
            {workflowTab === 'close' && <AccountingWorkflowCard title="Close the books" icon="📚" description="Reconcile, review statements, and file.">
              <AccountingToolLink to="/accounting/card-processor" label="Card processor" detail="GoDaddy transactions, matched to invoices" />
              <AccountingToolLink to="/accounting/bank-match/review" label="Bank matching" detail="Import, match, split, and ignore" />
              <AccountingToolLink to="/accounting/bank-match" label="Bank reconciliation" detail="Close statement periods" />
              <AccountingToolLink to="/accounting/ledger" label="General ledger" detail={trialBalance?.totals.is_balanced ? 'Trial balance is balanced' : 'Trial balance needs review'} />
              <AccountingToolLink to="/accounting/sales-tax" label="Sales tax" detail={`${money(salesTaxQ.data?.data.totals.tax_collected_cents ?? 0)} collected`} />
              <AccountingToolLink to="/accounting/sync-mappings" label="Sync mappings" detail="External accounting export map" />
            </AccountingWorkflowCard>}
          </div>
        </section>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <DashboardLinkPanel
            to="/reports?layout=browser&report=revenue-breakdown"
            title="Cash flow"
            subtitle="Money collected compared with payouts and purchase orders."
            className="xl:col-span-7"
            actionLabel="View revenue report"
          >
            <div className="mb-3 flex flex-wrap gap-4 text-sm text-slate-600">
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" />In {money(cashflow?.totals.in_cents ?? 0)}</span>
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-red-600" />Out {money(cashflow?.totals.out_cents ?? 0)}</span>
              <span className="text-xs text-slate-400 self-center">trailing {(cashflow?.buckets ?? []).length} {range === 'day' ? 'days' : range === 'week' ? 'weeks' : range === 'quarter' ? 'quarters' : range === 'year' ? 'years' : 'months'}</span>
            </div>
            <DualBarChart
              height={230}
              data={(cashflow?.buckets ?? []).map((b) => ({
                label: b.label,
                inCents: b.in_cents,
                outCents: b.out_cents,
              }))}
            />
          </DashboardLinkPanel>

          <DashboardLinkPanel
            to="/accounting/ledger"
            title="Books check"
            subtitle={`Trial balance, profit and loss, and balance sheet for ${statementWindow.label}.`}
            className="xl:col-span-5"
            actionLabel="Open ledger"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatementMiniStat
                label="Net income"
                value={incomeStatementQ.isLoading ? '...' : money(incomeStatement?.totals.net_income_cents ?? 0)}
                tone={(incomeStatement?.totals.net_income_cents ?? 0) < 0 ? 'red' : 'green'}
              />
              <StatementMiniStat
                label="Trial balance"
                value={trialBalanceQ.isLoading ? '...' : trialBalance?.totals.is_balanced ? 'Balanced' : 'Review'}
                helper={
                  trialBalance
                    ? `${exactMoney(trialBalance.totals.debit_cents)} debit / ${exactMoney(trialBalance.totals.credit_cents)} credit`
                    : 'As-of ledger check'
                }
                tone={trialBalance?.totals.is_balanced === false ? 'red' : 'green'}
              />
              <StatementMiniStat
                label="Assets"
                value={balanceSheetQ.isLoading ? '...' : money(balanceSheet?.totals.assets_cents ?? 0)}
                helper="Balance sheet"
                tone="blue"
              />
              <StatementMiniStat
                label="Balance sheet"
                value={balanceSheetQ.isLoading ? '...' : balanceSheet?.totals.is_balanced ? 'Balanced' : 'Review'}
                helper={
                  balanceSheet
                    ? `${exactMoney(balanceSheet.totals.liabilities_and_equity_cents)} liabilities + equity`
                    : 'As-of statement check'
                }
                tone={balanceSheet?.totals.is_balanced === false ? 'red' : 'green'}
              />
            </div>
          </DashboardLinkPanel>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <DashboardLinkPanel to="/accounting/cash-drawer" title="Cash drawer" subtitle="Field collections waiting for office review." actionLabel="Review drawer">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Pending turnover</div>
              <div className="mt-1 text-3xl font-bold text-slate-900">{exactMoney(pendingTotal)}</div>
              <div className="mt-1 text-sm text-amber-800">
                {pendingPayments.length} payment{pendingPayments.length === 1 ? '' : 's'} waiting
              </div>
            </div>
          </DashboardLinkPanel>

          <DashboardLinkPanel to="/accounting/invoices" title="A/R aging" subtitle="Open invoice balance by age." actionLabel="Review invoices">
            <MiniBarChart
              height={180}
              data={(receivables?.aging ?? []).map((b) => ({ label: b.label, cents: b.cents }))}
              colorAt={(i) => ['#15803d', '#ca8a04', '#f97316', '#dc2626', '#991b1b'][i] ?? '#64748b'}
            />
          </DashboardLinkPanel>

          <DashboardLinkPanel to="/accounting/invoices" title="Payment methods" subtitle="Received payments by method." actionLabel="Review payments">
            <MiniBarChart height={180} data={paymentMethodRows} color="#10b981" />
          </DashboardLinkPanel>

          <DashboardLinkPanel to="/accounting/invoices" title="Invoice status" subtitle="Work that needs billing attention." actionLabel="Review invoices">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Open invoices" value={openInvoices.length} helper={money(openInvoices.reduce((sum, inv) => sum + balanceOf(inv), 0))} />
              <MiniStat label="Overdue invoices" value={overdueInvoices.length} helper={money(overdueTotal)} danger={overdueInvoices.length > 0} />
              <MiniStat label="Draft invoices" value={draftInvoices.length} helper="Not sent yet" />
              <MiniStat label="Tax last month" value={money(salesTaxQ.data?.data.totals.tax_collected_cents ?? 0)} helper={lastMonth.label} />
            </div>
          </DashboardLinkPanel>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <DashboardLinkPanel
            to="/accounting/customer-credits"
            title="Customer credits"
            subtitle="Overpayments, deposits, refunds, and unapplied balances."
            actionLabel="Review credits"
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Open credits" value={customerCreditsQ.isLoading ? '...' : customerCredits?.totals.credit_count ?? 0} helper={money(customerCredits?.totals.balance_cents ?? 0)} />
              <MiniStat label="Applied" value={customerCreditsQ.isLoading ? '...' : money(customerCredits?.totals.applied_cents ?? 0)} helper="Used on invoices" />
            </div>
          </DashboardLinkPanel>

          <DashboardLinkPanel
            to="/accounting/sales-tax"
            title="Sales tax"
            subtitle={`Tax collected for ${lastMonth.label}.`}
            actionLabel="Review tax"
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Collected" value={salesTaxQ.isLoading ? '...' : money(salesTaxQ.data?.data.totals.tax_collected_cents ?? 0)} helper={lastMonth.label} />
              <MiniStat label="Export" value="PDF / Spreadsheet" helper="Report browser" />
            </div>
          </DashboardLinkPanel>

          <DashboardLinkPanel
            to="/reports?layout=browser&report=contractor-1099"
            title="Subcontractors & 1099"
            subtitle={`${contractor1099Year} paid subcontractor review.`}
            actionLabel="Open 1099 report"
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniStat
                label="Needs 1099"
                value={contractor1099Q.isLoading ? '...' : contractor1099Q.data?.data.totals.review_count ?? 0}
                helper={money(contractor1099Q.data?.data.totals.review_cents ?? 0)}
              />
              <MiniStat
                label="Missing W-9"
                value={contractor1099Q.isLoading ? '...' : contractor1099Q.data?.data.totals.missing_w9_count ?? 0}
                helper="Before filing"
                danger={(contractor1099Q.data?.data.totals.missing_w9_count ?? 0) > 0}
              />
              <MiniStat
                label="Contractors"
                value={contractor1099Q.isLoading ? '...' : contractor1099Q.data?.data.totals.contractor_count ?? 0}
                helper={money(contractor1099Q.data?.data.totals.paid_cents ?? 0)}
              />
              <MiniStat
                label="Threshold"
                value={money(contractor1099Q.data?.data.threshold_cents ?? 0)}
                helper={`Tax year ${contractor1099Year}`}
              />
            </div>
          </DashboardLinkPanel>
        </section>

        {showGrids && (
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-4">
            <GridPanel title="Cashflow grid">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <Th>Period</Th>
                  <Th align="right">Money in</Th>
                  <Th align="right">Money out</Th>
                  <Th align="right">Net</Th>
                </tr>
              </thead>
              <tbody>
                {(cashflow?.buckets ?? []).map((bucket) => (
                  <tr key={bucket.label} className="border-b border-slate-100 last:border-0">
                    <Td>{bucket.label}</Td>
                    <Td align="right">{exactMoney(bucket.in_cents)}</Td>
                    <Td align="right">{exactMoney(bucket.out_cents)}</Td>
                    <Td align="right">{exactMoney(bucket.in_cents - bucket.out_cents)}</Td>
                  </tr>
                ))}
              </tbody>
            </GridPanel>

            <GridPanel title="Receivables grid">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <Th>Bucket</Th>
                  <Th align="right">Balance</Th>
                </tr>
              </thead>
              <tbody>
                {(receivables?.aging ?? []).map((bucket) => (
                  <tr key={bucket.key} className="border-b border-slate-100 last:border-0">
                    <Td>{bucket.label}</Td>
                    <Td align="right">{exactMoney(bucket.cents)}</Td>
                  </tr>
                ))}
              </tbody>
            </GridPanel>

            <GridPanel title="Payment methods grid">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <Th>Method</Th>
                  <Th align="right">Collected</Th>
                </tr>
              </thead>
              <tbody>
                {paymentMethodRows.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-sm text-slate-500" colSpan={2}>No received payments in this view.</td>
                  </tr>
                ) : paymentMethodRows.map((row) => (
                  <tr key={row.label} className="border-b border-slate-100 last:border-0">
                    <Td>{row.label}</Td>
                    <Td align="right">{exactMoney(row.cents)}</Td>
                  </tr>
                ))}
              </tbody>
            </GridPanel>

            <GridPanel title="Invoice status grid">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <Th>Status</Th>
                  <Th align="right">Count</Th>
                  <Th align="right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {invoiceStatusRows.map((row) => (
                  <tr key={row.label} className="border-b border-slate-100 last:border-0">
                    <Td>{row.label}</Td>
                    <Td align="right">{row.count}</Td>
                    <Td align="right">{exactMoney(row.balanceCents)}</Td>
                  </tr>
                ))}
              </tbody>
            </GridPanel>
          </section>
        )}
      </main>
    </div>
  )
}

function AccountingAttentionRow({ icon, tone, title, detail, amount, action, to }: { icon: string; tone: 'red' | 'amber'; title: string; detail: string; amount: string; action: string; to: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className={`h-2.5 w-2.5 rounded-full ${tone === 'red' ? 'bg-red-500' : 'bg-amber-600'}`} />
      <span className="text-lg">{icon}</span>
      <div className="min-w-[220px] flex-1">
        <div className="font-semibold text-slate-950">{title}</div>
        <div className="text-sm text-slate-500">{detail}</div>
      </div>
      <strong className="font-mono text-slate-950">{amount}</strong>
      <Link to={to} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-amber-300 hover:bg-amber-50">{action}</Link>
    </div>
  )
}

function AccountingWorkflowTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      className={`shrink-0 border-b-3 px-4 py-3 text-sm font-semibold transition-colors ${active ? 'border-amber-500 text-slate-950' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
    >
      {children}
    </button>
  )
}
function AccountingWorkflowCard({ title, icon, description, children }: { title: string; icon: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2"><span>{icon}</span><h3 className="font-bold text-slate-950">{title}</h3></div>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      <div className="mt-4 divide-y divide-slate-100">{children}</div>
    </section>
  )
}

function AccountingToolLink({ to, label, detail }: { to: string; label: string; detail: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800 group-hover:text-amber-700">{label}</span><span className="block truncate text-xs text-slate-500">{detail}</span></span>
      <span className="text-amber-700">→</span>
    </Link>
  )
}
function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'green' | 'red' | 'amber' | 'blue' }) {
  const color = {
    green: 'text-emerald-700',
    red: 'text-red-700',
    amber: 'text-amber-700',
    blue: 'text-sky-700',
  }[tone]
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 truncate text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

function DashboardLinkPanel({
  to,
  title,
  subtitle,
  className = '',
  actionLabel = 'View details',
  children,
}: {
  to: string
  title: string
  subtitle: string
  className?: string
  actionLabel?: string
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className={`block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-amber-300 hover:bg-amber-50/30 ${className}`}
    >
      <div className="mb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-amber-700">{actionLabel}</span>
        </div>
      </div>
      {children}
    </Link>
  )
}

function MiniStat({ label, value, helper, danger = false }: { label: string; value: string | number; helper: string; danger?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${danger ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${danger ? 'text-red-700' : 'text-slate-900'}`}>{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{helper}</div>
    </div>
  )
}

function StatementMiniStat({
  label,
  value,
  helper,
  tone,
}: {
  label: string
  value: string
  helper?: string
  tone: 'green' | 'red' | 'amber' | 'blue'
}) {
  const styles = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-sky-200 bg-sky-50 text-sky-800',
  }[tone]

  return (
    <div className={`rounded-lg border p-3 ${styles}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 truncate text-lg font-bold tabular-nums">{value}</div>
      {helper ? <div className="mt-0.5 truncate text-xs opacity-80">{helper}</div> : null}
    </div>
  )
}

function GridPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">{children}</table>
      </div>
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`py-2 pr-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <td className={`py-2 pr-3 ${align === 'right' ? 'text-right font-mono' : 'text-left'}`}>{children}</td>
}
