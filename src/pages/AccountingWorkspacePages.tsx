import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL, apiRequest, getActingTenant, getFranchiseActAs, getStoredToken } from '@/lib/api'

type WorkspaceAction = {
  label: string
  to?: string
  disabled?: boolean
}

type WorkspaceCard = {
  title: string
  text: string
  actions: WorkspaceAction[]
}

type TechPerformanceRow = {
  tech_id: string | null
  tech_name: string
  job_count: number
  clock_hours: number
  pay_type: string | null
  revenue_cents: number
  paid_cents: number
  parts_sub_cost_cents: number
  labor_cost_cents: number
  commission_cost_cents: number
  parts_commission_cost_cents: number
  sick_hours_earned: number
  vacation_hours_earned: number
  vacation_accrual_cents: number
  reimbursable_expense_cents: number
  reimbursable_pending_cents: number
  reimbursable_approved_cents: number
  reimbursable_reimbursed_cents: number
  cost_cents: number
  margin_cents: number
  margin_pct: number | null
  average_ticket_cents: number
}

type TechPerformanceReport = {
  from: string
  to: string
  totals: {
    tech_count: number
    job_count: number
    revenue_cents: number
    paid_cents: number
    parts_sub_cost_cents: number
    labor_cost_cents: number
    commission_cost_cents: number
    parts_commission_cost_cents: number
    sick_hours_earned: number
    vacation_hours_earned: number
    vacation_accrual_cents: number
    reimbursable_expense_cents: number
    reimbursable_pending_cents: number
    reimbursable_approved_cents: number
    reimbursable_reimbursed_cents: number
    cost_cents: number
    margin_cents: number
    average_ticket_cents: number
  }
  rows: TechPerformanceRow[]
}

type PtoBalanceRow = {
  account_id: string
  tech_name: string
  email: string | null
  pay_type: string | null
  sick_days_per_quarter: number
  vacation_accrual_percent: number
  sick_hours_available: number
  sick_hours_used: number
  sick_hours_remaining: number
  vacation_hours_available: number
  vacation_hours_used: number
  vacation_hours_remaining: number
  pto_hours_available: number
  pto_hours_used: number
  pto_hours_remaining: number
  paid_leave_hours: number
  paid_leave_cost_cents: number
  unpaid_hours_used: number
  other_hours_used: number
}

type PtoBalancesReport = {
  from: string
  to: string
  totals: {
    tech_count: number
    sick_hours_available: number
    sick_hours_used: number
    vacation_hours_available: number
    vacation_hours_used: number
    pto_hours_available: number
    pto_hours_used: number
    paid_leave_hours: number
    paid_leave_cost_cents: number
    unpaid_hours_used: number
    other_hours_used: number
  }
  rows: PtoBalanceRow[]
}

type PayrollCloseoutResponse = {
  data: {
    id: string
  }
  duplicate?: boolean
  totals?: {
    from: string
    to: string
    payroll_cost_cents: number
  }
}

type PayrollRunRecord = {
  id: string
  journal_entry_id: string | null
  from: string
  to: string
  status: string
  tech_count: number
  job_count: number
  clock_minutes: number
  labor_cost_cents: number
  commission_cost_cents: number
  parts_commission_cost_cents: number
  vacation_accrual_cents: number
  paid_leave_hours: number
  paid_leave_cost_cents: number
  payroll_cost_cents: number
  paid_cents: number
  balance_cents: number
  posted_at: string | null
  lines?: PayrollRunLineRecord[] | null
  payments?: PayrollPaymentRecord[] | null
}

type PayrollRunLineRecord = {
  id: string
  account_id: string | null
  tech_name: string
  job_count: number
  clock_minutes: number
  labor_cost_cents: number
  commission_cost_cents: number
  parts_commission_cost_cents: number
  vacation_accrual_cents: number
  paid_leave_hours: number
  paid_leave_cost_cents: number
  payroll_cost_cents: number
}

type PayrollPaymentRecord = {
  id: string
  payroll_run_id: string
  journal_entry_id: string | null
  amount_cents: number
  paid_on: string | null
  payment_method: string
  cash_account_code: string
  reference_number?: string | null
  memo?: string | null
  paid_by_account_id?: string | null
  created_at?: string | null
}

type ReceiptAttachment = {
  id: string
  original_filename?: string | null
  url?: string | null
  thumbnail_url?: string | null
  mime_type?: string | null
}

type ReimbursementExpense = {
  id: string
  expense_date: string | null
  category: string
  description: string
  amount_cents: number
  tax_cents: number
  status: string
  reimbursement_status: string
  receipt_attachment_ids?: string[]
  receipt_attachments?: ReceiptAttachment[]
  payment_method?: string | null
  reference_number?: string | null
  employee?: {
    id: string
    name?: string | null
    email?: string | null
  } | null
  vendor?: {
    id: string
    name: string
    display_name?: string | null
  } | null
  work_order?: {
    id: string
    job_number?: string | null
    title?: string | null
  } | null
}

type CustomerCreditRegisterRow = {
  customer_credit_id: string
  status: string
  customer_id: string
  customer_name: string | null
  work_order_number: string | null
  source_type: string
  payment_method: string | null
  payment_reference: string | null
  amount_cents: number
  applied_cents: number
  refunded_cents: number
  balance_cents: number
  notes: string | null
  created_at: string | null
  payment_received_at: string | null
}

type CustomerCreditRegisterReport = {
  from: string
  to: string
  status_state: string | null
  totals: {
    credit_count: number
    amount_cents: number
    applied_cents: number
    refunded_cents: number
    balance_cents: number
  }
  rows: CustomerCreditRegisterRow[]
}

type ExpenseRegisterSummaryRow = {
  expense_id: string
  expense_date: string | null
  category: string
  description: string
  vendor_name: string | null
  employee_name: string | null
  employee_email: string | null
  work_order_number: string | null
  total_cents: number
  status: string
  reimbursable: boolean
  reimbursement_status: string
  billable_to_job: boolean
}

type ExpenseRegisterSummaryReport = {
  from: string
  to: string
  totals: {
    expense_count: number
    amount_cents: number
    tax_cents: number
    total_cents: number
    reimbursable_cents: number
    reimbursement_pending_cents: number
    reimbursement_approved_cents: number
    reimbursement_reimbursed_cents: number
    billable_cents: number
  }
  by_category: Array<{ category: string; count: number; total_cents: number }>
  by_reimbursement_status: Array<{ status: string; count: number; total_cents: number }>
  rows: ExpenseRegisterSummaryRow[]
}

type Contractor1099SummaryReport = {
  year: number
  threshold_cents: number
  totals: {
    contractor_count: number
    review_count: number
    missing_w9_count: number
    paid_cents: number
    review_cents: number
  }
}

type ApAgingSummaryReport = {
  as_of: string
  totals: {
    bill_count: number
    balance_cents: number
  }
  buckets: Array<{ bucket: string; label: string; count: number; balance_cents: number }>
}

type InventoryValuationReport = {
  as_of: string
  totals: {
    stock_row_count: number
    qty_on_hand: number
    qty_available: number
    inventory_value_cents: number
    available_value_cents: number
  }
  by_location: Array<{
    location_name: string
    row_count: number
    qty_on_hand: number
    inventory_value_cents: number
  }>
  rows: Array<{
    stock_level_id: string
    item_name: string | null
    sku: string | null
    location_name: string | null
    bin_name: string | null
    qty_on_hand: number
    qty_available: number
    unit_cost_cents: number
    inventory_value_cents: number
  }>
}

type InventorySpendReport = {
  from: string
  to: string
  group_by: string
  totals: {
    po_count: number
    line_count: number
    qty_ordered: number
    qty_received: number
    spend_cents: number
  }
  rows: Array<{
    key: string
    label: string
    po_count: number
    line_count: number
    qty_ordered: number
    qty_received: number
    spend_cents: number
  }>
}

type PurchaseOrderRegisterReport = {
  from: string
  to: string
  totals: {
    purchase_order_count: number
    subtotal_cents: number
    tax_cents: number
    shipping_cents: number
    total_cents: number
  }
  by_status: Array<{ status: string; count: number; total_cents: number }>
  rows: Array<{
    purchase_order_id: string
    po_number: string
    vendor_name: string | null
    status: string
    order_date: string | null
    received_at: string | null
    item_count: number
    total_cents: number
  }>
}

type BankReconciliationReport = {
  from: string
  to: string
  totals: {
    transaction_count: number
    matched_count: number
    unmatched_count: number
    ignored_count: number
    deposit_cents: number
    withdrawal_cents: number
    net_cents: number
    matched_cents: number
    unmatched_cents: number
  }
  by_status: Array<{ status: string; count: number; net_cents: number }>
  rows: Array<{
    bank_transaction_id: string
    transaction_date: string | null
    description: string
    memo: string | null
    amount_cents: number
    transaction_type: string
    source: string
    bank_account_name: string | null
    bank_account_last4: string | null
    match_status: string
    matched_type: string | null
    matched_id: string | null
  }>
}

