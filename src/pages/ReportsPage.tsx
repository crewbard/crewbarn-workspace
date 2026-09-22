import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL, apiRequest, getActingTenant, getFranchiseActAs, getStoredToken } from '@/lib/api'

type AgingBucket = {
  bucket: string
  label: string
  count: number
  balance_cents: number
}

type AgingRow = {
  invoice_id: string
  invoice_number: string
  customer_id: string
  customer_name: string | null
  issued_at: string | null
  due_at: string | null
  days_past_due: number
  total_cents: number
  amount_paid_cents: number
  balance_cents: number
  bucket: string
}

type AgingReport = {
  as_of: string
  totals: { invoice_count: number; balance_cents: number }
  buckets: AgingBucket[]
  rows: AgingRow[]
}

type ApAgingRow = {
  vendor_bill_id: string
  bill_number: string | null
  vendor_id: string | null
  vendor_name: string | null
  po_number: string | null
  bill_date: string | null
  due_date: string | null
  days_past_due: number
  total_cents: number
  amount_paid_cents: number
  balance_cents: number
  bucket: string
}

type ApAgingReport = {
  as_of: string
  totals: { bill_count: number; balance_cents: number }
  buckets: AgingBucket[]
  rows: ApAgingRow[]
}

type RevenueRow = {
  key: string
  label: string
  invoice_count: number
  line_count: number
  subtotal_cents: number
  discount_cents: number
  tax_cents: number
  total_cents: number
}

type RevenueReport = {
  from: string
  to: string
  group_by: string
  totals: {
    invoice_count: number
    line_count: number
    subtotal_cents: number
    discount_cents: number
    tax_cents: number
    total_cents: number
  }
  rows: RevenueRow[]
}

type InvoiceRegisterRow = {
  invoice_id: string
  invoice_number: string
  status: string
  customer_id: string
  customer_name: string | null
  work_order_number: string | null
  issued_at: string | null
  due_at: string | null
  total_cents: number
  amount_paid_cents: number
  balance_cents: number
}

type InvoiceRegisterReport = {
  from: string
  to: string
  totals: {
    invoice_count: number
    total_cents: number
    paid_cents: number
    balance_cents: number
  }
  rows: InvoiceRegisterRow[]
}

type PaymentRegisterRow = {
  payment_id: string
  status: string
  customer_id: string
  customer_name: string | null
  work_order_number: string | null
  payment_method: string
  payment_reference: string | null
  amount_cents: number
  processing_fee_cents: number
  net_deposit_cents: number
  collected_by_email: string | null
  received_by_email: string | null
  received_at: string | null
}

type PaymentRegisterReport = {
  from: string
  to: string
  totals: {
    payment_count: number
    amount_cents: number
    processing_fee_cents: number
    net_deposit_cents: number
    tip_cents: number
    customer_credit_cents: number
    allocated_cents: number
  }
  rows: PaymentRegisterRow[]
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
}

type CustomerCreditRegisterReport = {
  from: string
  to: string
  totals: {
    credit_count: number
    amount_cents: number
    applied_cents: number
    refunded_cents: number
    balance_cents: number
  }
  rows: CustomerCreditRegisterRow[]
}

type BankReconciliationRow = {
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
  matched_at: string | null
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
  rows: BankReconciliationRow[]
}

type FinancialAuditRow = {
  event_id: string
  event_type: string
  occurred_at: string | null
  source_type: string
  source_id: string
  reference: string | null
  customer_name: string | null
  work_order_number: string | null
  actor_email: string | null
  amount_cents: number
  reason: string | null
}

type FinancialAuditReport = {
  from: string
  to: string
  event_type: string | null
  totals: {
    event_count: number
    impacted_cents: number
  }
  by_type: Array<{
    event_type: string
    count: number
    amount_cents: number
  }>
  rows: FinancialAuditRow[]
}

type PostingAuditRow = {
  id: string
  record_type: string
  reference: string | null
  record_date: string | null
  status: string | null
  amount_cents: number
  reason: string
  source_type: string
  source_id: string
}

type PostingAuditReport = {
  from: string
  to: string
  total_count: number
  total_amount_cents: number
  truncated: boolean
  rows: PostingAuditRow[]
}

type JobProfitabilityRow = {
  work_order_id: string
  work_order_number: string
  customer_name: string | null
  job_type: string | null
  status: string | null
  lead_tech: string | null
  revenue_cents: number
  cost_cents: number
  margin_cents: number
  margin_pct: number | null
}

type JobProfitabilityReport = {
  from: string
  to: string
  totals: {
    job_count: number
    revenue_cents: number
    cost_cents: number
    margin_cents: number
    margin_pct: number | null
  }
  rows: JobProfitabilityRow[]
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

type InventoryMovementRow = {
  movement_id: string
  type: string
  catalog_item_name: string | null
  sku: string | null
  quantity: number
  unit_cost_cents: number
  extended_cost_cents: number
  from_location: string | null
  to_location: string | null
  applied_at: string | null
  created_at: string | null
}

type InventoryMovementReport = {
  from: string
  to: string
  totals: {
    movement_count: number
    quantity: number
    extended_cost_cents: number
  }
  by_type: Array<{ type: string; count: number; quantity: number; extended_cost_cents: number }>
  rows: InventoryMovementRow[]
}

type InventoryValuationRow = {
  stock_level_id: string
  item_name: string | null
  sku: string | null
  location_name: string | null
  bin_name: string | null
  qty_on_hand: number
  qty_available: number
  unit_cost_cents: number
  inventory_value_cents: number
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
  rows: InventoryValuationRow[]
}

type InventorySpendRow = {
  key: string
  label: string
  po_count: number
  line_count: number
  qty_ordered: number
  qty_received: number
  spend_cents: number
}

type InventorySpendReport = {
  from: string
  to: string
  group_by: string
  status: string | null
  totals: {
    po_count: number
    line_count: number
    qty_ordered: number
    qty_received: number
    spend_cents: number
  }
  rows: InventorySpendRow[]
}

type PurchaseOrderRegisterRow = {
  purchase_order_id: string
  po_number: string
  vendor_name: string | null
  vendor_order_number: string | null
  status: string
  order_date: string | null
  expected_delivery: string | null
  item_count: number
  total_cents: number
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
  rows: PurchaseOrderRegisterRow[]
}

type ExpenseRegisterRow = {
  expense_id: string
  expense_date: string | null
  category: string
  description: string
  vendor_name: string | null
  employee_name: string | null
  employee_email: string | null
  work_order_id: string | null
  work_order_number: number | string | null
  work_order_title: string | null
  receipt_attachment_ids: string[]
  receipt_attachment_count: number
  amount_cents: number
  tax_cents: number
  total_cents: number
  status: string
  reimbursable: boolean
  reimbursement_status: string
  billable_to_job: boolean
}

type ExpenseRegisterReport = {
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
  rows: ExpenseRegisterRow[]
}

type VendorBillRegisterRow = {
  vendor_bill_id: string
  bill_number: string | null
  vendor_name: string | null
  po_number: string | null
  bill_date: string | null
  due_date: string | null
  category: string
  status: string
  total_cents: number
  amount_paid_cents: number
  balance_cents: number
}

type VendorBillRegisterReport = {
  from: string
  to: string
  totals: {
    bill_count: number
    total_cents: number
    paid_cents: number
    balance_cents: number
    overdue_cents: number
  }
  rows: VendorBillRegisterRow[]
}

type SubcontractorPayoutRow = {
  sub_invoice_id: string
  invoice_number: string | null
  status: string
  subcontractor_name: string | null
  work_order_id: string
  work_order_number: string | null
  completion_date: string | null
  paid_at: string | null
  paid_via: string | null
  total_cents: number
}

type SubcontractorPayoutReport = {
  from: string
  to: string
  totals: {
    invoice_count: number
    submitted_cents: number
    approved_cents: number
    paid_cents: number
    total_cents: number
  }
  rows: SubcontractorPayoutRow[]
}

type Contractor1099SummaryRow = {
  subcontractor_id: string | null
  subcontractor_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  w9_on_file: boolean
  invoice_count: number
  paid_cents: number
  requires_1099_review: boolean
  last_paid_at: string | null
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
  rows: Contractor1099SummaryRow[]
}

const revenueGroups = [
  { value: 'month', label: 'Month' },
  { value: 'customer', label: 'Customer' },
  { value: 'job_type', label: 'Job type' },
  { value: 'technician', label: 'Technician' },
  { value: 'service', label: 'Line item' },
]

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

function previewValue(showGridPreviews: boolean, isLoading: boolean, value: string): string {
  if (!showGridPreviews) return '-'
  return isLoading ? '...' : value
}

function rowStringValue(row: unknown, key: string): string {
  if (!row || typeof row !== 'object') return ''
  const value = (row as Record<string, unknown>)[key]
  return value == null ? '' : String(value)
}

function rowNumberValue(row: unknown, key: string): number | null {
  if (!row || typeof row !== 'object') return null
  const value = (row as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : null
}

function searchableReportText(row: unknown): string {
  if (!row || typeof row !== 'object') return ''
  return Object.values(row as Record<string, unknown>)
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).toLowerCase())
    .join(' ')
}

function csvCell(value: unknown): string {
  const raw = value == null
    ? ''
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)
  return `"${raw.replace(/"/g, '""')}"`
}

function reportFileSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function reportFilterLabel(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const reportPanelIds = [
  'unpaid-invoices',
  'invoice-register',
  'payment-register',
  'customer-credit-register',
  'financial-audit',
  'posting-audit',
  'bank-reconciliation',
  'purchase-order-register',
  'expense-register',
  'vendor-bill-register',
  'subcontractor-payout',
  'contractor-1099',
  'job-profitability',
  'inventory-movement',
  'inventory-spend',
  'inventory-valuation',
  'ar-aging',
  'ap-aging',
  'revenue-breakdown',
  'tech-performance',
] as const

type ReportPanelId = (typeof reportPanelIds)[number]
type ReportLayout = 'balanced' | 'dense' | 'single' | 'browser'
type ReportPageSize = 10 | 50 | 100 | 'all'
type ReportStatusFilter = 'all' | 'paid' | 'unpaid' | 'open' | 'not_closed' | 'closed'
type InvoiceDateScope = 'all' | 'range'
type ReimbursementStatusFilter = 'all' | 'pending' | 'approved' | 'reimbursed' | 'not_reimbursable' | 'rejected'
type ReportPayTypeFilter = 'all' | 'hourly' | 'salary' | 'commission' | 'hybrid' | 'none'
type Contractor1099ReviewFilter = 'all' | 'review' | 'missing_w9' | 'below_threshold'

type SavedReportPreset = {
  id: string
  name: string
  report: ReportPanelId
  from: string
  to: string
  asOf: string
  groupBy: string
  inventorySpendGroupBy: 'item' | 'vendor' | 'category' | 'po'
  layout: ReportLayout
  pageSize: ReportPageSize
  reportSearch: string
  customerFilter: string
  techFilter: string
  statusFilter: ReportStatusFilter
  invoiceDateScope: InvoiceDateScope
  reimbursementStatusFilter: ReimbursementStatusFilter
  techPerformancePayTypeFilter: ReportPayTypeFilter
  contractor1099ReviewFilter: Contractor1099ReviewFilter
  createdAt: string
}

type ApiSavedReportPreset = {
  id: string
  name: string
  report_key: string
  filters: Record<string, unknown> | null
  layout: string | null
  visibility: 'tenant' | 'private'
  sort_order: number
  is_default: boolean
  created_at: string | null
}

function reportPanelIdFromParam(value: string | null): ReportPanelId | null {
  return reportPanelIds.includes(value as ReportPanelId) ? value as ReportPanelId : null
}

function reportLayoutFromParam(value: string | null): ReportLayout | null {
  return ['balanced', 'dense', 'single', 'browser'].includes(value ?? '') ? value as ReportLayout : null
}

function reportRowMatchesStatus(row: unknown, filter: ReportStatusFilter): boolean {
  if (filter === 'all') return true

  const status = (rowStringValue(row, 'status') || rowStringValue(row, 'match_status') || rowStringValue(row, 'transaction_type')).toLowerCase()
  if (!status && rowStringValue(row, 'event_type')) return true

  const balance = rowNumberValue(row, 'balance_cents')
  const total = rowNumberValue(row, 'total_cents')
  const amountPaid = rowNumberValue(row, 'amount_paid_cents')
  const paidAt = rowStringValue(row, 'paid_at') || rowStringValue(row, 'received_at') || rowStringValue(row, 'matched_at')

  const paid =
    status.includes('paid') ||
    status.includes('matched') ||
    status.includes('received') ||
    Boolean(paidAt) ||
    (balance !== null && balance <= 0 && (total === null || total > 0)) ||
    (total !== null && amountPaid !== null && total > 0 && amountPaid >= total)

  const closed =
    paid ||
    status.includes('closed') ||
    status.includes('complete') ||
    status.includes('cancel') ||
    status.includes('void') ||
    status.includes('ignored')

  const unpaid =
    (balance !== null && balance > 0) ||
    status.includes('unpaid') ||
    status.includes('draft') ||
    status.includes('sent') ||
    status.includes('pending') ||
    status.includes('submitted') ||
    status.includes('unmatched')

  if (filter === 'paid') return paid
  if (filter === 'unpaid') return unpaid && !paid
  if (filter === 'open') return unpaid && !closed
  if (filter === 'not_closed') return !closed
  if (filter === 'closed') return closed
  return true
}

const reportOrderKey = 'crewbarn_reports_order_v1'
const reportLayoutKey = 'crewbarn_reports_layout_v1'
const reportDragModeKey = 'crewbarn_reports_drag_mode_v1'
const savedReportPresetsKey = 'crewbarn_reports_saved_presets_v1'

const reportLayoutOptions: Array<{ value: ReportLayout; label: string; description: string }> = [
  { value: 'balanced', label: 'Balanced', description: 'Two-column desktop grid with comfortable rows.' },
  { value: 'dense', label: 'Dense', description: 'More reports visible on wide monitors.' },
  { value: 'single', label: 'Single column', description: 'One report per row for review work.' },
  { value: 'browser', label: 'Left menu', description: 'Choose a report on the left, review the grid on the right.' },
]

const reportPanelMeta: Record<ReportPanelId, { title: string; description: string; dateMode: 'range' | 'asOf' | 'all'; help: string }> = {
  'unpaid-invoices': {
    title: 'Unpaid invoices',
    description: 'Every unpaid invoice and remaining customer balance across all time.',
    dateMode: 'all',
    help: 'Use this for collections, customer follow-up, and a complete export of outstanding invoices.',
  },
  'invoice-register': {
    title: 'Invoice register',
    description: 'Every invoice with status, customer, issue date, due date, and balance.',
    dateMode: 'range',
    help: 'Use this to review billing status, find unpaid or draft invoices, and export an invoice list for bookkeeping.',
  },
  'payment-register': {
    title: 'Payment register',
    description: 'Payments by method, collector, received date, allocations, and void history.',
    dateMode: 'range',
    help: 'Use this to audit cash, card, check, and field-collected payments, including who collected them and whether they were voided.',
  },
  'customer-credit-register': {
    title: 'Customer credit register',
    description: 'Overpayments, down payments, applied credits, refunds, and remaining balances.',
    dateMode: 'range',
    help: 'Use this to review unapplied customer money before refunds, invoice application, or month-end close.',
  },
  'financial-audit': {
    title: 'Financial audit',
    description: 'Voids, write-offs, refunds, cancelled invoices, and journal reversals.',
    dateMode: 'range',
    help: 'Use this for owner or bookkeeper review of financial changes that should never disappear from the books.',
  },
  'posting-audit': {
    title: 'Posting audit',
    description: 'Accounting records that are not yet posted to the general ledger.',
    dateMode: 'range',
    help: 'Use this before closing books to find invoices, payments, expenses, purchase orders, bills, and bank rows that still need ledger posting.',
  },
  'bank-reconciliation': {
    title: 'Bank reconciliation',
    description: 'Imported bank rows, match status, linked payments, expenses, purchase orders, and unmatched money.',
    dateMode: 'range',
    help: 'Use this to compare bank activity against CrewBarn payments, expenses, purchase orders, and deposits.',
  },
  'purchase-order-register': {
    title: 'Purchase order register',
    description: 'Purchase orders, vendors, delivery dates, item counts, and totals.',
    dateMode: 'range',
    help: 'Use this to see what was ordered, what vendor it came from, and what has been received for inventory cost tracking.',
  },
  'expense-register': {
    title: 'Expense register',
    description: 'Fuel, vendor bills, materials, reimbursements, and company overhead.',
    dateMode: 'range',
    help: 'Use this to review money out by date, category, vendor, job, technician, or reimbursement status.',
  },
  'vendor-bill-register': {
    title: 'Vendor bill register',
    description: 'Open AP, paid bills, due dates, purchase-order links, and vendor balances.',
    dateMode: 'range',
    help: 'Use this to manage bills owed to vendors and verify what has been approved, paid, or still open.',
  },
  'subcontractor-payout': {
    title: 'Subcontractor payout',
    description: 'Sub invoices, approval status, completion dates, paid dates, and totals.',
    dateMode: 'range',
    help: 'Use this to confirm subcontractor work, approval status, and payout amounts before sending payment.',
  },
  'contractor-1099': {
    title: '1099 contractor summary',
    description: 'Paid subcontractor totals by tax year, W-9 status, and current 1099 review threshold.',
    dateMode: 'asOf',
    help: 'Use this to review which subcontractors may need 1099-NEC filing data. CrewBarn tracks the data; filing still goes through your accountant or 1099 provider.',
  },
  'job-profitability': {
    title: 'Job profitability',
    description: 'Invoice revenue against labor, parts, fuel, subcontractors, overhead, and margin.',
    dateMode: 'range',
    help: 'Use this to see whether completed jobs made money after direct costs, labor, fuel, parts, and overhead allocation.',
  },
  'inventory-movement': {
    title: 'Inventory movement',
    description: 'Stock usage, transfers, adjustments, low stock, shrink signals, and valuation.',
    dateMode: 'range',
    help: 'Use this to audit stock movement between warehouse, trucks, jobs, adjustments, and shrink events.',
  },
  'inventory-spend': {
    title: 'Inventory spend',
    description: 'Purchase-order spend by vendor, item, category, or PO number.',
    dateMode: 'range',
    help: 'Use this to review what was spent on inventory and where the cost came from by PO, vendor, item, or date.',
  },
  'inventory-valuation': {
    title: 'Inventory valuation',
    description: 'On-hand inventory value by item, warehouse, truck, and bin.',
    dateMode: 'asOf',
    help: 'Use this to estimate the value of stock on hand at a point in time, including warehouse and truck inventory.',
  },
  'ar-aging': {
    title: 'A/R aging',
    description: 'Who owes money, how old the balance is, and which invoices need follow-up.',
    dateMode: 'asOf',
    help: 'Use this to prioritize collections by customer and invoice age.',
  },
  'ap-aging': {
    title: 'A/P aging',
    description: 'Which vendor bills are open, how old they are, and what needs to be paid.',
    dateMode: 'asOf',
    help: 'Use this to plan vendor payments and avoid missing due bills.',
  },
  'revenue-breakdown': {
    title: 'Revenue breakdown',
    description: 'Revenue by month, customer, job type, technician, or line item.',
    dateMode: 'range',
    help: 'Use this to understand where revenue is coming from by customer, work type, technician, or service line.',
  },
  'tech-performance': {
    title: 'Tech performance',
    description: 'Jobs, revenue, time-clock hours, payroll cost, reimbursements, and margin by technician.',
    dateMode: 'range',
    help: 'Use this to review technician output, payroll cost, reimbursements, callbacks, and profitability.',
  },
}

function normalizeReportOrder(value: unknown): ReportPanelId[] {
  const incoming = Array.isArray(value) ? value : []
  const known = incoming.filter((id): id is ReportPanelId =>
    typeof id === 'string' && reportPanelIds.includes(id as ReportPanelId),
  )
  return [...known, ...reportPanelIds.filter((id) => !known.includes(id))]
}

function readReportOrder(): ReportPanelId[] {
  try {
    return normalizeReportOrder(JSON.parse(localStorage.getItem(reportOrderKey) || '[]'))
  } catch {
    return [...reportPanelIds]
  }
}

function readReportLayout(): ReportLayout {
  try {
    const stored = localStorage.getItem(reportLayoutKey)
    return stored === 'dense' || stored === 'single' || stored === 'balanced' || stored === 'browser' ? stored : 'balanced'
  } catch {
    return 'balanced'
  }
}

function readReportDragMode(): boolean {
  try {
    return localStorage.getItem(reportDragModeKey) === '1'
  } catch {
    return false
  }
}

function normalizeReportPageSize(value: unknown): ReportPageSize {
  if (value === 'all') return 'all'
  return value === 10 || value === 100 ? value : 50
}

function readSavedReportPresets(): SavedReportPreset[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(savedReportPresetsKey) || '[]')
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((preset): SavedReportPreset | null => {
        if (!preset || typeof preset !== 'object') return null
        const report = reportPanelIdFromParam(String(preset.report ?? ''))
        if (!report) return null
        const layout = reportLayoutFromParam(String(preset.layout ?? '')) ?? 'browser'
        const inventorySpendGroupBy = ['item', 'vendor', 'category', 'po'].includes(String(preset.inventorySpendGroupBy))
          ? preset.inventorySpendGroupBy as SavedReportPreset['inventorySpendGroupBy']
          : 'item'
        const statusFilter = ['all', 'paid', 'unpaid', 'open', 'not_closed', 'closed'].includes(String(preset.statusFilter))
          ? preset.statusFilter as ReportStatusFilter
          : 'all'
        const reimbursementStatusFilter = ['all', 'pending', 'approved', 'reimbursed', 'not_reimbursable', 'rejected'].includes(String(preset.reimbursementStatusFilter))
          ? preset.reimbursementStatusFilter as ReimbursementStatusFilter
          : 'all'
        const techPerformancePayTypeFilter = ['all', 'hourly', 'salary', 'commission', 'hybrid', 'none'].includes(String(preset.techPerformancePayTypeFilter))
          ? preset.techPerformancePayTypeFilter as ReportPayTypeFilter
          : 'all'
        const contractor1099ReviewFilter = ['all', 'review', 'missing_w9', 'below_threshold'].includes(String(preset.contractor1099ReviewFilter))
          ? preset.contractor1099ReviewFilter as Contractor1099ReviewFilter
          : 'all'

        return {
          id: String(preset.id || `${report}-${preset.createdAt || Date.now()}`),
          name: String(preset.name || reportPanelMeta[report].title),
          report,
          from: String(preset.from || ''),
          to: String(preset.to || ''),
          asOf: String(preset.asOf || ''),
          groupBy: String(preset.groupBy || 'month'),
          inventorySpendGroupBy,
          layout,
          pageSize: normalizeReportPageSize(preset.pageSize),
          reportSearch: String(preset.reportSearch || ''),
          customerFilter: String(preset.customerFilter || ''),
          techFilter: String(preset.techFilter || ''),
          statusFilter,
          invoiceDateScope: preset.invoiceDateScope === 'all' ? 'all' : 'range',
          reimbursementStatusFilter,
          techPerformancePayTypeFilter,
          contractor1099ReviewFilter,
          createdAt: String(preset.createdAt || ''),
        }
      })
      .filter((preset): preset is SavedReportPreset => Boolean(preset))
  } catch {
    return []
  }
}

function writeSavedReportPresets(presets: SavedReportPreset[]) {
  try {
    localStorage.setItem(savedReportPresetsKey, JSON.stringify(presets))
  } catch {
    /* ignore */
  }
}

function normalizeSavedReportPreset(input: unknown): SavedReportPreset | null {
  if (!input || typeof input !== 'object') return null
  const preset = input as Record<string, unknown>
  const report = reportPanelIdFromParam(String(preset.report ?? preset.report_key ?? ''))
  if (!report) return null
  const filters = preset.filters && typeof preset.filters === 'object'
    ? preset.filters as Record<string, unknown>
    : preset
  const layout = reportLayoutFromParam(String(preset.layout ?? filters.layout ?? '')) ?? 'browser'
  const inventorySpendGroupBy = ['item', 'vendor', 'category', 'po'].includes(String(filters.inventorySpendGroupBy))
    ? filters.inventorySpendGroupBy as SavedReportPreset['inventorySpendGroupBy']
    : 'item'
  const statusFilter = ['all', 'paid', 'unpaid', 'open', 'not_closed', 'closed'].includes(String(filters.statusFilter))
    ? filters.statusFilter as ReportStatusFilter
    : 'all'
  const reimbursementStatusFilter = ['all', 'pending', 'approved', 'reimbursed', 'not_reimbursable', 'rejected'].includes(String(filters.reimbursementStatusFilter))
    ? filters.reimbursementStatusFilter as ReimbursementStatusFilter
    : 'all'
  const techPerformancePayTypeFilter = ['all', 'hourly', 'salary', 'commission', 'hybrid', 'none'].includes(String(filters.techPerformancePayTypeFilter))
    ? filters.techPerformancePayTypeFilter as ReportPayTypeFilter
    : 'all'
  const contractor1099ReviewFilter = ['all', 'review', 'missing_w9', 'below_threshold'].includes(String(filters.contractor1099ReviewFilter))
    ? filters.contractor1099ReviewFilter as Contractor1099ReviewFilter
    : 'all'

  return {
    id: String(preset.id || `${report}-${filters.createdAt || Date.now()}`),
    name: String(preset.name || reportPanelMeta[report].title),
    report,
    from: String(filters.from || ''),
    to: String(filters.to || ''),
    asOf: String(filters.asOf || ''),
    groupBy: String(filters.groupBy || 'month'),
    inventorySpendGroupBy,
    layout,
    pageSize: normalizeReportPageSize(filters.pageSize),
    reportSearch: String(filters.reportSearch || ''),
    customerFilter: String(filters.customerFilter || ''),
    techFilter: String(filters.techFilter || ''),
    statusFilter,
    invoiceDateScope: filters.invoiceDateScope === 'all' ? 'all' : 'range',
    reimbursementStatusFilter,
    techPerformancePayTypeFilter,
    contractor1099ReviewFilter,
    createdAt: String(preset.created_at || filters.createdAt || ''),
  }
}

function apiPresetToSaved(preset: ApiSavedReportPreset): SavedReportPreset | null {
  return normalizeSavedReportPreset(preset)
}

function savedPresetFilters(preset: SavedReportPreset): Record<string, unknown> {
  return {
    from: preset.from,
    to: preset.to,
    asOf: preset.asOf,
    groupBy: preset.groupBy,
    inventorySpendGroupBy: preset.inventorySpendGroupBy,
    layout: preset.layout,
    pageSize: preset.pageSize,
    reportSearch: preset.reportSearch,
    customerFilter: preset.customerFilter,
    techFilter: preset.techFilter,
    statusFilter: preset.statusFilter,
    invoiceDateScope: preset.invoiceDateScope,
    reimbursementStatusFilter: preset.reimbursementStatusFilter,
    techPerformancePayTypeFilter: preset.techPerformancePayTypeFilter,
    contractor1099ReviewFilter: preset.contractor1099ReviewFilter,
    createdAt: preset.createdAt,
  }
}

function reportGridClass(layout: ReportLayout): string {
  if (layout === 'browser') return 'grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start'
  if (layout === 'dense') return 'grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3'
  if (layout === 'single') return 'grid grid-cols-1 gap-4'
  return 'grid grid-cols-1 xl:grid-cols-2 gap-4'
}

