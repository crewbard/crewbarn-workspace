import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { API_URL, apiRequest, getActingTenant, getFranchiseActAs, getStoredToken } from '@/lib/api'
import {
  SalesTaxDetailOverlay,
  type SalesTaxInvoiceRow,
} from '@/components/reports/SalesTaxDetailOverlay'

/**
 * Sales Tax Report — for filing season.
 *
 * Shows gross / taxable / non-taxable sales + total tax collected for
 * a date range, with a per-jurisdiction breakdown (FL State 6 %,
 * Brevard County 1 %, etc.). The state filing form usually asks for
 * the totals plus the split, so we print both.
 *
 * Date basis: invoice issued_at. Drafts and cancelled / voided
 * invoices are excluded — only "actually-happened" sales count.
 *
 * Presets cover the common filing windows: this/last month, this/last
 * quarter, YTD. Custom range available too.
 */

interface SalesTaxReport {
  from: string
  to: string
  invoice_count: number
  totals: {
    gross_sales_cents: number
    taxable_cents: number
    non_taxable_cents: number
    tax_collected_cents: number
  }
  tax_breakdown: {
    state_tax_collected_cents: number
    county_local_tax_collected_cents: number
    other_tax_collected_cents: number
    total_tax_collected_cents: number
  }
  invoices: SalesTaxInvoiceRow[]
  by_jurisdiction: Array<{
    bucket: string
    bucket_label: string
    jurisdiction: string | null
    remit_to: string | null
    rate_pct: number
    tax_collected_cents: number
  }>
  filing: {
    filings: Array<{
      id: string
      filed_on: string
      period_from: string
      period_to: string
      amount_cents: number
      reference: string | null
    }>
    paid_cents: number
    outstanding_cents: number
    status: 'filed' | 'unfiled' | 'short' | 'overpaid' | 'nothing_due'
    tracked_from: string | null
    running_owed_cents: number | null
    collected_since_cents: number | null
    filed_since_cents: number | null
  }
}

// Local calendar day, NOT toISOString(). Tax windows are calendar-based and
// the clock here is Eastern, so a UTC conversion pushes every evening onto
// tomorrow — which on 31 Dec made "Year to date" run into the next year.
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function dollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

async function downloadReport(path: string, filename: string) {
  const headers: Record<string, string> = { Accept: '*/*' }
  const token = getStoredToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const actingTenant = getActingTenant()
  if (actingTenant) headers['X-Act-As-Tenant'] = actingTenant
  const franchiseActAs = getFranchiseActAs()
  if (franchiseActAs) headers['X-Franchise-Act-As'] = franchiseActAs.id

  const response = await fetch(`${API_URL}${path}`, { headers })
  if (!response.ok) throw new Error(`Report download failed (${response.status})`)
  const blob = await response.blob()
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
}

// Window-of-time presets. Today is "now"; everything calculated off
// the user's local clock — sales-tax windows are calendar-based.
// A specific month or quarter of a specific year. The relative presets below
// cover the routine filing, but "amend last year's Q4" needs a way to name the
// period rather than type two dates.
function quarterRange(year: number, q: number): { from: string; to: string } {
  return {
    from: isoDay(new Date(year, q * 3, 1)),
    to: isoDay(new Date(year, q * 3 + 3, 0)),
  }
}
function monthRange(year: number, monthIndex: number): { from: string; to: string } {
  return {
    from: isoDay(new Date(year, monthIndex, 1)),
    to: isoDay(new Date(year, monthIndex + 1, 0)),
  }
}
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function rangePresets(): Record<string, { from: string; to: string; label: string }> {
  const today = new Date()
  const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
  const q = Math.floor(today.getMonth() / 3)
  const startOfThisQuarter = new Date(today.getFullYear(), q * 3, 1)
  const startOfLastQuarter = new Date(
    q === 0 ? today.getFullYear() - 1 : today.getFullYear(),
    q === 0 ? 9 : (q - 1) * 3,
    1,
  )
  const endOfLastQuarter = new Date(startOfThisQuarter.getTime() - 24 * 60 * 60 * 1000)
  const startOfYear = new Date(today.getFullYear(), 0, 1)

  return {
    this_month: { label: 'This month', from: isoDay(startOfThisMonth), to: isoDay(today) },
    last_month: { label: 'Last month', from: isoDay(startOfLastMonth), to: isoDay(endOfLastMonth) },
    this_quarter: {
      label: 'This quarter',
      from: isoDay(startOfThisQuarter),
      to: isoDay(today),
    },
    last_quarter: {
      label: 'Last quarter',
      from: isoDay(startOfLastQuarter),
      to: isoDay(endOfLastQuarter),
    },
    ytd: { label: 'Year to date', from: isoDay(startOfYear), to: isoDay(today) },
  }
}