type ReconciliationRunRecord = {
  id: string
  bank_account_name: string | null
  bank_account_last4: string | null
  statement_start_date: string | null
  statement_end_date: string | null
  statement_ending_balance_cents: number
  cleared_deposit_cents: number
  cleared_withdrawal_cents: number
  book_ending_balance_cents: number
  difference_cents: number
  status: string
  updated_at: string | null
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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

function humanize(value: string | null | undefined) {
  if (!value) return 'Unassigned'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function dollarsToCents(value: string): number {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function csvCell(value: unknown): string {
  const raw = value == null ? '' : String(value)
  return `"${raw.replace(/"/g, '""')}"`
}

function htmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]): boolean {
  if (rows.length === 0) {
    return false
  }

  const csv = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return true
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
  if (!response.ok) {
    let message = `Could not export ${filename}. Server returned HTTP ${response.status}.`
    try {
      const text = await response.text()
      if (text) {
        try {
          const body = JSON.parse(text)
          const serverMessage = typeof body?.message === 'string'
            ? body.message
            : typeof body?.error === 'string'
              ? body.error
              : null
          if (serverMessage && serverMessage !== 'Server Error') {
            message = serverMessage
          }
        } catch {
          if (!text.trim().startsWith('<')) {
            message = text.trim().slice(0, 300)
          }
        }
      }
    } catch {
      // Keep the HTTP status message when the export body cannot be read.
    }
    throw new Error(message)
  }
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

const payrollCards: WorkspaceCard[] = [
  {
    title: 'Compensation setup',
    text: 'Hourly, salary, commission-only, service commission, parts commission, and effective-dated pay rules.',
    actions: [
      { label: 'Open staff', to: '/tool-shed/staff' },
      { label: 'Pay profiles', to: '/accounting/payroll/profiles' },
    ],
  },
  {
    title: 'Time off cost',
    text: 'Vacation, sick, holiday, unpaid, and PTO hours separated from revenue-producing labor.',
    actions: [
      { label: 'Open time off', to: '/tool-shed/time-off' },
      { label: 'Payroll balances', to: '/accounting/payroll' },
    ],
  },
  {
    title: 'Technician expense reports',
    text: 'Fuel, tolls, emergency parts, tools, travel, and reimbursable expenses with receipt photos.',
    actions: [
      { label: 'Open expenses', to: '/accounting/expenses/register' },
      { label: 'Use cost model', to: '/tool-shed/cost-model' },
    ],
  },
  {
    title: 'Tech profitability',
    text: 'Revenue minus wages, salary allocation, commission, paid time off, expenses, fuel, callbacks, parts cost, and overhead.',
    actions: [
      { label: 'Tech report', to: '/reports?layout=browser&report=tech-performance' },
      { label: 'Payroll review', to: '/accounting/payroll' },
    ],
  },
]

const expenseCards: WorkspaceCard[] = [
  {
    title: 'Bills and AP',
    text: 'Vendor bills, due dates, balances, approvals, bill payments, and AP aging.',
    actions: [
      { label: 'Vendors', to: '/vendors' },
      { label: 'Open bills', to: '/accounting/expenses/bills' },
      { label: 'AP aging', to: '/reports?layout=browser&report=ap-aging' },
      { label: 'Bill report', to: '/reports?layout=browser&report=vendor-bill-register' },
    ],
  },
  {
    title: 'Expense register',
    text: 'Non-inventory spend such as fuel, rent, software, insurance, repairs, advertising, and bank fees.',
    actions: [
      { label: 'Cost model', to: '/tool-shed/cost-model' },
      { label: 'Open register', to: '/accounting/expenses/register' },
      { label: 'Expense report', to: '/reports?layout=browser&report=expense-register' },
    ],
  },
  {
    title: 'Receipt capture',
    text: 'Upload job receipts from the job page or record company spend in the register, then route reimbursements through payroll.',
    actions: [
      { label: 'Open register', to: '/accounting/expenses/register' },
      { label: 'Payroll review', to: '/accounting/payroll' },
    ],
  },
]

const inventoryCostCards: WorkspaceCard[] = [
  {
    title: 'PO spend',
    text: 'Spend by PO #, vendor, order date, received date, item, category, unit cost, and total cost.',
    actions: [
      { label: 'Purchase orders', to: '/purchase-orders' },
      { label: 'Spend report', to: '/reports?layout=browser&report=inventory-spend' },
      { label: 'PO report', to: '/reports?layout=browser&report=purchase-order-register' },
    ],
  },
  {
    title: 'Inventory valuation',
    text: 'Current on-hand quantity and extended value by warehouse, bin, truck, item, and category.',
    actions: [
      { label: 'Inventory', to: '/inventory' },
      { label: 'Valuation report', to: '/reports?layout=browser&report=inventory-valuation' },
    ],
  },
  {
    title: 'Movement audit',
    text: 'Received, transferred, installed, returned, adjusted, written off, and reconciled stock movement history.',
    actions: [
      { label: 'Movements', to: '/inventory/movements' },
      { label: 'Reconciliations', to: '/inventory/reconciliations' },
    ],
  },
]

const bankMatchCards: WorkspaceCard[] = [
  {
    title: 'Statement import',
    text: 'Paste CSV bank statements or add manual rows. No bank credentials, no transfers, no ACH.',
    actions: [
      { label: 'Open review', to: '/accounting/bank-match/review' },
      { label: 'Audit log', to: '/tool-shed/audit-log' },
    ],
  },
  {
    title: 'Suggested matches',
    text: 'Match bank records to CrewBarn payments, vendor bills, expenses, purchase orders, and other reconciled rows.',
    actions: [
      { label: 'Review matches', to: '/accounting/bank-match/review' },
      { label: 'Cash drawer', to: '/accounting/cash-drawer' },
    ],
  },
  {
    title: 'Reconciliation exports',
    text: 'Filter bank rows by date, status, and type, then export the visible reconciliation queue for bookkeeping.',
    actions: [
      { label: 'Export rows', to: '/accounting/bank-match/review' },
      { label: 'Report browser', to: '/reports?layout=browser&report=bank-reconciliation' },
    ],
  },
]

export function CustomerCreditsWorkspacePage() {
  const defaultRange = useMemo(() => {
    const now = new Date()
    return {
      from: `${now.getFullYear() - 2}-01-01`,
      to: isoDate(now),
    }
  }, [])
  const [from, setFrom] = useState(defaultRange.from)
  const [to, setTo] = useState(defaultRange.to)
  const [status, setStatus] = useState<'open' | 'closed' | 'all'>('open')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(50)
  const [page, setPage] = useState(1)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const statusParam = status === 'all' ? '' : `&status_state=${encodeURIComponent(status)}`
  const baseUrl = `/v1/reports/customer-credit-register?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${statusParam}`
  const reportQ = useQuery({
    queryKey: ['accounting', 'customer-credit-register', from, to, status],
    queryFn: () => apiRequest<{ data: CustomerCreditRegisterReport }>(baseUrl),
    staleTime: 60_000,
  })
  const report = reportQ.data?.data
  const rows = report?.rows ?? []
  const totals = report?.totals
  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return rows

    return rows.filter((row) =>
      [
        row.customer_name,
        row.work_order_number,
        row.source_type,
        row.payment_method,
        row.payment_reference,
        row.notes,
        row.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [rows, search])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageLabel =
    filteredRows.length === 0
      ? 'No rows'
      : `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, filteredRows.length)} of ${filteredRows.length}`

  const handleDownload = async (path: string, filename: string) => {
    setDownloadError(null)
    try {
      await downloadReport(path, filename)
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Could not download report.')
    }
  }

  return (
    <div className="mx-auto w-full max-w-none space-y-6 px-4 py-4 sm:px-6 sm:py-6 2xl:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Credits & deposits</div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Customer Credits</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Review open overpayments, down payments, applied credits, refunds, and remaining unapplied balances.
          </p>
        </div>
        <Link
          to="/accounting"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Accounting overview
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Credit register</h2>
            <p className="mt-1 text-sm text-slate-500">Open credits should be applied, refunded, or left intentionally as customer deposits.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(180px,1fr)_160px_160px_160px_110px_130px]">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Customer, job, payment ref..."
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              From
              <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1) }} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              To
              <input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1) }} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
              <select value={status} onChange={(event) => { setStatus(event.target.value as 'open' | 'closed' | 'all'); setPage(1) }} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900">
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="all">All</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void handleDownload(`${baseUrl}&format=pdf`, `customer-credit-register-${from}-${to}.pdf`)}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 sm:self-end"
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => void handleDownload(`${baseUrl}&format=csv`, `customer-credit-register-${from}-${to}.csv`)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:self-end"
            >
              Download spreadsheet
            </button>
          </div>
        </div>
        {downloadError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {downloadError}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <PayrollMetric label="Credits" value={reportQ.isLoading ? '...' : String(totals?.credit_count ?? 0)} />
        <PayrollMetric label="Original" value={reportQ.isLoading ? '...' : exactMoney(totals?.amount_cents ?? 0)} tone="green" />
        <PayrollMetric label="Applied" value={reportQ.isLoading ? '...' : exactMoney(totals?.applied_cents ?? 0)} />
        <PayrollMetric label="Refunded" value={reportQ.isLoading ? '...' : exactMoney(totals?.refunded_cents ?? 0)} tone="amber" />
        <PayrollMetric label="Balance" value={reportQ.isLoading ? '...' : exactMoney(totals?.balance_cents ?? 0)} tone="amber" />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">{pageLabel}</div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value) as 25 | 50 | 100)
                setPage(1)
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-3 py-3 text-left">Source</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-right">Original</th>
                <th className="px-3 py-3 text-right">Applied</th>
                <th className="px-3 py-3 text-right">Refunded</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.customer_credit_id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link to={`/customers/${row.customer_id}`} className="font-semibold text-slate-900 hover:text-amber-700">
                      {row.customer_name ?? 'Customer'}
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-500">{row.work_order_number ?? row.created_at ?? '-'}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="capitalize text-slate-900">{row.source_type.replace(/_/g, ' ')}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{row.payment_method ?? row.payment_reference ?? 'No payment ref'}</div>
                  </td>
                  <td className="px-3 py-3 capitalize">{row.status}</td>
                  <td className="px-3 py-3 text-right font-mono">{exactMoney(row.amount_cents)}</td>
                  <td className="px-3 py-3 text-right font-mono">{exactMoney(row.applied_cents)}</td>
                  <td className="px-3 py-3 text-right font-mono">{exactMoney(row.refunded_cents)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{exactMoney(row.balance_cents)}</td>
                </tr>
              ))}
              {!reportQ.isLoading && filteredRows.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={7}>No customer credits in this filter.</td>
                </tr>
              )}
              {reportQ.isLoading && (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={7}>Loading customer credits...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export function PayrollWorkspacePage() {
  const queryClient = useQueryClient()
  const defaultRange = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      from: isoDate(start),
      to: isoDate(now),
    }
  }, [])
  const [from, setFrom] = useState(defaultRange.from)
  const [to, setTo] = useState(defaultRange.to)
  const [techSearch, setTechSearch] = useState('')
  const [payTypeFilter, setPayTypeFilter] = useState('all')
  const [reimbursementStatusView, setReimbursementStatusView] = useState('approved')
  const [isClosingReimbursements, setIsClosingReimbursements] = useState(false)
  const [selectedPayrollRunId, setSelectedPayrollRunId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [payrollPaymentForm, setPayrollPaymentForm] = useState({
    paid_on: isoDate(new Date()),
    amount: '',
    payment_method: 'bank',
    cash_account_code: '1010',
    reference_number: '',
    memo: '',
  })
  const payrollParams = new URLSearchParams({ from, to })
  if (techSearch.trim()) payrollParams.set('q', techSearch.trim())
  if (payTypeFilter !== 'all') payrollParams.set('pay_type', payTypeFilter)
  const payrollQueryString = payrollParams.toString()
  const reimbursementParams = new URLSearchParams({
    date_from: from,
    date_to: to,
    per_page: '100',
  })
  if (reimbursementStatusView !== 'all') {
    reimbursementParams.set('reimbursement_status', reimbursementStatusView)
  }
  const reimbursementQueryString = reimbursementParams.toString()

  const reportQ = useQuery({
    queryKey: ['accounting', 'payroll-tech-performance', from, to, techSearch.trim(), payTypeFilter],
    queryFn: () =>
      apiRequest<{ data: TechPerformanceReport }>(
        `/v1/reports/tech-performance?${payrollQueryString}`,
      ),
    staleTime: 60_000,
  })
  const report = reportQ.data?.data
  const totals = report?.totals
  const baseUrl = `/v1/reports/tech-performance?${payrollQueryString}`

  const handleDownload = async (path: string, filename: string) => {
    setDownloadError(null)
    try {
      await downloadReport(path, filename)
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Could not download report.')
    }
  }

  const reimbursementsQ = useQuery({
    queryKey: ['accounting', 'tech-reimbursements', from, to, reimbursementStatusView],
    queryFn: () => apiRequest<{ data: ReimbursementExpense[] }>(`/v1/expenses?${reimbursementQueryString}`),
    staleTime: 30_000,
  })
  const payrollRunsQ = useQuery({
    queryKey: ['accounting', 'payroll-runs', from, to],
    queryFn: () =>
      apiRequest<{ data: PayrollRunRecord[] }>(
        `/v1/accounting/payroll-runs?${new URLSearchParams({ from, to, limit: '20' }).toString()}`,
      ),
    staleTime: 30_000,
  })
  const ptoBalancesQ = useQuery({
    queryKey: ['accounting', 'pto-balances', from, to],
    queryFn: () =>
      apiRequest<{ data: PtoBalancesReport }>(
        `/v1/accounting/pto-balances?${new URLSearchParams({ from, to }).toString()}`,
      ),
    staleTime: 30_000,
  })
  const selectedPayrollRunQ = useQuery({
    queryKey: ['accounting', 'payroll-run', selectedPayrollRunId],
    queryFn: () =>
      apiRequest<{ data: PayrollRunRecord }>(
        `/v1/accounting/payroll-runs/${encodeURIComponent(selectedPayrollRunId ?? '')}`,
      ),
    enabled: Boolean(selectedPayrollRunId),
    staleTime: 30_000,
  })
  const reimbursements = reimbursementsQ.data?.data ?? []
  const payrollRuns = payrollRunsQ.data?.data ?? []
  const ptoBalances = ptoBalancesQ.data?.data
  const selectedPayrollRun = selectedPayrollRunQ.data?.data
  const selectedPayrollRunBalance = selectedPayrollRun
    ? Math.max(0, selectedPayrollRun.balance_cents ?? selectedPayrollRun.payroll_cost_cents - (selectedPayrollRun.paid_cents ?? 0))
    : 0
  const paidLeaveHoursForCloseout = ptoBalances?.totals.paid_leave_hours ?? 0
  const paidLeaveCostForCloseout = ptoBalances?.totals.paid_leave_cost_cents ?? 0
  const payrollCost =
    (totals?.labor_cost_cents ?? 0) +
    (totals?.commission_cost_cents ?? 0) +
    (totals?.parts_commission_cost_cents ?? 0) +
    (totals?.vacation_accrual_cents ?? 0) +
    paidLeaveCostForCloseout
  const manualLeaveHoursNeedingCloseoutReview = ptoBalances?.totals.other_hours_used ?? 0
  const unpaidLeaveHoursNeedingCloseoutReview = ptoBalances?.totals.unpaid_hours_used ?? 0
  const hasTimeOffCloseoutReview =
    manualLeaveHoursNeedingCloseoutReview > 0 || unpaidLeaveHoursNeedingCloseoutReview > 0
  const reimbursementSearch = techSearch.trim().toLowerCase()
  const visiblePtoRows = reimbursementSearch
    ? (ptoBalances?.rows ?? []).filter((row) =>
        [row.tech_name, row.email, row.pay_type]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(reimbursementSearch),
      )
    : (ptoBalances?.rows ?? [])
  const visibleReimbursements = reimbursementSearch
    ? reimbursements.filter((expense) =>
        [
          expense.employee?.name,
          expense.employee?.email,
          expense.description,
          expense.category,
          expense.work_order?.job_number,
          expense.work_order?.title,
          expense.vendor?.display_name,
          expense.vendor?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(reimbursementSearch),
      )
    : reimbursements
  const approvedVisibleReimbursements = visibleReimbursements.filter(
    (expense) => expense.reimbursement_status === 'approved',
  )
  const reimbursementBatchTotal = visibleReimbursements.reduce((sum, expense) => sum + expense.amount_cents + expense.tax_cents, 0)
  const reimbursementGroups = visibleReimbursements.reduce<Record<string, { label: string; total: number; count: number }>>((groups, expense) => {
    const key = expense.employee?.id ?? 'unassigned'
    const label = expense.employee?.name || expense.employee?.email || 'Unassigned'
    groups[key] ??= { label, total: 0, count: 0 }
    groups[key].total += expense.amount_cents + expense.tax_cents
    groups[key].count += 1
    return groups
  }, {})
  const reimbursementStatusLabel =
    reimbursementStatusView === 'all'
      ? 'all reimbursement expenses'
      : `${reimbursementStatusView} reimbursements`
  const reimbursementEmptyLabel =
    reimbursementStatusView === 'all'
      ? 'No reimbursements found in this pay period.'
      : `No ${reimbursementStatusView} reimbursements found in this pay period.`
  const updateReimbursementStatus = useMutation({
    mutationFn: ({
      expenseId,
      reimbursementStatus,
      status,
    }: {
      expenseId: string
      reimbursementStatus: string
      status: string
    }) =>
      apiRequest<{ data: ReimbursementExpense }>(`/v1/expenses/${encodeURIComponent(expenseId)}`, {
        method: 'PATCH',
        body: { reimbursement_status: reimbursementStatus, status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
  const closeoutReimbursements = useMutation({
    mutationFn: (expenseIds: string[]) =>
      apiRequest<{ data: { updated_count: number; expense_ids: string[] } }>('/v1/expenses/reimbursements/closeout', {
        method: 'POST',
        body: { expense_ids: expenseIds },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
  const reverseReimbursement = useMutation({
    mutationFn: ({ expenseId, reason }: { expenseId: string; reason: string }) =>
      apiRequest<{ data: ReimbursementExpense; journal_entry_id?: string | null }>(
        `/v1/expenses/${encodeURIComponent(expenseId)}/reimbursement-reversal`,
        {
          method: 'POST',
          body: { reason },
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
  const closeoutPayroll = useMutation({
    mutationFn: () =>
      apiRequest<PayrollCloseoutResponse>('/v1/accounting/payroll-closeout', {
        method: 'POST',
        body: {
          from,
          to,
          payable_account_code: '2090',
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
  const recordPayrollPayment = useMutation({
    mutationFn: ({
      payrollRunId,
      amountCents,
    }: {
      payrollRunId: string
      amountCents: number
    }) =>
      apiRequest<{ data: PayrollPaymentRecord; payroll_run: PayrollRunRecord }>(
        `/v1/accounting/payroll-runs/${encodeURIComponent(payrollRunId)}/payments`,
        {
          method: 'POST',
          body: {
            paid_on: payrollPaymentForm.paid_on,
            amount_cents: amountCents,
            payment_method: payrollPaymentForm.payment_method,
            cash_account_code: payrollPaymentForm.cash_account_code,
            reference_number: payrollPaymentForm.reference_number.trim() || null,
            memo: payrollPaymentForm.memo.trim() || null,
          },
        },
      ),
    onSuccess: () => {
      setPayrollPaymentForm((current) => ({
        ...current,
        amount: '',
        reference_number: '',
        memo: '',
      }))
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
  async function postPayrollCloseout() {
    if (payrollCost <= 0) return

    setActionError(null)
    setActionMessage(null)
    const paidLeaveNotice = paidLeaveHoursForCloseout > 0
      ? `\n\nPaid leave included: ${paidLeaveHoursForCloseout}h for ${exactMoney(paidLeaveCostForCloseout)}.`
      : ''
    const timeOffNotice = hasTimeOffCloseoutReview
      ? `\n\nManual time-off review: ${manualLeaveHoursNeedingCloseoutReview}h other leave and ${unpaidLeaveHoursNeedingCloseoutReview}h unpaid leave are approved in this period and are not paid automatically.`
      : ''
    const confirmed = window.confirm(
      `Post payroll closeout for ${from} to ${to} for ${exactMoney(payrollCost)}? Reimbursements stay separate and are not included.${paidLeaveNotice}${timeOffNotice}`,
    )
    if (!confirmed) return

    try {
      const result = await closeoutPayroll.mutateAsync()
      setActionMessage(
        result.duplicate
          ? 'This payroll closeout was already posted for the selected period.'
          : 'Payroll closeout posted to the general ledger.',
      )
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not post payroll closeout.')
    }
  }
  async function submitPayrollPayment(event: FormEvent) {
    event.preventDefault()
    if (!selectedPayrollRun || selectedPayrollRunBalance <= 0) return

    setActionError(null)
    setActionMessage(null)
    const amountCents = payrollPaymentForm.amount.trim()
      ? dollarsToCents(payrollPaymentForm.amount)
      : selectedPayrollRunBalance

    if (amountCents <= 0) {
      setActionError('Enter a payroll payment amount.')
      return
    }

    if (amountCents > selectedPayrollRunBalance) {
      setActionError('Payment cannot be greater than the remaining payroll balance.')
      return
    }

    const confirmed = window.confirm(
      `Record payroll payment of ${exactMoney(amountCents)} for ${selectedPayrollRun.from} to ${selectedPayrollRun.to}?`,
    )
    if (!confirmed) return

    try {
      await recordPayrollPayment.mutateAsync({ payrollRunId: selectedPayrollRun.id, amountCents })
      setActionMessage('Payroll payment recorded.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not record payroll payment.')
    }
  }
  async function closeVisibleReimbursements() {
    if (approvedVisibleReimbursements.length === 0) return

    setActionError(null)
    setActionMessage(null)
    const confirmed = window.confirm(
      `Mark ${approvedVisibleReimbursements.length} visible approved reimbursement${approvedVisibleReimbursements.length === 1 ? '' : 's'} as reimbursed/paid?`,
    )
    if (!confirmed) return

    try {
      setIsClosingReimbursements(true)
      const result = await closeoutReimbursements.mutateAsync(approvedVisibleReimbursements.map((expense) => expense.id))
      setActionMessage(`Marked ${result.data.updated_count} reimbursement${result.data.updated_count === 1 ? '' : 's'} paid.`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not close reimbursements.')
    } finally {
      setIsClosingReimbursements(false)
    }
  }
  async function reversePaidReimbursement(expense: ReimbursementExpense) {
    const reason = window.prompt('Reason for reversing this reimbursement')
    if (!reason || reason.trim().length < 3) return

    setActionError(null)
    setActionMessage(null)

    try {
      await reverseReimbursement.mutateAsync({ expenseId: expense.id, reason: reason.trim() })
      setActionMessage('Reimbursement reversed and moved back to approved.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not reverse reimbursement.')
    }
  }
  const reimbursementActionFor = (expense: ReimbursementExpense) => {
    if (expense.reimbursement_status === 'pending') {
      return {
        label: 'Approve',
        reimbursementStatus: 'approved',
        status: 'approved',
      }
    }
    if (expense.reimbursement_status === 'approved') {
      return {
        label: 'Mark reimbursed',
        reimbursementStatus: 'reimbursed',
        status: 'paid',
      }
    }

    return null
  }
  const downloadReimbursementCsv = () => {
    setActionError(null)
    setActionMessage(null)
    const downloaded = downloadCsv(
      `tech-reimbursements-${reimbursementStatusView}-${from}-${to}.csv`,
      ['Date', 'Tech', 'Email', 'Category', 'Description', 'Job', 'Vendor', 'Receipt files', 'Amount', 'Status', 'Reimbursement status', 'Payment method', 'Reference'],
      visibleReimbursements.map((expense) => [
        expense.expense_date ?? '',
        expense.employee?.name ?? expense.employee?.email ?? 'Unassigned',
        expense.employee?.email ?? '',
        expense.category.replace(/_/g, ' '),
        expense.description,
        expense.work_order?.job_number ?? '',
        expense.vendor?.display_name ?? expense.vendor?.name ?? '',
        expense.receipt_attachments?.map((attachment) => attachment.original_filename || attachment.id).join(' | ')
          || expense.receipt_attachment_ids?.join(' | ')
          || '',
        exactMoney(expense.amount_cents + expense.tax_cents),
        expense.status,
        expense.reimbursement_status,
        expense.payment_method ?? '',
        expense.reference_number ?? '',
      ]),
    )
    if (!downloaded) {
      setActionError('No visible reimbursement rows to export.')
    }
  }
  const downloadPtoBalancesCsv = () => {
    setActionError(null)
    setActionMessage(null)
    const downloaded = downloadCsv(
      `pto-balances-${from}-${to}.csv`,
      [
        'Tech',
        'Email',
        'Pay type',
        'Sick available',
        'Sick used',
        'Sick remaining',
        'Vacation available',
        'Vacation used',
        'Vacation remaining',
        'PTO available',
        'PTO used',
        'PTO remaining',
        'Paid leave hours',
        'Paid leave cost',
        'Unpaid used',
        'Other used',
        'Sick days per quarter',
        'Vacation accrual percent',
      ],
      visiblePtoRows.map((row) => [
        row.tech_name,
        row.email ?? '',
        row.pay_type ?? 'No pay profile',
        row.sick_hours_available,
        row.sick_hours_used,
        row.sick_hours_remaining,
        row.vacation_hours_available,
        row.vacation_hours_used,
        row.vacation_hours_remaining,
        row.pto_hours_available,
        row.pto_hours_used,
        row.pto_hours_remaining,
        row.paid_leave_hours,
        exactMoney(row.paid_leave_cost_cents),
        row.unpaid_hours_used,
        row.other_hours_used,
        row.sick_days_per_quarter,
        row.vacation_accrual_percent,
      ]),
    )
    if (!downloaded) {
      setActionError('No PTO balance rows to export.')
    }
  }
  const downloadPayrollWorksheetCsv = () => {
    const headers = [
      'Section',
      'Date',
      'Tech',
      'Email',
      'Pay type',
      'Jobs',
      'Clock hours',
      'Revenue',
      'Paid',
      'Parts/sub cost',
      'Labor cost',
      'Service commission',
      'Parts commission',
      'Sick earned',
      'Vacation earned',
      'Vacation accrual',
      'Reimbursable expenses',
      'Pending reimbursement',
      'Approved reimbursement',
      'Reimbursed reimbursement',
      'Total cost',
      'Margin',
      'Margin %',
      'Description',
      'Job',
      'Vendor',
      'Status',
      'Reimbursement status',
      'Reference',
    ]
    const payrollRows = (report?.rows ?? []).map((row) => [
      'Payroll summary',
      `${from} to ${to}`,
      row.tech_name,
      '',
      row.pay_type ?? 'No pay profile',
      row.job_count,
      row.clock_hours,
      exactMoney(row.revenue_cents),
      exactMoney(row.paid_cents),
      exactMoney(row.parts_sub_cost_cents),
      exactMoney(row.labor_cost_cents),
      exactMoney(row.commission_cost_cents),
      exactMoney(row.parts_commission_cost_cents ?? 0),
      `${row.sick_hours_earned ?? 0}h`,
      `${row.vacation_hours_earned ?? 0}h`,
      exactMoney(row.vacation_accrual_cents ?? 0),
      exactMoney(row.reimbursable_expense_cents),
      exactMoney(row.reimbursable_pending_cents ?? 0),
      exactMoney(row.reimbursable_approved_cents ?? 0),
      exactMoney(row.reimbursable_reimbursed_cents ?? 0),
      exactMoney(row.cost_cents),
      exactMoney(row.margin_cents),
      row.margin_pct == null ? '' : `${row.margin_pct}%`,
      '',
      '',
      '',
      '',
      '',
      '',
    ])
    const reimbursementRows = visibleReimbursements.map((expense) => [
      'Reimbursement detail',
      expense.expense_date ?? '',
      expense.employee?.name ?? expense.employee?.email ?? 'Unassigned',
      expense.employee?.email ?? '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      exactMoney(expense.amount_cents + expense.tax_cents),
      '',
      '',
      '',
      '',
      '',
      '',
      expense.description,
      expense.work_order?.job_number ?? '',
      expense.vendor?.display_name ?? expense.vendor?.name ?? '',
      expense.status,
      expense.reimbursement_status,
      expense.reference_number ?? '',
    ])

    setActionError(null)
    setActionMessage(null)
    const downloaded = downloadCsv(`payroll-worksheet-${from}-${to}.csv`, headers, [...payrollRows, ...reimbursementRows])
    if (!downloaded) {
      setActionError('No payroll or reimbursement rows to export.')
    }
  }
  const downloadSelectedPayrollRunCsv = () => {
    if (!selectedPayrollRun) return

    setActionError(null)
    setActionMessage(null)
    const downloaded = downloadCsv(
      `payroll-closeout-${selectedPayrollRun.from}-${selectedPayrollRun.to}.csv`,
      [
        'Period from',
        'Period to',
        'Technician',
        'Jobs',
        'Clock hours',
        'Labor',
        'Service commission',
        'Parts commission',
        'Vacation accrual',
        'Paid leave hours',
        'Paid leave',
        'Payroll total',
        'GL entry',
      ],
      (selectedPayrollRun.lines ?? []).map((line) => [
        selectedPayrollRun.from,
        selectedPayrollRun.to,
        line.tech_name,
        line.job_count,
        Math.round((line.clock_minutes / 60) * 100) / 100,
        exactMoney(line.labor_cost_cents),
        exactMoney(line.commission_cost_cents),
        exactMoney(line.parts_commission_cost_cents),
        exactMoney(line.vacation_accrual_cents),
        line.paid_leave_hours,
        exactMoney(line.paid_leave_cost_cents),
        exactMoney(line.payroll_cost_cents),
        selectedPayrollRun.journal_entry_id ?? '',
      ]),
    )
    if (!downloaded) {
      setActionError('This payroll closeout has no detail lines to export.')
    }
  }

  const downloadSelectedPayrollPayStubs = async () => {
    if (!selectedPayrollRun) return

    setActionError(null)
    setActionMessage(null)
    try {
      await downloadReport(
        `/v1/accounting/payroll-runs/${encodeURIComponent(selectedPayrollRun.id)}/pay-stubs`,
        `pay-stubs-${selectedPayrollRun.from}-${selectedPayrollRun.to}.pdf`,
      )
      setActionMessage('Pay stubs PDF downloaded.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not download pay stubs.')
    }
  }

  const printSelectedPayrollRun = () => {
    if (!selectedPayrollRun) return

    setActionError(null)
    setActionMessage(null)
    const lines = selectedPayrollRun.lines ?? []
    if (lines.length === 0) {
      setActionError('No tech lines to print.')
      return
    }

    const popup = window.open('', '_blank', 'width=960,height=720')
    if (!popup) {
      setActionError('Allow popups to print this payroll packet.')
      return
    }

    const payments = selectedPayrollRun.payments ?? []
    const paidCents = selectedPayrollRun.paid_cents ?? 0
    const balanceCents = Math.max(0, selectedPayrollRun.balance_cents ?? selectedPayrollRun.payroll_cost_cents - paidCents)
    const totalHours = lines.reduce((sum, line) => sum + line.clock_minutes, 0)
    const totalJobs = lines.reduce((sum, line) => sum + line.job_count, 0)

    const lineRows = lines
      .map(
        (line) => `
          <tr>
            <td>
              <strong>${htmlEscape(line.tech_name)}</strong>
              <span>${line.job_count} jobs / ${Math.round((line.clock_minutes / 60) * 100) / 100} hours</span>
            </td>
            <td>${exactMoney(line.labor_cost_cents)}</td>
            <td>${exactMoney(line.commission_cost_cents)}</td>
            <td>${exactMoney(line.parts_commission_cost_cents)}</td>
            <td>${exactMoney(line.vacation_accrual_cents)}</td>
            <td>${line.paid_leave_hours}h / ${exactMoney(line.paid_leave_cost_cents)}</td>
            <td><strong>${exactMoney(line.payroll_cost_cents)}</strong></td>
          </tr>
        `,
      )
      .join('')

    const paymentRows = payments.length
      ? payments
          .map(
            (payment) => `
              <tr>
                <td>${htmlEscape(payment.paid_on ?? '-')}</td>
                <td>${htmlEscape(humanize(payment.payment_method))}</td>
                <td>${htmlEscape(payment.reference_number || payment.memo || 'Payroll payment')}</td>
                <td><strong>${exactMoney(payment.amount_cents)}</strong></td>
              </tr>
            `,
          )
          .join('')
      : '<tr><td colspan="4" class="muted">No payroll payments recorded yet.</td></tr>'

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Payroll closeout ${htmlEscape(selectedPayrollRun.from)} to ${htmlEscape(selectedPayrollRun.to)}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; background: #f1f5f9; color: #0f172a; font-family: Arial, sans-serif; }
            .page { width: 8.5in; min-height: 11in; margin: 24px auto; background: #fff; padding: 0.55in; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.16); }
            .eyebrow { color: #b45309; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
            h1 { margin: 6px 0 8px; font-size: 28px; }
            .muted { color: #64748b; }
            .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #f59e0b; padding-bottom: 14px; }
            .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 20px 0; }
            .metric { border: 1px solid #dbe3ef; border-radius: 10px; padding: 10px; background: #f8fafc; }
            .metric span { display: block; color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
            .metric strong { display: block; margin-top: 5px; font-size: 18px; }
            h2 { margin: 22px 0 8px; font-size: 15px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #0f172a; color: #fff; padding: 9px 8px; text-align: left; }
            td { border-bottom: 1px solid #e2e8f0; padding: 9px 8px; vertical-align: top; }
            td:not(:first-child), th:not(:first-child) { text-align: right; }
            td span { display: block; margin-top: 3px; color: #64748b; font-size: 11px; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 42px; }
            .line { border-top: 1px solid #94a3b8; padding-top: 8px; color: #334155; font-size: 12px; }
            .footer { margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 10px; color: #64748b; font-size: 11px; }
            @media print {
              body { background: #fff; }
              .page { width: auto; min-height: auto; margin: 0; box-shadow: none; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <main class="page">
            <section class="header">
              <div>
                <div class="eyebrow">Accounting payroll closeout</div>
                <h1>Payroll Review Packet</h1>
                <div class="muted">Pay period ${htmlEscape(selectedPayrollRun.from)} to ${htmlEscape(selectedPayrollRun.to)}</div>
              </div>
              <div class="muted">
                <strong>Run ID</strong><br />
                ${htmlEscape(selectedPayrollRun.id)}<br /><br />
                <strong>GL entry</strong><br />
                ${htmlEscape(selectedPayrollRun.journal_entry_id ?? 'Not posted')}
              </div>
            </section>

            <section class="summary">
              <div class="metric"><span>Technicians</span><strong>${lines.length}</strong></div>
              <div class="metric"><span>Jobs</span><strong>${totalJobs}</strong></div>
              <div class="metric"><span>Hours</span><strong>${Math.round((totalHours / 60) * 100) / 100}</strong></div>
              <div class="metric"><span>Total payroll</span><strong>${exactMoney(selectedPayrollRun.payroll_cost_cents)}</strong></div>
              <div class="metric"><span>Balance</span><strong>${exactMoney(balanceCents)}</strong></div>
            </section>

            <h2>Technician pay lines</h2>
            <table>
              <thead>
                <tr>
                  <th>Technician</th>
                  <th>Labor</th>
                  <th>Service comm.</th>
                  <th>Parts comm.</th>
                  <th>Vacation</th>
                  <th>Paid leave</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>${lineRows}</tbody>
            </table>

            <h2>Payments</h2>
            <table>
              <thead>
                <tr>
                  <th>Paid on</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>${paymentRows}</tbody>
            </table>

            <section class="signatures">
              <div class="line">Prepared by</div>
              <div class="line">Approved by</div>
            </section>
            <div class="footer">Printed ${htmlEscape(new Date().toLocaleString())}. Paid: ${exactMoney(paidCents)}.</div>
          </main>
        </body>
      </html>
    `)
    popup.document.close()
    popup.focus()
    window.setTimeout(() => popup.print(), 250)
  }

  return (
    <div className="mx-auto w-full max-w-none space-y-6 px-4 py-4 sm:px-6 sm:py-6 2xl:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Payroll review</div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Payroll & Tech Profit</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Compare completed job revenue against labor, commission, reimbursable expenses, parts/sub cost, and margin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/accounting/payroll/profiles"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Pay profiles
          </Link>
          <button
            type="button"
            onClick={downloadPayrollWorksheetCsv}
            disabled={(report?.rows?.length ?? 0) === 0 && visibleReimbursements.length === 0}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Payroll worksheet spreadsheet
          </button>
          <button
            type="button"
            onClick={postPayrollCloseout}
            disabled={reportQ.isLoading || payrollCost <= 0 || closeoutPayroll.isPending}
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {closeoutPayroll.isPending ? 'Posting...' : 'Post payroll closeout'}
          </button>
          <button
            type="button"
            onClick={() => void handleDownload(`${baseUrl}&format=csv`, `tech-performance-${from}-${to}.csv`)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tech report spreadsheet
          </button>
          <button
            type="button"
            onClick={() => void handleDownload(`${baseUrl}&format=pdf`, `tech-performance-${from}-${to}.pdf`)}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Tech report PDF
          </button>
        </div>
      </div>
      {downloadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {downloadError}
        </div>
      ) : null}
      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {actionError}
        </div>
      ) : null}
      {actionMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          {actionMessage}
        </div>
      ) : null}
      {hasTimeOffCloseoutReview ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="font-semibold">Review time off before posting payroll</div>
          <div className="mt-1 text-xs leading-5">
            Paid leave included in closeout: {paidLeaveHoursForCloseout}h for {exactMoney(paidLeaveCostForCloseout)}.
            Manual review still needed for {manualLeaveHoursNeedingCloseoutReview}h other leave and{' '}
            {unpaidLeaveHoursNeedingCloseoutReview}h unpaid leave.
          </div>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-9">
        <PayrollMetric label="Techs" value={reportQ.isLoading ? '...' : String(totals?.tech_count ?? 0)} />
        <PayrollMetric label="Jobs" value={reportQ.isLoading ? '...' : String(totals?.job_count ?? 0)} />
        <PayrollMetric label="Revenue" value={reportQ.isLoading ? '...' : money(totals?.revenue_cents ?? 0)} tone="green" />
        <PayrollMetric label="Payroll cost" value={reportQ.isLoading ? '...' : money(payrollCost)} tone="amber" />
        <PayrollMetric
          label="Paid leave"
          value={ptoBalancesQ.isLoading ? '...' : money(paidLeaveCostForCloseout)}
          subvalue={ptoBalancesQ.isLoading ? undefined : `${paidLeaveHoursForCloseout}h`}
          tone="amber"
        />
        <PayrollMetric label="Sick earned" value={reportQ.isLoading ? '...' : `${totals?.sick_hours_earned ?? 0}h`} />
        <PayrollMetric label="Vacation earned" value={reportQ.isLoading ? '...' : `${totals?.vacation_hours_earned ?? 0}h`} />
        <PayrollMetric
          label="Expenses"
          value={reportQ.isLoading ? '...' : money(totals?.reimbursable_expense_cents ?? 0)}
          subvalue={
            reportQ.isLoading
              ? undefined
              : `Pending ${money(totals?.reimbursable_pending_cents ?? 0)} · Approved ${money(totals?.reimbursable_approved_cents ?? 0)} · Paid ${money(totals?.reimbursable_reimbursed_cents ?? 0)}`
          }
          tone="amber"
        />
        <PayrollMetric label="Margin" value={reportQ.isLoading ? '...' : money(totals?.margin_cents ?? 0)} tone={(totals?.margin_cents ?? 0) >= 0 ? 'green' : 'red'} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1 text-sm font-semibold text-slate-700">
            <span>From</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-slate-700">
            <span>To</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-slate-700 xl:col-span-2">
            <span>Technician</span>
            <input
              value={techSearch}
              onChange={(event) => setTechSearch(event.target.value)}
              placeholder="Search tech name..."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-slate-700">
            <span>Pay type</span>
            <select
              value={payTypeFilter}
              onChange={(event) => setPayTypeFilter(event.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
            >
              <option value="all">All pay types</option>
              <option value="hourly">Hourly</option>
              <option value="salary">Salary</option>
              <option value="commission">Commission</option>
              <option value="hybrid">Hybrid</option>
              <option value="none">No pay profile</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">PTO balances</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Approved paid time-off is clipped to this period before subtracting from payroll profile balances. Unpaid leave is tracked separately.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/tool-shed/time-off"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open time off
            </Link>
            <button
              type="button"
              onClick={downloadPtoBalancesCsv}
              disabled={visiblePtoRows.length === 0}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export balances
            </button>
          </div>
        </div>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-7">
          <PayrollMetric label="Techs" value={ptoBalancesQ.isLoading ? '...' : String(ptoBalances?.totals.tech_count ?? 0)} />
          <PayrollMetric label="Sick used" value={ptoBalancesQ.isLoading ? '...' : `${ptoBalances?.totals.sick_hours_used ?? 0}h`} tone="amber" />
          <PayrollMetric label="Vacation used" value={ptoBalancesQ.isLoading ? '...' : `${ptoBalances?.totals.vacation_hours_used ?? 0}h`} tone="amber" />
          <PayrollMetric label="PTO used" value={ptoBalancesQ.isLoading ? '...' : `${ptoBalances?.totals.pto_hours_used ?? 0}h`} tone="amber" />
          <PayrollMetric label="Paid leave" value={ptoBalancesQ.isLoading ? '...' : money(paidLeaveCostForCloseout)} subvalue={ptoBalancesQ.isLoading ? undefined : `${paidLeaveHoursForCloseout}h`} tone="amber" />
          <PayrollMetric label="Unpaid used" value={ptoBalancesQ.isLoading ? '...' : `${ptoBalances?.totals.unpaid_hours_used ?? 0}h`} />
          <PayrollMetric label="Other used" value={ptoBalancesQ.isLoading ? '...' : `${ptoBalances?.totals.other_hours_used ?? 0}h`} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-3 pl-4 pr-3 text-left">Technician</th>
                <th className="px-3 py-3 text-right">Sick</th>
                <th className="px-3 py-3 text-right">Vacation</th>
                <th className="px-3 py-3 text-right">PTO</th>
                <th className="px-3 py-3 text-right">Paid leave</th>
                <th className="px-3 py-3 text-right">Unpaid used</th>
                <th className="px-3 py-3 text-right">Other used</th>
                <th className="py-3 pl-3 pr-4 text-left">Rules</th>
              </tr>
            </thead>
            <tbody>
              {visiblePtoRows.map((row) => (
                <tr key={row.account_id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pl-4 pr-3">
                    <div className="font-semibold text-slate-900">{row.tech_name}</div>
                    <div className="text-xs text-slate-500">{row.email ?? 'No email'} · {row.pay_type ?? 'No pay profile'}</div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="tabular-nums">{row.sick_hours_remaining}h left</div>
                    <div className="text-xs text-slate-500">{row.sick_hours_used}h used / {row.sick_hours_available}h available</div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="tabular-nums">{row.vacation_hours_remaining}h left</div>
                    <div className="text-xs text-slate-500">{row.vacation_hours_used}h used / {row.vacation_hours_available}h available</div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="tabular-nums">{row.pto_hours_remaining}h left</div>
                    <div className="text-xs text-slate-500">{row.pto_hours_used}h used / {row.pto_hours_available}h available</div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="font-mono">{exactMoney(row.paid_leave_cost_cents)}</div>
                    <div className="text-xs text-slate-500">{row.paid_leave_hours}h</div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.unpaid_hours_used}h</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.other_hours_used}h</td>
                  <td className="py-3 pl-3 pr-4 text-xs text-slate-500">
                    Sick {row.sick_days_per_quarter} days/qtr · Vacation {row.vacation_accrual_percent}%
                  </td>
                </tr>
              ))}
              {!ptoBalancesQ.isLoading && visiblePtoRows.length === 0 && (
                <tr>
                  <td className="py-8 text-center text-slate-500" colSpan={8}>
                    No payroll profiles matched this filter.
                  </td>
                </tr>
              )}
              {ptoBalancesQ.isLoading && (
                <tr>
                  <td className="py-8 text-center text-slate-500" colSpan={8}>
                    Loading PTO balances...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Posted payroll closeouts</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Locked pay-period snapshots tied to general-ledger payroll entries.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {payrollRunsQ.isLoading ? 'Loading...' : `${payrollRuns.length} in range`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-3 pl-4 pr-3 text-left">Period</th>
                <th className="px-3 py-3 text-right">Techs</th>
                <th className="px-3 py-3 text-right">Jobs</th>
                <th className="px-3 py-3 text-right">Hours</th>
                <th className="px-3 py-3 text-right">Labor</th>
                <th className="px-3 py-3 text-right">Commission</th>
                <th className="px-3 py-3 text-right">Vacation</th>
                <th className="px-3 py-3 text-right">Paid leave</th>
                <th className="px-3 py-3 text-right">Paid</th>
                <th className="py-3 pl-3 pr-4 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {payrollRuns.map((run) => (
                <tr
                  key={run.id}
                  className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-amber-50/50 ${
                    selectedPayrollRunId === run.id ? 'bg-amber-50' : ''
                  }`}
                  onClick={() => setSelectedPayrollRunId((current) => (current === run.id ? null : run.id))}
                >
                  <td className="py-3 pl-4 pr-3">
                    <div className="font-semibold text-slate-900">{run.from} to {run.to}</div>
                    <div className="text-xs text-slate-500">
                      {run.journal_entry_id ? `GL ${run.journal_entry_id}` : 'No GL link'} · {run.status}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{run.tech_count}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{run.job_count}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{Math.round((run.clock_minutes / 60) * 100) / 100}</td>
                  <td className="px-3 py-3 text-right font-mono">{exactMoney(run.labor_cost_cents)}</td>
                  <td className="px-3 py-3 text-right font-mono">
                    {exactMoney(run.commission_cost_cents + run.parts_commission_cost_cents)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono">{exactMoney(run.vacation_accrual_cents)}</td>
                  <td className="px-3 py-3 text-right font-mono">{exactMoney(run.paid_leave_cost_cents)}</td>
                  <td className="px-3 py-3 text-right font-mono">{exactMoney(run.paid_cents ?? 0)}</td>
                  <td className="py-3 pl-3 pr-4 text-right font-mono font-semibold">
                    {exactMoney(run.balance_cents ?? Math.max(0, run.payroll_cost_cents - (run.paid_cents ?? 0)))}
                  </td>
                </tr>
              ))}
              {!payrollRunsQ.isLoading && payrollRuns.length === 0 && (
                <tr>
                  <td className="py-8 text-center text-slate-500" colSpan={10}>
                    No payroll closeouts posted in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {selectedPayrollRunId ? (
          <div className="border-t border-slate-200 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Closeout detail</h3>
                <p className="text-xs text-slate-500">
                  {selectedPayrollRun
                    ? `${selectedPayrollRun.from} to ${selectedPayrollRun.to} · ${selectedPayrollRun.lines?.length ?? 0} tech line${(selectedPayrollRun.lines?.length ?? 0) === 1 ? '' : 's'}`
                    : 'Loading closeout detail...'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadSelectedPayrollRunCsv}
                  disabled={!selectedPayrollRun || selectedPayrollRunQ.isLoading || (selectedPayrollRun.lines ?? []).length === 0}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Export closeout
                </button>
                <button
                  type="button"
                  onClick={printSelectedPayrollRun}
                  disabled={!selectedPayrollRun || selectedPayrollRunQ.isLoading || (selectedPayrollRun.lines ?? []).length === 0}
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Print packet
                </button>
                <button
                  type="button"
                  onClick={downloadSelectedPayrollPayStubs}
                  disabled={!selectedPayrollRun || selectedPayrollRunQ.isLoading || (selectedPayrollRun.lines ?? []).length === 0}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Pay stubs PDF
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayrollRunId(null)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close detail
                </button>
              </div>
            </div>
            {selectedPayrollRun ? (
              <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="grid gap-3 sm:grid-cols-4">
                  <PayrollMetric label="Closeout total" value={exactMoney(selectedPayrollRun.payroll_cost_cents)} />
                  <PayrollMetric label="Paid leave" value={exactMoney(selectedPayrollRun.paid_leave_cost_cents)} subvalue={`${selectedPayrollRun.paid_leave_hours}h`} tone="amber" />
                  <PayrollMetric label="Paid" value={exactMoney(selectedPayrollRun.paid_cents ?? 0)} tone="green" />
                  <PayrollMetric
                    label="Balance"
                    value={exactMoney(selectedPayrollRunBalance)}
                    tone={selectedPayrollRunBalance > 0 ? 'amber' : 'green'}
                  />
                </div>
                <form onSubmit={submitPayrollPayment} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Record payroll payment</h4>
                      <p className="mt-0.5 text-xs text-slate-500">Clears Payroll Payable and credits the selected cash account.</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                      {selectedPayrollRunBalance > 0 ? 'Open' : 'Paid'}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-semibold text-slate-600">
                      Paid on
                      <input
                        type="date"
                        value={payrollPaymentForm.paid_on}
                        onChange={(event) => setPayrollPaymentForm((current) => ({ ...current, paid_on: event.target.value }))}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-600">
                      Amount
                      <input
                        value={payrollPaymentForm.amount}
                        onChange={(event) => setPayrollPaymentForm((current) => ({ ...current, amount: event.target.value }))}
                        inputMode="decimal"
                        placeholder={(selectedPayrollRunBalance / 100).toFixed(2)}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-600">
                      Method
                      <select
                        value={payrollPaymentForm.payment_method}
                        onChange={(event) => setPayrollPaymentForm((current) => ({ ...current, payment_method: event.target.value }))}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
                      >
                        <option value="bank">Bank</option>
                        <option value="ach">ACH</option>
                        <option value="check">Check</option>
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-600">
                      Cash account
                      <select
                        value={payrollPaymentForm.cash_account_code}
                        onChange={(event) => setPayrollPaymentForm((current) => ({ ...current, cash_account_code: event.target.value }))}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
                      >
                        <option value="1010">Checking</option>
                        <option value="1020">Undeposited funds</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">
                      Reference
                      <input
                        value={payrollPaymentForm.reference_number}
                        onChange={(event) => setPayrollPaymentForm((current) => ({ ...current, reference_number: event.target.value }))}
                        placeholder="Check #, ACH trace, payroll batch..."
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">
                      Memo
                      <input
                        value={payrollPaymentForm.memo}
                        onChange={(event) => setPayrollPaymentForm((current) => ({ ...current, memo: event.target.value }))}
                        placeholder="Optional note"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={selectedPayrollRunBalance <= 0 || recordPayrollPayment.isPending}
                    className="mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {recordPayrollPayment.isPending ? 'Recording...' : 'Record payment'}
                  </button>
                </form>
              </div>
            ) : null}
            {selectedPayrollRun?.payments?.length ? (
              <div className="mb-4 rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payroll payments
                </div>
                <div className="divide-y divide-slate-100">
                  {selectedPayrollRun.payments.map((payment) => (
                    <div key={payment.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[140px_140px_1fr_120px]">
                      <div className="font-semibold text-slate-900">{payment.paid_on ?? '-'}</div>
                      <div className="font-mono font-semibold text-emerald-700">{exactMoney(payment.amount_cents)}</div>
                      <div className="text-slate-600">
                        {payment.reference_number || payment.memo || 'Payroll payment'}
                      </div>
                      <div className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {payment.payment_method}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-3 pl-4 pr-3 text-left">Technician</th>
                    <th className="px-3 py-3 text-right">Jobs</th>
                    <th className="px-3 py-3 text-right">Hours</th>
                    <th className="px-3 py-3 text-right">Labor</th>
                    <th className="px-3 py-3 text-right">Service comm.</th>
                    <th className="px-3 py-3 text-right">Parts comm.</th>
                    <th className="px-3 py-3 text-right">Vacation</th>
                    <th className="px-3 py-3 text-right">Paid leave</th>
                    <th className="py-3 pl-3 pr-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedPayrollRun?.lines ?? []).map((line) => (
                    <tr key={line.id} className="border-t border-slate-100">
                      <td className="py-3 pl-4 pr-3 font-semibold text-slate-900">{line.tech_name}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{line.job_count}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{Math.round((line.clock_minutes / 60) * 100) / 100}</td>
                      <td className="px-3 py-3 text-right font-mono">{exactMoney(line.labor_cost_cents)}</td>
                      <td className="px-3 py-3 text-right font-mono">{exactMoney(line.commission_cost_cents)}</td>
                      <td className="px-3 py-3 text-right font-mono">{exactMoney(line.parts_commission_cost_cents)}</td>
                      <td className="px-3 py-3 text-right font-mono">{exactMoney(line.vacation_accrual_cents)}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="font-mono">{exactMoney(line.paid_leave_cost_cents)}</div>
                        <div className="text-xs text-slate-500">{line.paid_leave_hours}h</div>
                      </td>
                      <td className="py-3 pl-3 pr-4 text-right font-mono font-semibold">{exactMoney(line.payroll_cost_cents)}</td>
                    </tr>
                  ))}
                  {!selectedPayrollRunQ.isLoading && (selectedPayrollRun?.lines ?? []).length === 0 && (
                    <tr>
                      <td className="py-8 text-center text-slate-500" colSpan={9}>
                        No tech lines were saved for this closeout.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Technician profitability</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {from} to {to}. Cost includes payroll profile rules, commission, reimbursable expenses, and parts/sub cost.
            </p>
          </div>
          <Link
            to="/accounting/reports"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open reports
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-3 pl-4 pr-3 text-left">Technician</th>
                <th className="px-3 py-3 text-right">Jobs</th>
                <th className="px-3 py-3 text-right">Hours</th>
                <th className="px-3 py-3 text-right">Revenue</th>
                <th className="px-3 py-3 text-right">Labor</th>
                <th className="px-3 py-3 text-right">Commission</th>
                <th className="px-3 py-3 text-right">Parts comm.</th>
                <th className="px-3 py-3 text-right">Sick</th>
                <th className="px-3 py-3 text-right">Vacation</th>
                <th className="px-3 py-3 text-right">Expenses</th>
                <th className="px-3 py-3 text-right">Margin</th>
                <th className="py-3 pl-3 pr-4 text-right">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {(report?.rows ?? []).map((row) => (
                <tr key={row.tech_id ?? 'unassigned'} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pl-4 pr-3">
                    <div className="font-semibold text-slate-900">{row.tech_name}</div>
                    <div className="text-xs text-slate-500">{row.pay_type ?? 'No pay profile'} · Avg ticket {money(row.average_ticket_cents)}</div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.job_count}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.clock_hours}</td>
                  <td className="px-3 py-3 text-right font-mono">{exactMoney(row.revenue_cents)}</td>
                  <td className="px-3 py-3 text-right font-mono">{exactMoney(row.labor_cost_cents)}</td>
                  <td className="px-3 py-3 text-right font-mono">{exactMoney(row.commission_cost_cents)}</td>
                  <td className="px-3 py-3 text-right font-mono">{exactMoney(row.parts_commission_cost_cents ?? 0)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.sick_hours_earned ?? 0}h</td>
                  <td className="px-3 py-3 text-right">
                    <div className="tabular-nums">{row.vacation_hours_earned ?? 0}h</div>
                    <div className="text-xs font-mono text-slate-500">{exactMoney(row.vacation_accrual_cents ?? 0)}</div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="font-mono font-semibold">{exactMoney(row.reimbursable_expense_cents)}</div>
                    <div className="text-xs text-slate-500">
                      P {exactMoney(row.reimbursable_pending_cents ?? 0)} · A {exactMoney(row.reimbursable_approved_cents ?? 0)} · R {exactMoney(row.reimbursable_reimbursed_cents ?? 0)}
                    </div>
                  </td>
                  <td className={`px-3 py-3 text-right font-mono font-semibold ${row.margin_cents >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {exactMoney(row.margin_cents)}
                  </td>
                  <td className="py-3 pl-3 pr-4 text-right tabular-nums">{row.margin_pct === null ? '-' : `${row.margin_pct}%`}</td>
                </tr>
              ))}
              {!reportQ.isLoading && (report?.rows ?? []).length === 0 && (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={12}>
                    No completed jobs found for this payroll period.
                  </td>
                </tr>
              )}
              {reportQ.isLoading && (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={12}>
                    Loading payroll report...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Tech reimbursements</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Review {reimbursementStatusLabel} for {from} to {to}. Uses the same tech search box above.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/accounting/expenses/register"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Expense register
            </Link>
            <button
              type="button"
              onClick={downloadReimbursementCsv}
              disabled={visibleReimbursements.length === 0}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export visible
            </button>
            <button
              type="button"
              onClick={closeVisibleReimbursements}
              disabled={approvedVisibleReimbursements.length === 0 || isClosingReimbursements || closeoutReimbursements.isPending}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isClosingReimbursements ? 'Closing...' : `Mark visible paid (${approvedVisibleReimbursements.length})`}
            </button>
            <select
              value={reimbursementStatusView}
              onChange={(event) => setReimbursementStatusView(event.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <option value="pending">Pending approval</option>
              <option value="approved">Approved payout</option>
              <option value="reimbursed">Reimbursed</option>
              <option value="all">All reimbursements</option>
            </select>
            <div className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
              {exactMoney(reimbursementBatchTotal)}
            </div>
          </div>
        </div>

        {Object.keys(reimbursementGroups).length > 0 ? (
          <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(reimbursementGroups).map(([id, group]) => (
              <div key={id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-semibold text-slate-900">{group.label}</div>
                <div className="mt-1 font-mono text-lg font-bold text-amber-700">{exactMoney(group.total)}</div>
                <div className="text-xs text-slate-500">{group.count} expense{group.count === 1 ? '' : 's'}</div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-3 pl-4 pr-3 text-left">Date</th>
                <th className="px-3 py-3 text-left">Tech</th>
                <th className="px-3 py-3 text-left">Expense</th>
                <th className="px-3 py-3 text-left">Job / vendor</th>
                <th className="px-3 py-3 text-left">Receipt</th>
                <th className="px-3 py-3 text-right">Amount</th>
                <th className="py-3 pl-3 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleReimbursements.map((expense) => {
                const action = reimbursementActionFor(expense)
                return (
                  <tr key={expense.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pl-4 pr-3 whitespace-nowrap">{expense.expense_date ?? '-'}</td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">{expense.employee?.name || expense.employee?.email || 'Unassigned'}</div>
                      <div className="text-xs text-slate-500">{expense.employee?.email ?? ''}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">{expense.description}</div>
                      <div className="text-xs capitalize text-slate-500">{expense.category.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="px-3 py-3">
                      {expense.work_order?.id ? (
                        <Link
                          to={`/jobs/${expense.work_order.id}`}
                          className="font-semibold text-amber-700 hover:text-amber-800"
                        >
                          {expense.work_order.job_number ?? 'Open job'}
                        </Link>
                      ) : (
                        <div className="text-slate-700">{expense.vendor?.display_name ?? expense.vendor?.name ?? 'Company expense'}</div>
                      )}
                      <div className="text-xs text-slate-500">
                        {expense.work_order?.title ?? expense.reference_number ?? expense.payment_method ?? ''}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {expense.receipt_attachments?.length ? (
                        <div className="space-y-1">
                          {expense.receipt_attachments.map((attachment) => (
                            attachment.url ? (
                              <a
                                key={attachment.id}
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block max-w-[220px] truncate text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline"
                              >
                                View {attachment.original_filename || 'receipt'}
                              </a>
                            ) : (
                              <div key={attachment.id} className="max-w-[220px] truncate text-xs font-semibold text-slate-500">
                                {attachment.original_filename || attachment.id}
                              </div>
                            )
                          ))}
                        </div>
                      ) : expense.receipt_attachment_ids?.length ? (
                        <div className="max-w-[180px] truncate text-xs font-semibold text-slate-500">{expense.receipt_attachment_ids[0]}</div>
                      ) : (
                        <span className="text-xs text-slate-400">No receipt</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold">{exactMoney(expense.amount_cents + expense.tax_cents)}</td>
                    <td className="py-3 pl-3 pr-4 text-right">
                      {action ? (
                        <button
                          type="button"
                          disabled={updateReimbursementStatus.isPending}
                          onClick={() =>
                            updateReimbursementStatus.mutate({
                              expenseId: expense.id,
                              reimbursementStatus: action.reimbursementStatus,
                              status: action.status,
                            })
                          }
                          className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                          {action.label}
                        </button>
                      ) : expense.reimbursement_status === 'reimbursed' ? (
                        <button
                          type="button"
                          disabled={reverseReimbursement.isPending}
                          onClick={() => reversePaidReimbursement(expense)}
                          className="rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reverse
                        </button>
                      ) : (
                        <span className="text-xs font-semibold capitalize text-slate-500">{expense.reimbursement_status}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!reimbursementsQ.isLoading && visibleReimbursements.length === 0 && (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={7}>
                    {reimbursementEmptyLabel}
                  </td>
                </tr>
              )}
              {reimbursementsQ.isLoading && (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={7}>
                    Loading reimbursements...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {payrollCards.map((card) => (
          <WorkspaceModuleCard key={card.title} card={card} />
        ))}
      </section>
    </div>
  )
}

export function ExpensesWorkspacePage() {
  const defaultRange = useMemo(() => {
    const now = new Date()
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: isoDate(now),
    }
  }, [])
  const [from, setFrom] = useState(defaultRange.from)
  const [to, setTo] = useState(defaultRange.to)
  const contractor1099Year = new Date(`${to}T00:00:00`).getFullYear()
  const expenseQ = useQuery({
    queryKey: ['accounting', 'expenses-workspace', from, to],
    queryFn: () =>
      apiRequest<{ data: ExpenseRegisterSummaryReport }>(
        `/v1/reports/expense-register?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    staleTime: 60_000,
  })
  const apQ = useQuery({
    queryKey: ['accounting', 'ap-aging-workspace', to],
    queryFn: () =>
      apiRequest<{ data: ApAgingSummaryReport }>(
        `/v1/reports/ap-aging?as_of=${encodeURIComponent(to)}`,
    ),
    staleTime: 60_000,
  })
  const contractor1099Q = useQuery({
    queryKey: ['accounting', 'contractor-1099-workspace', contractor1099Year],
    queryFn: () =>
      apiRequest<{ data: Contractor1099SummaryReport }>(
        `/v1/reports/contractor-1099-summary?year=${encodeURIComponent(String(contractor1099Year))}`,
      ),
    staleTime: 60_000,
  })

  const expenses = expenseQ.data?.data
  const ap = apQ.data?.data
  const contractor1099 = contractor1099Q.data?.data
  const totals = expenses?.totals
  const topCategories = [...(expenses?.by_category ?? [])]
    .sort((a, b) => b.total_cents - a.total_cents)
    .slice(0, 6)
  const recentRows = (expenses?.rows ?? []).slice(0, 8)

  return (
    <div className="mx-auto w-full max-w-none space-y-6 px-4 py-4 sm:px-6 sm:py-6 2xl:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Money out</div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Bills, Expenses & Receipts</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Capture vendor bills, ordinary expenses, receipts, approvals, reimbursements, payments, and AP aging.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            From
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            To
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
            />
          </label>
          <Link
            to="/accounting/expenses/register"
            className="self-end rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Open register
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <PayrollMetric label="Expenses" value={expenseQ.isLoading ? '...' : String(totals?.expense_count ?? 0)} />
        <PayrollMetric label="Money out" value={expenseQ.isLoading ? '...' : exactMoney(totals?.total_cents ?? 0)} tone="red" />
        <PayrollMetric label="Billable" value={expenseQ.isLoading ? '...' : exactMoney(totals?.billable_cents ?? 0)} tone="green" />
        <PayrollMetric label="Pending reimb." value={expenseQ.isLoading ? '...' : exactMoney(totals?.reimbursement_pending_cents ?? 0)} tone="amber" />
        <PayrollMetric label="Approved reimb." value={expenseQ.isLoading ? '...' : exactMoney(totals?.reimbursement_approved_cents ?? 0)} tone="amber" />
        <PayrollMetric label="Open AP" value={apQ.isLoading ? '...' : exactMoney(ap?.totals.balance_cents ?? 0)} tone="amber" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Spend by category</h2>
              <p className="mt-1 text-sm text-slate-500">Top expense categories in this date range.</p>
            </div>
            <Link to="/reports?layout=browser&report=expense-register" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
              Expense report
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {topCategories.map((category) => {
              const percent = totals?.total_cents ? Math.max(4, Math.round((category.total_cents / totals.total_cents) * 100)) : 0
              return (
                <div key={category.category}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-700">{humanize(category.category)}</span>
                    <span className="font-mono font-semibold text-slate-900">{exactMoney(category.total_cents)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              )
            })}
            {!expenseQ.isLoading && topCategories.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No expenses in this date range.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">AP aging</h2>
              <p className="mt-1 text-sm text-slate-500">Open vendor bills as of {to}.</p>
            </div>
            <Link to="/reports?layout=browser&report=ap-aging" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
              AP report
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {(ap?.buckets ?? []).map((bucket) => (
              <div key={bucket.bucket} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{bucket.label}</div>
                  <div className="text-xs text-slate-500">{bucket.count} bill{bucket.count === 1 ? '' : 's'}</div>
                </div>
                <div className="font-mono text-sm font-semibold text-slate-900">{exactMoney(bucket.balance_cents)}</div>
              </div>
            ))}
            {!apQ.isLoading && (ap?.buckets ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No open vendor bills.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recent expenses</h2>
              <p className="text-sm text-slate-500">Latest receipts and money-out records in this period.</p>
            </div>
            <Link to="/accounting/expenses/register" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
              Manage all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Expense</th>
                  <th className="px-4 py-3 text-left">Owner</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map((expense) => (
                  <tr key={expense.expense_id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-600">{expense.expense_date ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{expense.description}</div>
                      <div className="text-xs text-slate-500">
                        {humanize(expense.category)}
                        {expense.work_order_number ? ` · Job #${expense.work_order_number}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {expense.employee_name || expense.employee_email || expense.vendor_name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-700">
                          {humanize(expense.status)}
                        </span>
                        {expense.reimbursable ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold capitalize text-amber-700 ring-1 ring-amber-200">
                            {humanize(expense.reimbursement_status)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{exactMoney(expense.total_cents)}</td>
                  </tr>
                ))}
                {!expenseQ.isLoading && recentRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={5}>No expenses in this date range.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Reimbursements</h2>
            <p className="mt-1 text-sm text-slate-500">Tech receipts waiting on approval or payment.</p>
            <div className="mt-4 space-y-2">
              {(expenses?.by_reimbursement_status ?? []).map((row) => (
                <div key={row.status} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{humanize(row.status)}</div>
                    <div className="text-xs text-slate-500">{row.count} expense{row.count === 1 ? '' : 's'}</div>
                  </div>
                  <div className="font-mono text-sm font-semibold text-slate-900">{exactMoney(row.total_cents)}</div>
                </div>
              ))}
              {!expenseQ.isLoading && (expenses?.by_reimbursement_status ?? []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                  No reimbursements in this date range.
                </div>
              ) : null}
            </div>
            <Link
              to="/accounting/payroll"
              className="mt-4 inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Review in payroll
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">1099 readiness</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Paid subcontractor totals for tax year {contractor1099Year}. Filing still goes through your accountant or 1099 provider.
                </p>
              </div>
              <Link to={`/reports?layout=browser&report=contractor-1099`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">
                1099 report
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Review needed</div>
                <div className="mt-1 font-mono text-lg font-bold text-amber-700">
                  {contractor1099Q.isLoading ? '...' : contractor1099?.totals.review_count ?? 0}
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Missing W-9</div>
                <div className="mt-1 font-mono text-lg font-bold text-red-700">
                  {contractor1099Q.isLoading ? '...' : contractor1099?.totals.missing_w9_count ?? 0}
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Paid total</div>
                <div className="mt-1 font-mono text-sm font-bold text-slate-900">
                  {contractor1099Q.isLoading ? '...' : exactMoney(contractor1099?.totals.paid_cents ?? 0)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Threshold</div>
                <div className="mt-1 font-mono text-sm font-bold text-slate-900">
                  {contractor1099Q.isLoading ? '...' : exactMoney(contractor1099?.threshold_cents ?? 0)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {expenseCards.map((card) => (
              <WorkspaceModuleCard key={card.title} card={card} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export function InventoryCostWorkspacePage() {
  const defaultRange = useMemo(() => {
    const now = new Date()
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: isoDate(now),
    }
  }, [])
  const [from, setFrom] = useState(defaultRange.from)
  const [to, setTo] = useState(defaultRange.to)
  const [groupBy, setGroupBy] = useState<'item' | 'vendor' | 'category' | 'po'>('item')
  const valuationQ = useQuery({
    queryKey: ['accounting', 'inventory-valuation-workspace'],
    queryFn: () => apiRequest<{ data: InventoryValuationReport }>('/v1/reports/inventory-valuation'),
    staleTime: 60_000,
  })
  const spendQ = useQuery({
    queryKey: ['accounting', 'inventory-spend-workspace', from, to, groupBy],
    queryFn: () =>
      apiRequest<{ data: InventorySpendReport }>(
        `/v1/reports/inventory-spend?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&group_by=${encodeURIComponent(groupBy)}`,
      ),
    staleTime: 60_000,
  })
  const poQ = useQuery({
    queryKey: ['accounting', 'purchase-orders-workspace', from, to],
    queryFn: () =>
      apiRequest<{ data: PurchaseOrderRegisterReport }>(
        `/v1/reports/purchase-order-register?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    staleTime: 60_000,
  })

  const valuation = valuationQ.data?.data
  const spend = spendQ.data?.data
  const purchaseOrders = poQ.data?.data
  const topSpend = (spend?.rows ?? []).slice(0, 6)
  const topLocations = [...(valuation?.by_location ?? [])]
    .sort((a, b) => b.inventory_value_cents - a.inventory_value_cents)
    .slice(0, 6)
  const recentPurchaseOrders = (purchaseOrders?.rows ?? []).slice(0, 8)

  return (
    <div className="mx-auto w-full max-w-none space-y-6 px-4 py-4 sm:px-6 sm:py-6 2xl:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Inventory cost</div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Inventory & PO Cost</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Track purchase order spend, on-hand inventory value, location value, receiving, and cost basis.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            From
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            To
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
            />
          </label>
          <Link
            to="/purchase-orders"
            className="self-end rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Purchase orders
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <PayrollMetric label="Inventory value" value={valuationQ.isLoading ? '...' : exactMoney(valuation?.totals.inventory_value_cents ?? 0)} tone="green" />
        <PayrollMetric label="Available value" value={valuationQ.isLoading ? '...' : exactMoney(valuation?.totals.available_value_cents ?? 0)} tone="green" />
        <PayrollMetric label="On hand" value={valuationQ.isLoading ? '...' : String(valuation?.totals.qty_on_hand ?? 0)} />
        <PayrollMetric label="Available qty" value={valuationQ.isLoading ? '...' : String(valuation?.totals.qty_available ?? 0)} />
        <PayrollMetric label="PO spend" value={spendQ.isLoading ? '...' : exactMoney(spend?.totals.spend_cents ?? 0)} tone="amber" />
        <PayrollMetric label="POs" value={poQ.isLoading ? '...' : String(purchaseOrders?.totals.purchase_order_count ?? 0)} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">PO spend</h2>
              <p className="mt-1 text-sm text-slate-500">What was purchased in this date range.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={groupBy}
                onChange={(event) => setGroupBy(event.target.value as 'item' | 'vendor' | 'category' | 'po')}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="item">By item</option>
                <option value="vendor">By vendor</option>
                <option value="category">By category</option>
                <option value="po">By PO</option>
              </select>
              <Link to="/reports?layout=browser&report=inventory-spend" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Spend report
              </Link>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {topSpend.map((row) => {
              const percent = spend?.totals.spend_cents ? Math.max(4, Math.round((row.spend_cents / spend.totals.spend_cents) * 100)) : 0
              return (
                <div key={row.key}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-700">{row.label}</span>
                    <span className="font-mono font-semibold text-slate-900">{exactMoney(row.spend_cents)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {row.po_count} PO{row.po_count === 1 ? '' : 's'} · {row.line_count} line{row.line_count === 1 ? '' : 's'} · {row.qty_received} received
                  </div>
                </div>
              )
            })}
            {!spendQ.isLoading && topSpend.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No PO spend in this date range.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Value by location</h2>
              <p className="mt-1 text-sm text-slate-500">On-hand cost value by warehouse or truck.</p>
            </div>
            <Link to="/reports?layout=browser&report=inventory-valuation" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
              Valuation
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {topLocations.map((location) => (
              <div key={location.location_name} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{location.location_name || 'Unknown location'}</div>
                  <div className="text-xs text-slate-500">{location.row_count} stock row{location.row_count === 1 ? '' : 's'} · {location.qty_on_hand} on hand</div>
                </div>
                <div className="font-mono text-sm font-semibold text-slate-900">{exactMoney(location.inventory_value_cents)}</div>
              </div>
            ))}
            {!valuationQ.isLoading && topLocations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No on-hand inventory value yet.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recent purchase orders</h2>
              <p className="text-sm text-slate-500">Latest PO cost records in this date range.</p>
            </div>
            <Link to="/reports?layout=browser&report=purchase-order-register" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
              PO report
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">PO</th>
                  <th className="px-4 py-3 text-left">Vendor</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentPurchaseOrders.map((po) => (
                  <tr key={po.purchase_order_id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{po.po_number}</div>
                      <div className="text-xs text-slate-500">{po.order_date ?? 'No order date'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{po.vendor_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-700">
                        {humanize(po.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{po.item_count}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{exactMoney(po.total_cents)}</td>
                  </tr>
                ))}
                {!poQ.isLoading && recentPurchaseOrders.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={5}>No purchase orders in this date range.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">PO status</h2>
            <p className="mt-1 text-sm text-slate-500">Order totals grouped by current status.</p>
            <div className="mt-4 space-y-2">
              {(purchaseOrders?.by_status ?? []).map((row) => (
                <div key={row.status} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{humanize(row.status)}</div>
                    <div className="text-xs text-slate-500">{row.count} PO{row.count === 1 ? '' : 's'}</div>
                  </div>
                  <div className="font-mono text-sm font-semibold text-slate-900">{exactMoney(row.total_cents)}</div>
                </div>
              ))}
              {!poQ.isLoading && (purchaseOrders?.by_status ?? []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                  No purchase order totals yet.
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {inventoryCostCards.map((card) => (
              <WorkspaceModuleCard key={card.title} card={card} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export function BankMatchWorkspacePage() {
  const queryClient = useQueryClient()
  const defaultRange = useMemo(() => {
    const now = new Date()
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: isoDate(now),
    }
  }, [])
  const [from, setFrom] = useState(defaultRange.from)
  const [to, setTo] = useState(defaultRange.to)
  const [bankAccountName, setBankAccountName] = useState('')
  const [bankAccountLast4, setBankAccountLast4] = useState('')
  const [reconciliationForm, setReconciliationForm] = useState({
    bank_account_name: '',
    bank_account_last4: '',
    statement_ending_balance: '',
    notes: '',
  })
  const bankAccountParams = [
    bankAccountName.trim() ? `bank_account_name=${encodeURIComponent(bankAccountName.trim())}` : '',
    bankAccountLast4.trim() ? `bank_account_last4=${encodeURIComponent(bankAccountLast4.trim())}` : '',
  ]
    .filter(Boolean)
    .join('&')
  const reportQ = useQuery({
    queryKey: ['accounting', 'bank-match-workspace', from, to, bankAccountName, bankAccountLast4],
    queryFn: () =>
      apiRequest<{ data: BankReconciliationReport }>(
        `/v1/reports/bank-reconciliation?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${bankAccountParams ? `&${bankAccountParams}` : ''}`,
      ),
    staleTime: 60_000,
  })
  const runsQ = useQuery({
    queryKey: ['accounting', 'bank-match-runs-workspace', from, to, bankAccountLast4],
    queryFn: () =>
      apiRequest<{ data: ReconciliationRunRecord[] }>(
        `/v1/accounting/reconciliation-runs?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}${bankAccountLast4.trim() ? `&bank_account_last4=${encodeURIComponent(bankAccountLast4.trim())}` : ''}&per_page=5`,
      ),
    staleTime: 60_000,
  })
  const createReconciliationRun = useMutation({
    mutationFn: () =>
      apiRequest<{ data: ReconciliationRunRecord }>('/v1/accounting/reconciliation-runs', {
        method: 'POST',
        body: {
          bank_account_name: reconciliationForm.bank_account_name.trim() || bankAccountName.trim() || null,
          bank_account_last4: reconciliationForm.bank_account_last4.trim() || bankAccountLast4.trim() || null,
          statement_start_date: from || null,
          statement_end_date: to || isoDate(new Date()),
          statement_ending_balance: Number(reconciliationForm.statement_ending_balance || 0),
          notes: reconciliationForm.notes.trim() || null,
        },
      }),
    onSuccess: () => {
      setReconciliationForm((current) => ({ ...current, statement_ending_balance: '', notes: '' }))
      queryClient.invalidateQueries({ queryKey: ['accounting', 'bank-match-runs-workspace'] })
    },
  })

  const report = reportQ.data?.data
  const totals = report?.totals
  const rows = report?.rows ?? []
  const unmatchedRows = rows.filter((row) => row.match_status === 'unmatched' || row.match_status === 'suggested').slice(0, 8)
  const deposits = rows.filter((row) => row.amount_cents > 0).slice(0, 5)
  const withdrawals = rows.filter((row) => row.amount_cents < 0).slice(0, 5)
  const runs = runsQ.data?.data ?? []
  const accountFilterLabel =
    bankAccountName.trim() || bankAccountLast4.trim()
      ? `${bankAccountName.trim() || 'Selected account'}${bankAccountLast4.trim() ? ` *${bankAccountLast4.trim()}` : ''}`
      : 'All bank accounts'

  return (
    <div className="mx-auto w-full max-w-none space-y-6 px-4 py-4 sm:px-6 sm:py-6 2xl:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Bank reconciliation</div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Bank Match</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Match statement rows to payments, vendor bills, expenses, purchase orders, and ignored bank activity without storing bank login credentials.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            From
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            To
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
            />
          </label>
          <Link
            to="/accounting/bank-match/review"
            className="self-end rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Open review
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Statement account filter</h2>
            <p className="mt-1 text-sm text-slate-500">
              Filter the bank rows and saved reviews to one account before closing a statement period.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_140px_auto]">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Account name
              <input
                value={bankAccountName}
                onChange={(event) => {
                  setBankAccountName(event.target.value)
                  setReconciliationForm((current) => ({ ...current, bank_account_name: event.target.value }))
                }}
                placeholder="Operating checking"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Last 4
              <input
                value={bankAccountLast4}
                onChange={(event) => {
                  setBankAccountLast4(event.target.value)
                  setReconciliationForm((current) => ({ ...current, bank_account_last4: event.target.value }))
                }}
                placeholder="1234"
                maxLength={8}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setBankAccountName('')
                setBankAccountLast4('')
                setReconciliationForm((current) => ({ ...current, bank_account_name: '', bank_account_last4: '' }))
              }}
              className="self-end rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <PayrollMetric label="Bank rows" value={reportQ.isLoading ? '...' : String(totals?.transaction_count ?? 0)} />
        <PayrollMetric label="Matched" value={reportQ.isLoading ? '...' : String(totals?.matched_count ?? 0)} tone="green" />
        <PayrollMetric label="Unmatched" value={reportQ.isLoading ? '...' : String(totals?.unmatched_count ?? 0)} tone="amber" />
        <PayrollMetric label="Deposits" value={reportQ.isLoading ? '...' : exactMoney(totals?.deposit_cents ?? 0)} tone="green" />
        <PayrollMetric label="Withdrawals" value={reportQ.isLoading ? '...' : exactMoney(totals?.withdrawal_cents ?? 0)} tone="red" />
        <PayrollMetric label="Net" value={reportQ.isLoading ? '...' : exactMoney(totals?.net_cents ?? 0)} tone={(totals?.net_cents ?? 0) >= 0 ? 'green' : 'red'} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Rows needing review</h2>
              <p className="text-sm text-slate-500">Unmatched or suggested bank rows that still need a decision.</p>
            </div>
            <Link to="/accounting/bank-match/review" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Match rows
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {unmatchedRows.map((row) => (
                  <tr key={row.bank_transaction_id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.transaction_date ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{row.description}</div>
                      <div className="text-xs text-slate-500">
                        {row.bank_account_name || row.source}
                        {row.bank_account_last4 ? ` *${row.bank_account_last4}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold capitalize text-amber-800">
                        {humanize(row.match_status)}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${row.amount_cents >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {exactMoney(row.amount_cents)}
                    </td>
                  </tr>
                ))}
                {!reportQ.isLoading && unmatchedRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={4}>No unmatched bank rows in this date range.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              createReconciliationRun.mutate()
            }}
            className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Start statement review</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Save this bank statement window, ending balance, cleared totals, and difference for {accountFilterLabel}.
                </p>
              </div>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                {from} to {to}
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold text-slate-600">
                Bank account
                <input
                  value={reconciliationForm.bank_account_name}
                  onChange={(event) => setReconciliationForm((current) => ({ ...current, bank_account_name: event.target.value }))}
                  placeholder="Operating checking"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">
                Last 4
                <input
                  value={reconciliationForm.bank_account_last4}
                  onChange={(event) => setReconciliationForm((current) => ({ ...current, bank_account_last4: event.target.value }))}
                  placeholder="1234"
                  maxLength={8}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">
                Statement ending balance
                <input
                  value={reconciliationForm.statement_ending_balance}
                  onChange={(event) => setReconciliationForm((current) => ({ ...current, statement_ending_balance: event.target.value }))}
                  placeholder="1520.00"
                  inputMode="decimal"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">
                Notes
                <input
                  value={reconciliationForm.notes}
                  onChange={(event) => setReconciliationForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Statement reviewed by..."
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
                />
              </label>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="font-semibold uppercase tracking-wide text-slate-500">Matched in range</div>
                <div className="mt-1 font-mono text-sm font-bold text-slate-900">{totals?.matched_count ?? 0}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="font-semibold uppercase tracking-wide text-slate-500">Net rows</div>
                <div className="mt-1 font-mono text-sm font-bold text-slate-900">{exactMoney(totals?.net_cents ?? 0)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="font-semibold uppercase tracking-wide text-slate-500">Unmatched</div>
                <div className="mt-1 font-mono text-sm font-bold text-amber-700">{totals?.unmatched_count ?? 0}</div>
              </div>
            </div>
            {createReconciliationRun.isError ? (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {(createReconciliationRun.error as Error)?.message || 'Could not save reconciliation run.'}
              </div>
            ) : null}
            {createReconciliationRun.isSuccess ? (
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Statement review saved.
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={createReconciliationRun.isPending}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {createReconciliationRun.isPending ? 'Saving...' : 'Save review'}
              </button>
              <Link
                to="/accounting/bank-match/review"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open detailed review
              </Link>
            </div>
          </form>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Match status</h2>
            <p className="mt-1 text-sm text-slate-500">Bank row totals grouped by current reconciliation status.</p>
            <div className="mt-4 space-y-2">
              {(report?.by_status ?? []).map((row) => (
                <div key={row.status} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{humanize(row.status)}</div>
                    <div className="text-xs text-slate-500">{row.count} row{row.count === 1 ? '' : 's'}</div>
                  </div>
                  <div className="font-mono text-sm font-semibold text-slate-900">{exactMoney(row.net_cents)}</div>
                </div>
              ))}
              {!reportQ.isLoading && (report?.by_status ?? []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                  No bank rows in this date range.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Recent reconciliation runs</h2>
            <p className="mt-1 text-sm text-slate-500">Saved statement reviews and their differences.</p>
            <div className="mt-4 space-y-2">
              {runs.map((run) => (
                <div key={run.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-800">
                      {run.bank_account_name || 'Bank account'}{run.bank_account_last4 ? ` *${run.bank_account_last4}` : ''}
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold capitalize text-slate-700">{humanize(run.status)}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {run.statement_start_date ?? 'Start'} to {run.statement_end_date ?? 'End'} · Difference {exactMoney(run.difference_cents)}
                  </div>
                </div>
              ))}
              {!runsQ.isLoading && runs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                  No reconciliation runs saved yet.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <BankFlowPanel title="Recent deposits" rows={deposits} empty="No deposits in this date range." />
        <BankFlowPanel title="Recent withdrawals" rows={withdrawals} empty="No withdrawals in this date range." />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {bankMatchCards.map((card) => (
          <WorkspaceModuleCard key={card.title} card={card} />
        ))}
      </section>
    </div>
  )
}

function BankFlowPanel({
  title,
  rows,
  empty,
}: {
  title: string
  rows: BankReconciliationReport['rows']
  empty: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.bank_transaction_id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
            <div>
              <div className="font-semibold text-slate-900">{row.description}</div>
              <div className="text-xs text-slate-500">
                {row.transaction_date ?? '-'} · {humanize(row.match_status)}
              </div>
            </div>
            <div className={`font-mono font-semibold ${row.amount_cents >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {exactMoney(row.amount_cents)}
            </div>
          </div>
        ))}
        {rows.length === 0 ? <div className="px-4 py-8 text-center text-sm text-slate-500">{empty}</div> : null}
      </div>
    </div>
  )
}

function WorkspaceModuleCard({ card }: { card: WorkspaceCard }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{card.title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{card.text}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {card.actions.map((action) =>
          action.to && !action.disabled ? (
            <Link
              key={action.label}
              to={action.to}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-amber-300 hover:bg-amber-50"
            >
              {action.label}
            </Link>
          ) : (
            <button
              key={action.label}
              type="button"
              disabled
              className="cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-400"
            >
              {action.label}
            </button>
          ),
        )}
      </div>
    </div>
  )
}

function PayrollMetric({
  label,
  value,
  subvalue,
  tone = 'slate',
}: {
  label: string
  value: string
  subvalue?: string
  tone?: 'slate' | 'green' | 'amber' | 'red'
}) {
  const color = {
    slate: 'text-slate-900',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
  }[tone]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 truncate text-xl font-bold tabular-nums ${color}`}>{value}</div>
      {subvalue ? <div className="mt-1 truncate text-[10px] font-semibold text-slate-500">{subvalue}</div> : null}
    </div>
  )
}
