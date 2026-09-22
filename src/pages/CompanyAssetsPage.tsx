import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError } from '@/lib/api'
import { useCompanyAssets, useCreateCompanyAsset, useDeleteCompanyAsset, useUpdateCompanyAsset } from '@/hooks/useCompanyAssets'
import { useInventoryLocations } from '@/hooks/useInventoryLocations'
import { useTenantAccounts } from '@/hooks/useTenantAccounts'
import type { CompanyAsset, CompanyAssetAssignmentType, CompanyAssetInput } from '@/types/companyAsset'
import {
  COMPANY_ASSET_CATEGORIES,
  COMPANY_ASSET_CATEGORY_LABELS,
  COMPANY_ASSET_STATUSES,
  COMPANY_ASSET_STATUS_LABELS,
  type CompanyAssetCategory,
  type CompanyAssetStatus,
} from '@/types/companyAsset'

const inputCls = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500'

type FormState = {
  name: string
  category: CompanyAssetCategory
  status: CompanyAssetStatus
  manufacturer: string
  model: string
  serial_number: string
  asset_tag: string
  assignment_type: CompanyAssetAssignmentType
  assigned_account_id: string
  inventory_location_id: string
  capabilities_text: string
  capability_notes: string
  notes: string
  purchase_price: string
  current_value: string
  monthly_depreciation: string
  loan_balance: string
  monthly_payment: string
  interest_rate_percent: string
  payoff_date: string
  monthly_insurance_cost: string
  monthly_maintenance_cost: string
  fuel_type: string
  average_mpg: string
  average_fuel_price: string
  monthly_miles: string
  monthly_fuel_cost: string
  vehicle_wear_cost_per_mile: string
  service_radius_miles: string
  active: boolean
}

const emptyForm = (): FormState => ({
  name: '',
  category: 'tool',
  status: 'needs_confirmation',
  manufacturer: '',
  model: '',
  serial_number: '',
  asset_tag: '',
  assignment_type: 'unassigned',
  assigned_account_id: '',
  inventory_location_id: '',
  capabilities_text: '',
  capability_notes: '',
  notes: '',
  purchase_price: '',
  current_value: '',
  monthly_depreciation: '',
  loan_balance: '',
  monthly_payment: '',
  interest_rate_percent: '',
  payoff_date: '',
  monthly_insurance_cost: '',
  monthly_maintenance_cost: '',
  fuel_type: '',
  average_mpg: '',
  average_fuel_price: '',
  monthly_miles: '',
  monthly_fuel_cost: '',
  vehicle_wear_cost_per_mile: '',
  service_radius_miles: '',
  active: true,
})

function formFromAsset(asset: CompanyAsset): FormState {
  return {
    name: asset.name,
    category: asset.category,
    status: asset.status,
    manufacturer: asset.manufacturer ?? '',
    model: asset.model ?? '',
    serial_number: asset.serial_number ?? '',
    asset_tag: asset.asset_tag ?? '',
    assignment_type: asset.assignment_type,
    assigned_account_id: asset.assigned_account_id ?? '',
    inventory_location_id: asset.inventory_location_id ?? '',
    capabilities_text: (asset.capabilities ?? []).join(', '),
    capability_notes: asset.capability_notes ?? '',
    notes: asset.notes ?? '',
    purchase_price: numStr(asset.purchase_price),
    current_value: numStr(asset.current_value),
    monthly_depreciation: numStr(asset.monthly_depreciation),
    loan_balance: numStr(asset.loan_balance),
    monthly_payment: numStr(asset.monthly_payment),
    interest_rate_percent: numStr(asset.interest_rate_percent),
    payoff_date: asset.payoff_date ?? '',
    monthly_insurance_cost: numStr(asset.monthly_insurance_cost),
    monthly_maintenance_cost: numStr(asset.monthly_maintenance_cost),
    fuel_type: asset.fuel_type ?? '',
    average_mpg: numStr(asset.average_mpg),
    average_fuel_price: numStr(asset.average_fuel_price),
    monthly_miles: numStr(asset.monthly_miles),
    monthly_fuel_cost: numStr(asset.monthly_fuel_cost),
    vehicle_wear_cost_per_mile: numStr(asset.vehicle_wear_cost_per_mile),
    service_radius_miles: numStr(asset.service_radius_miles),
    active: asset.active,
  }
}

