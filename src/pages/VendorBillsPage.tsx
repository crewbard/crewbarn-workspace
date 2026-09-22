import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { tenantDate, useTenantTimezone } from '@/hooks/useTenantTime'

type VendorBill = {
  id: string
  bill_number?: string | null
  vendor_name?: string | null
  bill_date: string
  due_date?: string | null
  category: string
  status: string
  total_cents: number
  amount_paid_cents: number
  balance_cents: number
  payment_terms?: string | null
  memo?: string | null
  vendor?: { id: string; name: string; display_name?: string | null } | null
  purchase_order?: { id: string; po_number?: string | null } | null
}

type VendorOption = {
  id: string
  name: string
  display_name?: string | null
}

const statuses = [
  ['', 'All statuses'],
  ['open', 'Open'],
  ['partially_paid', 'Partially paid'],
  ['paid', 'Paid'],
  ['draft', 'Draft'],
  ['void', 'Void'],
] as const

const categories = [
  ['parts_materials', 'Parts / materials'],
  ['subcontractor', 'Subcontractor'],
  ['fuel', 'Fuel'],
  ['vehicle', 'Vehicle'],
  ['rent', 'Rent'],
  ['insurance', 'Insurance'],
  ['software', 'Software'],
  ['tools_equipment', 'Tools / equipment'],
  ['office', 'Office'],
  ['other', 'Other'],
] as const

function dollars(cents: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100)
}

function vendorLabel(bill: VendorBill) {
  return bill.vendor?.display_name || bill.vendor?.name || bill.vendor_name || 'No vendor'
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ')
}

