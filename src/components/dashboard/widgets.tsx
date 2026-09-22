import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { useEstimates } from '@/hooks/useEstimates'
import { useWarranties } from '@/hooks/useWarranties'
import { useInvoices } from '@/hooks/useInvoices'
import { useDashboardSummary } from '@/hooks/useDashboardSummary'
import { listConversations, type CommsConversation } from '@/lib/comms'
import { MiniBarChart, DualBarChart, DualLineChart, StackedBarChart } from './MiniBarChart'
import { Gauge } from './Gauge'
import { TechMiniMap, type TechMarker } from './TechMiniMap'
import { bucketByRange, bucketGrouped, type DashRange } from '@/lib/dashboardTime'
import { TeamMessagesWidget } from './TeamMessagesWidget'

/** Distinct, repeatable color palette for per-tech / per-method segments. */
const SEGMENT_PALETTE = [
  '#15803d', '#2563eb', '#E8902C', '#9333ea', '#dc2626',
  '#0891b2', '#ca8a04', '#db2777', '#65a30d', '#475569',
]
function colorForIndex(groups: string[]): (g: string) => string {
  const idx = new Map(groups.map((g, i) => [g, i]))
  return (g) => SEGMENT_PALETTE[(idx.get(g) ?? 0) % SEGMENT_PALETTE.length]
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  check: 'Check',
  card_manual: 'Card (manual)',
  card_terminal: 'Card (terminal)',
  ach: 'ACH',
  paypal: 'PayPal',
  godaddy: 'GoDaddy',
  other: 'Other',
}

/**
 * Dashboard widgets — each is a self-contained card the tenant can add,
 * remove, and drag around. All read from EXISTING endpoints (no new
 * backend). Chart widgets honor the global Day/Month/Year range.
 *
 * Registry at the bottom: DASHBOARD_WIDGETS + DEFAULT_WIDGET_IDS.
 */

/** Coerce anything to an array — guards against a non-array API shape
 *  (e.g. a 422 error body) reaching a .filter/.map and crashing a widget. */
function asArray<T>(x: unknown): T[] {
  return Array.isArray(x) ? (x as T[]) : []
}

type ChartType = 'bar' | 'line'

/** Persisted per-widget chart-type choice (localStorage). */
function useChartType(key: string): [ChartType, (t: ChartType) => void] {
  const [t, setT] = useState<ChartType>(() => {
    try {
      return localStorage.getItem(key) === 'line' ? 'line' : 'bar'
    } catch {
      return 'bar'
    }
  })
  const set = (v: ChartType) => {
    setT(v)
    try {
      localStorage.setItem(key, v)
    } catch {
      /* ignore */
    }
  }
  return [t, set]
}

