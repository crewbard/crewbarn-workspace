import { useEffect, useState } from 'react'
import {
  useVendors,
  useCreateVendor,
  useUpdateVendor,
  useDeleteVendor,
} from '@/hooks/useVendors'
import { Modal } from '@/components/ui/Modal'
import { ApiError, isDeleteCancelled } from '@/lib/api'
import { formatPhoneInput } from '@/lib/phone'
import type { Vendor, VendorInput } from '@/types/vendor'

/**
 * Vendors page (Tool Shed -> Inventory -> Vendors). Slice 16a.
 *
 * Per-tenant supplier directory. Replaces the coming-soon placeholder
 * with a real list + inline add/edit modal. Each vendor row will be
 * referenced by purchase_orders (16b) when that ships.
 */
export function VendorsPage() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, isError, error } = useVendors({
    q: debounced || undefined,
    per_page: 100,
  })
  const vendors = data?.data ?? []

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Vendors</h1>
          <p className="text-sm text-slate-600 mt-1">
            Suppliers you order inventory from. Purchase orders reference these.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium"
        >
          + New Vendor
        </button>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search vendors..."
        className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
      />

      {isError && (
        <div className="bg-white border border-red-200 rounded-xl shadow-sm p-6">
          <p className="text-sm text-red-700">
            Failed to load vendors.{error instanceof Error ? ` ${error.message}` : ''}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 animate-pulse">
          <div className="space-y-3">
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
          </div>
        </div>
      )}

      {!isLoading && !isError && vendors.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
          <p className="text-sm text-slate-600 mb-3">
            {debounced
              ? `No vendors match "${debounced}".`
              : 'No vendors yet.'}
          </p>
          {!debounced && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="text-sm font-medium text-amber-700 hover:underline"
            >
              + Add the first one
            </button>
          )}
        </div>
      )}

      {!isLoading && vendors.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-6 py-3 font-medium">Name</th>
                <th className="text-left px-6 py-3 font-medium">Phone</th>
                <th className="text-left px-6 py-3 font-medium">Email</th>
                <th className="text-left px-6 py-3 font-medium">Account #</th>
                <th className="text-center px-6 py-3 font-medium">Active</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {v.label}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    {v.phone || <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    {v.email || <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-600">
                    {v.account_number || <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {v.active ? (
                      <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(v)}
                      className="text-xs text-amber-700 hover:underline font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <VendorFormModal
          onClose={() => setShowCreate(false)}
        />
      )}
      {editing && (
        <VendorFormModal
          vendor={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ============================================================
// Vendor form modal (create + edit)
// ============================================================

function blankInput(): VendorInput {
  return {
    name: '',
    display_name: null,
    website: null,
    phone: null,
    email: null,
    billing_address_line1: null,
    billing_address_line2: null,
    billing_city: null,
    billing_state: null,
    billing_postal_code: null,
    billing_country: 'US',
    default_currency: 'USD',
    payment_terms: null,
    account_number: null,
    notes: null,
    active: true,
  }
}

function inputFromVendor(v: Vendor): VendorInput {
  return {
    name: v.name,
    display_name: v.display_name,
    website: v.website,
    phone: v.phone,
    email: v.email,
    billing_address_line1: v.billing_address.line1,
    billing_address_line2: v.billing_address.line2,
    billing_city: v.billing_address.city,
    billing_state: v.billing_address.state,
    billing_postal_code: v.billing_address.postal_code,
    billing_country: v.billing_address.country,
    default_currency: v.default_currency,
    payment_terms: v.payment_terms,
    account_number: v.account_number,
    notes: v.notes,
    active: v.active,
  }
}

function VendorFormModal({
  vendor,
  onClose,
}: {
  vendor?: Vendor
  onClose: () => void
}) {
  const isEdit = !!vendor
  const [form, setForm] = useState<VendorInput>(() =>
    vendor ? inputFromVendor(vendor) : blankInput()
  )
  const [error, setError] = useState<string | null>(null)
  const createMutation = useCreateVendor()
  const updateMutation = useUpdateVendor()
  const deleteMutation = useDeleteVendor()

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const canSave = !isPending && (form.name?.trim() ?? '').length > 0

  function set<K extends keyof VendorInput>(key: K, value: VendorInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setError(null)
    try {
      if (isEdit && vendor) {
        await updateMutation.mutateAsync({ id: vendor.id, input: form })
      } else {
        await createMutation.mutateAsync(form)
      }
      onClose()
    } catch (err) {
      setError(extractError(err))
    }
  }

  async function handleDelete() {
    if (!vendor) return
    setError(null)
    try {
      await deleteMutation.mutateAsync(vendor.id)
      onClose()
    } catch (err) {
      if (!isDeleteCancelled(err)) setError(extractError(err))
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEdit ? `Edit: ${vendor?.label ?? 'Vendor'}` : 'New Vendor'}
      size="lg"
    >
      <Modal.Body>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className={inputClass()}
                placeholder='e.g. "Schlage Lock Company"'
                autoFocus
              />
            </Field>
            <Field label="Display name (optional)">
              <input
                type="text"
                value={form.display_name ?? ''}
                onChange={(e) => set('display_name', e.target.value || null)}
                className={inputClass()}
                placeholder="Override label for printed POs"
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Phone">
              <input
                type="tel"
                value={form.phone ?? ''}
                onChange={(e) => set('phone', formatPhoneInput(e.target.value) || null)}
                className={inputClass()}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value || null)}
                className={inputClass()}
              />
            </Field>
            <Field label="Website">
              <input
                type="text"
                value={form.website ?? ''}
                onChange={(e) => set('website', e.target.value || null)}
                className={inputClass()}
                placeholder="https://..."
              />
            </Field>
          </div>

          <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mt-2">
            Billing address
          </h3>
          <Field label="Street line 1">
            <input
              type="text"
              value={form.billing_address_line1 ?? ''}
              onChange={(e) => set('billing_address_line1', e.target.value || null)}
              className={inputClass()}
            />
          </Field>
          <Field label="Street line 2">
            <input
              type="text"
              value={form.billing_address_line2 ?? ''}
              onChange={(e) => set('billing_address_line2', e.target.value || null)}
              className={inputClass()}
            />
          </Field>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <Field label="City">
                <input
                  type="text"
                  value={form.billing_city ?? ''}
                  onChange={(e) => set('billing_city', e.target.value || null)}
                  className={inputClass()}
                />
              </Field>
            </div>
            <Field label="State">
              <input
                type="text"
                value={form.billing_state ?? ''}
                onChange={(e) => set('billing_state', e.target.value.toUpperCase() || null)}
                className={inputClass()}
                maxLength={2}
                placeholder="FL"
              />
            </Field>
            <Field label="Zip">
              <input
                type="text"
                value={form.billing_postal_code ?? ''}
                onChange={(e) => set('billing_postal_code', e.target.value || null)}
                className={inputClass()}
              />
            </Field>
          </div>

          <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mt-2">
            Account terms
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Payment terms">
              <input
                type="text"
                value={form.payment_terms ?? ''}
                onChange={(e) => set('payment_terms', e.target.value || null)}
                className={inputClass()}
                placeholder='e.g. "Net 30"'
              />
            </Field>
            <Field label="Our account #">
              <input
                type="text"
                value={form.account_number ?? ''}
                onChange={(e) => set('account_number', e.target.value || null)}
                className={inputClass()}
                placeholder="(your account # with this vendor)"
              />
            </Field>
            <Field label="Currency">
              <input
                type="text"
                value={form.default_currency ?? 'USD'}
                onChange={(e) => set('default_currency', e.target.value.toUpperCase() || 'USD')}
                className={inputClass()}
                maxLength={3}
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value || null)}
              rows={2}
              className={inputClass() + ' resize-y'}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm pt-2 border-t border-slate-100">
            <input
              type="checkbox"
              checked={!!form.active}
              onChange={(e) => set('active', e.target.checked)}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span>{form.active ? 'Active' : 'Inactive'}</span>
          </label>

          {error && (
            <div className="text-xs text-red-600 px-3 py-2 bg-red-50 border border-red-100 rounded">
              {error}
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="text-sm px-3 py-2 text-red-600 hover:text-red-800 disabled:opacity-50 mr-auto"
          >
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="px-4 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving...' : isEdit ? 'Save changes' : 'Create vendor'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

function inputClass(): string {
  return 'w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return String(err)
}