const FILING_TITLE: Record<string, string> = {
  filed: 'Filed and paid',
  unfiled: 'Not filed yet',
  short: 'Partly paid',
  overpaid: 'Overpaid',
  nothing_due: 'Nothing due',
}

/**
 * Sales tax, as a view rather than a page.
 *
 * It renders in two places: its own route, reached from the accounting nav,
 * and an overlay opened from the reports front door. The filing workflow is
 * the reason it isn't one of the generic report specs — recording a payment
 * and reading a total are different jobs, and only this one has both.
 */
export function SalesTaxReportView({
  embedded = false,
  onClose,
}: {
  embedded?: boolean
  onClose?: () => void
}) {
  const presets = useMemo(rangePresets, [])
  const queryClient = useQueryClient()
  // Default to last month — common filing cadence is monthly in
  // Florida for small businesses.
  const [from, setFrom] = useState<string>(presets.last_month.from)
  const [to, setTo] = useState<string>(presets.last_month.to)
  const [paidOn, setPaidOn] = useState<string>(isoDay(new Date()))
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [referenceNumber, setReferenceNumber] = useState<string>('')
  const [jumpYear, setJumpYear] = useState<number>(new Date().getFullYear())
  const [showFilingForm, setShowFilingForm] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  const query = useQuery({
    queryKey: ['sales-tax-report', from, to],
    queryFn: () =>
      apiRequest<{ data: SalesTaxReport }>(
        `/v1/reports/sales-tax?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    enabled: !!from && !!to,
  })

  const report = query.data?.data

  const filing = report?.filing
  // Prefill what's actually left, not what was collected — after a partial
  // filing the outstanding figure is the one being paid.
  const dueCents = filing ? filing.outstanding_cents : report?.totals.tax_collected_cents

  useEffect(() => {
    if (dueCents === undefined) return
    setPaymentAmount((Math.max(0, dueCents) / 100).toFixed(2))
  }, [dueCents])

  // Reopening the form is per-period; carrying the toggle across ranges would
  // show a payment box on a period that's already settled.
  useEffect(() => {
    setShowFilingForm(false)
  }, [from, to])

  const paymentMutation = useMutation({
    mutationFn: () => {
      const amountCents = Math.round(Number(paymentAmount || 0) * 100)
      return apiRequest<{ data: unknown; duplicate?: boolean }>('/v1/accounting/sales-tax-payments', {
        method: 'POST',
        body: {
          paid_on: paidOn,
          from,
          to,
          amount_cents: amountCents,
          reference_number: referenceNumber.trim() || undefined,
          cash_account_code: '1010',
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      queryClient.invalidateQueries({ queryKey: ['sales-tax-report'] })
      setReferenceNumber('')
      setShowFilingForm(false)
    },
  })

  function applyPreset(key: keyof typeof presets) {
    const p = presets[key]
    setFrom(p.from)
    setTo(p.to)
  }

  const reportBase = `/v1/reports/sales-tax?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`

  return (
    <div
      className={
        embedded
          ? 'space-y-5'
          // 70% of the viewport, centred, once there's room for it. Below lg
          // that would leave a column too narrow for the jurisdiction table, so
          // it goes full width with padding instead.
          : 'mx-auto w-full space-y-6 px-4 py-4 sm:px-6 sm:py-6 lg:w-[70%]'
      }
    >
      {/* Header — print:hidden so the printed page is just the report.
          No action buttons: downloading belongs with the detail you are
          downloading, which is the review overlay below. */}
      <div className="print:hidden">
        <div>
          <div className="text-xs text-slate-500 mb-1">
            {embedded ? (
              <button
                type="button"
                onClick={onClose}
                className="text-[12px] font-bold text-[#B4762A] hover:text-[#8a5a1f]"
              >
                &larr; All questions
              </button>
            ) : (
              <Link to="/accounting" className="hover:text-slate-700">
                &larr; Accounting
              </Link>
            )}
          </div>
          <h1 className={embedded ? 'text-[26px] font-bold text-[#0A1220]' : 'text-3xl font-semibold text-slate-900'}>
            Sales Tax Report
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Totals + per-jurisdiction breakdown for the filing form. Includes invoices in{' '}
            <em>sent</em> or <em>paid</em> status with an issue date in the window.
          </p>
        </div>
      </div>

      {/* Range controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          {Object.entries(presets).map(([key, p]) => {
            const isActive = p.from === from && p.to === to
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key as keyof typeof presets)}
                className={`text-xs px-3 py-1.5 rounded-full border ${
                  isActive
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-amber-300'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        {/* Naming a period beats typing two dates — and it's the only way to
            reach a closed year once the relative presets have rolled past it. */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-xs font-medium text-slate-500">Jump to</span>
          <select
            value={jumpYear}
            onChange={(e) => setJumpYear(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs tabular-nums"
          >
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {[0, 1, 2, 3].map((q) => {
            const r = quarterRange(jumpYear, q)
            const isActive = r.from === from && r.to === to
            return (
              <button
                key={q}
                type="button"
                onClick={() => { setFrom(r.from); setTo(r.to) }}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  isActive
                    ? 'border-amber-500 bg-amber-500 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-amber-300'
                }`}
              >
                Q{q + 1}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => {
              setFrom(isoDay(new Date(jumpYear, 0, 1)))
              setTo(isoDay(new Date(jumpYear, 11, 31)))
            }}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              from === isoDay(new Date(jumpYear, 0, 1)) && to === isoDay(new Date(jumpYear, 11, 31))
                ? 'border-amber-500 bg-amber-500 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-amber-300'
            }`}
          >
            Full year
          </button>
          <select
            value={
              MONTH_NAMES.findIndex((_, i) => {
                const r = monthRange(jumpYear, i)
                return r.from === from && r.to === to
              })
            }
            onChange={(e) => {
              const i = Number(e.target.value)
              if (i < 0) return
              const r = monthRange(jumpYear, i)
              setFrom(r.from)
              setTo(r.to)
            }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          >
            <option value={-1}>Month…</option>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-700 mb-1">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700 mb-1">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </label>
        </div>
      </div>

      {report && filing && (
        <div
          className={`rounded-xl border p-4 print:hidden ${
            filing.status === 'filed'
              ? 'border-emerald-200 bg-emerald-50/70'
              : filing.status === 'nothing_due'
                ? 'border-slate-200 bg-white'
                : 'border-amber-200 bg-amber-50/60'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                {filing.status === 'filed' && <span className="text-emerald-600">&#10003;</span>}
                {FILING_TITLE[filing.status]}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {filing.status === 'nothing_due'
                  ? 'No tax was collected in this window, so there is nothing to remit.'
                  : filing.status === 'unfiled'
                    ? 'Nothing has been remitted for this period yet.'
                    : filing.status === 'short'
                      ? `Paid $${dollars(filing.paid_cents)} of $${dollars(report.totals.tax_collected_cents)} — $${dollars(filing.outstanding_cents)} still owed on this period.`
                      : filing.status === 'overpaid'
                        ? `Paid $${dollars(filing.paid_cents)} against $${dollars(report.totals.tax_collected_cents)} collected — $${dollars(-filing.outstanding_cents)} more than this period called for.`
                        : `$${dollars(filing.paid_cents)} remitted.`}
              </p>

              {filing.filings.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {filing.filings.map((f) => {
                    const isOpen = f.period_from === from && f.period_to === to
                    return (
                      <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                        <span>
                          <span className="font-mono font-semibold tabular-nums">${dollars(f.amount_cents)}</span>
                          {' paid '}
                          <span className="tabular-nums">{f.filed_on}</span>
                          {' for '}
                          <span className="tabular-nums">{f.period_from} to {f.period_to}</span>
                          {f.reference && <span className="text-slate-500"> &middot; {f.reference}</span>}
                        </span>
                        {/* Filings show up when you're looking at a window that
                            contains them, which for a quarter is three months at
                            once. This reopens the exact period that was filed, so
                            the totals below are the ones on that return — and the
                            PDF and spreadsheet buttons then export that. */}
                        <button
                          type="button"
                          disabled={isOpen}
                          onClick={() => {
                            setFrom(f.period_from)
                            setTo(f.period_to)
                          }}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11.5px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-45"
                        >
                          {isOpen ? 'Showing' : 'Report'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* The one number a new calendar year does not reset. Absent
                  until something has been filed here, because before that
                  there is no honest place to start counting from. */}
              {filing.running_owed_cents !== null && filing.tracked_from && (
                <p className="mt-3 text-xs text-slate-500">
                  Owed across all periods through {to}:{' '}
                  <span
                    className={`font-mono font-semibold tabular-nums ${
                      filing.running_owed_cents > 0 ? 'text-slate-900' : 'text-emerald-700'
                    }`}
                  >
                    ${dollars(filing.running_owed_cents)}
                  </span>
                  {filing.running_owed_cents > 0
                    ? ' — charged on invoices but not yet remitted, including anything carried in from earlier years.'
                    : filing.running_owed_cents < 0
                      ? ' — more has been remitted than was charged on invoices.'
                      : ' — everything charged has been remitted.'}
                  <br />
                  <span className="text-slate-400">
                    ${dollars(filing.collected_since_cents ?? 0)} charged less $
                    {dollars(filing.filed_since_cents ?? 0)} filed, counting from{' '}
                    <span className="tabular-nums">{filing.tracked_from}</span> — the earliest
                    period filed here. Anything before that was filed outside CrewBarn.
                  </span>
                </p>
              )}
            </div>

            {(filing.status === 'filed' || filing.status === 'overpaid') && !showFilingForm && (
              <button
                type="button"
                onClick={() => setShowFilingForm(true)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Record another payment
              </button>
            )}
          </div>

          {(showFilingForm || filing.status === 'unfiled' || filing.status === 'short') && (
            <div className="mt-4 border-t border-slate-200/70 pt-4">
              <p className="mb-2 text-sm text-slate-600">
                Posts a journal entry: debit Sales Tax Payable and credit Checking.
              </p>
              {paymentMutation.isSuccess && (
                <p className="mb-2 text-sm font-medium text-emerald-700">Sales tax payment posted.</p>
              )}
              {paymentMutation.isError && (
                <p className="mb-2 text-sm font-medium text-red-700">
                  {(paymentMutation.error as Error)?.message || 'Could not post sales tax payment.'}
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-[150px_150px_minmax(180px,1fr)_auto] sm:items-end">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-700">Paid on</span>
                  <input
                    type="date"
                    value={paidOn}
                    onChange={(e) => setPaidOn(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-700">Amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-700">Reference</span>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Check, EFT, or filing confirmation"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={paymentMutation.isPending || !paidOn || Number(paymentAmount || 0) <= 0}
                  onClick={() => paymentMutation.mutate()}
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {paymentMutation.isPending ? 'Posting...' : 'Post payment'}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Filed for {from} to {to}. That period is what marks this report paid, so change the
                range above before posting if you filed a different window.
              </p>
            </div>
          )}

          {/* Under the payment controls on purpose: check the invoices, then
              record what you filed. */}
          <div className="mt-4 border-t border-slate-200/70 pt-4">
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Review report
            </button>
            <span className="ml-3 text-xs text-slate-500">
              Every invoice behind this total, with the tax on each — and the PDF and spreadsheet.
            </span>
          </div>
        </div>
      )}

      {showDetail && report && (
        <SalesTaxDetailOverlay
          from={from}
          to={to}
          rows={report.invoices ?? []}
          taxTotalCents={report.totals.tax_collected_cents}
          onClose={() => setShowDetail(false)}
          onDownload={(format) =>
            downloadReport(
              `${reportBase}&detail=1&format=${format}`,
              `sales-tax-detail-${from}-${to}.${format}`,
            ).catch((error) =>
              window.alert(error instanceof Error ? error.message : 'Could not download report.'),
            )
          }
        />
      )}

      {/* The actual report — visible AND prints cleanly */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 print:border-0 print:shadow-none print:p-0">
        <div className="border-b border-slate-200 pb-3 mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Sales Tax Report · {from} to {to}
          </h2>
          {report && (
            <p className="text-xs text-slate-500 mt-0.5">
              {report.invoice_count} invoice{report.invoice_count === 1 ? '' : 's'} included
            </p>
          )}
        </div>

        {query.isLoading && (
          <div className="text-sm text-slate-500 py-12 text-center">Calculating…</div>
        )}
        {query.isError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            Failed to load report. {(query.error as Error)?.message}
          </div>
        )}

        {report && (
          <div className="space-y-6">
            {/* Sales totals — what the filing form asks for first */}
            <section>
              <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-600 mb-2">
                Sales totals
              </h3>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  <Row label="Total sales (gross)" amount={report.totals.gross_sales_cents} />
                  <Row
                    label="  Non-taxable (resale certs, exempt customers, etc.)"
                    amount={report.totals.non_taxable_cents}
                    muted
                  />
                  <Row
                    label="  Taxable"
                    amount={report.totals.taxable_cents}
                    muted
                  />
                </tbody>
              </table>
            </section>

            <section>
              <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-600 mb-2">
                Tax summary
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <TaxSummaryCard label="State tax" amount={report.tax_breakdown.state_tax_collected_cents} />
                <TaxSummaryCard label="County/local tax" amount={report.tax_breakdown.county_local_tax_collected_cents} />
                <TaxSummaryCard label="Other tax" amount={report.tax_breakdown.other_tax_collected_cents} muted />
                <TaxSummaryCard label="Total tax" amount={report.tax_breakdown.total_tax_collected_cents} strong />
              </div>
            </section>

            {/* Tax collected total + breakdown */}
            <section>
              <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-600 mb-2">
                Jurisdiction split
              </h3>
              {report.by_jurisdiction.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No tax collected in this period.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-2 font-medium">Type</th>
                      <th className="py-2 font-medium">Jurisdiction</th>
                      <th className="py-2 font-medium">Remit to</th>
                      <th className="py-2 font-medium text-right">Rate</th>
                      <th className="py-2 font-medium text-right">Collected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.by_jurisdiction.map((row, i) => (
                      <tr key={i}>
                        <td className="py-2 text-slate-700">
                          {row.bucket_label || 'Other tax'}
                        </td>
                        <td className="py-2 text-slate-800">
                          {row.jurisdiction ?? <em className="text-slate-400">—</em>}
                        </td>
                        <td className="py-2 text-slate-700">
                          {row.remit_to ?? <em className="text-slate-400">—</em>}
                        </td>
                        <td className="py-2 text-right font-mono text-slate-700 tabular-nums">
                          {row.rate_pct.toFixed(3)}%
                        </td>
                        <td className="py-2 text-right font-mono text-slate-900 tabular-nums">
                          ${dollars(row.tax_collected_cents)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-300 font-bold">
                      <td colSpan={4} className="py-2 text-right text-slate-900">
                        Total tax collected
                      </td>
                      <td className="py-2 text-right font-mono text-slate-900 tabular-nums">
                        ${dollars(report.totals.tax_collected_cents)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </section>

            {report.filing.filings.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Filed
                </h3>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {report.filing.filings.map((f) => (
                      <tr key={f.id}>
                        <td className="py-2 text-slate-700">
                          Paid {f.filed_on} for {f.period_from} to {f.period_to}
                          {f.reference && <span className="text-slate-500"> &middot; {f.reference}</span>}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-slate-900">
                          ${dollars(f.amount_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <p className="text-[11px] text-slate-400 italic pt-2 border-t border-slate-100">
              Per-jurisdiction split uses the frozen tax snapshot stored when each
              invoice was issued. Older invoices without a snapshot fall back to the
              tax class configuration so totals still reconcile.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/** The route. Everything above renders the same either way. */
export function SalesTaxReportPage() {
  return <SalesTaxReportView />
}

function TaxSummaryCard({
  label,
  amount,
  muted = false,
  strong = false,
}: {
  label: string
  amount: number
  muted?: boolean
  strong?: boolean
}) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${strong ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold tabular-nums ${muted ? 'text-slate-500' : 'text-slate-900'}`}>
        ${(amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </div>
    </div>
  )
}
function Row({
  label,
  amount,
  muted = false,
}: {
  label: string
  amount: number
  muted?: boolean
}) {
  return (
    <tr>
      <td className={`py-2 ${muted ? 'text-slate-600' : 'text-slate-900 font-medium'}`}>
        {label}
      </td>
      <td
        className={`py-2 text-right font-mono tabular-nums ${
          muted ? 'text-slate-600' : 'text-slate-900 font-semibold'
        }`}
      >
        ${(amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </td>
    </tr>
  )
}
