/**
 * One spec per report endpoint: what it's called, what it takes, what the
 * answer is, and which of its columns are worth showing first.
 *
 * The reports themselves already return a consistent envelope —
 * { from|as_of, totals: {...}, rows: [...] } plus the odd grouping — so the
 * overlay is generic and everything report-specific lives here. Adding a
 * report means adding an entry, not touching the overlay.
 *
 * Every field referenced below was read off ReportsController rather than
 * guessed: a column that names a key the endpoint doesn't return renders an
 * empty cell forever and nobody notices.
 */

export type DateMode = 'range' | 'asOf' | 'none'

export interface Column {
  key: string
  label: string
  kind?: 'money' | 'date' | 'number' | 'pct' | 'text'
  /** Emphasise this column — used for the identifying one. */
  strong?: boolean
}

export interface Bar {
  label: string
  value: number
  /** Rendered as money when true, plain count otherwise. */
  money?: boolean
}

export interface Answer {
  headline: string
  detail?: string
}

export interface ReportSpec {
  id: string
  /** The question, not the report name. */
  title: string
  /** Report slugs, shown under the title exactly as on the cards. */
  builtFrom: string[]
  path: string
  /** Query fragments this report always needs (group_by, all_time, …). */
  fixedParams?: Record<string, string>
  dateMode: DateMode
  answer: (d: Any) => Answer
  chart?: (d: Any) => { title: string; bars: Bar[] } | null
  columns: Column[]
}

// The report payloads are heterogeneous by design; each spec below narrows
// its own. A shared interface would be a fiction that has to be cast away.
type Any = Record<string, any>

export function money(cents: number): string {
  return ((cents ?? 0) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}

function rowsOf(d: Any): Any[] {
  return Array.isArray(d?.rows) ? d.rows : []
}

/** Sum a numeric field over rows, tolerating missing keys. */
function sumBy(rows: Any[], key: string): number {
  return rows.reduce((n, r) => n + (Number(r?.[key]) || 0), 0)
}

/** Group rows by a field and total another, biggest first. */
function groupBars(rows: Any[], labelKey: string, valueKey: string, limit = 6): Bar[] {
  const acc = new Map<string, number>()
  for (const r of rows) {
    const label = String(r?.[labelKey] ?? '').trim() || 'Unspecified'
    acc.set(label, (acc.get(label) ?? 0) + (Number(r?.[valueKey]) || 0))
  }
  return [...acc.entries()]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, limit)
    .map(([label, value]) => ({ label, value, money: true }))
}

/**
 * Do the returned rows actually add up to the reported total?
 *
 * Every report caps its rows, and some cap them well below the totals they
 * report. Any sentence derived from rows — "most of it came in by card", "three
 * jobs lost money" — is a claim about the whole set, and is simply false when
 * the rows are a sample of it. This is the check before making one.
 */
function rowsAreComplete(rows: Any[], key: string, total: unknown): boolean {
  const claimed = Number(total) || 0
  if (claimed === 0) return false
  const seen = sumBy(rows, key)
  return Math.abs(seen - claimed) <= Math.max(100, Math.abs(claimed) * 0.01)
}