function ChartTypeToggle({ value, onChange }: { value: ChartType; onChange: (t: ChartType) => void }) {
  return (
    <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-[11px]">
      {(['bar', 'line'] as ChartType[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={[
            'px-2 py-0.5 font-medium capitalize transition-colors',
            value === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50',
          ].join(' ')}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

function fmtUsd(cents: number): string {
  // Show exact dollars-and-cents. Rounding to whole dollars overstated money
  // ($197.95 → $198) and disagreed with the customer/invoice screens.
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function relDays(iso: string | null): string {
  if (!iso) return ''
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return `${-days}d ago`
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `${days}d`
}

// ---------- Shared card shell ----------

function WidgetCard({
  title,
  to,
  toLabel = 'View all →',
  accent = 'slate',
  fill = false,
  children,
}: {
  title: string
  to?: string
  toLabel?: string
  accent?: 'slate' | 'amber' | 'emerald' | 'rose' | 'sky'
  /** Chart widgets: content fills the tile height (no scroll) instead of
   *  scrolling. Lay the chart into a `flex-1 min-h-0` slot so it shrinks. */
  fill?: boolean
  children: ReactNode
}) {
  const ring: Record<string, string> = {
    slate: 'border-slate-200',
    amber: 'border-amber-200',
    emerald: 'border-emerald-200',
    rose: 'border-rose-200',
    sky: 'border-sky-200',
  }
  return (
    <div className={`h-full flex flex-col bg-white border ${ring[accent]} rounded-xl p-4 sm:p-5`}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-sm font-semibold text-navy-900 truncate">{title}</h2>
        {to && (
          <Link to={to} className="text-xs text-amber-700 hover:underline font-medium shrink-0">
            {toLabel}
          </Link>
        )}
      </div>
      <div className={`flex-1 min-h-0 ${fill ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
        {children}
      </div>
    </div>
  )
}

function Loading({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 bg-slate-100 rounded animate-pulse" />
      ))}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500 py-4">{children}</p>
}

// ---------- Cash collected (chart, range-aware) ----------

interface PaymentRow {
  amount_cents: number
  received_at: string | null
  created_at: string | null
  payment_method: string
  collected_by_email: string | null
}

type CashBreakdown = 'tech' | 'method'

/** Header framing — "Month" = THIS month's number, not a trailing-window sum. */
const DASH_PERIOD_LABEL: Record<DashRange, string> = {
  day: 'today',
  month: 'this month',
  quarter: 'this quarter',
  year: 'this year',
} as Record<DashRange, string>

function CashCollectedWidget({ range }: { range: DashRange }) {
  const q = useQuery({
    queryKey: ['dash', 'payments-received'],
    queryFn: () =>
      apiRequest<{ data: PaymentRow[] }>('/v1/payments?status=received&per_page=500').catch(
        () => ({ data: [] as PaymentRow[] }),
      ),
    staleTime: 60_000,
  })
  const [mode, setMode] = useState<CashBreakdown>(() => {
    try {
      return localStorage.getItem('crewbarn_dash_cash_breakdown') === 'method' ? 'method' : 'tech'
    } catch {
      return 'tech'
    }
  })
  const setBreakdown = (m: CashBreakdown) => {
    setMode(m)
    try {
      localStorage.setItem('crewbarn_dash_cash_breakdown', m)
    } catch {
      /* ignore */
    }
  }

  const rows = q.data?.data ?? []
  const groupOf = (r: PaymentRow) =>
    mode === 'tech'
      ? r.collected_by_email?.split('@')[0] ?? 'Unknown'
      : PAYMENT_METHOD_LABELS[r.payment_method] ?? r.payment_method ?? 'Other'

  const { buckets, groups } = bucketGrouped(
    rows.map((r) => ({ at: r.received_at ?? r.created_at, cents: r.amount_cents, group: groupOf(r) })),
    range,
  )
  const colorFor = colorForIndex(groups)
  const total = buckets.reduce(
    (s, b) => s + groups.reduce((bs, g) => bs + (b.byGroup[g] ?? 0), 0),
    0,
  )

  return (
    <WidgetCard title="Cash collected" to="/accounting/cash-drawer" toLabel="Cash drawer →" accent="emerald" fill>
      {q.isLoading ? (
        <Loading rows={3} />
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3 mb-1 flex-wrap shrink-0">
            <div className="text-2xl font-bold text-navy-900">{fmtUsd(total)}</div>
            <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-[11px]">
              {(['tech', 'method'] as CashBreakdown[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setBreakdown(m)}
                  className={[
                    'px-2 py-0.5 font-medium capitalize transition-colors',
                    mode === m ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {m === 'tech' ? 'By tech' : 'By method'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <StackedBarChart data={buckets} groups={groups} colorFor={colorFor} fill />
          </div>
          {groups.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 shrink-0">
              {groups.slice(0, 8).map((g) => (
                <span key={g} className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colorFor(g) }} />
                  {g}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  )
}

// ---------- Money in / out (chart, range-aware) ----------

function MoneyInOutWidget({ range }: { range: DashRange }) {
  const q = useDashboardSummary(range)
  const d = q.data?.data.cashflow
  const net = d?.totals.net_cents ?? 0
  const [chartType, setChartType] = useChartType('crewbarn_dash_money_chart')
  const series = asArray<{ label: string; in_cents: number; out_cents: number }>(d?.buckets).map((b) => ({
    label: b.label,
    inCents: b.in_cents,
    outCents: b.out_cents,
  }))
  return (
    <WidgetCard title="Money in / out" to="/accounting" toLabel="Money →" accent="emerald" fill>
      {q.isLoading || !d ? (
        <Loading rows={3} />
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap shrink-0">
            <div className="flex items-baseline gap-4 flex-wrap">
              <span className="text-sm" title="Accrual basis — invoiced (earned) this period">
                Invoiced <span className="font-bold text-navy-900">{fmtUsd(d.totals.invoiced_cents)}</span>
              </span>
              <span className="text-sm" title="Cash basis — collected (received) this period">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 mr-1 align-middle" />
                In <span className="font-bold text-navy-900">{fmtUsd(d.totals.in_cents)}</span>
              </span>
              <span className="text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-red-600 mr-1 align-middle" />
                Out <span className="font-bold text-navy-900">{fmtUsd(d.totals.out_cents)}</span>
              </span>
              {/* The period these figures cover — was a cross-year rolling sum. */}
              <span className="text-xs text-slate-400">{d.period?.label ?? ''}</span>
              <span className={`text-sm font-semibold ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                Net {net >= 0 ? '+' : '−'}{fmtUsd(Math.abs(net))}
              </span>
            </div>
            <ChartTypeToggle value={chartType} onChange={setChartType} />
          </div>
          <div className="flex-1 min-h-0">
            {chartType === 'line' ? (
              <DualLineChart data={series} fill />
            ) : (
              <DualBarChart data={series} fill />
            )}
          </div>
        </>
      )}
    </WidgetCard>
  )
}

// ---------- Outstanding balance ----------

interface InvoiceRow {
  money?: { balance_due_cents?: number; total_cents?: number }
  is_overdue: boolean
  due_at?: string | null
  terms?: string | null
  status?: string
}

/** Open balance lives in invoice.money.balance_due_cents (not top-level). */
function balanceOf(i: InvoiceRow): number {
  return i.money?.balance_due_cents ?? 0
}

function OutstandingBalanceWidget() {
  const data = useInvoices({ per_page: 500 })
  const invoices = asArray<InvoiceRow>(data.data)
  const open = invoices.filter((i) => balanceOf(i) > 0)
  const overdue = open.filter((i) => i.is_overdue)
  const current = open.filter((i) => !i.is_overdue)
  const overdueCents = overdue.reduce((s, i) => s + balanceOf(i), 0)
  const currentCents = current.reduce((s, i) => s + balanceOf(i), 0)
  const total = overdueCents + currentCents

  return (
    <WidgetCard title="Outstanding balance" to="/accounting" toLabel="Money →" accent="amber" fill>
      {data.isLoading ? (
        <Loading rows={3} />
      ) : (
        <>
          <div className="shrink-0">
            <div className="text-2xl font-bold text-navy-900">{fmtUsd(total)}</div>
            <div className="text-xs text-slate-500 mb-2">
              {open.length} open invoice{open.length === 1 ? '' : 's'}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <MiniBarChart
              fill
              data={[
                { label: 'Current', cents: currentCents },
                { label: 'Overdue', cents: overdueCents },
              ]}
              color="#E8902C"
            />
          </div>
          {overdueCents > 0 && (
            <div className="mt-2 text-xs text-red-700 font-medium shrink-0">
              {fmtUsd(overdueCents)} overdue
            </div>
          )}
        </>
      )}
    </WidgetCard>
  )
}

// ---------- Receivables (Net 30): aging / vs collected / by term ----------

type RxView = 'aging' | 'expected' | 'term'

const AGING_BUCKETS = [
  { key: 'notdue', label: 'Not due', color: '#15803d' },
  { key: '1-30', label: '1–30', color: '#ca8a04' },
  { key: '31-60', label: '31–60', color: '#E8902C' },
  { key: '61-90', label: '61–90', color: '#dc2626' },
  { key: '90+', label: '90+', color: '#991b1b' },
]

function totalOf(i: InvoiceRow): number {
  return i.money?.total_cents ?? 0
}

function ReceivablesWidget({ range }: { range: DashRange }) {
  const [view, setView] = useState<RxView>(() => {
    try {
      const v = localStorage.getItem('crewbarn_dash_rx_view')
      return v === 'expected' || v === 'term' ? (v as RxView) : 'aging'
    } catch {
      return 'aging'
    }
  })
  const setRxView = (v: RxView) => {
    setView(v)
    try {
      localStorage.setItem('crewbarn_dash_rx_view', v)
    } catch {
      /* ignore */
    }
  }

  // Aging + by-term + totals come from the backend (exact day buckets,
  // server-parsed terms). The "vs Collected" view stays client-side.
  const rx = useDashboardSummary(range)
  const d = rx.data?.data.receivables
  const totalOpen = d?.total_open_cents ?? 0
  const openCount = d?.open_count ?? 0

  const inv = useInvoices({ per_page: 500 })
  const pay = useQuery({
    queryKey: ['dash', 'payments-received'],
    queryFn: () =>
      apiRequest<{ data: PaymentRow[] }>('/v1/payments?status=received&per_page=500').catch(
        () => ({ data: [] as PaymentRow[] }),
      ),
    staleTime: 60_000,
    enabled: view === 'expected',
  })

  let body: ReactNode = null
  let legend: ReactNode = null

  if (view === 'aging') {
    const aging = asArray<{ key: string; label: string; cents: number }>(d?.aging)
    const colorByKey: Record<string, string> = Object.fromEntries(AGING_BUCKETS.map((b) => [b.key, b.color]))
    body = (
      <MiniBarChart
        data={aging.map((a) => ({ label: a.label, cents: a.cents }))}
        colorAt={(i) => colorByKey[aging[i].key] ?? '#64748b'}
        fill
      />
    )
  } else if (view === 'term') {
    const terms = asArray<{ term: string; cents: number }>(d?.by_term)
    const colorFor = colorForIndex(terms.map((t) => t.term))
    body = (
      <MiniBarChart
        data={terms.map((t) => ({ label: t.term, cents: t.cents }))}
        colorAt={(i) => colorFor(terms[i].term)}
        fill
      />
    )
  } else {
    // vs Collected — what came due each period vs what we actually collected.
    const collected = bucketByRange(
      asArray<PaymentRow>(pay.data?.data).map((p) => ({ at: p.received_at ?? p.created_at, cents: p.amount_cents })),
      range,
    )
    const due = bucketByRange(
      asArray<InvoiceRow>(inv.data).filter((i) => i.due_at).map((i) => ({ at: i.due_at ?? null, cents: totalOf(i) })),
      range,
    )
    const series = collected.map((c, idx) => ({
      label: c.label,
      inCents: c.cents,
      outCents: due[idx]?.cents ?? 0,
    }))
    body = <DualBarChart data={series} inColor="#15803d" outColor="#E8902C" fill />
    legend = (
      <div className="mt-1 flex gap-3 text-[11px] text-slate-600 shrink-0">
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-600 mr-1 align-middle" />Collected</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500 mr-1 align-middle" />Came due</span>
      </div>
    )
  }

  return (
    <WidgetCard title="Receivables (Net 30)" to="/accounting" toLabel="Money →" accent="amber" fill>
      {rx.isLoading ? (
        <Loading rows={3} />
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3 mb-1 flex-wrap shrink-0">
            <div>
              <span className="text-2xl font-bold text-navy-900">{fmtUsd(totalOpen)}</span>
              <span className="text-xs text-slate-500 ml-2">{openCount} open</span>
            </div>
            <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-[11px]">
              {(['aging', 'expected', 'term'] as RxView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRxView(v)}
                  className={[
                    'px-2 py-0.5 font-medium transition-colors',
                    view === v ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {v === 'aging' ? 'Aging' : v === 'expected' ? 'vs Collected' : 'By term'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0">{body}</div>
          {legend}
        </>
      )}
    </WidgetCard>
  )
}

// ---------- Revenue gauge ----------

function RevenueGaugeWidget({ range }: { range: DashRange }) {
  const s = useDashboardSummary(range)
  const cf = s.data?.data.cashflow
  // BOTH bases for the SELECTED calendar period (never a cross-year window):
  // invoiced = accrual (earned), collected = cash (received).
  const invoiced = cf?.totals.invoiced_cents ?? 0
  const collected = cf?.totals.in_cents ?? 0
  const periodLabel = cf?.period.label ?? ''
  const outstanding = s.data?.data.receivables.total_open_cents ?? 0
  // Of what you BILLED this period, how much has come in?
  const rate = invoiced > 0 ? Math.min(1, collected / invoiced) : 0
  const loading = s.isLoading

  return (
    <WidgetCard title="Revenue" to="/accounting" toLabel="Money →" accent="sky" fill>
      {loading ? (
        <Loading rows={3} />
      ) : (
        <>
          <div className="flex-1 min-h-0 flex items-end justify-center">
            <Gauge value={rate} color="#3b82f6" fill />
          </div>
          <div className="shrink-0 mt-1">
            <div className="grid grid-cols-2 gap-1 text-center">
              <div>
                <div className="text-[9px] uppercase tracking-wide text-slate-400">Invoiced</div>
                <div className="text-sm font-bold text-navy-900 leading-tight">{fmtUsd(invoiced)}</div>
                <div className="text-[9px] text-slate-400">accrual</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wide text-slate-400">Collected</div>
                <div className="text-sm font-bold text-emerald-700 leading-tight">{fmtUsd(collected)}</div>
                <div className="text-[9px] text-slate-400">cash</div>
              </div>
            </div>
            <div className="mt-1 text-center text-[10px] uppercase tracking-wide text-slate-400">
              {periodLabel} · {fmtUsd(outstanding)} open A/R
            </div>
          </div>
        </>
      )}
    </WidgetCard>
  )
}

// ---------- Average revenue per job ----------

function AvgRevenuePerJobWidget({ range }: { range: DashRange }) {
  const q = useDashboardSummary(range)
  const d = q.data?.data.avg_job_revenue ?? { jobs: 0, total_cents: 0, avg_cents: 0 }
  const revenueTrend = asArray<{ label: string; in_cents: number }>(q.data?.data.cashflow.buckets)
    .map((b) => ({ label: b.label, cents: b.in_cents }))
  // The figure is for the SELECTED calendar period — say which one, rather than
  // the old "last 12 months" (a rolling window that straddles two tax years).
  const rangeLabel = q.data?.data.avg_job_revenue.period?.label ?? DASH_PERIOD_LABEL[range]

  return (
    <WidgetCard title="Avg revenue / job" to="/jobs" toLabel="Jobs →" accent="emerald">
      {q.isLoading ? (
        <Loading rows={2} />
      ) : (
        <div className="flex h-full flex-col">
          <div className="text-3xl font-bold text-navy-900 text-center">{fmtUsd(d.avg_cents)}</div>
          <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400 text-center">per completed job</div>
          <div className="mt-3 text-sm text-slate-600 text-center">
            {d.jobs} completed {d.jobs === 1 ? 'job' : 'jobs'} · {fmtUsd(d.total_cents)} total
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400 text-center">{rangeLabel}</div>
          <div className="mt-3">
            <MiniBarChart data={revenueTrend} color="#15803d" height={90} />
          </div>
        </div>
      )}
    </WidgetCard>
  )
}

// ---------- Company metrics (KPI strip) ----------

function CompanyMetricsWidget({ range }: { range: DashRange }) {
  const dash = useDashboardSummary(range)
  const approved = useEstimates({ status: 'approved', per_page: 100 })

  const totals = dash.data?.data.cashflow.totals ?? { in_cents: 0, out_cents: 0, net_cents: 0 }
  // THIS period (server 'current') — the trailing-window sum read as a
  // period number is how $550k of history got labeled "this month".
  const curr = (dash.data?.data.cashflow as { current?: { in_cents: number; out_cents: number; net_cents: number } } | undefined)?.current
    ?? { in_cents: 0, out_cents: 0, net_cents: 0 }
  const buckets = asArray<{ label: string; in_cents: number; out_cents: number }>(dash.data?.data.cashflow.buckets)
    .map((b) => ({ label: b.label, inCents: b.in_cents, outCents: b.out_cents }))
  const avgData = dash.data?.data.avg_job_revenue ?? { jobs: 0, total_cents: 0, avg_cents: 0 }
  const outstanding = dash.data?.data.receivables.total_open_cents ?? 0
  const openCount = dash.data?.data.receivables.open_count ?? 0
  const acceptedRows = approved.data?.data ?? []
  const acceptedTotal = acceptedRows.reduce((s, e) => s + (e.money?.total_cents ?? 0), 0)

  const pl = DASH_PERIOD_LABEL[range] ?? 'this period'
  const stats: Array<{ label: string; value: string; tone?: string }> = [
    { label: `Collected (${pl})`, value: fmtUsd(curr.in_cents), tone: 'text-emerald-700' },
    { label: `Spent (${pl})`, value: fmtUsd(curr.out_cents), tone: 'text-red-700' },
    { label: `Net (${pl})`, value: fmtUsd(curr.net_cents), tone: curr.net_cents >= 0 ? 'text-emerald-700' : 'text-red-700' },
    { label: 'Outstanding', value: fmtUsd(outstanding), tone: 'text-amber-700' },
    { label: 'Open invoices', value: String(openCount) },
    { label: 'Accepted est.', value: fmtUsd(acceptedTotal) },
  ]

  return (
    <WidgetCard title="Company metrics" accent="slate">
      {dash.isLoading ? (
        <Loading rows={3} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.7fr)] gap-3 flex-1 min-h-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 gap-2 content-start">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 min-h-[54px] shadow-[0_1px_0_rgba(15,23,42,0.03)]"
              >
                <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold truncate">{s.label}</div>
                <div className={`mt-1 text-[clamp(1.05rem,1.35vw,1.35rem)] leading-none font-bold tabular-nums whitespace-nowrap ${s.tone ?? 'text-navy-900'}`}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          <div className="min-h-[190px] flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between gap-3 shrink-0">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Average revenue</div>
                <div className="mt-1 text-2xl font-bold leading-none text-navy-900 tabular-nums">{fmtUsd(avgData.avg_cents)}</div>
                <div className="mt-2 text-xs text-slate-500">
                  {avgData.jobs} completed {avgData.jobs === 1 ? 'job' : 'jobs'} - {fmtUsd(avgData.total_cents)}
                </div>
              </div>
              <div className={`text-right text-sm font-semibold tabular-nums ${totals.net_cents >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                Net {totals.net_cents >= 0 ? '+' : '-'}{fmtUsd(Math.abs(totals.net_cents))}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-600 shrink-0">
              <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-600 mr-1.5 align-middle" />In {fmtUsd(totals.in_cents)}</span>
              <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600 mr-1.5 align-middle" />Out {fmtUsd(totals.out_cents)}</span>
            </div>
            <div className="mt-4 h-24 min-h-[96px]">
              <DualBarChart data={buckets} height={96} />
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  )
}

// ---------- Estimates accepted ----------

function EstimatesAcceptedWidget() {
  const q = useEstimates({ status: 'approved', per_page: 25 })
  const rows = q.data?.data ?? []
  return (
    <WidgetCard title="Estimates accepted — ready to schedule" to="/estimates?status=approved" accent="emerald">
      {q.isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>Nothing to convert right now.</Empty>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 6).map((est) => (
            <li key={est.id} className="text-sm">
              <Link to={`/estimates/${est.id}`} className="text-slate-800 hover:text-emerald-700 truncate block">
                <span className="font-medium">{est.display_number ?? est.estimate_number}</span>
                {' · '}
                {est.customer?.display_name ?? '—'}
                <span className="text-slate-400"> · {fmtUsd(est.money.total_cents)}</span>
              </Link>
            </li>
          ))}
          {rows.length > 6 && <li className="text-[11px] text-slate-400 italic">+ {rows.length - 6} more</li>}
        </ul>
      )}
    </WidgetCard>
  )
}

// ---------- Estimates waiting on customer ----------

function EstimatesWaitingWidget() {
  const q = useEstimates({ status: 'sent', per_page: 25 })
  const rows = q.data?.data ?? []
  return (
    <WidgetCard title="Estimates waiting for approval" to="/estimates?status=sent" accent="slate">
      {q.isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>Every sent estimate has been actioned.</Empty>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 6).map((est) => (
            <li key={est.id} className="text-sm">
              <Link to={`/estimates/${est.id}`} className="text-slate-800 hover:text-amber-700 truncate block">
                <span className="font-medium">{est.display_number ?? est.estimate_number}</span>
                {' · '}
                {est.customer?.display_name ?? '—'}
                <span className="text-slate-400"> · {fmtUsd(est.money.total_cents)}</span>
              </Link>
            </li>
          ))}
          {rows.length > 6 && <li className="text-[11px] text-slate-400 italic">+ {rows.length - 6} more</li>}
        </ul>
      )}
    </WidgetCard>
  )
}

// ---------- Unanswered messages ----------

function UnansweredMessagesWidget() {
  const q = useQuery({
    queryKey: ['dash', 'unanswered-messages'],
    queryFn: () =>
      listConversations({ unread: true }).catch(() => [] as CommsConversation[]),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const rows = asArray<CommsConversation>(q.data)
  // Customer texted last (inbound) = needs a reply.
  const unanswered = rows.filter((c) => c.last_direction === 'inbound' || c.unread_count > 0)
  return (
    <WidgetCard title="Unanswered messages" to="/communications" toLabel="Inbox →" accent="sky">
      {q.isLoading ? (
        <Loading />
      ) : unanswered.length === 0 ? (
        <Empty>Inbox is clear — no one's waiting on a reply.</Empty>
      ) : (
        <ul className="space-y-1.5">
          {unanswered.slice(0, 6).map((c) => (
            <li key={c.id} className="text-sm">
              <Link to="/communications" className="block truncate">
                <span className="font-medium text-navy-900">{c.customer_name || c.external_number}</span>
                <span className="text-slate-500"> · {relDays(c.last_message_at)}</span>
                {c.last_message_preview && (
                  <span className="block text-xs text-slate-500 truncate">{c.last_message_preview}</span>
                )}
              </Link>
            </li>
          ))}
          {unanswered.length > 6 && (
            <li className="text-[11px] text-slate-400 italic">+ {unanswered.length - 6} more</li>
          )}
        </ul>
      )}
    </WidgetCard>
  )
}

// ---------- Techs (live GPS) ----------

interface Position {
  account_id: string | null
  latitude: number
  longitude: number
  recorded_at: string | null
}

function TechsLiveWidget() {
  const q = useQuery({
    queryKey: ['dash', 'tech-positions'],
    queryFn: () =>
      apiRequest<{ data: { positions: Position[] } }>('/v1/dispatch/positions').catch(
        () => ({ data: { positions: [] as Position[] } }),
      ),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
  const positions = asArray<Position>(q.data?.data?.positions).filter(
    (p) => p.account_id && p.latitude != null && p.longitude != null,
  )
  const isStale = (p: Position) =>
    !p.recorded_at || Date.now() - new Date(p.recorded_at).getTime() >= 10 * 60_000
  const fresh = positions.filter((p) => !isStale(p))
  const markers: TechMarker[] = positions.map((p) => ({
    id: String(p.account_id),
    lat: p.latitude,
    lng: p.longitude,
    stale: isStale(p),
  }))

  return (
    <WidgetCard title="Techs on the map" to="/dispatch" toLabel="Open full map →" accent="sky">
      {q.isLoading ? (
        <Loading rows={2} />
      ) : (
        <div className="flex flex-col h-full gap-2">
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-navy-900">{fresh.length}</span> reporting GPS
            {positions.length > fresh.length && ` · ${positions.length - fresh.length} stale`}
          </div>
          <TechMiniMap markers={markers} height={180} />
        </div>
      )}
    </WidgetCard>
  )
}

// ---------- Pending turnover (cash drawer) ----------

interface TurnoverRow {
  id: string
  customer_name: string | null
  amount_cents: number
  payment_method: string
  collected_by_email: string | null
}

function PendingTurnoverWidget() {
  const q = useQuery({
    queryKey: ['dash', 'pending-turnover'],
    queryFn: () =>
      apiRequest<{ data: TurnoverRow[] }>('/v1/payments?status=pending_turnover').catch(
        () => ({ data: [] as TurnoverRow[] }),
      ),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const rows = q.data?.data ?? []
  const total = rows.reduce((s, r) => s + r.amount_cents, 0)
  return (
    <WidgetCard title="Cash to turn in (from techs)" to="/accounting/cash-drawer" toLabel="Confirm →" accent="amber">
      {q.isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>No field collections waiting to be turned in.</Empty>
      ) : (
        <>
          <div className="text-2xl font-bold text-navy-900">{fmtUsd(total)}</div>
          <div className="text-xs text-slate-500 mb-2">{rows.length} payment{rows.length === 1 ? '' : 's'} pending</div>
          <ul className="space-y-1">
            {rows.slice(0, 5).map((r) => (
              <li key={r.id} className="text-xs text-slate-600 truncate">
                {r.collected_by_email?.split('@')[0] ?? 'tech'} · {r.customer_name ?? '—'} · {fmtUsd(r.amount_cents)}
              </li>
            ))}
          </ul>
        </>
      )}
    </WidgetCard>
  )
}

// ---------- Needs attention (stale jobs) ----------

interface StaleJob {
  id: string
  wo_number: string
  customer: string | null
}
interface StaleSnapshotResp {
  data: {
    unbilled_completed: { count: number; total_dollars: number; top: StaleJob[] }
    past_scheduled_open: { count: number; top: StaleJob[] }
    dormant: { count: number; top: StaleJob[] }
    needs_parts: { count: number; top: StaleJob[] }
    parts_ordered: { count: number; top: StaleJob[] }
    missing_photos?: { count: number; top: StaleJob[] }
    no_payment?: { count: number; total_dollars: number; top: StaleJob[] }
  }
}

function NeedsAttentionWidget() {
  const q = useQuery({
    queryKey: ['dashboard', 'stale-snapshot'],
    queryFn: () => apiRequest<StaleSnapshotResp>('/v1/work-orders/stale-snapshot'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const s = q.data?.data
  return (
    <WidgetCard title="Needs attention" to="/jobs" accent="rose">
      {q.isLoading || !s ? (
        <Loading rows={3} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Stat label="No payment" value={s.no_payment?.count ?? 0} sub={(s.no_payment?.count ?? 0) > 0 ? `$${(s.no_payment?.total_dollars ?? 0).toLocaleString()}` : null} tone="rose" to="/jobs?stale=no_payment" />
          <Stat label="No invoice" value={s.unbilled_completed.count} sub={s.unbilled_completed.count > 0 ? `$${s.unbilled_completed.total_dollars.toLocaleString()}` : null} tone="emerald" to="/jobs?stale=unbilled_completed" />
          <Stat label="No photos" value={s.missing_photos?.count ?? 0} sub={null} tone="amber" to="/jobs?stale=missing_photos" />
          <Stat label="Past-due" value={s.past_scheduled_open.count} sub={null} tone="rose" to="/jobs?stale=past_scheduled_open" />
          <Stat label="Needs parts" value={s.needs_parts.count} sub={null} tone="amber" to="/jobs?stale=needs_parts" />
          <Stat label="Parts ordered" value={s.parts_ordered.count} sub={null} tone="sky" to="/jobs?stale=parts_ordered" />
          <Stat label="Dormant" value={s.dormant.count} sub={null} tone="amber" to="/jobs?stale=dormant" />
        </div>
      )}
    </WidgetCard>
  )
}

function Stat({ label, value, sub, tone, to }: { label: string; value: number; sub: string | null; tone: 'emerald' | 'rose' | 'amber' | 'sky'; to?: string }) {
  const toneCls = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:border-emerald-400',
    rose: 'bg-rose-50 border-rose-200 text-rose-800 hover:border-rose-400',
    amber: 'bg-amber-50 border-amber-200 text-amber-800 hover:border-amber-400',
    sky: 'bg-sky-50 border-sky-200 text-sky-800 hover:border-sky-400',
  }[tone]
  const inner = (
    <>
      <div className="text-xl font-bold text-navy-900">{value}</div>
      <div className="text-[11px] font-medium">{label}</div>
      {sub && <div className="text-[10px] text-slate-500 truncate">{sub}</div>}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={`border rounded-lg p-2 text-center block transition-colors ${toneCls}`}>
        {inner}
      </Link>
    )
  }
  return <div className={`border rounded-lg p-2 text-center ${toneCls}`}>{inner}</div>
}

// ---------- Inspections due ----------

interface InspectionDueRow {
  asset_id: string
  asset_name: string
  days_until_due: number | null
  is_overdue: boolean
  customer: { id: string; display_name: string } | null
}

function InspectionsDueWidget() {
  const q = useQuery({
    queryKey: ['inspections-due', 30],
    queryFn: () => apiRequest<{ data: InspectionDueRow[] }>('/v1/inspections/due?within_days=30'),
    staleTime: 5 * 60_000,
  })
  const rows = q.data?.data ?? []
  return (
    <WidgetCard title="Inspections due (30 days)" accent="amber">
      {q.isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>No inspections due in the next month.</Empty>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 6).map((r) => (
            <li key={r.asset_id} className="text-sm flex items-center justify-between gap-2">
              <span className="truncate text-slate-800">
                {r.asset_name}
                <span className="text-slate-400"> · {r.customer?.display_name ?? '—'}</span>
              </span>
              <span className={`text-xs shrink-0 ${r.is_overdue ? 'text-red-700 font-semibold' : 'text-amber-700'}`}>
                {r.days_until_due == null ? '—' : r.days_until_due < 0 ? `${-r.days_until_due}d late` : `${r.days_until_due}d`}
              </span>
            </li>
          ))}
          {rows.length > 6 && <li className="text-[11px] text-slate-400 italic">+ {rows.length - 6} more</li>}
        </ul>
      )}
    </WidgetCard>
  )
}

// ---------- Warranties expiring ----------

function WarrantiesWidget() {
  const { data, isLoading } = useWarranties({ expiring_within: 30, per_page: 25 })
  const rows = data ?? []
  return (
    <WidgetCard title="Warranties expiring (30 days)" to="/warranties?status=active" accent="amber">
      {isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>No warranties expiring this month.</Empty>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 6).map((w) => (
            <li key={w.id} className="text-sm truncate text-slate-800">
              {w.catalog_item_name}
              <span className="text-slate-400"> · {w.customer?.display_name ?? '—'}</span>
            </li>
          ))}
          {rows.length > 6 && <li className="text-[11px] text-slate-400 italic">+ {rows.length - 6} more</li>}
        </ul>
      )}
    </WidgetCard>
  )
}

// ---------- Quick actions ----------

function QuickActionsWidget() {
  const actions: Array<{ to: string; label: string }> = [
    { to: '/jobs/new', label: 'New job' },
    { to: '/estimates/new', label: 'New estimate' },
    { to: '/customers/new', label: 'New customer' },
    { to: '/schedule', label: 'Schedule' },
  ]
  return (
    <WidgetCard title="Quick actions" accent="slate">
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50 px-3 py-3 text-sm font-medium text-navy-900 text-center transition-colors"
          >
            {a.label}
          </Link>
        ))}
      </div>
    </WidgetCard>
  )
}

// ---------- Registry ----------

export interface DashboardWidgetDef {
  id: string
  title: string
  description: string
  /** Column span on the lg 4-col grid. */
  span: 1 | 2
  Component: React.ComponentType<{ range: DashRange }>
}

export const DASHBOARD_WIDGETS: DashboardWidgetDef[] = [
  { id: 'company-metrics', title: 'Company metrics', description: 'Headline numbers: collected, spent, net, outstanding.', span: 2, Component: ({ range }) => <CompanyMetricsWidget range={range} /> },
  { id: 'revenue-gauge', title: 'Revenue', description: 'Collection gauge — collected vs outstanding.', span: 1, Component: ({ range }) => <RevenueGaugeWidget range={range} /> },
  { id: 'avg-job-revenue', title: 'Avg revenue / job', description: 'Average revenue per completed job over the window.', span: 1, Component: ({ range }) => <AvgRevenuePerJobWidget range={range} /> },
  { id: 'money-flow', title: 'Money in / out', description: 'Cash in (payments) vs out (sub payouts + POs) over time.', span: 2, Component: ({ range }) => <MoneyInOutWidget range={range} /> },
  { id: 'cash-collected', title: 'Cash collected', description: 'Payments received over time (Day/Month/Year).', span: 2, Component: ({ range }) => <CashCollectedWidget range={range} /> },
  { id: 'outstanding-balance', title: 'Outstanding balance', description: 'Open invoice balance, current vs overdue.', span: 1, Component: () => <OutstandingBalanceWidget /> },
  { id: 'receivables', title: 'Receivables (Net 30)', description: 'AR aging, collected-vs-due, or open balance by term.', span: 2, Component: ({ range }) => <ReceivablesWidget range={range} /> },
  { id: 'needs-attention', title: 'Needs attention', description: 'Unbilled, past-due, and dormant jobs.', span: 1, Component: () => <NeedsAttentionWidget /> },
  { id: 'techs-live', title: 'Techs on the map', description: 'Live GPS count + jump to the dispatch map.', span: 1, Component: () => <TechsLiveWidget /> },
  { id: 'unanswered-messages', title: 'Unanswered messages', description: 'Customer texts waiting on a reply.', span: 1, Component: () => <UnansweredMessagesWidget /> },
  { id: 'estimates-accepted', title: 'Estimates accepted', description: 'Approved estimates ready to schedule.', span: 1, Component: () => <EstimatesAcceptedWidget /> },
  { id: 'estimates-waiting', title: 'Estimates waiting', description: 'Sent estimates awaiting a decision.', span: 1, Component: () => <EstimatesWaitingWidget /> },
  { id: 'pending-turnover', title: 'Cash to turn in', description: 'Field-collected cash/checks pending turnover.', span: 1, Component: () => <PendingTurnoverWidget /> },
  { id: 'inspections-due', title: 'Inspections due', description: 'Assets due for inspection in 30 days.', span: 1, Component: () => <InspectionsDueWidget /> },
  { id: 'warranties', title: 'Warranties expiring', description: 'Warranties expiring in the next 30 days.', span: 1, Component: () => <WarrantiesWidget /> },
  { id: 'quick-actions', title: 'Quick actions', description: 'Shortcuts to create jobs, estimates, customers.', span: 1, Component: () => <QuickActionsWidget /> },
  { id: 'team-messages', title: 'Team messages', description: 'Internal tech ↔ office threads — read + reply.', span: 1, Component: () => <TeamMessagesWidget /> },
]

/** Default board for a fresh user. */
export const DEFAULT_WIDGET_IDS: string[] = [
  'company-metrics',
  'revenue-gauge',
  'avg-job-revenue',
  'money-flow',
  'receivables',
  'outstanding-balance',
  'needs-attention',
  'techs-live',
  'unanswered-messages',
  'team-messages',
  'estimates-accepted',
  'pending-turnover',
  'quick-actions',
]

export const WIDGET_BY_ID = new Map(DASHBOARD_WIDGETS.map((w) => [w.id, w]))
