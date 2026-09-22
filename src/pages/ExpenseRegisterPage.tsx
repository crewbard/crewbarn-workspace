import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { tenantDate, useTenantTimezone } from '@/hooks/useTenantTime'
import type { PaginatedResponse } from '@/types/api'

type ReceiptAttachment = {
  id: string
  original_filename?: string | null
  url?: string | null
  thumbnail_url?: string | null
  mime_type?: string | null
}

type Expense = {
  id: string
  expense_date: string
  category: string
  description: string
  amount_cents: number
  tax_cents: number
  status: string
  payment_method?: string | null
  reference_number?: string | null
  reimbursable: boolean
  reimbursement_status: string
  billable_to_job: boolean
  vendor?: { id: string; name: string; display_name?: string | null } | null
  employee?: { id: string; name?: string | null; email?: string | null } | null
  work_order?: { id: string; job_number?: string | number | null; title?: string | null } | null
  receipt_attachment_ids?: string[]
  receipt_attachments?: ReceiptAttachment[]
}

type VendorOption = {
  id: string
  name: string
  display_name?: string | null
}

type StaffOption = {
  id: string
  name: string
  email: string
  role_slug: string | null
  status: string
}

const categories = [
  ['fuel', 'Fuel'],
  ['parking_tolls', 'Parking / tolls'],
  ['parts_materials', 'Parts / materials'],
  ['tools_equipment', 'Tools / equipment'],
  ['subcontractor', 'Subcontractor'],
  ['rent', 'Rent'],
  ['insurance', 'Insurance'],
  ['software', 'Software'],
  ['vehicle', 'Vehicle'],
  ['payroll', 'Payroll'],
  ['taxes', 'Taxes'],
  ['bank_fee', 'Bank fee'],
  ['office', 'Office'],
  ['travel_meals', 'Travel / meals'],
  ['other', 'Other'],
] as const

function dollars(cents: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100)
}

function labelForCategory(value: string) {
  return categories.find(([key]) => key === value)?.[1] ?? value
}