function titleCase(s: string): string {
  return String(s ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------

const AGING_COLUMNS_AR: Column[] = [
  { key: 'customer_name', label: 'Customer', strong: true },
  { key: 'invoice_number', label: 'Invoice' },
  { key: 'due_at', label: 'Due', kind: 'date' },
  { key: 'days_past_due', label: 'Days late', kind: 'number' },
  { key: 'balance_cents', label: 'Balance', kind: 'money' },
]

export const REPORT_SPECS: Record<string, ReportSpec> = {
  'ar-aging': {
    id: 'ar-aging',
    title: 'Who owes me money?',
    builtFrom: ['ar-aging'],
    path: '/v1/reports/ar-aging',
    dateMode: 'asOf',
    answer: (d) => {
      const t = d?.totals ?? {}
      const buckets: Any[] = Array.isArray(d?.buckets) ? d.buckets : []
      const overdue = buckets
        .filter((b) => b.bucket !== 'current')
        .reduce((n, b) => n + (Number(b.balance_cents) || 0), 0)
      const overdueCount = buckets
        .filter((b) => b.bucket !== 'current')
        .reduce((n, b) => n + (Number(b.count) || 0), 0)
      const rows = rowsOf(d)
      const oldest = rows.reduce<Any | null>(
        (worst, r) => (!worst || (r.days_past_due ?? 0) > (worst.days_past_due ?? 0) ? r : worst),
        null,
      )
      let detail = 'Every open invoice is still inside its terms.'
      if (overdueCount > 0) {
        // The amount is set off by dashes rather than joined with "and", so the
        // clause about the oldest invoice reads as a separate fact.
        let sentence = `${count(overdueCount, 'of them is', 'of them are')} past due — ${money(overdue)}`
        sentence += oldest && (oldest.days_past_due ?? 0) > 0
          ? ` — and the oldest, ${oldest.customer_name ?? 'unnamed'} at ${money(oldest.balance_cents)}, has been sitting ${count(oldest.days_past_due, 'day')}.`
          : '.'
        detail = `${sentence} Everything else is inside terms.`
      }
      return {
        headline: `${money(t.balance_cents ?? 0)} is owed to you across ${count(t.invoice_count ?? 0, 'invoice')}.`,
        detail,
      }
    },
    chart: (d) => {
      const buckets: Any[] = Array.isArray(d?.buckets) ? d.buckets : []
      if (!buckets.length) return null
      return {
        title: 'How old the money is',
        bars: buckets.map((b) => ({ label: b.label, value: Number(b.balance_cents) || 0, money: true })),
      }
    },
    columns: AGING_COLUMNS_AR,
  },

  'invoice-register': {
    id: 'invoice-register',
    title: 'Every invoice, with what is still on it',
    builtFrom: ['invoice-register'],
    path: '/v1/reports/invoice-register',
    dateMode: 'range',
    answer: (d) => {
      const t = d?.totals ?? {}
      return {
        headline: `${count(t.invoice_count ?? 0, 'invoice')} worth ${money(t.total_cents ?? 0)}.`,
        detail: `${money(t.paid_cents ?? 0)} collected, ${money(t.balance_cents ?? 0)} still outstanding. Tax on the whole set was ${money(t.tax_cents ?? 0)}.`,
      }
    },
    columns: [
      { key: 'customer_name', label: 'Customer', strong: true },
      { key: 'invoice_number', label: 'Invoice' },
      { key: 'issued_at', label: 'Issued', kind: 'date' },
      { key: 'total_cents', label: 'Total', kind: 'money' },
      { key: 'balance_cents', label: 'Balance', kind: 'money' },
    ],
  },

  'unpaid-invoices': {
    id: 'unpaid-invoices',
    title: 'Everything unpaid, all time',
    builtFrom: ['invoice-register'],
    path: '/v1/reports/invoice-register',
    fixedParams: { all_time: '1', payment_state: 'unpaid' },
    dateMode: 'none',
    answer: (d) => {
      const t = d?.totals ?? {}
      return {
        headline: `${money(t.balance_cents ?? 0)} unpaid across ${count(t.invoice_count ?? 0, 'invoice')}.`,
        detail: 'No date limit — this is every invoice with a balance, however old.',
      }
    },
    columns: [
      { key: 'customer_name', label: 'Customer', strong: true },
      { key: 'invoice_number', label: 'Invoice' },
      { key: 'due_at', label: 'Due', kind: 'date' },
      { key: 'total_cents', label: 'Total', kind: 'money' },
      { key: 'balance_cents', label: 'Balance', kind: 'money' },
    ],
  },

  'payment-register': {
    id: 'payment-register',
    title: 'What got paid this month?',
    builtFrom: ['payment-register'],
    path: '/v1/reports/payment-register',
    dateMode: 'range',
    answer: (d) => {
      const t = d?.totals ?? {}
      const rows = rowsOf(d)
      const total = Number(t.amount_cents) || 0
      const fees = Number(t.processing_fee_cents) || 0
      const bits: string[] = []

      // Share, not a bare amount, and only when the rows account for the whole
      // total — otherwise "most of it" describes the sample, not the month.
      if (rowsAreComplete(rows, 'amount_cents', total)) {
        const top = groupBars(rows, 'payment_method', 'amount_cents', 1)[0]
        if (top) {
          bits.push(
            `${Math.round((Math.abs(top.value) / total) * 100)}% of it by ${titleCase(top.label)}`,
          )
        }
      }
      if (fees > 0) {
        bits.push(
          `${money(fees)} went to processing fees, leaving ${money(t.net_deposit_cents ?? 0)} net`,
        )
      }
      return {
        headline: `${money(total)} came in across ${count(t.payment_count ?? 0, 'payment')}.`,
        detail: bits.length ? `${bits.join('. ')}.` : undefined,
      }
    },
    chart: (d) => {
      const bars = groupBars(rowsOf(d), 'payment_method', 'amount_cents')
      return bars.length ? { title: 'How it came in', bars: bars.map((b) => ({ ...b, label: titleCase(b.label) })) } : null
    },
    columns: [
      { key: 'customer_name', label: 'Customer', strong: true },
      { key: 'payment_method', label: 'Method' },
      { key: 'received_at', label: 'Received', kind: 'date' },
      { key: 'collected_by_email', label: 'Collected by' },
      { key: 'amount_cents', label: 'Amount', kind: 'money' },
    ],
  },

  'revenue-breakdown': {
    id: 'revenue-breakdown',
    title: 'Am I making more than last month?',
    builtFrom: ['revenue'],
    path: '/v1/reports/revenue',
    fixedParams: { group_by: 'month' },
    dateMode: 'range',
    answer: (d) => {
      const t = d?.totals ?? {}
      const rows = rowsOf(d)
      let detail: string | undefined
      if (rows.length >= 2) {
        const latest = rows[rows.length - 1]
        const prior = rows[rows.length - 2]
        const a = Number(latest.total_cents) || 0
        const b = Number(prior.total_cents) || 0
        const diff = a - b
        const pct = b > 0 ? Math.round((diff / b) * 100) : null
        detail =
          diff === 0
            ? `${latest.label} matched ${prior.label} exactly.`
            : `${latest.label} was ${money(Math.abs(diff))} ${diff > 0 ? 'up on' : 'down on'} ${prior.label}${pct !== null ? ` — ${Math.abs(pct)}%` : ''}.`
      }
      return {
        headline: `${money(t.total_cents ?? 0)} invoiced across ${count(t.invoice_count ?? 0, 'invoice')}.`,
        detail,
      }
    },
    chart: (d) => {
      const rows = rowsOf(d)
      if (!rows.length) return null
      return {
        title: 'Revenue by period',
        bars: rows.slice(-12).map((r) => ({ label: String(r.label ?? r.key ?? ''), value: Number(r.total_cents) || 0, money: true })),
      }
    },
    columns: [
      { key: 'label', label: 'Period', strong: true },
      { key: 'invoice_count', label: 'Invoices', kind: 'number' },
      { key: 'subtotal_cents', label: 'Subtotal', kind: 'money' },
      { key: 'tax_cents', label: 'Tax', kind: 'money' },
      { key: 'total_cents', label: 'Total', kind: 'money' },
    ],
  },

  'customer-credit-register': {
    id: 'customer-credit-register',
    title: 'Who has credit on account?',
    builtFrom: ['customer-credit-register'],
    path: '/v1/reports/customer-credit-register',
    dateMode: 'range',
    answer: (d) => {
      const t = d?.totals ?? {}
      return {
        headline: `${money(t.balance_cents ?? 0)} of customer money is unspent.`,
        detail: `${money(t.amount_cents ?? 0)} taken in over ${count(t.credit_count ?? 0, 'credit')}, of which ${money(t.applied_cents ?? 0)} has been applied to invoices and ${money(t.refunded_cents ?? 0)} refunded.`,
      }
    },
    columns: [
      { key: 'customer_name', label: 'Customer', strong: true },
      { key: 'source_type', label: 'Source' },
      { key: 'created_at', label: 'Taken', kind: 'date' },
      { key: 'amount_cents', label: 'Amount', kind: 'money' },
      { key: 'balance_cents', label: 'Unused', kind: 'money' },
    ],
  },

  'expense-register': {
    id: 'expense-register',
    title: 'Where did the money go?',
    builtFrom: ['expense-register'],
    path: '/v1/reports/expense-register',
    dateMode: 'range',
    answer: (d) => {
      const t = d?.totals ?? {}
      const owed = Number(t.reimbursement_pending_cents ?? 0) + Number(t.reimbursement_approved_cents ?? 0)
      return {
        headline: `${money(t.total_cents ?? 0)} spent across ${count(t.expense_count ?? 0, 'expense')}.`,
        detail:
          owed > 0
            ? `${money(owed)} of that is owed back to staff and hasn't been reimbursed yet.`
            : undefined,
      }
    },
    chart: (d) => {
      const by: Any[] = Array.isArray(d?.by_category) ? d.by_category : []
      if (!by.length) return null
      return {
        title: 'Where it went',
        bars: by
          .slice(0, 8)
          .map((c) => ({ label: titleCase(c.category ?? 'Uncategorised'), value: Number(c.total_cents) || 0, money: true })),
      }
    },
    columns: [
      { key: 'description', label: 'What', strong: true },
      { key: 'vendor_name', label: 'Vendor' },
      { key: 'employee_name', label: 'Who' },
      { key: 'expense_date', label: 'Date', kind: 'date' },
      { key: 'total_cents', label: 'Total', kind: 'money' },
    ],
  },

  'ap-aging': {
    id: 'ap-aging',
    title: 'What do I owe vendors?',
    builtFrom: ['ap-aging'],
    path: '/v1/reports/ap-aging',
    dateMode: 'asOf',
    answer: (d) => {
      const t = d?.totals ?? {}
      const buckets: Any[] = Array.isArray(d?.buckets) ? d.buckets : []
      const overdue = buckets
        .filter((b) => b.bucket !== 'current')
        .reduce((n, b) => n + (Number(b.balance_cents) || 0), 0)
      return {
        headline: `${money(t.balance_cents ?? 0)} owed to vendors across ${count(t.bill_count ?? 0, 'bill')}.`,
        detail:
          overdue > 0
            ? `${money(overdue)} of that is already past its due date.`
            : 'Nothing is past due yet.',
      }
    },
    chart: (d) => {
      const buckets: Any[] = Array.isArray(d?.buckets) ? d.buckets : []
      if (!buckets.length) return null
      return {
        title: 'How overdue it is',
        bars: buckets.map((b) => ({ label: b.label, value: Number(b.balance_cents) || 0, money: true })),
      }
    },
    columns: [
      { key: 'vendor_name', label: 'Vendor', strong: true },
      { key: 'bill_number', label: 'Bill' },
      { key: 'due_date', label: 'Due', kind: 'date' },
      { key: 'days_past_due', label: 'Days late', kind: 'number' },
      { key: 'balance_cents', label: 'Balance', kind: 'money' },
    ],
  },

  'vendor-bill-register': {
    id: 'vendor-bill-register',
    title: 'Every vendor bill',
    builtFrom: ['vendor-bill-register'],
    path: '/v1/reports/vendor-bill-register',
    dateMode: 'range',
    answer: (d) => {
      const t = d?.totals ?? {}
      return {
        headline: `${count(t.bill_count ?? 0, 'bill')} totalling ${money(t.total_cents ?? 0)}.`,
        detail: `${money(t.paid_cents ?? 0)} paid, ${money(t.balance_cents ?? 0)} outstanding${Number(t.overdue_cents) > 0 ? `, ${money(t.overdue_cents)} of it overdue` : ''}.`,
      }
    },
    columns: [
      { key: 'vendor_name', label: 'Vendor', strong: true },
      { key: 'bill_number', label: 'Bill' },
      { key: 'bill_date', label: 'Dated', kind: 'date' },
      { key: 'total_cents', label: 'Total', kind: 'money' },
      { key: 'balance_cents', label: 'Balance', kind: 'money' },
    ],
  },

  'purchase-order-register': {
    id: 'purchase-order-register',
    title: 'What did I order and not get?',
    builtFrom: ['purchase-order-register'],
    path: '/v1/reports/purchase-order-register',
    dateMode: 'range',
    answer: (d) => {
      const t = d?.totals ?? {}
      const rows = rowsOf(d)
      const complete = rowsAreComplete(rows, 'total_cents', t.total_cents)
      const notReceived = rows.filter((r) => !r.received_at)
      return {
        headline: `${count(t.purchase_order_count ?? 0, 'purchase order')} worth ${money(t.total_cents ?? 0)}.`,
        detail: !complete
          ? undefined
          : notReceived.length
            ? `${count(notReceived.length, 'order has', 'orders have')} nothing marked received yet — ${money(sumBy(notReceived, 'total_cents'))} of stock you have paid for or committed to.`
            : 'Everything ordered in this window has been received.',
      }
    },
    chart: (d) => {
      const by: Any[] = Array.isArray(d?.by_status) ? d.by_status : []
      if (!by.length) return null
      return {
        title: 'Where the orders stand',
        bars: by.map((s) => ({ label: titleCase(s.status), value: Number(s.total_cents) || 0, money: true })),
      }
    },
    columns: [
      { key: 'vendor_name', label: 'Vendor', strong: true },
      { key: 'po_number', label: 'PO' },
      { key: 'order_date', label: 'Ordered', kind: 'date' },
      { key: 'expected_delivery', label: 'Expected', kind: 'date' },
      { key: 'total_cents', label: 'Total', kind: 'money' },
    ],
  },

  'subcontractor-payout': {
    id: 'subcontractor-payout',
    title: 'What do I owe subs?',
    builtFrom: ['subcontractor-payout-register'],
    path: '/v1/reports/subcontractor-payout-register',
    dateMode: 'range',
    answer: (d) => {
      const t = d?.totals ?? {}
      const due = Number(t.submitted_cents ?? 0) + Number(t.approved_cents ?? 0)
      return {
        headline: `${money(due)} is due to subcontractors.`,
        detail: `${money(t.approved_cents ?? 0)} approved and ready to pay, ${money(t.submitted_cents ?? 0)} still waiting on approval. ${money(t.paid_cents ?? 0)} has already gone out.`,
      }
    },
    columns: [
      { key: 'subcontractor_name', label: 'Subcontractor', strong: true },
      { key: 'invoice_number', label: 'Invoice' },
      { key: 'status', label: 'Status' },
      { key: 'completion_date', label: 'Completed', kind: 'date' },
      { key: 'total_cents', label: 'Amount', kind: 'money' },
    ],
  },

  'contractor-1099': {
    id: 'contractor-1099',
    title: 'Who needs a 1099?',
    builtFrom: ['contractor-1099-summary'],
    path: '/v1/reports/contractor-1099-summary',
    dateMode: 'none',
    answer: (d) => {
      const t = d?.totals ?? {}
      const missing = Number(t.missing_w9_count ?? 0)
      return {
        headline: `${count(t.review_count ?? 0, 'contractor')} crossed the 1099 threshold in ${d?.year ?? 'this year'}.`,
        detail:
          missing > 0
            ? `${count(missing, 'of them has', 'of them have')} no W-9 on file — that is the part to fix before January.`
            : `${money(t.review_cents ?? 0)} paid to them, and every one has a W-9 on file.`,
      }
    },
    columns: [
      { key: 'subcontractor_name', label: 'Contractor', strong: true },
      { key: 'w9_on_file', label: 'W-9' },
      { key: 'paid_cents', label: 'Paid', kind: 'money' },
    ],
  },

  'job-profitability': {
    id: 'job-profitability',
    title: 'Which jobs actually made money?',
    builtFrom: ['job-profitability'],
    path: '/v1/reports/job-profitability',
    dateMode: 'range',
    answer: (d) => {
      const t = d?.totals ?? {}
      const rows = rowsOf(d)
      const complete = rowsAreComplete(rows, 'revenue_cents', t.revenue_cents)
      const losers = rows.filter((r) => (Number(r.margin_cents) || 0) < 0)
      const pct = Number(t.margin_pct)
      return {
        headline: `${money(t.margin_cents ?? 0)} margin on ${money(t.revenue_cents ?? 0)} of work${Number.isFinite(pct) ? ` — ${pct.toFixed(1)}%` : ''}.`,
        detail: !complete
          ? undefined
          : losers.length
            ? `${count(losers.length, 'job')} lost money, ${money(Math.abs(sumBy(losers, 'margin_cents')))} between them.`
            : 'Every job in this window came out ahead.',
      }
    },
    columns: [
      { key: 'customer_name', label: 'Customer', strong: true },
      { key: 'work_order_number', label: 'Job' },
      { key: 'revenue_cents', label: 'Revenue', kind: 'money' },
      { key: 'cost_cents', label: 'Cost', kind: 'money' },
      { key: 'margin_cents', label: 'Margin', kind: 'money' },
      { key: 'margin_pct', label: '%', kind: 'pct' },
    ],
  },

  'tech-performance': {
    id: 'tech-performance',
    title: 'How is each tech doing?',
    builtFrom: ['tech-performance'],
    path: '/v1/reports/tech-performance',
    dateMode: 'range',
    answer: (d) => {
      const t = d?.totals ?? {}
      return {
        headline: `${count(t.tech_count ?? 0, 'tech')} closed ${count(t.job_count ?? 0, 'job')} worth ${money(t.revenue_cents ?? 0)}.`,
        detail: `Average ticket ${money(t.average_ticket_cents ?? 0)}, leaving ${money(t.margin_cents ?? 0)} after labour, parts and commission.`,
      }
    },
    chart: (d) => {
      const rows = rowsOf(d)
      if (!rows.length) return null
      return {
        title: 'Revenue by tech',
        bars: rows
          .slice()
          .sort((a, b) => (Number(b.revenue_cents) || 0) - (Number(a.revenue_cents) || 0))
          .slice(0, 8)
          .map((r) => ({ label: String(r.tech_name ?? 'Unnamed'), value: Number(r.revenue_cents) || 0, money: true })),
      }
    },
    columns: [
      { key: 'tech_name', label: 'Tech', strong: true },
      { key: 'job_count', label: 'Jobs', kind: 'number' },
      { key: 'clock_hours', label: 'Hours', kind: 'number' },
      { key: 'revenue_cents', label: 'Revenue', kind: 'money' },
      { key: 'margin_cents', label: 'Margin', kind: 'money' },
    ],
  },

  'inventory-valuation': {
    id: 'inventory-valuation',
    title: 'What is my inventory worth?',
    builtFrom: ['inventory-valuation'],
    path: '/v1/reports/inventory-valuation',
    dateMode: 'none',
    answer: (d) => {
      const t = d?.totals ?? {}
      return {
        headline: `${money(t.inventory_value_cents ?? 0)} of stock on hand.`,
        detail: `${Number(t.qty_on_hand ?? 0).toLocaleString('en-US')} units across ${count(t.stock_row_count ?? 0, 'stock line')}, of which ${money(t.available_value_cents ?? 0)} is unreserved and actually available to sell.`,
      }
    },
    chart: (d) => {
      const by: Any[] = Array.isArray(d?.by_location) ? d.by_location : []
      if (!by.length) return null
      return {
        title: 'Where the stock is',
        bars: by.map((l) => ({
          label: String(l.location_name ?? 'Unassigned'),
          value: Number(l.inventory_value_cents) || 0,
          money: true,
        })),
      }
    },
    columns: [
      { key: 'item_name', label: 'Item', strong: true },
      { key: 'sku', label: 'SKU' },
      { key: 'location_name', label: 'Location' },
      { key: 'qty_on_hand', label: 'On hand', kind: 'number' },
      { key: 'inventory_value_cents', label: 'Value', kind: 'money' },
    ],
  },

  'inventory-movement': {
    id: 'inventory-movement',
    title: 'What moved in and out of stock?',
    builtFrom: ['inventory-movement'],
    path: '/v1/reports/inventory-movement',
    dateMode: 'range',
    answer: (d) => {
      const t = d?.totals ?? {}
      return {
        headline: `${count(t.movement_count ?? 0, 'stock movement')} worth ${money(t.extended_cost_cents ?? 0)}.`,
        detail: `${Number(t.quantity ?? 0).toLocaleString('en-US')} units net across the window.`,
      }
    },
    chart: (d) => {
      const by: Any[] = Array.isArray(d?.by_type) ? d.by_type : []
      if (!by.length) return null
      return {
        title: 'By movement type',
        bars: by.map((r) => ({
          label: titleCase(r.type ?? r.label ?? ''),
          value: Number(r.extended_cost_cents ?? r.total_cents) || 0,
          money: true,
        })),
      }
    },
    columns: [
      { key: 'item_name', label: 'Item', strong: true },
      { key: 'sku', label: 'SKU' },
      { key: 'quantity', label: 'Qty', kind: 'number' },
      { key: 'extended_cost_cents', label: 'Cost', kind: 'money' },
    ],
  },

  'inventory-spend': {
    id: 'inventory-spend',
    title: 'What did stock cost me?',
    builtFrom: ['inventory-spend'],
    path: '/v1/reports/inventory-spend',
    fixedParams: { group_by: 'item' },
    dateMode: 'range',
    answer: (d) => {
      const t = d?.totals ?? {}
      return {
        headline: `${money(t.spend_cents ?? 0)} spent on stock across ${count(t.po_count ?? 0, 'purchase order')}.`,
        detail: `${Number(t.qty_ordered ?? 0).toLocaleString('en-US')} units ordered, ${Number(t.qty_received ?? 0).toLocaleString('en-US')} received.`,
      }
    },
    columns: [
      { key: 'label', label: 'Item', strong: true },
      { key: 'qty_ordered', label: 'Ordered', kind: 'number' },
      { key: 'qty_received', label: 'Received', kind: 'number' },
      { key: 'spend_cents', label: 'Spend', kind: 'money' },
    ],
  },

  'bank-reconciliation': {
    id: 'bank-reconciliation',
    title: 'Does the bank match my books?',
    builtFrom: ['bank-reconciliation'],
    path: '/v1/reports/bank-reconciliation',
    dateMode: 'range',
    answer: (d) => {
      const t = d?.totals ?? {}
      const unmatched = Number(t.unmatched_count ?? 0)
      return {
        headline: unmatched
          ? `${count(unmatched, 'bank row')} doesn't match your books.`
          : `All ${count(t.transaction_count ?? 0, 'bank row')} match your books.`,
        detail: `${money(t.deposit_cents ?? 0)} in and ${money(t.withdrawal_cents ?? 0)} out over the window${unmatched ? `, with ${money(t.unmatched_cents ?? 0)} of it unaccounted for` : ''}.`,
      }
    },
    chart: (d) => {
      const by: Any[] = Array.isArray(d?.by_status) ? d.by_status : []
      if (!by.length) return null
      return {
        title: 'Match status',
        bars: by.map((s) => ({ label: titleCase(s.status), value: Number(s.net_cents) || 0, money: true })),
      }
    },
    columns: [
      { key: 'description', label: 'Description', strong: true },
      { key: 'transaction_date', label: 'Date', kind: 'date' },
      { key: 'matched_type', label: 'Matched to' },
      { key: 'amount_cents', label: 'Amount', kind: 'money' },
    ],
  },

  'posting-audit': {
    id: 'posting-audit',
    title: 'What never reached the ledger?',
    builtFrom: ['posting-audit'],
    path: '/v1/accounting/posting-audit',
    dateMode: 'range',
    answer: (d) => {
      const n = Number(d?.total_count ?? 0)
      return {
        headline: n
          ? `${count(n, 'record')} never posted to the general ledger.`
          : 'Everything in this window is posted to the ledger.',
        detail: n
          ? `${money(d?.total_amount_cents ?? 0)} of activity the ledger doesn't know about, so any report built from the ledger is short by that much.`
          : undefined,
      }
    },
    chart: (d) => {
      const rows = rowsOf(d)
      if (!rows.length) return null
      return { title: 'What is missing', bars: groupBars(rows, 'record_type', 'amount_cents') }
    },
    columns: [
      { key: 'record_type', label: 'Type', strong: true },
      { key: 'reference', label: 'Reference' },
      { key: 'record_date', label: 'Date', kind: 'date' },
      { key: 'status', label: 'Status' },
      { key: 'amount_cents', label: 'Amount', kind: 'money' },
    ],
  },

  'financial-audit': {
    id: 'financial-audit',
    title: 'Who changed what?',
    builtFrom: ['financial-audit'],
    path: '/v1/reports/financial-audit',
    dateMode: 'range',
    answer: (d) => {
      const t = d?.totals ?? {}
      return {
        headline: `${count(t.event_count ?? 0, 'financial change')} worth ${money(t.impacted_cents ?? 0)}.`,
        detail:
          'Voids, write-offs, refunds, cancelled invoices and reversals — the edits that should never quietly disappear from the books.',
      }
    },
    chart: (d) => {
      const by: Any[] = Array.isArray(d?.by_type) ? d.by_type : []
      if (!by.length) return null
      return {
        title: 'By kind of change',
        bars: by.map((r) => ({
          label: titleCase(r.event_type ?? r.type ?? r.label ?? ''),
          value: Number(r.amount_cents ?? r.impacted_cents ?? r.count) || 0,
          money: Boolean(r.amount_cents ?? r.impacted_cents),
        })),
      }
    },
    columns: [
      { key: 'source_type', label: 'What', strong: true },
      { key: 'reference', label: 'Reference' },
      { key: 'occurred_at', label: 'When', kind: 'date' },
      { key: 'actor_email', label: 'Who' },
      { key: 'amount_cents', label: 'Amount', kind: 'money' },
    ],
  },
}

export function specFor(id: string): ReportSpec | null {
  return REPORT_SPECS[id] ?? null
}
