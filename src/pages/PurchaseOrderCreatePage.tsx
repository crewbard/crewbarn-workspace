import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreatePurchaseOrder } from '@/hooks/usePurchaseOrders'
import { useVendors } from '@/hooks/useVendors'
import { ApiError } from '@/lib/api'
import { tenantDate, useTenantTimezone } from '@/hooks/useTenantTime'
import type { PurchaseOrderInput } from '@/types/purchaseOrder'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'

/**
 * Purchase order create — header-only flow. Line items are added on the
 * detail page after the PO exists (mirrors WO behavior). Vendor must be
 * picked from existing vendors; create-vendor flow lives at /vendors.
 */
export function PurchaseOrderCreatePage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const navigate = useNavigate()
  const vendorsQuery = useVendors({ active: true, per_page: 200 })
  const createMutation = useCreatePurchaseOrder()
  const tenantTimezone = useTenantTimezone()

  const [form, setForm] = useState<PurchaseOrderInput>({
    vendor_id: '',
    vendor_order_number: null,
    order_date: tenantDate(tenantTimezone),
    expected_delivery: null,
    tax_cents: null,
    shipping_cents: null,
    currency: 'USD',
    notes: null,
    status: 'draft',
  })
  useEffect(() => {
    setForm((current) => ({ ...current, order_date: tenantDate(tenantTimezone) }))
  }, [tenantTimezone])

  const [error, setError] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({})

  function set<K extends keyof PurchaseOrderInput>(key: K, value: PurchaseOrderInput[K]) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  function dollarsToCents(s: string): number | null {
    const t = s.trim()
    if (!t) return null
    const n = Number(t)
    if (Number.isNaN(n)) return null
    return Math.round(n * 100)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setServerErrors({})
    if (!form.vendor_id) {
      setError('Please select a vendor.')
      return
    }
    try {
      const po = await createMutation.mutateAsync(form)
      navigate(`/purchase-orders/${po.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const details = err.details as { errors?: Record<string, string[]> } | undefined
        if (details?.errors) {
          setServerErrors(details.errors)
        } else {
          setError(err.message)
        }
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
  }

  const vendors = vendorsQuery.data?.data ?? []

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      {easy ? <EasyPageHeading title="Start a purchase order" description="Choose the vendor and delivery details first. Save the draft, then add its items on the next screen." /> : <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">New Purchase Order</h1>
        <p className="text-sm text-slate-600 mt-1">
          Create a draft PO. You'll add line items on the next screen.
        </p>
      </div>}

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-lg p-6 space-y-5"
      >
        <Field label="Vendor" required error={serverErrors.vendor_id?.[0]}>
          {vendorsQuery.isLoading ? (
            <div className="text-sm text-slate-500">Loading vendors…</div>
          ) : vendorsQuery.isError ? (
            <div role="alert" className="text-sm text-red-700">Vendors could not be loaded.
              <button type="button" disabled={vendorsQuery.isFetching} onClick={() => void vendorsQuery.refetch()} className="ml-2 underline disabled:opacity-50">Retry</button>
            </div>
          ) : vendors.length === 0 ? (
            <div className="text-sm text-amber-700">
              No vendors yet.{' '}
              <button
                type="button"
                onClick={() => navigate('/vendors')}
                className="underline font-medium"
              >
                Add one first
              </button>
              .
            </div>
          ) : (
            <select
              value={form.vendor_id}
              aria-label="Vendor"
              onChange={(e) => set('vendor_id', e.target.value)}
              className={inputClass()}
              required
            >
              <option value="">— Select a vendor —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          label="Vendor order # (their confirmation/order number)"
          error={serverErrors.vendor_order_number?.[0]}
        >
          <input
            type="text"
            value={form.vendor_order_number ?? ''}
            onChange={(e) => set('vendor_order_number', e.target.value || null)}
            className={inputClass()}
            placeholder='e.g. "AB12345" — printed on sticker, snapshotted to each unit on receive'
            maxLength={100}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Order date" error={serverErrors.order_date?.[0]}>
            <input
              type="date"
              value={form.order_date ?? ''}
              onChange={(e) => set('order_date', e.target.value || null)}
              className={inputClass()}
            />
          </Field>
          <Field label="Expected delivery" error={serverErrors.expected_delivery?.[0]}>
            <input
              type="date"
              value={form.expected_delivery ?? ''}
              onChange={(e) => set('expected_delivery', e.target.value || null)}
              className={inputClass()}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Tax ($)" error={serverErrors.tax_cents?.[0]}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.tax_cents == null ? '' : (form.tax_cents / 100).toFixed(2)}
              onChange={(e) => set('tax_cents', dollarsToCents(e.target.value))}
              className={inputClass()}
              placeholder="0.00"
            />
          </Field>
          <Field label="Shipping ($)" error={serverErrors.shipping_cents?.[0]}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.shipping_cents == null ? '' : (form.shipping_cents / 100).toFixed(2)}
              onChange={(e) => set('shipping_cents', dollarsToCents(e.target.value))}
              className={inputClass()}
              placeholder="0.00"
            />
          </Field>
          <Field label="Currency" error={serverErrors.currency?.[0]}>
            <input
              type="text"
              maxLength={3}
              value={form.currency ?? 'USD'}
              onChange={(e) => set('currency', e.target.value.toUpperCase() || 'USD')}
              className={inputClass()}
            />
          </Field>
        </div>

        <Field label="Notes" error={serverErrors.notes?.[0]}>
          <textarea
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value || null)}
            rows={3}
            className={inputClass() + ' resize-y'}
            placeholder="Internal notes for this PO"
          />
        </Field>

        {error && (
          <div className="text-sm text-red-600 px-3 py-2 bg-red-50 border border-red-100 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/purchase-orders')}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Create PO'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

function inputClass(): string {
  return 'w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
}