async function downloadReportFile(path: string, filename: string) {
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
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function ReportsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const defaults = useMemo(() => {
    const now = new Date()
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: isoDate(now),
      asOf: isoDate(now),
    }
  }, [])

  // A link may carry its own window — the front door and saved views both
  // build links, and a range in the URL is what makes one shareable.
  const isDayParam = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  const [from, setFrom] = useState(() =>
    isDayParam(searchParams.get('from')) ? (searchParams.get('from') as string) : defaults.from,
  )
  const [to, setTo] = useState(() =>
    isDayParam(searchParams.get('to')) ? (searchParams.get('to') as string) : defaults.to,
  )
  const [asOf, setAsOf] = useState(() =>
    isDayParam(searchParams.get('as_of')) ? (searchParams.get('as_of') as string) : defaults.asOf,
  )
  const [groupBy, setGroupBy] = useState('month')
  const [inventorySpendGroupBy, setInventorySpendGroupBy] = useState<'item' | 'vendor' | 'category' | 'po'>('item')
  const [reportOrder, setReportOrder] = useState<ReportPanelId[]>(readReportOrder)
  const [reportLayout, setReportLayout] = useState<ReportLayout>(
    () => reportLayoutFromParam(searchParams.get('layout')) ?? readReportLayout(),
  )
  const [selectedReport, setSelectedReport] = useState<ReportPanelId>(
    () => reportPanelIdFromParam(searchParams.get('report')) ?? 'invoice-register',
  )
  const [reportDragMode, setReportDragMode] = useState(readReportDragMode)
  const [draggedReport, setDraggedReport] = useState<ReportPanelId | null>(null)
  const [dragOverReport, setDragOverReport] = useState<ReportPanelId | null>(null)
  const [reportSearch, setReportSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [techFilter, setTechFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>('all')
  const [invoiceDateScope, setInvoiceDateScope] = useState<InvoiceDateScope>('all')
  const [reimbursementStatusFilter, setReimbursementStatusFilter] = useState<ReimbursementStatusFilter>('all')
  const [techPerformancePayTypeFilter, setTechPerformancePayTypeFilter] = useState<ReportPayTypeFilter>('all')
  const [contractor1099ReviewFilter, setContractor1099ReviewFilter] = useState<Contractor1099ReviewFilter>('all')
  const [pageSize, setPageSize] = useState<ReportPageSize>(50)
  const [reportPage, setReportPage] = useState(1)
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null)
  const [reportDownloadError, setReportDownloadError] = useState<string | null>(null)
  const [savedReportPresets, setSavedReportPresets] = useState<SavedReportPreset[]>(readSavedReportPresets)
  const [showGridPreviews, setShowGridPreviews] = useState(() => {
    try {
      return localStorage.getItem('crewbarn_reports_show_grid_previews') === '1'
    } catch {
      return false
    }
  })

  const setGridPreference = (next: boolean) => {
    setShowGridPreviews(next)
    try {
      localStorage.setItem('crewbarn_reports_show_grid_previews', next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const reportPresetsQ = useQuery({
    queryKey: ['report-presets'],
    queryFn: () => apiRequest<{ data: ApiSavedReportPreset[] }>('/v1/reports/presets'),
  })

  useEffect(() => {
    if (!reportPresetsQ.data) return
    const remote = reportPresetsQ.data.data
      .map(apiPresetToSaved)
      .filter((preset): preset is SavedReportPreset => Boolean(preset))
    setSavedReportPresets(remote)
    writeSavedReportPresets(remote)
  }, [reportPresetsQ.data])

  const savePresetMutation = useMutation({
    mutationFn: (preset: SavedReportPreset) => apiRequest<{ data: ApiSavedReportPreset }>('/v1/reports/presets', {
      method: 'POST',
      body: {
        name: preset.name,
        report_key: preset.report,
        filters: savedPresetFilters(preset),
        layout: preset.layout,
        visibility: 'tenant',
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-presets'] })
    },
  })

  const deletePresetMutation = useMutation({
    // DELETE, not the POST .../remove alias. Both hit the same controller;
    // the alias only exists for a client that no longer calls it.
    mutationFn: (id: string) => apiRequest<null>(`/v1/reports/presets/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-presets'] })
    },
  })

  const resetReportPage = () => setReportPage(1)

  const downloadReport = async (path: string, filename: string) => {
    if (downloadingReport) return
    setDownloadingReport(filename)
    setReportDownloadError(null)
    try {
      await downloadReportFile(path, filename)
    } catch (error) {
      setReportDownloadError(error instanceof Error ? error.message : 'Could not download report.')
    } finally {
      setDownloadingReport(null)
    }
  }

  const openReport = (id: ReportPanelId) => {
    setSelectedReport(id)
    if (id === 'invoice-register' && selectedReport !== id) setInvoiceDateScope('all')
    if (id === 'unpaid-invoices') setStatusFilter('all')
    resetReportPage()
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('report', id)
      next.set('layout', 'browser')
      return next
    }, { replace: true })
  }

  const persistSavedReportPresets = (next: SavedReportPreset[]) => {
    setSavedReportPresets(next)
    writeSavedReportPresets(next)
  }

  const saveCurrentReportPreset = () => {
    const defaultName = `${reportPanelMeta[selectedReport].title} ${new Date().toLocaleDateString()}`
    const name = window.prompt('Name this saved report view', defaultName)?.trim()
    if (!name) return

    const preset: SavedReportPreset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      report: selectedReport,
      from,
      to,
      asOf,
      groupBy,
      inventorySpendGroupBy,
      layout: reportLayout,
      pageSize,
      reportSearch,
      customerFilter,
      techFilter,
      statusFilter,
      invoiceDateScope,
      reimbursementStatusFilter,
      techPerformancePayTypeFilter,
      contractor1099ReviewFilter,
      createdAt: new Date().toISOString(),
    }
    const next = [preset, ...savedReportPresets.filter((item) => item.name.toLowerCase() !== name.toLowerCase())].slice(0, 12)
    persistSavedReportPresets(next)
    savePresetMutation.mutate(preset)
  }

  const openSavedReportPreset = (preset: SavedReportPreset) => {
    setSelectedReport(preset.report)
    setFrom(preset.from || defaults.from)
    setTo(preset.to || defaults.to)
    setAsOf(preset.asOf || defaults.asOf)
    setGroupBy(preset.groupBy || 'month')
    setInventorySpendGroupBy(preset.inventorySpendGroupBy)
    setReportLayoutPreference(preset.layout)
    setPageSize(preset.pageSize)
    setReportSearch(preset.reportSearch)
    setCustomerFilter(preset.customerFilter)
    setTechFilter(preset.techFilter)
    setStatusFilter(preset.statusFilter)
    setInvoiceDateScope(preset.invoiceDateScope)
    setReimbursementStatusFilter(preset.reimbursementStatusFilter)
    setTechPerformancePayTypeFilter(preset.techPerformancePayTypeFilter)
    setContractor1099ReviewFilter(preset.contractor1099ReviewFilter)
    resetReportPage()
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('report', preset.report)
      next.set('layout', preset.layout)
      return next
    }, { replace: true })
  }

  // Applied once, after the presets arrive. Guarded by a ref rather than the
  // param alone, so editing the range afterwards isn't snapped back on the
  // next render.
  const appliedPresetRef = useRef<string | null>(null)
  const presetParam = searchParams.get('preset')
  useEffect(() => {
    if (!presetParam || appliedPresetRef.current === presetParam) return
    const match = savedReportPresets.find((preset) => preset.id === presetParam)
    if (!match) return
    appliedPresetRef.current = presetParam
    openSavedReportPreset(match)
  }, [presetParam, savedReportPresets])

  const deleteSavedReportPreset = (id: string) => {
    persistSavedReportPresets(savedReportPresets.filter((preset) => preset.id !== id))
    if (id.startsWith('rptp_')) {
      deletePresetMutation.mutate(id)
    }
  }

  const setReportLayoutPreference = (next: ReportLayout) => {
    setReportLayout(next)
    setSearchParams((current) => {
      const params = new URLSearchParams(current)
      params.set('layout', next)
      params.set('report', selectedReport)
      return params
    }, { replace: true })
    try {
      localStorage.setItem(reportLayoutKey, next)
    } catch {
      /* ignore */
    }
  }

  const setReportDragPreference = (next: boolean) => {
    setReportDragMode(next)
    setDraggedReport(null)
    setDragOverReport(null)
    try {
      localStorage.setItem(reportDragModeKey, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const persistReportOrder = (next: ReportPanelId[]) => {
    setReportOrder(next)
    try {
      localStorage.setItem(reportOrderKey, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const moveReportPanel = (fromId: ReportPanelId, toId: ReportPanelId) => {
    if (fromId === toId) return
    const next = reportOrder.filter((id) => id !== fromId)
    const toIndex = next.indexOf(toId)
    next.splice(toIndex < 0 ? next.length : toIndex, 0, fromId)
    persistReportOrder(normalizeReportOrder(next))
  }

  const resetReportLayout = () => {
    persistReportOrder([...reportPanelIds])
    setReportLayoutPreference('balanced')
  }

  const reportDragProps = (id: ReportPanelId) => ({
    draggable: reportDragMode,
    onDragStart: (event: DragEvent<HTMLDivElement>) => {
      if (!reportDragMode) {
        event.preventDefault()
        return
      }
      setDraggedReport(id)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', id)
      const dragImage = event.currentTarget.cloneNode(true) as HTMLElement
      dragImage.style.position = 'absolute'
      dragImage.style.top = '-10000px'
      dragImage.style.left = '-10000px'
      dragImage.style.width = `${event.currentTarget.offsetWidth}px`
      dragImage.style.opacity = '1'
      dragImage.style.background = 'white'
      dragImage.style.boxShadow = '0 18px 45px rgba(15, 23, 42, 0.25)'
      document.body.appendChild(dragImage)
      event.dataTransfer.setDragImage(dragImage, 24, 24)
      window.setTimeout(() => dragImage.remove(), 0)
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (!reportDragMode) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDragOverReport(id)
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      if (!reportDragMode) return
      event.preventDefault()
      const fromId = event.dataTransfer.getData('text/plain') || draggedReport
      if (reportPanelIds.includes(fromId as ReportPanelId)) {
        moveReportPanel(fromId as ReportPanelId, id)
      }
      setDraggedReport(null)
      setDragOverReport(null)
    },
    onDragLeave: () => setDragOverReport((current) => (current === id ? null : current)),
    onDragEnd: () => {
      setDraggedReport(null)
      setDragOverReport(null)
    },
    style: { order: reportOrder.indexOf(id) },
  })

  const reportPanelClass = (id: ReportPanelId) => {
    const hiddenInBrowser = reportLayout === 'browser' && selectedReport !== id
    const activeTarget = reportDragMode && dragOverReport === id && draggedReport !== id
    const activeSource = reportDragMode && draggedReport === id
    return [
      hiddenInBrowser ? 'hidden' : '',
      'bg-white border rounded-xl transition-all',
      reportDragMode ? 'cursor-move select-none' : 'cursor-default',
      activeTarget
        ? 'border-amber-500 ring-4 ring-amber-200 shadow-lg'
        : activeSource
          ? 'border-slate-400 ring-2 ring-slate-300 shadow-lg'
          : 'border-slate-200 hover:shadow-sm',
    ].join(' ')
  }

  const shouldLoadReport = (id: ReportPanelId) => showGridPreviews || (reportLayout === 'browser' && selectedReport === id)
  const showUnpaidInvoices = shouldLoadReport('unpaid-invoices')
  const showInvoiceRegister = shouldLoadReport('invoice-register')
  const showPaymentRegister = shouldLoadReport('payment-register')
  const showCustomerCreditRegister = shouldLoadReport('customer-credit-register')
  const showFinancialAudit = shouldLoadReport('financial-audit')
  const showPostingAudit = shouldLoadReport('posting-audit')
  const showBankReconciliation = shouldLoadReport('bank-reconciliation')
  const showPurchaseOrderRegister = shouldLoadReport('purchase-order-register')
  const showExpenseRegister = shouldLoadReport('expense-register')
  const showVendorBillRegister = shouldLoadReport('vendor-bill-register')
  const showSubcontractorPayout = shouldLoadReport('subcontractor-payout')
  const showContractor1099 = shouldLoadReport('contractor-1099')
  const showJobProfitability = shouldLoadReport('job-profitability')
  const showInventoryMovement = shouldLoadReport('inventory-movement')
  const showInventorySpend = shouldLoadReport('inventory-spend')
  const showInventoryValuation = shouldLoadReport('inventory-valuation')
  const showArAging = shouldLoadReport('ar-aging')
  const showApAging = shouldLoadReport('ap-aging')
  const showRevenueBreakdown = shouldLoadReport('revenue-breakdown')
  const showTechPerformance = shouldLoadReport('tech-performance')
  const expenseRegisterStatusParam =
    reimbursementStatusFilter === 'all'
      ? ''
      : `&reimbursement_status=${encodeURIComponent(reimbursementStatusFilter)}`
  const invoiceRegisterPaymentStateParam =
    statusFilter === 'all'
      ? ''
      : `&payment_state=${encodeURIComponent(statusFilter)}`
  const invoiceRegisterDateParams = invoiceDateScope === 'all'
    ? 'all_time=1'
    : `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  const paymentRegisterPaymentStateParam =
    statusFilter === 'all'
      ? ''
      : `&payment_state=${encodeURIComponent(statusFilter)}`
  const bankReconciliationMatchStateParam =
    statusFilter === 'all'
      ? ''
      : `&match_state=${encodeURIComponent(statusFilter)}`
  const registerStatusStateParam =
    statusFilter === 'all'
      ? ''
      : `&status_state=${encodeURIComponent(statusFilter)}`
  const techPerformanceSearchParam = techFilter.trim()
    ? `&q=${encodeURIComponent(techFilter.trim())}`
    : ''
  const techPerformancePayTypeParam =
    techPerformancePayTypeFilter === 'all'
      ? ''
      : `&pay_type=${encodeURIComponent(techPerformancePayTypeFilter)}`

  const agingQ = useQuery({
    queryKey: ['reports', 'ar-aging', asOf],
    queryFn: () =>
      apiRequest<{ data: AgingReport }>(
        `/v1/reports/ar-aging?as_of=${encodeURIComponent(asOf)}`,
      ),
    enabled: shouldLoadReport('ar-aging'),
  })

  const apAgingQ = useQuery({
    queryKey: ['reports', 'ap-aging', asOf],
    queryFn: () =>
      apiRequest<{ data: ApAgingReport }>(
        `/v1/reports/ap-aging?as_of=${encodeURIComponent(asOf)}`,
      ),
    enabled: shouldLoadReport('ap-aging'),
  })

  const revenueQ = useQuery({
    queryKey: ['reports', 'revenue', from, to, groupBy],
    queryFn: () =>
      apiRequest<{ data: RevenueReport }>(
        `/v1/reports/revenue?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&group_by=${encodeURIComponent(groupBy)}`,
      ),
    enabled: shouldLoadReport('revenue-breakdown'),
  })

  const unpaidInvoicesQ = useQuery({
    queryKey: ['reports', 'unpaid-invoices'],
    queryFn: () =>
      apiRequest<{ data: InvoiceRegisterReport }>(
        '/v1/reports/invoice-register?all_time=1&payment_state=unpaid',
      ),
    enabled: shouldLoadReport('unpaid-invoices'),
  })

  const invoiceRegisterQ = useQuery({
    queryKey: ['reports', 'invoice-register', invoiceDateScope, from, to, statusFilter],
    queryFn: () =>
      apiRequest<{ data: InvoiceRegisterReport }>(
        `/v1/reports/invoice-register?${invoiceRegisterDateParams}${invoiceRegisterPaymentStateParam}`,
      ),
    enabled: shouldLoadReport('invoice-register'),
  })

  const paymentRegisterQ = useQuery({
    queryKey: ['reports', 'payment-register', from, to, statusFilter],
    queryFn: () =>
      apiRequest<{ data: PaymentRegisterReport }>(
        `/v1/reports/payment-register?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${paymentRegisterPaymentStateParam}`,
      ),
    enabled: shouldLoadReport('payment-register'),
  })

  const customerCreditRegisterQ = useQuery({
    queryKey: ['reports', 'customer-credit-register', from, to, statusFilter],
    queryFn: () =>
      apiRequest<{ data: CustomerCreditRegisterReport }>(
        `/v1/reports/customer-credit-register?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${registerStatusStateParam}`,
      ),
    enabled: shouldLoadReport('customer-credit-register'),
  })

  const financialAuditQ = useQuery({
    queryKey: ['reports', 'financial-audit', from, to],
    queryFn: () =>
      apiRequest<{ data: FinancialAuditReport }>(
        `/v1/reports/financial-audit?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    enabled: shouldLoadReport('financial-audit'),
  })

  const postingAuditQ = useQuery({
    queryKey: ['reports', 'posting-audit', from, to],
    queryFn: () =>
      apiRequest<{ data: PostingAuditReport }>(
        `/v1/accounting/posting-audit?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    enabled: shouldLoadReport('posting-audit'),
  })

  const bankReconciliationQ = useQuery({
    queryKey: ['reports', 'bank-reconciliation', from, to, statusFilter],
    queryFn: () =>
      apiRequest<{ data: BankReconciliationReport }>(
        `/v1/reports/bank-reconciliation?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${bankReconciliationMatchStateParam}`,
      ),
    enabled: shouldLoadReport('bank-reconciliation'),
  })

  const jobProfitabilityQ = useQuery({
    queryKey: ['reports', 'job-profitability', from, to],
    queryFn: () =>
      apiRequest<{ data: JobProfitabilityReport }>(
        `/v1/reports/job-profitability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    enabled: shouldLoadReport('job-profitability'),
  })

  const techPerformanceQ = useQuery({
    queryKey: ['reports', 'tech-performance', from, to, techFilter.trim(), techPerformancePayTypeFilter],
    queryFn: () =>
      apiRequest<{ data: TechPerformanceReport }>(
        `/v1/reports/tech-performance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${techPerformanceSearchParam}${techPerformancePayTypeParam}`,
      ),
    enabled: shouldLoadReport('tech-performance'),
  })

  const inventoryMovementQ = useQuery({
    queryKey: ['reports', 'inventory-movement', from, to],
    queryFn: () =>
      apiRequest<{ data: InventoryMovementReport }>(
        `/v1/reports/inventory-movement?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    enabled: shouldLoadReport('inventory-movement'),
  })

  const inventoryValuationQ = useQuery({
    queryKey: ['reports', 'inventory-valuation', asOf],
    queryFn: () =>
      apiRequest<{ data: InventoryValuationReport }>(
        `/v1/reports/inventory-valuation?as_of=${encodeURIComponent(asOf)}`,
      ),
    enabled: shouldLoadReport('inventory-valuation'),
  })

  const inventorySpendQ = useQuery({
    queryKey: ['reports', 'inventory-spend', from, to, statusFilter, inventorySpendGroupBy],
    queryFn: () =>
      apiRequest<{ data: InventorySpendReport }>(
        `/v1/reports/inventory-spend?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&group_by=${encodeURIComponent(inventorySpendGroupBy)}${registerStatusStateParam}`,
      ),
    enabled: shouldLoadReport('inventory-spend'),
  })

  const purchaseOrderRegisterQ = useQuery({
    queryKey: ['reports', 'purchase-order-register', from, to, statusFilter],
    queryFn: () =>
      apiRequest<{ data: PurchaseOrderRegisterReport }>(
        `/v1/reports/purchase-order-register?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${registerStatusStateParam}`,
      ),
    enabled: shouldLoadReport('purchase-order-register'),
  })

  const expenseRegisterQ = useQuery({
    queryKey: ['reports', 'expense-register', from, to, reimbursementStatusFilter],
    queryFn: () =>
      apiRequest<{ data: ExpenseRegisterReport }>(
        `/v1/reports/expense-register?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${expenseRegisterStatusParam}`,
      ),
    enabled: shouldLoadReport('expense-register'),
  })

  const vendorBillRegisterQ = useQuery({
    queryKey: ['reports', 'vendor-bill-register', from, to, statusFilter],
    queryFn: () =>
      apiRequest<{ data: VendorBillRegisterReport }>(
        `/v1/reports/vendor-bill-register?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${registerStatusStateParam}`,
      ),
    enabled: shouldLoadReport('vendor-bill-register'),
  })

  const subcontractorPayoutQ = useQuery({
    queryKey: ['reports', 'subcontractor-payout-register', from, to, statusFilter],
    queryFn: () =>
      apiRequest<{ data: SubcontractorPayoutReport }>(
        `/v1/reports/subcontractor-payout-register?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${registerStatusStateParam}`,
      ),
    enabled: shouldLoadReport('subcontractor-payout'),
  })

  const contractor1099Year = new Date(`${asOf}T00:00:00`).getFullYear()
  const contractor1099ReviewParam =
    contractor1099ReviewFilter === 'all'
      ? ''
      : `&review_state=${encodeURIComponent(contractor1099ReviewFilter)}`
  const contractor1099Q = useQuery({
    queryKey: ['reports', 'contractor-1099-summary', contractor1099Year, contractor1099ReviewFilter],
    queryFn: () =>
      apiRequest<{ data: Contractor1099SummaryReport }>(
        `/v1/reports/contractor-1099-summary?year=${encodeURIComponent(String(contractor1099Year))}${contractor1099ReviewParam}`,
      ),
    enabled: shouldLoadReport('contractor-1099'),
  })

  const aging = agingQ.data?.data
  const apAging = apAgingQ.data?.data
  const revenue = revenueQ.data?.data
  const unpaidInvoices = unpaidInvoicesQ.data?.data
  const invoiceRegister = invoiceRegisterQ.data?.data
  const paymentRegister = paymentRegisterQ.data?.data
  const customerCreditRegister = customerCreditRegisterQ.data?.data
  const financialAudit = financialAuditQ.data?.data
  const postingAudit = postingAuditQ.data?.data
  const bankReconciliation = bankReconciliationQ.data?.data
  const jobProfitability = jobProfitabilityQ.data?.data
  const techPerformance = techPerformanceQ.data?.data
  const inventoryMovement = inventoryMovementQ.data?.data
  const inventorySpend = inventorySpendQ.data?.data
  const inventoryValuation = inventoryValuationQ.data?.data
  const purchaseOrderRegister = purchaseOrderRegisterQ.data?.data
  const expenseRegister = expenseRegisterQ.data?.data
  const vendorBillRegister = vendorBillRegisterQ.data?.data
  const subcontractorPayout = subcontractorPayoutQ.data?.data
  const contractor1099 = contractor1099Q.data?.data
  const expenseReimbursementByTech = useMemo(() => {
    const groups = new Map<
      string,
      {
        label: string
        pending_cents: number
        approved_cents: number
        reimbursed_cents: number
        total_cents: number
        count: number
      }
    >()

    ;(expenseRegister?.rows ?? [])
      .filter((row) => row.reimbursable)
      .forEach((row) => {
        const label = row.employee_name || row.employee_email || 'Unassigned'
        const existing =
          groups.get(label) ??
          {
            label,
            pending_cents: 0,
            approved_cents: 0,
            reimbursed_cents: 0,
            total_cents: 0,
            count: 0,
          }

        existing.count += 1
        existing.total_cents += row.total_cents

        if (row.reimbursement_status === 'pending') {
          existing.pending_cents += row.total_cents
        } else if (row.reimbursement_status === 'approved') {
          existing.approved_cents += row.total_cents
        } else if (row.reimbursement_status === 'reimbursed') {
          existing.reimbursed_cents += row.total_cents
        }

        groups.set(label, existing)
      })

    return Array.from(groups.values()).sort((a, b) => b.total_cents - a.total_cents)
  }, [expenseRegister?.rows])
  const revenueGroupLabel = revenueGroups.find((g) => g.value === groupBy)?.label ?? 'Revenue'
  const agingBase = `/v1/reports/ar-aging?as_of=${encodeURIComponent(asOf)}`
  const apAgingBase = `/v1/reports/ap-aging?as_of=${encodeURIComponent(asOf)}`
  const revenueBase = `/v1/reports/revenue?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&group_by=${encodeURIComponent(groupBy)}`
  const unpaidInvoicesBase = '/v1/reports/invoice-register?all_time=1&payment_state=unpaid'
  const invoiceRegisterBase = `/v1/reports/invoice-register?${invoiceRegisterDateParams}${invoiceRegisterPaymentStateParam}`
  const paymentRegisterBase = `/v1/reports/payment-register?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${paymentRegisterPaymentStateParam}`
  const customerCreditRegisterBase = `/v1/reports/customer-credit-register?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${registerStatusStateParam}`
  const financialAuditBase = `/v1/reports/financial-audit?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  const postingAuditBase = `/v1/accounting/posting-audit?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  const bankReconciliationBase = `/v1/reports/bank-reconciliation?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${bankReconciliationMatchStateParam}`
  const jobProfitabilityBase = `/v1/reports/job-profitability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  const techPerformanceBase = `/v1/reports/tech-performance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${techPerformanceSearchParam}${techPerformancePayTypeParam}`
  const inventoryMovementBase = `/v1/reports/inventory-movement?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  const inventorySpendBase = `/v1/reports/inventory-spend?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&group_by=${encodeURIComponent(inventorySpendGroupBy)}${registerStatusStateParam}`
  const inventoryValuationBase = `/v1/reports/inventory-valuation?as_of=${encodeURIComponent(asOf)}`
  const purchaseOrderRegisterBase = `/v1/reports/purchase-order-register?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${registerStatusStateParam}`
  const expenseRegisterBase = `/v1/reports/expense-register?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${expenseRegisterStatusParam}`
  const vendorBillRegisterBase = `/v1/reports/vendor-bill-register?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${registerStatusStateParam}`
  const subcontractorPayoutBase = `/v1/reports/subcontractor-payout-register?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${registerStatusStateParam}`
  const contractor1099Base = `/v1/reports/contractor-1099-summary?year=${encodeURIComponent(String(contractor1099Year))}${contractor1099ReviewParam}`

  const filterReportRows = <T,>(rows: T[]): T[] => {
    const search = reportSearch.trim().toLowerCase()
    const customer = customerFilter.trim().toLowerCase()
    const tech = techFilter.trim().toLowerCase()

    return rows.filter((row) => {
      const text = searchableReportText(row)
      if (search && !text.includes(search)) return false
      if (customer && !rowStringValue(row, 'customer_name').toLowerCase().includes(customer)) return false
      if (tech) {
        const techText = [
          rowStringValue(row, 'tech_name'),
          rowStringValue(row, 'lead_tech'),
          rowStringValue(row, 'collected_by_email'),
          rowStringValue(row, 'received_by_email'),
          rowStringValue(row, 'employee_name'),
          rowStringValue(row, 'employee_email'),
        ].join(' ').toLowerCase()
        if (!techText.includes(tech)) return false
      }
      if (!reportRowMatchesStatus(row, statusFilter)) return false
      return true
    })
  }

  const filteredUnpaidInvoiceRows = filterReportRows(unpaidInvoices?.rows ?? [])

  const pageReportRows = <T,>(rows: T[]): T[] => {
    if (pageSize === 'all') return rows
    const start = (currentPage - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }

  const selectedReportRows = (() => {
    switch (selectedReport) {
      case 'unpaid-invoices': return filteredUnpaidInvoiceRows
      case 'invoice-register': return filterReportRows(invoiceRegister?.rows ?? [])
      case 'payment-register': return filterReportRows(paymentRegister?.rows ?? [])
      case 'customer-credit-register': return filterReportRows(customerCreditRegister?.rows ?? [])
      case 'financial-audit': return filterReportRows(financialAudit?.rows ?? [])
      case 'posting-audit': return filterReportRows(postingAudit?.rows ?? [])
      case 'bank-reconciliation': return filterReportRows(bankReconciliation?.rows ?? [])
      case 'purchase-order-register': return filterReportRows(purchaseOrderRegister?.rows ?? [])
      case 'expense-register': return filterReportRows(expenseRegister?.rows ?? [])
      case 'vendor-bill-register': return filterReportRows(vendorBillRegister?.rows ?? [])
      case 'subcontractor-payout': return filterReportRows(subcontractorPayout?.rows ?? [])
      case 'contractor-1099': return filterReportRows(contractor1099?.rows ?? [])
      case 'job-profitability': return filterReportRows(jobProfitability?.rows ?? [])
      case 'inventory-movement': return filterReportRows(inventoryMovement?.rows ?? [])
      case 'inventory-spend': return filterReportRows(inventorySpend?.rows ?? [])
      case 'inventory-valuation': return filterReportRows(inventoryValuation?.rows ?? [])
      case 'ar-aging': return filterReportRows(aging?.rows ?? [])
      case 'ap-aging': return filterReportRows(apAging?.rows ?? [])
      case 'revenue-breakdown': return filterReportRows(revenue?.rows ?? [])
      case 'tech-performance': return filterReportRows(techPerformance?.rows ?? [])
    }
  })()
  const selectedReportMeta = reportPanelMeta[selectedReport]

  const selectedTotalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(selectedReportRows.length / pageSize))
  const currentPage = Math.min(reportPage, selectedTotalPages)
  const paginationLabel =
    pageSize === 'all'
      ? `Showing all ${selectedReportRows.length}`
      : `Showing ${selectedReportRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, selectedReportRows.length)} of ${selectedReportRows.length}`
  const activeFilterLabels = [
    reportSearch.trim() ? `Search: ${reportSearch.trim()}` : null,
    statusFilter !== 'all' ? `Status: ${reportFilterLabel(statusFilter)}` : null,
    customerFilter.trim() ? `Customer: ${customerFilter.trim()}` : null,
    techFilter.trim() ? `Tech/staff: ${techFilter.trim()}` : null,
    selectedReport === 'expense-register' && reimbursementStatusFilter !== 'all'
      ? `Reimbursement: ${reportFilterLabel(reimbursementStatusFilter)}`
      : null,
    selectedReport === 'tech-performance' && techPerformancePayTypeFilter !== 'all'
      ? `Pay type: ${reportFilterLabel(techPerformancePayTypeFilter)}`
      : null,
    selectedReport === 'contractor-1099' && contractor1099ReviewFilter !== 'all'
      ? `1099: ${reportFilterLabel(contractor1099ReviewFilter)}`
      : null,
    selectedReport === 'revenue-breakdown' && groupBy !== 'month'
      ? `Group: ${reportFilterLabel(groupBy)}`
      : null,
    selectedReport === 'inventory-spend' && inventorySpendGroupBy !== 'item'
      ? `Group: ${reportFilterLabel(inventorySpendGroupBy)}`
      : null,
    pageSize !== 50 ? `Rows: ${pageSize === 'all' ? 'All' : pageSize}` : null,
  ].filter((label): label is string => Boolean(label))
  const downloadFilteredSpreadsheet = () => {
    const rows = selectedReportRows as Array<Record<string, unknown>>
    if (rows.length === 0) {
      setReportDownloadError('No filtered rows to download.')
      return
    }

    setReportDownloadError(null)
    const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
    const csv = [
      headers.map(csvCell).join(','),
      ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateMode = reportPanelMeta[selectedReport].dateMode
    const dateSuffix = dateMode === 'asOf' ? asOf : dateMode === 'all' ? 'all-time' : `${from}-${to}`
    link.href = url
    link.download = `${reportFileSlug(reportPanelMeta[selectedReport].title)}-filtered-${dateSuffix}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div data-tour="reports-root" className="mx-auto w-full max-w-none space-y-6 px-4 py-4 sm:px-6 sm:py-6 2xl:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            to="/accounting/reports"
            className="text-xs font-semibold text-amber-700 hover:text-amber-800"
          >
            &larr; All questions
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Download PDF and spreadsheet reports. Visual graphs stay in Accounting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGridPreference(!showGridPreviews)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {showGridPreviews ? 'Hide grid previews' : 'Show grid previews'}
          </button>
          <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" to="/accounting">
            Accounting
          </Link>
          <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" to="/accounting/sales-tax">
            Sales tax
          </Link>
          <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" to="/tool-shed/cost-model">
            Cost model
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Reports are for pulling files you can send, save, or give to a bookkeeper.
        Use <Link to="/accounting" className="font-semibold underline">Accounting</Link> for visual graphs, cash drawer, receivables charts, and payment method charts.
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Saved report views</h2>
            <p className="text-sm text-slate-500">
              Save the report, dates, filters, row count, and layout you use often.
            </p>
          </div>
          <button
            type="button"
            onClick={saveCurrentReportPreset}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Save current view
          </button>
        </div>
        {savedReportPresets.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {savedReportPresets.map((preset) => (
              <div key={preset.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{preset.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{reportPanelMeta[preset.report].title}</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                    {reportPanelMeta[preset.report].dateMode === 'asOf' ? 'As of' : 'Range'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {reportPanelMeta[preset.report].dateMode === 'asOf'
                    ? `As of ${preset.asOf || defaults.asOf}`
                    : reportPanelMeta[preset.report].dateMode === 'all'
                      ? 'All time'
                      : `${preset.from || defaults.from} to ${preset.to || defaults.to}`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openSavedReportPreset(preset)}
                    className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSavedReportPreset(preset.id)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500">
            No saved report views yet.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Report controls</h2>
            <p className="text-sm text-slate-500">
              Choose dates, filters, row count, and layout for the selected report.
            </p>
            {downloadingReport ? (
              <p className="mt-2 text-sm font-semibold text-amber-800">
                Downloading {downloadingReport}...
              </p>
            ) : null}
            {reportDownloadError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {reportDownloadError}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-slate-500">
              From
              <input
                type="date"
                value={from}
                disabled={(selectedReport === 'invoice-register' && invoiceDateScope === 'all') || selectedReport === 'unpaid-invoices'}
                onChange={(e) => {
                  setFrom(e.target.value)
                  resetReportPage()
                }}
                className="ml-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>
            <label className="text-xs font-medium text-slate-500">
              To
              <input
                type="date"
                value={to}
                disabled={(selectedReport === 'invoice-register' && invoiceDateScope === 'all') || selectedReport === 'unpaid-invoices'}
                onChange={(e) => {
                  setTo(e.target.value)
                  resetReportPage()
                }}
                className="ml-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>
            <button
              type="button"
              onClick={() => setReportDragPreference(!reportDragMode)}
              className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                reportDragMode
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {reportDragMode ? 'Move mode on' : 'Move mode off'}
            </button>
            {reportLayoutOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setReportLayoutPreference(option.value)}
                title={option.description}
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  reportLayout === option.value
                    ? 'border-amber-500 bg-amber-50 text-amber-900'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={resetReportLayout}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
          <label className="lg:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Search</span>
            <input
              type="search"
              value={reportSearch}
              onChange={(e) => {
                setReportSearch(e.target.value)
                resetReportPage()
              }}
              placeholder="Invoice, PO, customer, tech, item..."
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </label>
          {selectedReport === 'invoice-register' && (
            <label>
              <span className="text-xs font-semibold text-slate-600">Invoice dates</span>
              <select
                value={invoiceDateScope}
                onChange={(e) => {
                  setInvoiceDateScope(e.target.value as InvoiceDateScope)
                  resetReportPage()
                }}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">All time</option>
                <option value="range">Date range</option>
              </select>
            </label>
          )}
          {selectedReport !== 'unpaid-invoices' && (
            <label>
              <span className="text-xs font-semibold text-slate-600">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as ReportStatusFilter)
                  resetReportPage()
                }}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="paid">Paid / matched</option>
                <option value="unpaid">Unpaid</option>
                <option value="open">Open</option>
                <option value="not_closed">Not closed</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          )}
          <label>
            <span className="text-xs font-semibold text-slate-600">Customer</span>
            <input
              type="search"
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value)
                resetReportPage()
              }}
              placeholder="Customer name"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-slate-600">Tech / staff</span>
            <input
              type="search"
              value={techFilter}
              onChange={(e) => {
                setTechFilter(e.target.value)
                resetReportPage()
              }}
              placeholder="Tech or email"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-slate-600">Rows per page</span>
            <select
              value={String(pageSize)}
              onChange={(e) => {
                const value = e.target.value
                setPageSize(value === 'all' ? 'all' : (Number(value) as ReportPageSize))
                resetReportPage()
              }}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="10">10 rows</option>
              <option value="50">50 rows</option>
              <option value="100">100 rows</option>
              <option value="all">All rows</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {paginationLabel}
              {pageSize !== 'all' ? ` · Page ${currentPage} of ${selectedTotalPages}` : ''}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeFilterLabels.length ? (
                activeFilterLabels.map((label) => (
                  <span key={label} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {label}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
                  No extra filters
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setReportSearch('')
                setCustomerFilter('')
                setTechFilter('')
                setStatusFilter('all')
                setInvoiceDateScope('all')
                setReimbursementStatusFilter('all')
                setTechPerformancePayTypeFilter('all')
                setContractor1099ReviewFilter('all')
                setGroupBy('month')
                setInventorySpendGroupBy('item')
                setPageSize(50)
                resetReportPage()
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear filters
            </button>
            <button
              type="button"
              onClick={downloadFilteredSpreadsheet}
              disabled={selectedReportRows.length === 0}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              title={`Download all ${selectedReportRows.length} filtered ${selectedReportMeta.title.toLowerCase()} rows as a spreadsheet`}
            >
              Filtered spreadsheet
            </button>
            <button
              type="button"
              onClick={() => setReportPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setReportPage((page) => Math.min(selectedTotalPages, page + 1))}
              disabled={currentPage >= selectedTotalPages || pageSize === 'all'}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Report guide</div>
            <h2 className="mt-1 text-base font-semibold text-slate-900">{selectedReportMeta.title}</h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">{selectedReportMeta.help}</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-600">
            {selectedReportMeta.dateMode === 'asOf' ? 'As-of report' : 'Date range report'}
          </div>
        </div>
      </section>

      <section className={reportGridClass(reportLayout)}>
        {reportLayout === 'browser' && (
          <aside className="rounded-xl border border-slate-200 bg-white p-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Reports</h2>
              <p className="text-xs text-slate-500">Choose one report, then filter, review, and export it.</p>
            </div>
            <div className="space-y-2">
              {reportOrder.map((id) => {
                const meta = reportPanelMeta[id]
                const selected = selectedReport === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      openReport(id)
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selected
                        ? 'border-amber-500 bg-amber-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{meta.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        meta.dateMode === 'asOf' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {meta.dateMode === 'asOf' ? 'As of' : meta.dateMode === 'all' ? 'All time' : 'Range'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{meta.description}</p>
                  </button>
                )
              })}
            </div>
          </aside>
        )}

        <div {...reportDragProps('unpaid-invoices')} className={reportPanelClass('unpaid-invoices')}>
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Unpaid invoices</h2>
              <p className="text-xs text-slate-500">Every invoice with an outstanding balance across all time.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${unpaidInvoicesBase}&format=pdf`, 'unpaid-invoices-all-time.pdf')}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${unpaidInvoicesBase}&format=csv`, 'unpaid-invoices-all-time.csv')}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric label="Unpaid invoices" value={previewValue(showUnpaidInvoices, unpaidInvoicesQ.isLoading, String(unpaidInvoices?.totals.invoice_count ?? 0))} />
              <Metric label="Billed" value={previewValue(showUnpaidInvoices, unpaidInvoicesQ.isLoading, exactMoney(unpaidInvoices?.totals.total_cents ?? 0))} />
              <Metric label="Outstanding" value={previewValue(showUnpaidInvoices, unpaidInvoicesQ.isLoading, exactMoney(unpaidInvoices?.totals.balance_cents ?? 0))} tone="amber" />
            </div>
            {showUnpaidInvoices ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="py-2 pr-3 text-left">Invoice</th>
                      <th className="py-2 pr-3 text-left">Customer</th>
                      <th className="py-2 pr-3 text-left">Due</th>
                      <th className="py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filteredUnpaidInvoiceRows).map((row) => (
                      <tr key={row.invoice_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3">
                          <Link to={`/invoices/${row.invoice_id}`} className="font-medium text-amber-700 hover:underline">
                            {row.invoice_number}
                          </Link>
                          <div className="text-xs text-slate-500">Issued {row.issued_at ?? '-'}</div>
                        </td>
                        <td className="py-2 pr-3">{row.customer_name ?? 'Customer'}</td>
                        <td className="py-2 pr-3">{row.due_at ?? '-'}</td>
                        <td className="py-2 text-right font-mono font-semibold">{exactMoney(row.balance_cents)}</td>
                      </tr>
                    ))}
                    {!unpaidInvoicesQ.isLoading && filteredUnpaidInvoiceRows.length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={4}>No unpaid invoices found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>
        <div {...reportDragProps('invoice-register')} className={reportPanelClass('invoice-register')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Invoice register</h2>
              <p className="text-xs text-slate-500">{invoiceDateScope === 'all' ? 'All invoices across the tenant history.' : 'All invoices in the selected date range.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${invoiceRegisterBase}&format=pdf`, `invoice-register-${invoiceDateScope === 'all' ? 'all-time' : `${from}-${to}`}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${invoiceRegisterBase}&format=csv`, `invoice-register-${invoiceDateScope === 'all' ? 'all-time' : `${from}-${to}`}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Invoices" value={previewValue(showInvoiceRegister, invoiceRegisterQ.isLoading, String(invoiceRegister?.totals.invoice_count ?? 0))} />
              <Metric label="Billed" value={previewValue(showInvoiceRegister, invoiceRegisterQ.isLoading, exactMoney(invoiceRegister?.totals.total_cents ?? 0))} />
              <Metric label="Balance" value={previewValue(showInvoiceRegister, invoiceRegisterQ.isLoading, exactMoney(invoiceRegister?.totals.balance_cents ?? 0))} tone="amber" />
            </div>
            {showInvoiceRegister ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">Invoice</th>
                      <th className="text-left py-2 pr-3">Customer</th>
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-right py-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(invoiceRegister?.rows ?? [])).map((row) => (
                      <tr key={row.invoice_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3">
                          <Link to={`/invoices/${row.invoice_id}`} className="font-medium text-amber-700 hover:underline">
                            {row.invoice_number}
                          </Link>
                          <div className="text-xs text-slate-500">Issued {row.issued_at ?? '-'}</div>
                        </td>
                        <td className="py-2 pr-3">{row.customer_name ?? 'Customer'}</td>
                        <td className="py-2 pr-3 capitalize">{row.status}</td>
                        <td className="py-2 text-right font-mono font-semibold">{exactMoney(row.balance_cents)}</td>
                      </tr>
                    ))}
                    {!invoiceRegisterQ.isLoading && filterReportRows(invoiceRegister?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={4}>No invoices in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>

        <div {...reportDragProps('payment-register')} className={reportPanelClass('payment-register')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Payment register</h2>
              <p className="text-xs text-slate-500">Cash, card, check, credit, and void audit rows.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${paymentRegisterBase}&format=pdf`, `payment-register-${from}-${to}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${paymentRegisterBase}&format=csv`, `payment-register-${from}-${to}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Metric label="Payments" value={previewValue(showPaymentRegister, paymentRegisterQ.isLoading, String(paymentRegister?.totals.payment_count ?? 0))} />
              <Metric label="Gross" value={previewValue(showPaymentRegister, paymentRegisterQ.isLoading, exactMoney(paymentRegister?.totals.amount_cents ?? 0))} tone="emerald" />
              <Metric label="Fees" value={previewValue(showPaymentRegister, paymentRegisterQ.isLoading, exactMoney(paymentRegister?.totals.processing_fee_cents ?? 0))} tone="amber" />
              <Metric label="Net" value={previewValue(showPaymentRegister, paymentRegisterQ.isLoading, exactMoney(paymentRegister?.totals.net_deposit_cents ?? 0))} />
              <Metric label="Allocated" value={previewValue(showPaymentRegister, paymentRegisterQ.isLoading, exactMoney(paymentRegister?.totals.allocated_cents ?? 0))} />
            </div>
            {showPaymentRegister ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">Customer</th>
                      <th className="text-left py-2 pr-3">Method</th>
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-right py-2 pr-3">Gross</th>
                      <th className="text-right py-2 pr-3">Fees</th>
                      <th className="text-right py-2">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(paymentRegister?.rows ?? [])).map((row) => (
                      <tr key={row.payment_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.customer_name ?? 'Customer'}</div>
                          <div className="text-xs text-slate-500">{row.received_at ?? 'Not received'}</div>
                        </td>
                        <td className="py-2 pr-3">{row.payment_method}</td>
                        <td className="py-2 pr-3 capitalize">{row.status.replace(/_/g, ' ')}</td>
                        <td className="py-2 pr-3 text-right font-mono font-semibold">{exactMoney(row.amount_cents)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-amber-700">{exactMoney(row.processing_fee_cents)}</td>
                        <td className="py-2 text-right font-mono font-semibold">{exactMoney(row.net_deposit_cents)}</td>
                      </tr>
                    ))}
                    {!paymentRegisterQ.isLoading && filterReportRows(paymentRegister?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={6}>No payments in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>

        <div {...reportDragProps('customer-credit-register')} className={reportPanelClass('customer-credit-register')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Customer credit register</h2>
              <p className="text-xs text-slate-500">Overpayments, down payments, refunds, and unapplied balances.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${customerCreditRegisterBase}&format=pdf`, `customer-credit-register-${from}-${to}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${customerCreditRegisterBase}&format=csv`, `customer-credit-register-${from}-${to}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Metric label="Credits" value={previewValue(showCustomerCreditRegister, customerCreditRegisterQ.isLoading, String(customerCreditRegister?.totals.credit_count ?? 0))} />
              <Metric label="Original" value={previewValue(showCustomerCreditRegister, customerCreditRegisterQ.isLoading, exactMoney(customerCreditRegister?.totals.amount_cents ?? 0))} tone="emerald" />
              <Metric label="Applied" value={previewValue(showCustomerCreditRegister, customerCreditRegisterQ.isLoading, exactMoney(customerCreditRegister?.totals.applied_cents ?? 0))} />
              <Metric label="Refunded" value={previewValue(showCustomerCreditRegister, customerCreditRegisterQ.isLoading, exactMoney(customerCreditRegister?.totals.refunded_cents ?? 0))} tone="amber" />
              <Metric label="Balance" value={previewValue(showCustomerCreditRegister, customerCreditRegisterQ.isLoading, exactMoney(customerCreditRegister?.totals.balance_cents ?? 0))} tone="amber" />
            </div>
            {showCustomerCreditRegister ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">Customer</th>
                      <th className="text-left py-2 pr-3">Source</th>
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-right py-2 pr-3">Original</th>
                      <th className="text-right py-2 pr-3">Used</th>
                      <th className="text-right py-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(customerCreditRegister?.rows ?? [])).map((row) => (
                      <tr key={row.customer_credit_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.customer_name ?? 'Customer'}</div>
                          <div className="text-xs text-slate-500">{row.work_order_number ?? row.created_at ?? '-'}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="capitalize">{row.source_type.replace(/_/g, ' ')}</div>
                          <div className="text-xs text-slate-500">{row.payment_method ?? row.payment_reference ?? ''}</div>
                        </td>
                        <td className="py-2 pr-3 capitalize">{row.status}</td>
                        <td className="py-2 pr-3 text-right font-mono font-semibold">{exactMoney(row.amount_cents)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-slate-600">
                          {exactMoney(row.applied_cents + row.refunded_cents)}
                        </td>
                        <td className="py-2 text-right font-mono font-semibold">{exactMoney(row.balance_cents)}</td>
                      </tr>
                    ))}
                    {!customerCreditRegisterQ.isLoading && filterReportRows(customerCreditRegister?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={6}>No customer credits in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>

        <div {...reportDragProps('financial-audit')} className={reportPanelClass('financial-audit')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Financial audit</h2>
              <p className="text-xs text-slate-500">Voids, write-offs, refunds, cancelled invoices, and journal reversals.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${financialAuditBase}&format=pdf`, `financial-audit-${from}-${to}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${financialAuditBase}&format=csv`, `financial-audit-${from}-${to}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Metric label="Events" value={previewValue(showFinancialAudit, financialAuditQ.isLoading, String(financialAudit?.totals.event_count ?? 0))} />
              <Metric label="Impacted" value={previewValue(showFinancialAudit, financialAuditQ.isLoading, exactMoney(financialAudit?.totals.impacted_cents ?? 0))} tone="amber" />
              <Metric label="Types" value={previewValue(showFinancialAudit, financialAuditQ.isLoading, String(financialAudit?.by_type.length ?? 0))} />
            </div>
            {showFinancialAudit ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">Date</th>
                      <th className="text-left py-2 pr-3">Event</th>
                      <th className="text-left py-2 pr-3">Reference</th>
                      <th className="text-left py-2 pr-3">Name</th>
                      <th className="text-right py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(financialAudit?.rows ?? [])).map((row) => (
                      <tr key={row.event_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{row.occurred_at ?? '-'}</td>
                        <td className="py-2 pr-3 capitalize">
                          <div className="font-medium text-slate-900">{row.event_type.replace(/_/g, ' ')}</div>
                          <div className="text-xs text-slate-500">{row.actor_email ?? 'System'}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.reference ?? row.source_id}</div>
                          <div className="text-xs text-slate-500">{row.source_type.replace(/_/g, ' ')}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <div>{row.customer_name ?? '-'}</div>
                          <div className="text-xs text-slate-500">{row.work_order_number ?? row.reason ?? ''}</div>
                        </td>
                        <td className="py-2 text-right font-mono font-semibold">{exactMoney(row.amount_cents)}</td>
                      </tr>
                    ))}
                    {!financialAuditQ.isLoading && filterReportRows(financialAudit?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={5}>No financial audit events in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>

        <div {...reportDragProps('posting-audit')} className={reportPanelClass('posting-audit')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Posting audit</h2>
              <p className="text-xs text-slate-500">Records that still need ledger posting before books are closed.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${postingAuditBase}&format=pdf`, `posting-audit-${from}-${to}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${postingAuditBase}&format=csv`, `posting-audit-${from}-${to}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Metric label="Unposted" value={previewValue(showPostingAudit, postingAuditQ.isLoading, String(postingAudit?.total_count ?? 0))} />
              <Metric label="Amount" value={previewValue(showPostingAudit, postingAuditQ.isLoading, exactMoney(postingAudit?.total_amount_cents ?? 0))} tone="amber" />
              <Metric label="Limited" value={previewValue(showPostingAudit, postingAuditQ.isLoading, postingAudit?.truncated ? 'Yes' : 'No')} />
            </div>
            {showPostingAudit ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">Date</th>
                      <th className="text-left py-2 pr-3">Record</th>
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-left py-2 pr-3">Reason</th>
                      <th className="text-right py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(postingAudit?.rows ?? [])).map((row) => (
                      <tr key={`${row.record_type}-${row.id}`} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{row.record_date ?? '-'}</td>
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.reference ?? row.id}</div>
                          <div className="text-xs capitalize text-slate-500">{row.record_type.replace(/_/g, ' ')}</div>
                        </td>
                        <td className="py-2 pr-3 capitalize">{(row.status ?? '-').replace(/_/g, ' ')}</td>
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.reason.replace(/_/g, ' ')}</div>
                          <div className="text-xs text-slate-500">{row.source_type.replace(/_/g, ' ')} {row.source_id}</div>
                        </td>
                        <td className="py-2 text-right font-mono font-semibold">{exactMoney(row.amount_cents)}</td>
                      </tr>
                    ))}
                    {!postingAuditQ.isLoading && filterReportRows(postingAudit?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={5}>No unposted accounting records in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>

        <div {...reportDragProps('bank-reconciliation')} className={reportPanelClass('bank-reconciliation')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Bank reconciliation</h2>
              <p className="text-xs text-slate-500">Imported bank rows matched to payments, expenses, purchase orders, and ignored items.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${bankReconciliationBase}&format=pdf`, `bank-reconciliation-${from}-${to}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${bankReconciliationBase}&format=csv`, `bank-reconciliation-${from}-${to}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Bank rows" value={previewValue(showBankReconciliation, bankReconciliationQ.isLoading, String(bankReconciliation?.totals.transaction_count ?? 0))} />
              <Metric label="Matched" value={previewValue(showBankReconciliation, bankReconciliationQ.isLoading, String(bankReconciliation?.totals.matched_count ?? 0))} tone="emerald" />
              <Metric label="Unmatched" value={previewValue(showBankReconciliation, bankReconciliationQ.isLoading, String(bankReconciliation?.totals.unmatched_count ?? 0))} tone="amber" />
              <Metric label="Net" value={previewValue(showBankReconciliation, bankReconciliationQ.isLoading, exactMoney(bankReconciliation?.totals.net_cents ?? 0))} />
            </div>
            {showBankReconciliation ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">Date</th>
                      <th className="text-left py-2 pr-3">Description</th>
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-left py-2 pr-3">Matched to</th>
                      <th className="text-right py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(bankReconciliation?.rows ?? [])).map((row) => (
                      <tr key={row.bank_transaction_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{row.transaction_date ?? '-'}</td>
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.description}</div>
                          <div className="text-xs text-slate-500">{row.bank_account_name ?? row.source}</div>
                        </td>
                        <td className="py-2 pr-3 capitalize">{row.match_status.replace(/_/g, ' ')}</td>
                        <td className="py-2 pr-3">
                          {row.matched_type && row.matched_id ? `${row.matched_type.replace(/_/g, ' ')} ${row.matched_id}` : '-'}
                        </td>
                        <td className={`py-2 text-right font-mono font-semibold ${row.amount_cents >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {exactMoney(row.amount_cents)}
                        </td>
                      </tr>
                    ))}
                    {!bankReconciliationQ.isLoading && filterReportRows(bankReconciliation?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={5}>No bank rows in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>

        <div {...reportDragProps('purchase-order-register')} className={reportPanelClass('purchase-order-register')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Purchase order register</h2>
              <p className="text-xs text-slate-500">Vendor orders, receiving status, item counts, and order totals.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${purchaseOrderRegisterBase}&format=pdf`, `purchase-order-register-${from}-${to}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${purchaseOrderRegisterBase}&format=csv`, `purchase-order-register-${from}-${to}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="POs" value={previewValue(showPurchaseOrderRegister, purchaseOrderRegisterQ.isLoading, String(purchaseOrderRegister?.totals.purchase_order_count ?? 0))} />
              <Metric label="Ordered" value={previewValue(showPurchaseOrderRegister, purchaseOrderRegisterQ.isLoading, exactMoney(purchaseOrderRegister?.totals.total_cents ?? 0))} />
              <Metric label="Shipping" value={previewValue(showPurchaseOrderRegister, purchaseOrderRegisterQ.isLoading, exactMoney(purchaseOrderRegister?.totals.shipping_cents ?? 0))} />
            </div>
            {showPurchaseOrderRegister ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">PO</th>
                      <th className="text-left py-2 pr-3">Vendor</th>
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-right py-2 pr-3">Items</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(purchaseOrderRegister?.rows ?? [])).map((row) => (
                      <tr key={row.purchase_order_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3">
                          <Link to={`/inventory/purchase-orders/${row.purchase_order_id}`} className="font-medium text-amber-700 hover:underline">
                            {row.po_number}
                          </Link>
                          <div className="text-xs text-slate-500">Expected {row.expected_delivery ?? '-'}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.vendor_name ?? 'Vendor'}</div>
                          {row.vendor_order_number && <div className="text-xs text-slate-500">Vendor order {row.vendor_order_number}</div>}
                        </td>
                        <td className="py-2 pr-3 capitalize">{row.status.replace(/_/g, ' ')}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.item_count}</td>
                        <td className="py-2 text-right font-mono font-semibold">{exactMoney(row.total_cents)}</td>
                      </tr>
                    ))}
                    {!purchaseOrderRegisterQ.isLoading && filterReportRows(purchaseOrderRegister?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={5}>No purchase orders in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>

        <div {...reportDragProps('inventory-spend')} className={reportPanelClass('inventory-spend')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Inventory spend</h2>
              <p className="text-xs text-slate-500">Purchase-order spend grouped by vendor, item, category, or PO number.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={inventorySpendGroupBy}
                onChange={(event) => {
                  setInventorySpendGroupBy(event.target.value as 'item' | 'vendor' | 'category' | 'po')
                  setReportPage(1)
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="item">By item</option>
                <option value="vendor">By vendor</option>
                <option value="category">By category</option>
                <option value="po">By PO</option>
              </select>
              <button
                type="button"
                onClick={() => downloadReport(`${inventorySpendBase}&format=pdf`, `inventory-spend-${inventorySpendGroupBy}-${from}-${to}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${inventorySpendBase}&format=csv`, `inventory-spend-${inventorySpendGroupBy}-${from}-${to}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="POs" value={previewValue(showInventorySpend, inventorySpendQ.isLoading, String(inventorySpend?.totals.po_count ?? 0))} />
              <Metric label="Lines" value={previewValue(showInventorySpend, inventorySpendQ.isLoading, String(inventorySpend?.totals.line_count ?? 0))} />
              <Metric label="Received" value={previewValue(showInventorySpend, inventorySpendQ.isLoading, String(inventorySpend?.totals.qty_received ?? 0))} />
              <Metric label="Spend" value={previewValue(showInventorySpend, inventorySpendQ.isLoading, exactMoney(inventorySpend?.totals.spend_cents ?? 0))} tone="amber" />
            </div>
            {showInventorySpend ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">Group</th>
                      <th className="text-right py-2 pr-3">POs</th>
                      <th className="text-right py-2 pr-3">Lines</th>
                      <th className="text-right py-2 pr-3">Received</th>
                      <th className="text-right py-2">Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(inventorySpend?.rows ?? [])).map((row) => (
                      <tr key={row.key} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.label}</div>
                          <div className="text-xs text-slate-500">{row.qty_ordered} ordered</div>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.po_count}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.line_count}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.qty_received}</td>
                        <td className="py-2 text-right font-mono font-semibold">{exactMoney(row.spend_cents)}</td>
                      </tr>
                    ))}
                    {!inventorySpendQ.isLoading && filterReportRows(inventorySpend?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={5}>No inventory spend in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>

        <div {...reportDragProps('expense-register')} className={reportPanelClass('expense-register')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Expense register</h2>
              <p className="text-xs text-slate-500">Fuel, vendor bills, reimbursements, billable job costs, and overhead.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={reimbursementStatusFilter}
                onChange={(event) => {
                  setReimbursementStatusFilter(event.target.value as ReimbursementStatusFilter)
                  resetReportPage()
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <option value="all">All reimbursement</option>
                <option value="pending">Pending reimbursement</option>
                <option value="approved">Approved reimbursement</option>
                <option value="reimbursed">Reimbursed</option>
                <option value="not_reimbursable">Not reimbursable</option>
                <option value="rejected">Rejected</option>
              </select>
              <button
                type="button"
                onClick={() => downloadReport(`${expenseRegisterBase}&format=pdf`, `expense-register-${from}-${to}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${expenseRegisterBase}&format=csv`, `expense-register-${from}-${to}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Metric label="Expenses" value={previewValue(showExpenseRegister, expenseRegisterQ.isLoading, String(expenseRegister?.totals.expense_count ?? 0))} />
              <Metric label="Total" value={previewValue(showExpenseRegister, expenseRegisterQ.isLoading, exactMoney(expenseRegister?.totals.total_cents ?? 0))} />
              <Metric label="Pending" value={previewValue(showExpenseRegister, expenseRegisterQ.isLoading, exactMoney(expenseRegister?.totals.reimbursement_pending_cents ?? 0))} tone="amber" />
              <Metric label="Approved" value={previewValue(showExpenseRegister, expenseRegisterQ.isLoading, exactMoney(expenseRegister?.totals.reimbursement_approved_cents ?? 0))} tone="amber" />
              <Metric label="Reimbursed" value={previewValue(showExpenseRegister, expenseRegisterQ.isLoading, exactMoney(expenseRegister?.totals.reimbursement_reimbursed_cents ?? 0))} tone="emerald" />
            </div>
            {showExpenseRegister && expenseReimbursementByTech.length > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Reimbursement by tech</h3>
                    <p className="text-xs text-slate-500">Pending, approved, and paid-back expense totals for payroll review.</p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {expenseReimbursementByTech.length} {expenseReimbursementByTech.length === 1 ? 'tech' : 'techs'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th className="py-2 pr-3 text-left">Tech</th>
                        <th className="py-2 pr-3 text-right">Items</th>
                        <th className="py-2 pr-3 text-right">Pending</th>
                        <th className="py-2 pr-3 text-right">Approved</th>
                        <th className="py-2 pr-3 text-right">Reimbursed</th>
                        <th className="py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseReimbursementByTech.map((tech) => (
                        <tr key={tech.label} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 pr-3 font-semibold text-slate-900">{tech.label}</td>
                          <td className="py-2 pr-3 text-right font-mono">{tech.count}</td>
                          <td className="py-2 pr-3 text-right font-mono text-amber-700">{exactMoney(tech.pending_cents)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-amber-700">{exactMoney(tech.approved_cents)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-emerald-700">{exactMoney(tech.reimbursed_cents)}</td>
                          <td className="py-2 text-right font-mono font-semibold">{exactMoney(tech.total_cents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {showExpenseRegister ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">Date</th>
                      <th className="text-left py-2 pr-3">Expense</th>
                      <th className="text-left py-2 pr-3">Tech / vendor</th>
                      <th className="text-left py-2 pr-3">Job</th>
                      <th className="text-left py-2 pr-3">Flags</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(expenseRegister?.rows ?? [])).map((row) => (
                      <tr key={row.expense_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{row.expense_date ?? '-'}</td>
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.description}</div>
                          <div className="text-xs text-slate-500 capitalize">{row.category.replace(/_/g, ' ')} · {row.status.replace(/_/g, ' ')}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <div>{row.employee_name ?? row.employee_email ?? row.vendor_name ?? 'Overhead'}</div>
                          {row.vendor_name && (row.employee_name || row.employee_email) ? (
                            <div className="text-xs text-slate-500">{row.vendor_name}</div>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">
                          {row.work_order_id ? (
                            <Link to={`/jobs/${row.work_order_id}`} className="font-medium text-amber-700 hover:underline">
                              #{row.work_order_number ?? row.work_order_id}
                            </Link>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                          {row.receipt_attachment_count > 0 ? (
                            <div className="text-xs font-semibold text-slate-500">{row.receipt_attachment_count} receipt file{row.receipt_attachment_count === 1 ? '' : 's'}</div>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {row.reimbursable && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold capitalize text-amber-800">{row.reimbursement_status.replace(/_/g, ' ')}</span>}
                            {row.billable_to_job && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">Billable</span>}
                            {!row.reimbursable && !row.billable_to_job && <span className="text-xs text-slate-400">Company</span>}
                          </div>
                        </td>
                        <td className="py-2 text-right font-mono font-semibold">{exactMoney(row.total_cents)}</td>
                      </tr>
                    ))}
                    {!expenseRegisterQ.isLoading && filterReportRows(expenseRegister?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={6}>No expenses in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>

        <div {...reportDragProps('vendor-bill-register')} className={reportPanelClass('vendor-bill-register')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Vendor bill register</h2>
              <p className="text-xs text-slate-500">AP bills by vendor, due date, PO, paid amount, and open balance.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${vendorBillRegisterBase}&format=pdf`, `vendor-bill-register-${from}-${to}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${vendorBillRegisterBase}&format=csv`, `vendor-bill-register-${from}-${to}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Bills" value={previewValue(showVendorBillRegister, vendorBillRegisterQ.isLoading, String(vendorBillRegister?.totals.bill_count ?? 0))} />
              <Metric label="Open AP" value={previewValue(showVendorBillRegister, vendorBillRegisterQ.isLoading, exactMoney(vendorBillRegister?.totals.balance_cents ?? 0))} tone="amber" />
              <Metric label="Overdue" value={previewValue(showVendorBillRegister, vendorBillRegisterQ.isLoading, exactMoney(vendorBillRegister?.totals.overdue_cents ?? 0))} tone="amber" />
            </div>
            {showVendorBillRegister ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">Bill</th>
                      <th className="text-left py-2 pr-3">Vendor</th>
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-right py-2 pr-3">Total</th>
                      <th className="text-right py-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(vendorBillRegister?.rows ?? [])).map((row) => (
                      <tr key={row.vendor_bill_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.bill_number ?? row.vendor_bill_id}</div>
                          <div className="text-xs text-slate-500">
                            Bill {row.bill_date ?? '-'} · Due {row.due_date ?? '-'}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.vendor_name ?? 'Vendor'}</div>
                          {row.po_number && <div className="text-xs text-slate-500">PO {row.po_number}</div>}
                        </td>
                        <td className="py-2 pr-3 capitalize">{row.status.replace(/_/g, ' ')}</td>
                        <td className="py-2 pr-3 text-right font-mono font-semibold">{exactMoney(row.total_cents)}</td>
                        <td className="py-2 text-right font-mono font-semibold">{exactMoney(row.balance_cents)}</td>
                      </tr>
                    ))}
                    {!vendorBillRegisterQ.isLoading && filterReportRows(vendorBillRegister?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={5}>No vendor bills in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>

        <div {...reportDragProps('subcontractor-payout')} className={reportPanelClass('subcontractor-payout')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Subcontractor payout register</h2>
              <p className="text-xs text-slate-500">Sub invoices by submitted, approved, declined, and paid status.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${subcontractorPayoutBase}&format=pdf`, `subcontractor-payout-register-${from}-${to}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${subcontractorPayoutBase}&format=csv`, `subcontractor-payout-register-${from}-${to}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Invoices" value={previewValue(showSubcontractorPayout, subcontractorPayoutQ.isLoading, String(subcontractorPayout?.totals.invoice_count ?? 0))} />
              <Metric label="Approved" value={previewValue(showSubcontractorPayout, subcontractorPayoutQ.isLoading, exactMoney(subcontractorPayout?.totals.approved_cents ?? 0))} tone="amber" />
              <Metric label="Paid" value={previewValue(showSubcontractorPayout, subcontractorPayoutQ.isLoading, exactMoney(subcontractorPayout?.totals.paid_cents ?? 0))} tone="emerald" />
            </div>
            {showSubcontractorPayout ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">Invoice</th>
                      <th className="text-left py-2 pr-3">Subcontractor</th>
                      <th className="text-left py-2 pr-3">Job</th>
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(subcontractorPayout?.rows ?? [])).map((row) => (
                      <tr key={row.sub_invoice_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.invoice_number ?? row.sub_invoice_id}</div>
                          <div className="text-xs text-slate-500">{row.paid_at ? `Paid ${row.paid_at}` : `Completed ${row.completion_date ?? '-'}`}</div>
                        </td>
                        <td className="py-2 pr-3">{row.subcontractor_name ?? 'Subcontractor'}</td>
                        <td className="py-2 pr-3">
                          <Link to={`/jobs/${row.work_order_id}`} className="text-amber-700 hover:underline">
                            {row.work_order_number ?? 'Job'}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 capitalize">{row.status.replace(/_/g, ' ')}</td>
                        <td className="py-2 text-right font-mono font-semibold">{exactMoney(row.total_cents)}</td>
                      </tr>
                    ))}
                    {!subcontractorPayoutQ.isLoading && filterReportRows(subcontractorPayout?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={5}>No subcontractor invoices in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>

        <div {...reportDragProps('contractor-1099')} className={reportPanelClass('contractor-1099')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">1099 contractor summary</h2>
              <p className="text-xs text-slate-500">
                {contractor1099Year} paid subcontractor totals, W-9 status, and review threshold.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Review
                <select
                  value={contractor1099ReviewFilter}
                  onChange={(event) => {
                    setContractor1099ReviewFilter(event.target.value as Contractor1099ReviewFilter)
                    resetReportPage()
                  }}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                >
                  <option value="all">All contractors</option>
                  <option value="review">Needs 1099</option>
                  <option value="missing_w9">Missing W-9</option>
                  <option value="below_threshold">Below threshold</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => downloadReport(`${contractor1099Base}&format=pdf`, `contractor-1099-summary-${contractor1099Year}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${contractor1099Base}&format=csv`, `contractor-1099-summary-${contractor1099Year}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Contractors" value={previewValue(showContractor1099, contractor1099Q.isLoading, String(contractor1099?.totals.contractor_count ?? 0))} />
              <Metric label="1099 review" value={previewValue(showContractor1099, contractor1099Q.isLoading, String(contractor1099?.totals.review_count ?? 0))} tone="amber" />
              <Metric label="Missing W-9" value={previewValue(showContractor1099, contractor1099Q.isLoading, String(contractor1099?.totals.missing_w9_count ?? 0))} tone="amber" />
              <Metric label="Threshold" value={previewValue(showContractor1099, contractor1099Q.isLoading, exactMoney(contractor1099?.threshold_cents ?? 0))} />
            </div>
            {showContractor1099 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">Subcontractor</th>
                      <th className="text-left py-2 pr-3">Contact</th>
                      <th className="text-left py-2 pr-3">W-9</th>
                      <th className="text-right py-2 pr-3">Invoices</th>
                      <th className="text-right py-2 pr-3">Paid</th>
                      <th className="text-left py-2">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(contractor1099?.rows ?? [])).map((row) => (
                      <tr key={row.subcontractor_id ?? row.subcontractor_name} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.subcontractor_name}</div>
                          <div className="text-xs text-slate-500">{row.last_paid_at ? `Last paid ${row.last_paid_at}` : 'No paid date'}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <div>{row.contact_name ?? '-'}</div>
                          <div className="text-xs text-slate-500">{row.email ?? row.phone ?? '-'}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.w9_on_file ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {row.w9_on_file ? 'On file' : 'Missing'}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">{row.invoice_count}</td>
                        <td className="py-2 pr-3 text-right font-mono font-semibold">{exactMoney(row.paid_cents)}</td>
                        <td className="py-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.requires_1099_review ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {row.requires_1099_review ? 'Review' : 'Below threshold'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!contractor1099Q.isLoading && filterReportRows(contractor1099?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={6}>No paid subcontractor invoices in this tax year.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>

        <div {...reportDragProps('job-profitability')} className={reportPanelClass('job-profitability')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Job profitability</h2>
              <p className="text-xs text-slate-500">Revenue, owner cost, subcontractor cost, and gross margin.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${jobProfitabilityBase}&format=pdf`, `job-profitability-${from}-${to}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${jobProfitabilityBase}&format=csv`, `job-profitability-${from}-${to}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Revenue" value={previewValue(showJobProfitability, jobProfitabilityQ.isLoading, exactMoney(jobProfitability?.totals.revenue_cents ?? 0))} tone="emerald" />
              <Metric label="Cost" value={previewValue(showJobProfitability, jobProfitabilityQ.isLoading, exactMoney(jobProfitability?.totals.cost_cents ?? 0))} />
              <Metric label="Margin" value={previewValue(showJobProfitability, jobProfitabilityQ.isLoading, exactMoney(jobProfitability?.totals.margin_cents ?? 0))} tone={(jobProfitability?.totals.margin_cents ?? 0) >= 0 ? 'emerald' : 'amber'} />
            </div>
            {showJobProfitability ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">Job</th>
                      <th className="text-left py-2 pr-3">Customer</th>
                      <th className="text-right py-2 pr-3">Revenue</th>
                      <th className="text-right py-2 pr-3">Cost</th>
                      <th className="text-right py-2">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(jobProfitability?.rows ?? [])).map((row) => (
                      <tr key={row.work_order_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3">
                          <Link to={`/jobs/${row.work_order_id}`} className="font-medium text-amber-700 hover:underline">
                            #{row.work_order_number}
                          </Link>
                          <div className="text-xs text-slate-500">{row.job_type ?? row.status ?? '-'}</div>
                        </td>
                        <td className="py-2 pr-3">{row.customer_name ?? 'Customer'}</td>
                        <td className="py-2 pr-3 text-right font-mono">{exactMoney(row.revenue_cents)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{exactMoney(row.cost_cents)}</td>
                        <td className={`py-2 text-right font-mono font-semibold ${row.margin_cents >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {exactMoney(row.margin_cents)}
                          {row.margin_pct !== null && <div className="text-xs text-slate-500">{row.margin_pct}%</div>}
                        </td>
                      </tr>
                    ))}
                    {!jobProfitabilityQ.isLoading && filterReportRows(jobProfitability?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={5}>No jobs in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>

        <div {...reportDragProps('inventory-movement')} className={reportPanelClass('inventory-movement')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Inventory movement</h2>
              <p className="text-xs text-slate-500">Receive, transfer, install, return, adjustment, and write-off history.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${inventoryMovementBase}&format=pdf`, `inventory-movement-${from}-${to}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${inventoryMovementBase}&format=csv`, `inventory-movement-${from}-${to}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Movements" value={previewValue(showInventoryMovement, inventoryMovementQ.isLoading, String(inventoryMovement?.totals.movement_count ?? 0))} />
              <Metric label="Quantity" value={previewValue(showInventoryMovement, inventoryMovementQ.isLoading, String(inventoryMovement?.totals.quantity ?? 0))} />
              <Metric label="Tracked cost" value={previewValue(showInventoryMovement, inventoryMovementQ.isLoading, exactMoney(inventoryMovement?.totals.extended_cost_cents ?? 0))} />
            </div>
            {showInventoryMovement ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">Type</th>
                      <th className="text-left py-2 pr-3">Item</th>
                      <th className="text-right py-2 pr-3">Qty</th>
                      <th className="text-left py-2 pr-3">From → To</th>
                      <th className="text-right py-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(inventoryMovement?.rows ?? [])).map((row) => (
                      <tr key={row.movement_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 capitalize">{row.type.replace(/_/g, ' ')}</td>
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.catalog_item_name ?? 'Item'}</div>
                          <div className="text-xs text-slate-500">{row.sku ?? row.created_at ?? '-'}</div>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.quantity}</td>
                        <td className="py-2 pr-3 text-xs text-slate-600">
                          {(row.from_location ?? '-') + ' -> ' + (row.to_location ?? '-')}
                        </td>
                        <td className="py-2 text-right font-mono font-semibold">{exactMoney(row.extended_cost_cents)}</td>
                      </tr>
                    ))}
                    {!inventoryMovementQ.isLoading && filterReportRows(inventoryMovement?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={5}>No inventory movements in this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>

        <div {...reportDragProps('inventory-valuation')} className={reportPanelClass('inventory-valuation')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Inventory valuation</h2>
              <p className="text-xs text-slate-500">Current on-hand value by item, warehouse, truck, and bin.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${inventoryValuationBase}&format=pdf`, `inventory-valuation-${asOf}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${inventoryValuationBase}&format=csv`, `inventory-valuation-${asOf}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Spreadsheet
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Stock rows" value={previewValue(showInventoryValuation, inventoryValuationQ.isLoading, String(inventoryValuation?.totals.stock_row_count ?? 0))} />
              <Metric label="On hand" value={previewValue(showInventoryValuation, inventoryValuationQ.isLoading, String(inventoryValuation?.totals.qty_on_hand ?? 0))} />
              <Metric label="Value" value={previewValue(showInventoryValuation, inventoryValuationQ.isLoading, exactMoney(inventoryValuation?.totals.inventory_value_cents ?? 0))} tone="emerald" />
            </div>
            {showInventoryValuation ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">Item</th>
                      <th className="text-left py-2 pr-3">Location</th>
                      <th className="text-right py-2 pr-3">On hand</th>
                      <th className="text-right py-2 pr-3">Unit cost</th>
                      <th className="text-right py-2">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(inventoryValuation?.rows ?? [])).map((row) => (
                      <tr key={row.stock_level_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.item_name ?? 'Inventory item'}</div>
                          <div className="text-xs text-slate-500">{row.sku ?? '-'}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <div>{row.location_name ?? 'Location'}</div>
                          <div className="text-xs text-slate-500">{row.bin_name ?? 'No bin'}</div>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.qty_on_hand}</td>
                        <td className="py-2 pr-3 text-right font-mono">{exactMoney(row.unit_cost_cents)}</td>
                        <td className="py-2 text-right font-mono font-semibold">{exactMoney(row.inventory_value_cents)}</td>
                      </tr>
                    ))}
                    {!inventoryValuationQ.isLoading && filterReportRows(inventoryValuation?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={5}>No on-hand inventory value to report.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
          </div>
        </div>

        <div {...reportDragProps('ar-aging')} className={reportPanelClass('ar-aging')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">AR aging</h2>
              <p className="text-xs text-slate-500">Sent invoices with an unpaid balance.</p>
            </div>
            <label className="text-xs text-slate-500">
              As of
              <input
                type="date"
                value={asOf}
                onChange={(e) => {
                  setAsOf(e.target.value)
                  resetReportPage()
                }}
                className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
              />
            </label>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Open invoices" value={previewValue(showArAging, agingQ.isLoading, String(aging?.totals.invoice_count ?? 0))} />
              <Metric label="Balance due" value={previewValue(showArAging, agingQ.isLoading, exactMoney(aging?.totals.balance_cents ?? 0))} tone="amber" />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${agingBase}&format=pdf`, `ar-aging-${asOf}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${agingBase}&format=csv`, `ar-aging-${asOf}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Download spreadsheet
              </button>
            </div>

            {agingQ.isLoading && <EmptyState text="Loading report preview..." />}

            {showArAging ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-3">Invoice</th>
                    <th className="text-left py-2 pr-3">Customer</th>
                    <th className="text-right py-2 pr-3">Days</th>
                    <th className="text-right py-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {pageReportRows(filterReportRows(aging?.rows ?? [])).map((row) => (
                    <tr key={row.invoice_id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3">
                        <Link to={`/invoices/${row.invoice_id}`} className="font-medium text-amber-700 hover:underline">
                          {row.invoice_number}
                        </Link>
                        <div className="text-xs text-slate-500">Due {row.due_at ?? '-'}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <Link to={`/customers/${row.customer_id}`} className="text-slate-900 hover:underline">
                          {row.customer_name ?? 'Customer'}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.days_past_due}</td>
                      <td className="py-2 text-right font-mono font-semibold">{exactMoney(row.balance_cents)}</td>
                    </tr>
                  ))}
                  {!agingQ.isLoading && filterReportRows(aging?.rows ?? []).length === 0 && (
                    <tr>
                      <td className="py-8 text-center text-slate-500" colSpan={4}>
                        No outstanding sent invoices.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
            <p className="text-xs text-slate-500">Preview follows the Rows per page setting. Spreadsheet and PDF downloads include the full filtered report.</p>
          </div>
        </div>

        <div {...reportDragProps('ap-aging')} className={reportPanelClass('ap-aging')}>
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">AP aging</h2>
              <p className="text-xs text-slate-500">Open vendor bills with an unpaid balance.</p>
            </div>
            <label className="text-xs text-slate-500">
              As of
              <input
                type="date"
                value={asOf}
                onChange={(e) => {
                  setAsOf(e.target.value)
                  resetReportPage()
                }}
                className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
              />
            </label>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Open bills" value={previewValue(showApAging, apAgingQ.isLoading, String(apAging?.totals.bill_count ?? 0))} />
              <Metric label="Balance owed" value={previewValue(showApAging, apAgingQ.isLoading, exactMoney(apAging?.totals.balance_cents ?? 0))} tone="amber" />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${apAgingBase}&format=pdf`, `ap-aging-${asOf}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${apAgingBase}&format=csv`, `ap-aging-${asOf}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Download spreadsheet
              </button>
            </div>

            {apAgingQ.isLoading && <EmptyState text="Loading report preview..." />}

            {showApAging ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-3">Bill</th>
                      <th className="text-left py-2 pr-3">Vendor</th>
                      <th className="text-right py-2 pr-3">Days</th>
                      <th className="text-right py-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReportRows(filterReportRows(apAging?.rows ?? [])).map((row) => (
                      <tr key={row.vendor_bill_id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{row.bill_number ?? row.vendor_bill_id}</div>
                          <div className="text-xs text-slate-500">Due {row.due_date ?? '-'}{row.po_number ? ` · PO ${row.po_number}` : ''}</div>
                        </td>
                        <td className="py-2 pr-3">{row.vendor_name ?? 'Vendor'}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.days_past_due}</td>
                        <td className="py-2 text-right font-mono font-semibold">{exactMoney(row.balance_cents)}</td>
                      </tr>
                    ))}
                    {!apAgingQ.isLoading && filterReportRows(apAging?.rows ?? []).length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-slate-500" colSpan={4}>
                          No open vendor bills.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
            <p className="text-xs text-slate-500">Preview follows the Rows per page setting. Spreadsheet and PDF downloads include the full filtered report.</p>
          </div>
        </div>

        <div {...reportDragProps('revenue-breakdown')} className={reportPanelClass('revenue-breakdown')}>
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Revenue breakdown</h2>
                <p className="text-xs text-slate-500">Sent and paid invoices by date range.</p>
              </div>
              <select
                value={groupBy}
                onChange={(e) => {
                  setGroupBy(e.target.value)
                  resetReportPage()
                }}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
              >
                {revenueGroups.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="text-xs text-slate-500">
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value)
                    resetReportPage()
                  }}
                  className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
                />
              </label>
              <label className="text-xs text-slate-500">
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value)
                    resetReportPage()
                  }}
                  className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
                />
              </label>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Revenue" value={previewValue(showRevenueBreakdown, revenueQ.isLoading, exactMoney(revenue?.totals.total_cents ?? 0))} tone="emerald" />
              <Metric label="Tax" value={previewValue(showRevenueBreakdown, revenueQ.isLoading, exactMoney(revenue?.totals.tax_cents ?? 0))} />
              <Metric label="Invoices" value={previewValue(showRevenueBreakdown, revenueQ.isLoading, String(revenue?.totals.invoice_count ?? 0))} />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadReport(`${revenueBase}&format=pdf`, `revenue-${groupBy}-${from}-${to}.pdf`)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReport(`${revenueBase}&format=csv`, `revenue-${groupBy}-${from}-${to}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Download spreadsheet
              </button>
            </div>

            {showRevenueBreakdown ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-3">{revenueGroupLabel}</th>
                    <th className="text-right py-2 pr-3">Invoices</th>
                    <th className="text-right py-2 pr-3">Tax</th>
                    <th className="text-right py-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {pageReportRows(filterReportRows(revenue?.rows ?? [])).map((row) => (
                    <tr key={`${row.key}-${row.label}`} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-900">{row.label}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.invoice_count}</td>
                      <td className="py-2 pr-3 text-right font-mono">{money(row.tax_cents)}</td>
                      <td className="py-2 text-right font-mono font-semibold">{money(row.total_cents)}</td>
                    </tr>
                  ))}
                  {!revenueQ.isLoading && filterReportRows(revenue?.rows ?? []).length === 0 && (
                    <tr>
                      <td className="py-8 text-center text-slate-500" colSpan={4}>
                        No sent or paid invoices in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            ) : (
              <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
            )}
            <p className="text-xs text-slate-500">Preview follows the Rows per page setting. Spreadsheet and PDF downloads include the full filtered report.</p>
          </div>
        </div>

        <div {...reportDragProps('tech-performance')} className={reportPanelClass('tech-performance')}>
        <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Tech performance</h2>
            <p className="text-xs text-slate-500">Completed jobs, time-clock hours, payroll cost, reimbursements, and margin by lead tech.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={techPerformancePayTypeFilter}
              onChange={(event) => {
                setTechPerformancePayTypeFilter(event.target.value as ReportPayTypeFilter)
                resetReportPage()
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <option value="all">All pay types</option>
              <option value="hourly">Hourly</option>
              <option value="salary">Salary</option>
              <option value="commission">Commission</option>
              <option value="hybrid">Hybrid</option>
              <option value="none">No payroll profile</option>
            </select>
            <button
              type="button"
              onClick={() => downloadReport(`${techPerformanceBase}&format=pdf`, `tech-performance-${from}-${to}.pdf`)}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => downloadReport(`${techPerformanceBase}&format=csv`, `tech-performance-${from}-${to}.csv`)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Spreadsheet
            </button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Metric label="Techs" value={previewValue(showTechPerformance, techPerformanceQ.isLoading, String(techPerformance?.totals.tech_count ?? 0))} />
            <Metric label="Jobs" value={previewValue(showTechPerformance, techPerformanceQ.isLoading, String(techPerformance?.totals.job_count ?? 0))} />
            <Metric label="Labor" value={previewValue(showTechPerformance, techPerformanceQ.isLoading, exactMoney(techPerformance?.totals.labor_cost_cents ?? 0))} />
            <Metric label="Vacation" value={previewValue(showTechPerformance, techPerformanceQ.isLoading, `${techPerformance?.totals.vacation_hours_earned ?? 0}h`)} />
            <Metric label="Margin" value={previewValue(showTechPerformance, techPerformanceQ.isLoading, exactMoney(techPerformance?.totals.margin_cents ?? 0))} tone={(techPerformance?.totals.margin_cents ?? 0) >= 0 ? 'emerald' : 'amber'} />
          </div>

          {showTechPerformance ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-3">Technician</th>
                    <th className="text-right py-2 pr-3">Jobs</th>
                    <th className="text-right py-2 pr-3">Hours</th>
                    <th className="text-right py-2 pr-3">Revenue</th>
                    <th className="text-right py-2 pr-3">Paid</th>
                    <th className="text-right py-2 pr-3">Labor</th>
                    <th className="text-right py-2 pr-3">Comm.</th>
                    <th className="text-right py-2 pr-3">Parts comm.</th>
                    <th className="text-right py-2 pr-3">Sick</th>
                    <th className="text-right py-2 pr-3">Vacation</th>
                    <th className="text-right py-2 pr-3">Reimburse</th>
                    <th className="text-right py-2 pr-3">Cost</th>
                    <th className="text-right py-2">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {pageReportRows(filterReportRows(techPerformance?.rows ?? [])).map((row) => (
                    <tr key={row.tech_id ?? 'unassigned'} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-slate-900">{row.tech_name}</div>
                        <div className="text-xs text-slate-500">{row.pay_type ?? 'No payroll profile'}</div>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.job_count}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.clock_hours}</td>
                      <td className="py-2 pr-3 text-right font-mono">{exactMoney(row.revenue_cents)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{exactMoney(row.paid_cents)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{exactMoney(row.labor_cost_cents)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{exactMoney(row.commission_cost_cents)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{exactMoney(row.parts_commission_cost_cents ?? 0)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.sick_hours_earned ?? 0}h</td>
                      <td className="py-2 pr-3 text-right">
                        <div className="tabular-nums">{row.vacation_hours_earned ?? 0}h</div>
                        <div className="text-xs font-mono text-slate-500">{exactMoney(row.vacation_accrual_cents ?? 0)}</div>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <div className="font-mono font-semibold">{exactMoney(row.reimbursable_expense_cents)}</div>
                        <div className="text-xs text-slate-500">
                          P {exactMoney(row.reimbursable_pending_cents ?? 0)} · A {exactMoney(row.reimbursable_approved_cents ?? 0)} · R {exactMoney(row.reimbursable_reimbursed_cents ?? 0)}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">{exactMoney(row.cost_cents)}</td>
                      <td className={`py-2 text-right font-mono font-semibold ${row.margin_cents >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {exactMoney(row.margin_cents)}
                        {row.margin_pct !== null && <div className="text-xs text-slate-500">{row.margin_pct}%</div>}
                      </td>
                    </tr>
                  ))}
                  {!techPerformanceQ.isLoading && filterReportRows(techPerformance?.rows ?? []).length === 0 && (
                    <tr>
                      <td className="py-8 text-center text-slate-500" colSpan={13}>No completed jobs in this range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text="Grid preview hidden. Download the PDF or spreadsheet for the full report." />
          )}
        </div>
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'amber' | 'emerald' }) {
  const color = tone === 'amber' ? 'text-amber-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-slate-900'
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold font-mono ${color}`}>{value}</div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">{text}</div>
}