function csvCell(value: unknown): string {
  const raw = value == null ? '' : String(value)
  return `"${raw.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  if (rows.length === 0) {
    return
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
}

export function ExpenseRegisterPage() {
  const queryClient = useQueryClient()
  const tenantTimezone = useTenantTimezone()
  const today = tenantDate(tenantTimezone)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<'10' | '50' | '100'>('50')
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    q: '',
    date_from: today.slice(0, 8) + '01',
    date_to: today,
    category: '',
    status: '',
    vendor_id: '',
    employee_account_id: '',
    reimbursement_status: '',
  })
  const [form, setForm] = useState({
    expense_date: today,
    category: 'fuel',
    vendor_id: '',
    employee_account_id: '',
    description: '',
    amount: '',
    tax: '',
    payment_method: '',
    reference_number: '',
    reimbursable: false,
    billable_to_job: false,
    notes: '',
  })

  useEffect(() => {
    setFilters((current) => ({ ...current, date_from: today.slice(0, 8) + '01', date_to: today }))
    setForm((current) => ({ ...current, expense_date: today }))
  }, [today])

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ per_page: perPage, page: String(page) })
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    return params.toString()
  }, [filters, page, perPage])

  const expensesQ = useQuery({
    queryKey: ['expenses', queryString],
    queryFn: () => apiRequest<PaginatedResponse<Expense>>(`/v1/expenses?${queryString}`),
  })

  const vendorsQ = useQuery({
    queryKey: ['expense-vendors'],
    queryFn: () => apiRequest<{ data: VendorOption[] }>('/v1/vendors?per_page=100&active=true'),
  })

  const staffQ = useQuery({
    queryKey: ['expense-staff'],
    queryFn: () => apiRequest<{ data: StaffOption[] }>('/v1/staff?per_page=200'),
  })

  const createExpense = useMutation({
    mutationFn: (payload: typeof form) =>
      apiRequest<{ data: Expense }>('/v1/expenses', {
        method: 'POST',
        body: {
          ...payload,
          vendor_id: payload.vendor_id || null,
          employee_account_id: payload.employee_account_id || null,
          amount: Number(payload.amount || 0),
          tax: Number(payload.tax || 0),
          payment_method: payload.payment_method || null,
          reference_number: payload.reference_number || null,
          notes: payload.notes || null,
        },
      }),
    onSuccess: () => {
      setPage(1)
      setForm({
        expense_date: today,
        category: 'fuel',
        vendor_id: '',
        employee_account_id: '',
        description: '',
        amount: '',
        tax: '',
        payment_method: '',
        reference_number: '',
        reimbursable: false,
        billable_to_job: false,
        notes: '',
      })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })

  const updateExpense = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Expense> }) =>
      apiRequest<{ data: Expense }>(`/v1/expenses/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })
  const reverseReimbursement = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<{ data: Expense; journal_entry_id?: string | null }>(
        `/v1/expenses/${encodeURIComponent(id)}/reimbursement-reversal`,
        {
          method: 'POST',
          body: { reason },
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  const expenses = expensesQ.data?.data ?? []
  const meta = expensesQ.data?.meta
  const subtotal = expenses.reduce((sum, expense) => sum + expense.amount_cents, 0)
  const taxTotal = expenses.reduce((sum, expense) => sum + expense.tax_cents, 0)
  const reimbursableTotal = expenses
    .filter((expense) => expense.reimbursable)
    .reduce((sum, expense) => sum + expense.amount_cents + expense.tax_cents, 0)
  function reversePaidReimbursement(expense: Expense) {
    const reason = window.prompt('Reason for reversing this reimbursement')
    if (!reason || reason.trim().length < 3) return

    reverseReimbursement.mutate({ id: expense.id, reason: reason.trim() })
  }
  const downloadVisibleExpenses = () => {
    setExportMessage(null)
    if (expenses.length === 0) {
      setExportMessage('No expense rows match the current filter.')
      return
    }

    downloadCsv(
      `expense-register-${filters.date_from || 'all'}-${filters.date_to || today}.csv`,
      ['Date', 'Description', 'Tech / staff', 'Job', 'Vendor', 'Category', 'Status', 'Reimbursement status', 'Billable', 'Receipt files', 'Payment method', 'Reference', 'Amount', 'Tax', 'Total'],
      expenses.map((expense) => [
        expense.expense_date,
        expense.description,
        expense.employee?.name || expense.employee?.email || 'Company',
        expense.work_order?.job_number ?? '',
        expense.vendor?.display_name || expense.vendor?.name || '',
        labelForCategory(expense.category),
        expense.status,
        expense.reimbursement_status,
        expense.billable_to_job ? 'Yes' : 'No',
        expense.receipt_attachments?.map((attachment) => attachment.original_filename || attachment.id).join(' | ')
          || expense.receipt_attachment_ids?.join(' | ')
          || '',
        expense.payment_method ?? '',
        expense.reference_number ?? '',
        dollars(expense.amount_cents),
        dollars(expense.tax_cents),
        dollars(expense.amount_cents + expense.tax_cents),
      ]),
    )
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    createExpense.mutate(form)
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-4 text-slate-950 sm:px-6 sm:py-6 2xl:px-8">
      <div className="mx-auto w-full max-w-none space-y-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Accounting</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Expense Register</h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Track fuel, vendor bills, job materials, tech reimbursements, and company overhead before bank match, payroll, and reports.
            </p>
          </div>
          <a className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm" href="/accounting/expenses">
            Back to expense workspace
          </a>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <SummaryTile label="Current filter total" value={dollars(subtotal + taxTotal)} />
          <SummaryTile label="Tax in filter" value={dollars(taxTotal)} />
          <SummaryTile label="Pending reimbursement exposure" value={dollars(reimbursableTotal)} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Add expense</h2>
          <form className="mt-4 grid gap-3 lg:grid-cols-12" onSubmit={submit}>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Date
              <input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={form.expense_date} onChange={(e) => setForm((old) => ({ ...old, expense_date: e.target.value }))} required />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Category
              <select className="rounded-md border border-slate-300 px-3 py-2" value={form.category} onChange={(e) => setForm((old) => ({ ...old, category: e.target.value }))}>
                {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Vendor
              <select className="rounded-md border border-slate-300 px-3 py-2" value={form.vendor_id} onChange={(e) => setForm((old) => ({ ...old, vendor_id: e.target.value }))}>
                <option value="">No vendor</option>
                {(vendorsQ.data?.data ?? []).map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.display_name || vendor.name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Tech / staff
              <select className="rounded-md border border-slate-300 px-3 py-2" value={form.employee_account_id} onChange={(e) => setForm((old) => ({ ...old, employee_account_id: e.target.value }))}>
                <option value="">Company expense</option>
                {(staffQ.data?.data ?? []).map((staff) => (
                  <option key={staff.id} value={staff.id}>{staff.name || staff.email}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Description
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.description} onChange={(e) => setForm((old) => ({ ...old, description: e.target.value }))} placeholder="Fuel, lock hardware, tolls..." required />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-1">
              Amount
              <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" value={form.amount} onChange={(e) => setForm((old) => ({ ...old, amount: e.target.value }))} placeholder="0.00" required />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-1">
              Tax
              <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" value={form.tax} onChange={(e) => setForm((old) => ({ ...old, tax: e.target.value }))} placeholder="0.00" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Method
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.payment_method} onChange={(e) => setForm((old) => ({ ...old, payment_method: e.target.value }))} placeholder="Card, cash, ACH" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Ref / PO #
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.reference_number} onChange={(e) => setForm((old) => ({ ...old, reference_number: e.target.value }))} placeholder="Receipt, check, PO" />
            </label>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 lg:col-span-2">
              <input type="checkbox" checked={form.reimbursable} onChange={(e) => setForm((old) => ({ ...old, reimbursable: e.target.checked }))} />
              Reimburse tech
            </label>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 lg:col-span-2">
              <input type="checkbox" checked={form.billable_to_job} onChange={(e) => setForm((old) => ({ ...old, billable_to_job: e.target.checked }))} />
              Billable to job
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-3">
              Notes
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.notes} onChange={(e) => setForm((old) => ({ ...old, notes: e.target.value }))} placeholder="Optional internal note" />
            </label>
            <div className="flex items-end lg:col-span-1">
              <button className="w-full rounded-md bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-60" disabled={createExpense.isPending}>
                {createExpense.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
          {createExpense.error ? <p className="mt-3 text-sm font-semibold text-red-700">Could not save expense.</p> : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-12">
            <input className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-3" placeholder="Search description, ref, notes..." value={filters.q} onChange={(e) => { setPage(1); setFilters((old) => ({ ...old, q: e.target.value })) }} />
            <input className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" type="date" value={filters.date_from} onChange={(e) => { setPage(1); setFilters((old) => ({ ...old, date_from: e.target.value })) }} />
            <input className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" type="date" value={filters.date_to} onChange={(e) => { setPage(1); setFilters((old) => ({ ...old, date_to: e.target.value })) }} />
            <select className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" value={filters.category} onChange={(e) => { setPage(1); setFilters((old) => ({ ...old, category: e.target.value })) }}>
              <option value="">All categories</option>
              {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" value={filters.status} onChange={(e) => { setPage(1); setFilters((old) => ({ ...old, status: e.target.value })) }}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="recorded">Recorded</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" value={filters.vendor_id} onChange={(e) => { setPage(1); setFilters((old) => ({ ...old, vendor_id: e.target.value })) }}>
              <option value="">All vendors</option>
              {(vendorsQ.data?.data ?? []).map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.display_name || vendor.name}</option>
              ))}
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" value={filters.employee_account_id} onChange={(e) => { setPage(1); setFilters((old) => ({ ...old, employee_account_id: e.target.value })) }}>
              <option value="">All techs/staff</option>
              {(staffQ.data?.data ?? []).map((staff) => (
                <option key={staff.id} value={staff.id}>{staff.name || staff.email}</option>
              ))}
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" value={filters.reimbursement_status} onChange={(e) => { setPage(1); setFilters((old) => ({ ...old, reimbursement_status: e.target.value })) }}>
              <option value="">All reimbursement</option>
              <option value="pending">Pending reimbursement</option>
              <option value="approved">Approved</option>
              <option value="reimbursed">Reimbursed</option>
              <option value="rejected">Rejected</option>
              <option value="not_reimbursable">Not reimbursable</option>
            </select>
            <select
              className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-1"
              value={perPage}
              onChange={(e) => {
                setPage(1)
                setPerPage(e.target.value as typeof perPage)
              }}
            >
              <option value="10">10</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <button className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold lg:col-span-1" onClick={() => { setPage(1); setFilters({ q: '', date_from: '', date_to: today, category: '', status: '', vendor_id: '', employee_account_id: '', reimbursement_status: '' }) }}>
              Clear
            </button>
            <button
              className="rounded-md bg-slate-950 px-3 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 lg:col-span-2"
              disabled={expenses.length === 0}
              onClick={downloadVisibleExpenses}
              type="button"
            >
              Export visible
            </button>
          </div>
          {exportMessage ? (
            <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              {exportMessage}
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Expense</th>
                  <th className="px-4 py-3">Tech / staff</th>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Flags</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expensesQ.isLoading ? (
                  <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={9}>Loading expenses...</td></tr>
                ) : expenses.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={9}>No expenses in this filter.</td></tr>
                ) : expenses.map((expense) => (
                  <tr className="border-t border-slate-100" key={expense.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">{expense.expense_date}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{expense.description}</div>
                      <div className="text-xs text-slate-500">{expense.reference_number || expense.payment_method || expense.status}</div>
                      {expense.receipt_attachment_ids?.length ? (
                        <ReceiptLinks
                          attachments={expense.receipt_attachments}
                          fallbackIds={expense.receipt_attachment_ids}
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{expense.employee?.name || expense.employee?.email || 'Company'}</td>
                    <td className="px-4 py-3">
                      {expense.work_order ? (
                        <Link className="font-semibold text-amber-700 hover:underline" to={`/jobs/${expense.work_order.id}`}>
                          #{expense.work_order.job_number ?? expense.work_order.id}
                        </Link>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{expense.vendor?.display_name || expense.vendor?.name || 'None'}</td>
                    <td className="px-4 py-3">{labelForCategory(expense.category)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {expense.reimbursable ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">Reimburse</span> : null}
                        {expense.reimbursable ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold capitalize text-slate-700">{expense.reimbursement_status.replace('_', ' ')}</span> : null}
                        {expense.billable_to_job ? <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800">Billable</span> : null}
                        {!expense.reimbursable && !expense.billable_to_job ? <span className="text-xs text-slate-400">Overhead</span> : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold">{dollars(expense.amount_cents + expense.tax_cents)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {expense.reimbursable && expense.reimbursement_status === 'pending' ? (
                          <button
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800 disabled:opacity-60"
                            disabled={updateExpense.isPending}
                            onClick={() => updateExpense.mutate({ id: expense.id, payload: { reimbursement_status: 'approved', status: 'approved' } })}
                            type="button"
                          >
                            Approve
                          </button>
                        ) : null}
                        {expense.reimbursable && expense.reimbursement_status === 'pending' ? (
                          <button
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-800 disabled:opacity-60"
                            disabled={updateExpense.isPending}
                            onClick={() => updateExpense.mutate({ id: expense.id, payload: { reimbursement_status: 'rejected', status: 'recorded' } })}
                            type="button"
                          >
                            Reject
                          </button>
                        ) : null}
                        {expense.reimbursable && expense.reimbursement_status === 'approved' ? (
                          <button
                            className="rounded-md border border-slate-300 bg-slate-950 px-2 py-1 text-xs font-bold text-white disabled:opacity-60"
                            disabled={updateExpense.isPending}
                            onClick={() => updateExpense.mutate({ id: expense.id, payload: { reimbursement_status: 'reimbursed', status: 'paid' } })}
                            type="button"
                          >
                            Mark reimbursed
                          </button>
                        ) : null}
                        {expense.reimbursable && ['approved', 'rejected'].includes(expense.reimbursement_status) ? (
                          <button
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700 disabled:opacity-60"
                            disabled={updateExpense.isPending}
                            onClick={() => updateExpense.mutate({ id: expense.id, payload: { reimbursement_status: 'pending', status: 'recorded' } })}
                            type="button"
                          >
                            Reset
                          </button>
                        ) : null}
                        {expense.reimbursable && expense.reimbursement_status === 'reimbursed' ? (
                          <button
                            className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-bold text-amber-800 disabled:opacity-60"
                            disabled={reverseReimbursement.isPending}
                            onClick={() => reversePaidReimbursement(expense)}
                            type="button"
                          >
                            Reverse
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {meta?.total
                ? `Showing ${meta.from ?? 0}-${meta.to ?? 0} of ${meta.total}`
                : 'No rows'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold disabled:opacity-50"
                disabled={!meta || meta.current_page <= 1 || expensesQ.isFetching}
                onClick={() => setPage((old) => Math.max(1, old - 1))}
              >
                Previous
              </button>
              <span className="min-w-20 text-center font-semibold">
                Page {meta?.current_page ?? page} of {meta?.last_page ?? 1}
              </span>
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold disabled:opacity-50"
                disabled={!meta || meta.current_page >= meta.last_page || expensesQ.isFetching}
                onClick={() => setPage((old) => old + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function ReceiptLinks({
  attachments,
  fallbackIds,
}: {
  attachments?: ReceiptAttachment[]
  fallbackIds?: string[]
}) {
  if (attachments?.length) {
    return (
      <div className="mt-1 space-y-1">
        {attachments.map((attachment) =>
          attachment.url ? (
            <a
              key={attachment.id}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="block max-w-[260px] truncate text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline"
            >
              View {attachment.original_filename || 'receipt'}
            </a>
          ) : (
            <div key={attachment.id} className="max-w-[260px] truncate text-xs font-semibold text-slate-500">
              {attachment.original_filename || attachment.id}
            </div>
          ),
        )}
      </div>
    )
  }

  if (fallbackIds?.length) {
    return (
      <div className="mt-1 max-w-[260px] truncate text-xs font-semibold text-slate-500">
        Receipt file {fallbackIds[0]}
      </div>
    )
  }

  return null
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  )
}