function formToInput(form: FormState): CompanyAssetInput {
  const capabilities = form.capabilities_text
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean)

  return {
    name: form.name.trim(),
    category: form.category,
    status: form.status,
    manufacturer: form.manufacturer.trim() || null,
    model: form.model.trim() || null,
    serial_number: form.serial_number.trim() || null,
    asset_tag: form.asset_tag.trim() || null,
    assignment_type: form.assignment_type,
    assigned_account_id: form.assignment_type === 'account' ? form.assigned_account_id || null : null,
    inventory_location_id:
      form.assignment_type === 'inventory_location' ? form.inventory_location_id || null : null,
    capabilities,
    capability_notes: form.capability_notes.trim() || null,
    notes: form.notes.trim() || null,
    purchase_price: parseNum(form.purchase_price),
    current_value: parseNum(form.current_value),
    monthly_depreciation: parseNum(form.monthly_depreciation),
    loan_balance: parseNum(form.loan_balance),
    monthly_payment: parseNum(form.monthly_payment),
    interest_rate_percent: parseNum(form.interest_rate_percent),
    payoff_date: form.payoff_date || null,
    monthly_insurance_cost: parseNum(form.monthly_insurance_cost),
    monthly_maintenance_cost: parseNum(form.monthly_maintenance_cost),
    fuel_type: form.fuel_type.trim() || null,
    average_mpg: parseNum(form.average_mpg),
    average_fuel_price: parseNum(form.average_fuel_price),
    monthly_miles: parseNum(form.monthly_miles),
    monthly_fuel_cost: parseNum(form.monthly_fuel_cost),
    vehicle_wear_cost_per_mile: parseNum(form.vehicle_wear_cost_per_mile),
    service_radius_miles: parseNum(form.service_radius_miles),
    active: form.active,
  }
}