export function VendorBillsPage() {
  const queryClient = useQueryClient()
  const tenantTimezone = useTenantTimezone()
  const today = tenantDate(tenantTimezone)
  const [filters, setFilters] = useState({
    q: '',
    status: '',
    date_from: today.slice(0, 8) + '01',
    date_to: today,
  })
  const [form, setForm] = useState({
    vendor_id: '',
    vendor_name: '',
    bill_number: '',
    bill_date: today,
    due_date: '',
    category: 'parts_materials',
    total: '',
    tax: '',
    payment_terms: '',
    memo: '',
  })
  useEffect(() => {
    setFilters((current) => ({ ...current, date_from: today.slice(0, 8) + '01', date_to: today }))
    setForm((current) => ({ ...current, bill_date: today }))
  }, [today])

  const [paymentByBill, setPaymentByBill] = useState<Record<string, string>>({})

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ per_page: '50' })
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    return params.toString()
  }, [filters])

  const billsQ = useQuery({
    queryKey: ['vendor-bills', queryString],
    queryFn: () => apiRequest<{ data: VendorBill[] }>(`/v1/vendor-bills?${queryString}`),
  })

  const vendorsQ = useQuery({
    queryKey: ['bill-vendors'],
    queryFn: () => apiRequest<{ data: VendorOption[] }>('/v1/vendors?per_page=100&active=true'),
  })

  const createBill = useMutation({
    mutationFn: (payload: typeof form) =>
      apiRequest<{ data: VendorBill }>('/v1/vendor-bills', {
        method: 'POST',
        body: {
          ...payload,
          vendor_id: payload.vendor_id || null,
          vendor_name: payload.vendor_id ? null : payload.vendor_name || null,
          due_date: payload.due_date || null,
          total: Number(payload.total || 0),
          tax: Number(payload.tax || 0),
          payment_terms: payload.payment_terms || null,
          memo: payload.memo || null,
        },
      }),
    onSuccess: () => {
      setForm({
        vendor_id: '',
        vendor_name: '',
        bill_number: '',
        bill_date: today,
        due_date: '',
        category: 'parts_materials',
        total: '',
        tax: '',
        payment_terms: '',
        memo: '',
      })
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] })
    },
  })

  const recordPayment = useMutation({
    mutationFn: ({ bill, amount }: { bill: VendorBill; amount: string }) =>
      apiRequest<{ data: VendorBill }>(`/v1/vendor-bills/${bill.id}/payments`, {
        method: 'POST',
        body: {
          paid_at: today,
          amount: Number(amount || bill.balance_cents / 100),
          payment_method: 'Manual',
        },
      }),
    onSuccess: () => {
      setPaymentByBill({})
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] })
    },
  })

  const bills = billsQ.data?.data ?? []
  const openBills = bills.filter((bill) => !['paid', 'void'].includes(bill.status))
  const openTotal = openBills.reduce((sum, bill) => sum + bill.balance_cents, 0)
  const overdueTotal = openBills
    .filter((bill) => bill.due_date && bill.due_date < today)
    .reduce((sum, bill) => sum + bill.balance_cents, 0)

  function submit(event: FormEvent) {
    event.preventDefault()
    createBill.mutate(form)
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-4 text-slate-950 sm:px-6 sm:py-6 2xl:px-8">
      <div className="mx-auto w-full max-w-none space-y-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Accounting</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Vendor Bills</h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Track what the company owes vendors, when bills are due, and when each bill is paid.
            </p>
          </div>
          <Link className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm" to="/accounting/expenses">
            Back to expenses
          </Link>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <SummaryTile label="Bills in filter" value={String(bills.length)} />
          <SummaryTile label="Open AP" value={dollars(openTotal)} tone="amber" />
          <SummaryTile label="Overdue AP" value={dollars(overdueTotal)} tone="red" />
          <SummaryTile label="Paid in filter" value={dollars(bills.reduce((sum, bill) => sum + bill.amount_paid_cents, 0))} tone="green" />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Add vendor bill</h2>
          <form className="mt-4 grid gap-3 lg:grid-cols-12" onSubmit={submit}>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Vendor
              <select className="rounded-md border border-slate-300 px-3 py-2" value={form.vendor_id} onChange={(event) => setForm((old) => ({ ...old, vendor_id: event.target.value }))}>
                <option value="">Manual vendor</option>
                {(vendorsQ.data?.data ?? []).map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.display_name || vendor.name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Vendor name
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.vendor_name} onChange={(event) => setForm((old) => ({ ...old, vendor_name: event.target.value }))} placeholder="Vendor name" disabled={Boolean(form.vendor_id)} />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Bill #
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.bill_number} onChange={(event) => setForm((old) => ({ ...old, bill_number: event.target.value }))} placeholder="Invoice / bill #" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Bill date
              <input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={form.bill_date} onChange={(event) => setForm((old) => ({ ...old, bill_date: event.target.value }))} required />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Due date
              <input className="rounded-md border border-slate-300 px-3 py-2" type="date" value={form.due_date} onChange={(event) => setForm((old) => ({ ...old, due_date: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Category
              <select className="rounded-md border border-slate-300 px-3 py-2" value={form.category} onChange={(event) => setForm((old) => ({ ...old, category: event.target.value }))}>
                {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Total
              <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" value={form.total} onChange={(event) => setForm((old) => ({ ...old, total: event.target.value }))} placeholder="0.00" required />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Tax
              <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" value={form.tax} onChange={(event) => setForm((old) => ({ ...old, tax: event.target.value }))} placeholder="0.00" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Terms
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.payment_terms} onChange={(event) => setForm((old) => ({ ...old, payment_terms: event.target.value }))} placeholder="Net 30" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-5">
              Memo
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.memo} onChange={(event) => setForm((old) => ({ ...old, memo: event.target.value }))} placeholder="Parts, PO note, bookkeeper note..." />
            </label>
            <div className="flex items-end lg:col-span-1">
              <button className="w-full rounded-md bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-60" disabled={createBill.isPending}>
                {createBill.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
          {createBill.error ? <p className="mt-3 text-sm font-semibold text-red-700">Could not save vendor bill.</p> : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-12">
            <input className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-4" placeholder="Search vendor, bill #, memo..." value={filters.q} onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))} />
            <select className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}>
              {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" type="date" value={filters.date_from} onChange={(event) => setFilters((old) => ({ ...old, date_from: event.target.value }))} />
            <input className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" type="date" value={filters.date_to} onChange={(event) => setFilters((old) => ({ ...old, date_to: event.target.value }))} />
            <button className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold lg:col-span-2" onClick={() => setFilters({ q: '', status: '', date_from: '', date_to: today })}>
              Clear
            </button>
          </div>
          <div className="grid gap-3 p-4 xl:grid-cols-2">
            {billsQ.isLoading ? (
              <p className="rounded-lg border border-slate-200 p-6 text-center text-slate-500 xl:col-span-2">Loading vendor bills...</p>
            ) : bills.length === 0 ? (
              <p className="rounded-lg border border-slate-200 p-6 text-center text-slate-500 xl:col-span-2">No vendor bills in this filter.</p>
            ) : bills.map((bill) => (
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={bill.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{bill.bill_number || bill.id}</div>
                    <h3 className="mt-1 text-lg font-black">{vendorLabel(bill)}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Bill {bill.bill_date} {bill.due_date ? `· Due ${bill.due_date}` : ''} {bill.purchase_order?.po_number ? `· PO ${bill.purchase_order.po_number}` : ''}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${bill.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : bill.status === 'void' ? 'bg-slate-200 text-slate-500' : 'bg-amber-100 text-amber-800'}`}>
                    {statusLabel(bill.status)}
                  </span>
                </div>
                {bill.memo ? <p className="mt-3 text-sm text-slate-600">{bill.memo}</p> : null}
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <MoneyBox label="Total" value={dollars(bill.total_cents)} />
                  <MoneyBox label="Paid" value={dollars(bill.amount_paid_cents)} />
                  <MoneyBox label="Balance" value={dollars(bill.balance_cents)} />
                </div>
                {bill.balance_cents > 0 && bill.status !== 'void' ? (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2"
                      inputMode="decimal"
                      value={paymentByBill[bill.id] ?? ''}
                      onChange={(event) => setPaymentByBill((old) => ({ ...old, [bill.id]: event.target.value }))}
                      placeholder={String((bill.balance_cents / 100).toFixed(2))}
                    />
                    <button
                      className="rounded-md bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-60"
                      disabled={recordPayment.isPending}
                      onClick={() => recordPayment.mutate({ bill, amount: paymentByBill[bill.id] ?? '' })}
                    >
                      Record payment
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function SummaryTile({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'amber' | 'red' | 'green' }) {
  const color = {
    slate: 'text-slate-950',
    amber: 'text-amber-700',
    red: 'text-red-700',
    green: 'text-emerald-700',
  }[tone]

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-black ${color}`}>{value}</div>
    </div>
  )
}

function MoneyBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-black">{value}</div>
    </div>
  )
}