export function CompanyAssetsPage() {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<CompanyAssetCategory | ''>('')
  const [status, setStatus] = useState<CompanyAssetStatus | ''>('')
  const [editing, setEditing] = useState<CompanyAsset | null>(null)
  const [creating, setCreating] = useState(false)

  const params = useMemo(() => ({ q, category, status, per_page: 100 }), [q, category, status])
  const assetsQuery = useCompanyAssets(params)
  const assets = assetsQuery.data?.data ?? []

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Company tools</p>
          <h1 className="text-3xl font-semibold text-slate-950">Company Assets</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Track the tools, vehicles, devices, and software your crew uses. Capability notes give dispatch and AI the context needed to match work to the right person.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
        >
          + Add company asset
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search tool, model, serial, tag, or capability"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as CompanyAssetCategory | '')}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
          >
            <option value="">All categories</option>
            {COMPANY_ASSET_CATEGORIES.map((value) => (
              <option key={value} value={value}>{COMPANY_ASSET_CATEGORY_LABELS[value]}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as CompanyAssetStatus | '')}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
          >
            <option value="">All statuses</option>
            {COMPANY_ASSET_STATUSES.map((value) => (
              <option key={value} value={value}>{COMPANY_ASSET_STATUS_LABELS[value]}</option>
            ))}
          </select>
        </div>
      </div>

      {assetsQuery.isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading assets...</div>
      )}

      {assetsQuery.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load company assets.
        </div>
      )}

      {!assetsQuery.isLoading && !assetsQuery.isError && (
        <AssetTable assets={assets} onEdit={setEditing} />
      )}

      {creating && <CompanyAssetModal onClose={() => setCreating(false)} />}
      {editing && <CompanyAssetModal asset={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function AssetTable({ assets, onEdit }: { assets: CompanyAsset[]; onEdit: (asset: CompanyAsset) => void }) {
  if (assets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="text-sm font-medium text-slate-800">No company assets yet.</p>
        <p className="mt-1 text-sm text-slate-500">Add tools manually now; onboarding and trade seeders can fill this later.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3 text-left">Asset</th>
            <th className="px-5 py-3 text-left">Status</th>
            <th className="px-5 py-3 text-left">Assigned</th>
            <th className="px-5 py-3 text-left">Capabilities</th>
            <th className="px-5 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assets.map((asset) => (
            <tr key={asset.id} className="hover:bg-slate-50">
              <td className="px-5 py-4 align-top">
                <div className="font-semibold text-slate-950">{asset.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {COMPANY_ASSET_CATEGORY_LABELS[asset.category]}
                  {asset.manufacturer ? ` - ${asset.manufacturer}` : ''}
                  {asset.model ? ` ${asset.model}` : ''}
                </div>
                {(asset.asset_tag || asset.serial_number) && (
                  <div className="mt-1 font-mono text-xs text-slate-500">
                    {asset.asset_tag ? `Tag ${asset.asset_tag}` : ''}
                    {asset.asset_tag && asset.serial_number ? ' - ' : ''}
                    {asset.serial_number ? `SN ${asset.serial_number}` : ''}
                  </div>
                )}
              </td>
              <td className="px-5 py-4 align-top">
                <span className={statusClass(asset.status)}>
                  {COMPANY_ASSET_STATUS_LABELS[asset.status]}
                </span>
                {!asset.active && <div className="mt-2 text-xs text-slate-400">Inactive</div>}
              </td>
              <td className="px-5 py-4 align-top text-slate-700">
                {asset.assigned_account?.display_name ||
                  asset.inventory_location?.display_label ||
                  <span className="text-slate-400">Unassigned</span>}
              </td>
              <td className="px-5 py-4 align-top">
                {asset.capabilities.length > 0 ? (
                  <div className="flex max-w-xl flex-wrap gap-1.5">
                    {asset.capabilities.slice(0, 6).map((capability) => (
                      <span key={capability} className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-800">
                        {capability}
                      </span>
                    ))}
                    {asset.capabilities.length > 6 && (
                      <span className="text-xs text-slate-400">+{asset.capabilities.length - 6}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-400">No capability tags</span>
                )}
                {asset.capability_notes && (
                  <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500 line-clamp-2">{asset.capability_notes}</p>
                )}
              </td>
              <td className="px-5 py-4 text-right align-top">
                <button
                  type="button"
                  onClick={() => onEdit(asset)}
                  className="text-sm font-medium text-amber-700 hover:text-amber-900"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CompanyAssetModal({ asset, onClose }: { asset?: CompanyAsset; onClose: () => void }) {
  const [form, setForm] = useState<FormState>(() => (asset ? formFromAsset(asset) : emptyForm()))
  const createMutation = useCreateCompanyAsset()
  const updateMutation = useUpdateCompanyAsset()
  const deleteMutation = useDeleteCompanyAsset()
  const accountsQuery = useTenantAccounts('', 200)
  const locationsQuery = useInventoryLocations({ per_page: 200, active: true })

  const accounts = accountsQuery.data ?? []
  const locations = locationsQuery.data?.data ?? []
  const isSaving = createMutation.isPending || updateMutation.isPending
  const canSave = form.name.trim().length > 0 && !isSaving

  const error = createMutation.error || updateMutation.error || deleteMutation.error
  const errorMessage = error
    ? error instanceof ApiError
      ? error.message
      : 'Could not save company asset.'
    : null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const input = formToInput(form)
    if (asset) {
      updateMutation.mutate({ id: asset.id, input }, { onSuccess: onClose })
    } else {
      createMutation.mutate(input, { onSuccess: onClose })
    }
  }

  const handleDelete = () => {
    if (!asset) return
    deleteMutation.mutate(asset.id, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <form onSubmit={submit} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{asset ? `Edit ${asset.name}` : 'Add company asset'}</h2>
            <p className="mt-1 text-xs text-slate-500">Tools, vehicles, software, and equipment your company owns.</p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-slate-700" aria-label="Close">x</button>
        </div>

        <div className="overflow-y-auto p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <Field label="Name" required>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputCls} autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as CompanyAssetCategory })} className={`${inputCls} bg-white`}>
                  {COMPANY_ASSET_CATEGORIES.map((value) => (
                    <option key={value} value={value}>{COMPANY_ASSET_CATEGORY_LABELS[value]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CompanyAssetStatus })} className={`${inputCls} bg-white`}>
                  {COMPANY_ASSET_STATUSES.map((value) => (
                    <option key={value} value={value}>{COMPANY_ASSET_STATUS_LABELS[value]}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Manufacturer">
              <input value={form.manufacturer} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} className={inputCls} />
            </Field>
            <Field label="Model">
              <input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} className={inputCls} />
            </Field>
            <Field label="Serial number">
              <input value={form.serial_number} onChange={(event) => setForm({ ...form, serial_number: event.target.value })} className={`${inputCls} font-mono`} />
            </Field>
            <Field label="Asset tag">
              <input value={form.asset_tag} onChange={(event) => setForm({ ...form, asset_tag: event.target.value })} className={`${inputCls} font-mono`} />
            </Field>

            <Field label="Assignment">
              <select value={form.assignment_type} onChange={(event) => setForm({ ...form, assignment_type: event.target.value as CompanyAssetAssignmentType })} className={`${inputCls} bg-white`}>
                <option value="unassigned">Unassigned</option>
                <option value="account">Assign to staff/tech</option>
                <option value="inventory_location">Assign to truck/location</option>
              </select>
            </Field>
            {form.assignment_type === 'account' && (
              <Field label="Staff/tech">
                <select value={form.assigned_account_id} onChange={(event) => setForm({ ...form, assigned_account_id: event.target.value })} className={`${inputCls} bg-white`}>
                  <option value="">Select staff member</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </Field>
            )}
            {form.assignment_type === 'inventory_location' && (
              <Field label="Truck/location">
                <select value={form.inventory_location_id} onChange={(event) => setForm({ ...form, inventory_location_id: event.target.value })} className={`${inputCls} bg-white`}>
                  <option value="">Select location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.display_label}</option>
                  ))}
                </select>
              </Field>
            )}

            <div className="lg:col-span-2">
              <Field label="Capability tags">
                <textarea
                  value={form.capabilities_text}
                  onChange={(event) => setForm({ ...form, capabilities_text: event.target.value })}
                  rows={2}
                  placeholder="car unlocks, key programming, EEPROM, high security keys"
                  className={`${inputCls} resize-y`}
                />
                <p className="mt-1 text-xs text-slate-500">Comma or line separated. These are compact AI matching tags.</p>
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field label="Capability notes">
                <textarea
                  value={form.capability_notes}
                  onChange={(event) => setForm({ ...form, capability_notes: event.target.value })}
                  rows={4}
                  placeholder="Describe what this tool or software can actually do, including limits and supported systems."
                  className={`${inputCls} resize-y`}
                />
              </Field>
            </div>

            <div className="lg:col-span-2">
              <Field label="Internal notes">
                <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} className={`${inputCls} resize-y`} />
              </Field>
            </div>

            <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-950">Cost model inputs</h3>
              <p className="mt-1 text-xs text-slate-500">Monthly payment, depreciation, insurance, maintenance, and fuel are counted in the company cost model.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <NumberField label="Purchase price" value={form.purchase_price} onChange={(value) => setForm({ ...form, purchase_price: value })} />
                <NumberField label="Current value" value={form.current_value} onChange={(value) => setForm({ ...form, current_value: value })} />
                <NumberField label="Monthly depreciation" value={form.monthly_depreciation} onChange={(value) => setForm({ ...form, monthly_depreciation: value })} />
                <NumberField label="Loan balance" value={form.loan_balance} onChange={(value) => setForm({ ...form, loan_balance: value })} />
                <NumberField label="Monthly payment" value={form.monthly_payment} onChange={(value) => setForm({ ...form, monthly_payment: value })} />
                <NumberField label="Interest %" value={form.interest_rate_percent} onChange={(value) => setForm({ ...form, interest_rate_percent: value })} />
                <Field label="Payoff date">
                  <input type="date" value={form.payoff_date} onChange={(event) => setForm({ ...form, payoff_date: event.target.value })} className={inputCls} />
                </Field>
                <NumberField label="Insurance / mo" value={form.monthly_insurance_cost} onChange={(value) => setForm({ ...form, monthly_insurance_cost: value })} />
                <NumberField label="Maintenance / mo" value={form.monthly_maintenance_cost} onChange={(value) => setForm({ ...form, monthly_maintenance_cost: value })} />
                <Field label="Fuel type">
                  <input value={form.fuel_type} onChange={(event) => setForm({ ...form, fuel_type: event.target.value })} placeholder="gas, diesel, electric" className={inputCls} />
                </Field>
                <NumberField label="Average MPG" value={form.average_mpg} onChange={(value) => setForm({ ...form, average_mpg: value })} />
                <NumberField label="Fuel price" value={form.average_fuel_price} onChange={(value) => setForm({ ...form, average_fuel_price: value })} />
                <NumberField label="Monthly miles" value={form.monthly_miles} onChange={(value) => setForm({ ...form, monthly_miles: value })} />
                <NumberField label="Fuel / mo" value={form.monthly_fuel_cost} onChange={(value) => setForm({ ...form, monthly_fuel_cost: value })} />
                <NumberField label="Wear / mile" value={form.vehicle_wear_cost_per_mile} onChange={(value) => setForm({ ...form, vehicle_wear_cost_per_mile: value })} />
                <NumberField label="Service radius" value={form.service_radius_miles} onChange={(value) => setForm({ ...form, service_radius_miles: value })} />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-amber-500" />
              Active
            </label>
          </div>
          {errorMessage && <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          {asset && (
            <button type="button" onClick={handleDelete} disabled={deleteMutation.isPending} className="mr-auto text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50">
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={!canSave} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:bg-slate-300">
            {isSaving ? 'Saving...' : asset ? 'Save changes' : 'Create asset'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}{required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <input type="number" min={0} step="0.01" value={value} onChange={(event) => onChange(event.target.value)} className={inputCls} />
    </Field>
  )
}

function numStr(value: number | null | undefined): string {
  return value == null ? '' : String(value)
}

function parseNum(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function statusClass(status: CompanyAssetStatus): string {
  const base = 'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold'
  if (status === 'active') return `${base} bg-emerald-50 text-emerald-700`
  if (status === 'needs_confirmation') return `${base} bg-amber-50 text-amber-800`
  if (status === 'maintenance') return `${base} bg-blue-50 text-blue-700`
  if (status === 'lost') return `${base} bg-red-50 text-red-700`
  return `${base} bg-slate-100 text-slate-600`
}
