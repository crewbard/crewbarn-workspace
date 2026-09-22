import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import {
  createCompanyCostEntry,
  deleteCompanyCostEntry,
  getCompanyCostModel,
  updateCompanyCostEntry,
  updateCompanyCostModelSettings,
} from '@/lib/companyCostModel'
import {
  COMPANY_COST_ENTRY_TYPES,
  COMPANY_COST_ENTRY_TYPE_LABELS,
  type CompanyCostEntry,
  type CompanyCostEntryInput,
  type CompanyCostEntryType,
  type TenantCostModelSettings,
} from '@/types/companyCostModel'
import { PERM, usePermissions } from '@/hooks/usePermissions'

const inputCls = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'

type EntryForm = {
  type: CompanyCostEntryType
  category: string
  name: string
  monthly_amount: string
  annual_amount: string
  current_balance: string
  minimum_payment: string
  interest_rate_percent: string
  trade: string
  fixed: boolean
  active: boolean
  notes: string
}

type SettingsForm = {
  target_gross_margin_percent: string
  target_net_margin_percent: string
  minimum_job_profit: string
  minimum_service_call: string
  after_hours_multiplier: string
  default_material_markup_percent: string
  default_labor_markup_percent: string
  expected_monthly_billable_hours: string
}

const emptyEntry = (): EntryForm => ({
  type: 'operating',
  category: 'general',
  name: '',
  monthly_amount: '',
  annual_amount: '',
  current_balance: '',
  minimum_payment: '',
  interest_rate_percent: '',
  trade: '',
  fixed: true,
  active: true,
  notes: '',
})

export function CompanyCostModelPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<CompanyCostEntry | 'new' | null>(null)
  const { has } = usePermissions()
  const canEdit = has(PERM.SETTINGS_EDIT)
  const query = useQuery({
    queryKey: ['company-cost-model'],
    queryFn: getCompanyCostModel,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['company-cost-model'] })
  const summary = query.data?.summary
  const entries = query.data?.entries ?? []
  const activeEntries = entries.filter((entry) => entry.active)
  const inactiveEntries = entries.filter((entry) => !entry.active)

  const suggestedHourly = useMemo(() => {
    const totals = summary?.totals
    if (!totals?.break_even_hourly_rate) return null
    const margin = totals.target_gross_margin_percent ?? 0
    if (margin <= 0 || margin >= 95) return totals.break_even_hourly_rate
    return totals.break_even_hourly_rate / (1 - margin / 100)
  }, [summary])

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pricing intelligence</p>
          <h1 className="text-3xl font-semibold text-slate-950">Company Cost Model</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Track overhead, payroll burden, fuel, debt, inventory carrying cost, and target margins so AI can suggest prices from real business costs.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            + Add cost
          </button>
        )}
      </div>

      {query.isLoading && <Panel>Loading cost model...</Panel>}
      {query.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load the cost model. This page requires revenue visibility.
        </div>
      )}

      {summary && (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Metric label="Monthly overhead" value={money(summary.totals.fixed_monthly_cost)} />
            <Metric label="Cost entries" value={money(summary.totals.monthly_cost_entries)} />
            <Metric label="Company assets" value={money(summary.totals.monthly_company_assets)} />
            <Metric label="Break-even / hr" value={summary.totals.break_even_hourly_rate == null ? 'Set hours' : money(summary.totals.break_even_hourly_rate)} />
            <Metric label="Target / hr" value={suggestedHourly == null ? 'Set margin' : money(suggestedHourly)} highlight />
          </div>

          <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
            <SettingsPanel settings={summary.settings} onSaved={refresh} canEdit={canEdit} />
            <div className="space-y-4">
              <CostBreakdown byType={summary.breakdown.by_type} assetMonthly={summary.breakdown.assets.monthly_total} />
              <EntriesPanel entries={activeEntries} onEdit={setEditing} canEdit={canEdit} />
              {inactiveEntries.length > 0 && (
                <EntriesPanel title="Inactive Costs" entries={inactiveEntries} onEdit={setEditing} canEdit={canEdit} muted />
              )}
            </div>
          </div>
        </>
      )}

      {editing && (
        <EntryModal
          entry={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function SettingsPanel({ settings, onSaved, canEdit }: { settings: TenantCostModelSettings; onSaved: () => void; canEdit: boolean }) {
  const [form, setForm] = useState<SettingsForm>(() => ({
    target_gross_margin_percent: str(settings.target_gross_margin_percent),
    target_net_margin_percent: str(settings.target_net_margin_percent),
    minimum_job_profit: str(settings.minimum_job_profit),
    minimum_service_call: str(settings.minimum_service_call),
    after_hours_multiplier: str(settings.after_hours_multiplier),
    default_material_markup_percent: str(settings.default_material_markup_percent),
    default_labor_markup_percent: str(settings.default_labor_markup_percent),
    expected_monthly_billable_hours: str(settings.expected_monthly_billable_hours),
  }))
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => updateCompanyCostModelSettings({
      target_gross_margin_percent: num(form.target_gross_margin_percent),
      target_net_margin_percent: num(form.target_net_margin_percent),
      minimum_job_profit: num(form.minimum_job_profit),
      minimum_service_call: num(form.minimum_service_call),
      after_hours_multiplier: num(form.after_hours_multiplier),
      default_material_markup_percent: num(form.default_material_markup_percent),
      default_labor_markup_percent: num(form.default_labor_markup_percent),
      expected_monthly_billable_hours: num(form.expected_monthly_billable_hours),
    }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not save settings.'),
  })

  return (
    <Panel>
      <h2 className="text-base font-semibold text-slate-950">Pricing Assumptions</h2>
      <p className="mt-1 text-xs text-slate-500">These settings turn monthly overhead into break-even and target hourly rates.</p>
      <div className="mt-4 grid gap-3">
        <NumberField label="Expected monthly billable hours" value={form.expected_monthly_billable_hours} onChange={(v) => setForm({ ...form, expected_monthly_billable_hours: v })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Gross margin %" value={form.target_gross_margin_percent} onChange={(v) => setForm({ ...form, target_gross_margin_percent: v })} />
          <NumberField label="Net margin %" value={form.target_net_margin_percent} onChange={(v) => setForm({ ...form, target_net_margin_percent: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Minimum job profit" value={form.minimum_job_profit} onChange={(v) => setForm({ ...form, minimum_job_profit: v })} />
          <NumberField label="Minimum service call" value={form.minimum_service_call} onChange={(v) => setForm({ ...form, minimum_service_call: v })} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <NumberField label="After-hours x" value={form.after_hours_multiplier} onChange={(v) => setForm({ ...form, after_hours_multiplier: v })} />
          <NumberField label="Material markup %" value={form.default_material_markup_percent} onChange={(v) => setForm({ ...form, default_material_markup_percent: v })} />
          <NumberField label="Labor markup %" value={form.default_labor_markup_percent} onChange={(v) => setForm({ ...form, default_labor_markup_percent: v })} />
        </div>
      </div>
      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      <div className="mt-4 flex justify-end">
        {canEdit ? (
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {save.isPending ? 'Saving...' : 'Save assumptions'}
          </button>
        ) : (
          <span className="text-xs text-slate-500">Read-only</span>
        )}
      </div>
    </Panel>
  )
}

function CostBreakdown({ byType, assetMonthly }: { byType: Record<string, { count: number; monthly_total: number }>; assetMonthly: number }) {
  const rows = Object.entries(byType).sort((a, b) => b[1].monthly_total - a[1].monthly_total)
  return (
    <Panel>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-950">Monthly Breakdown</h2>
        <span className="text-xs text-slate-500">Company assets: {money(assetMonthly)}</span>
      </div>
      {rows.length === 0 ? (
        <div className="mt-3 text-sm text-slate-500">No cost entries yet.</div>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {rows.map(([type, row]) => (
            <div key={type} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-800">{labelForType(type)}</span>
                <span className="text-sm font-semibold text-slate-950">{money(row.monthly_total)}</span>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{row.count} active {row.count === 1 ? 'item' : 'items'}</div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

function EntriesPanel({ entries, onEdit, canEdit, title = 'Active Costs', muted = false }: { entries: CompanyCostEntry[]; onEdit: (entry: CompanyCostEntry) => void; canEdit: boolean; title?: string; muted?: boolean }) {
  return (
    <Panel className={muted ? 'opacity-80' : ''}>
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      {entries.length === 0 ? (
        <div className="mt-3 rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No costs entered yet.</div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Cost</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Monthly</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-950">{entry.name}</div>
                    <div className="text-xs text-slate-500">{entry.category || 'general'}{entry.trade ? ` · ${entry.trade}` : ''}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{COMPANY_COST_ENTRY_TYPE_LABELS[entry.type]}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-950">{money(entry.computed_monthly_amount)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{entry.current_balance == null ? '-' : money(entry.current_balance)}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit ? (
                      <button type="button" onClick={() => onEdit(entry)} className="font-medium text-amber-700 hover:text-amber-900">Edit</button>
                    ) : (
                      <span className="text-xs text-slate-400">Read-only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

function EntryModal({ entry, onClose, onSaved }: { entry: CompanyCostEntry | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<EntryForm>(() => entry ? {
    type: entry.type,
    category: entry.category ?? 'general',
    name: entry.name,
    monthly_amount: str(entry.monthly_amount),
    annual_amount: str(entry.annual_amount),
    current_balance: str(entry.current_balance),
    minimum_payment: str(entry.minimum_payment),
    interest_rate_percent: str(entry.interest_rate_percent),
    trade: entry.trade ?? '',
    fixed: entry.fixed,
    active: entry.active,
    notes: entry.notes ?? '',
  } : emptyEntry())
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()

  const save = useMutation({
    mutationFn: () => {
      const input: CompanyCostEntryInput = {
        type: form.type,
        category: form.category.trim() || 'general',
        name: form.name.trim(),
        monthly_amount: num(form.monthly_amount),
        annual_amount: num(form.annual_amount),
        current_balance: num(form.current_balance),
        minimum_payment: num(form.minimum_payment),
        interest_rate_percent: num(form.interest_rate_percent),
        trade: form.trade.trim() || null,
        fixed: form.fixed,
        active: form.active,
        notes: form.notes.trim() || null,
      }
      return entry ? updateCompanyCostEntry(entry.id, input) : createCompanyCostEntry(input)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-cost-model'] })
      onSaved()
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not save cost.'),
  })
  const del = useMutation({
    mutationFn: () => entry ? deleteCompanyCostEntry(entry.id) : Promise.resolve(),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not delete cost.'),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) return
    save.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <form onSubmit={submit} className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{entry ? 'Edit cost' : 'Add cost'}</h2>
            <p className="text-xs text-slate-500">Use monthly amount, or annual amount if it should be divided by 12.</p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-slate-700">x</button>
        </div>
        <div className="grid max-h-[72vh] gap-4 overflow-y-auto p-6 md:grid-cols-2">
          <Field label="Name" required>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} autoFocus />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CompanyCostEntryType })} className={`${inputCls} bg-white`}>
              {COMPANY_COST_ENTRY_TYPES.map((type) => <option key={type} value={type}>{COMPANY_COST_ENTRY_TYPE_LABELS[type]}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Trade">
            <input value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} placeholder="locksmith, hvac, plumbing" className={inputCls} />
          </Field>
          <NumberField label="Monthly amount" value={form.monthly_amount} onChange={(v) => setForm({ ...form, monthly_amount: v })} />
          <NumberField label="Annual amount" value={form.annual_amount} onChange={(v) => setForm({ ...form, annual_amount: v })} />
          <NumberField label="Current balance" value={form.current_balance} onChange={(v) => setForm({ ...form, current_balance: v })} />
          <NumberField label="Minimum payment" value={form.minimum_payment} onChange={(v) => setForm({ ...form, minimum_payment: v })} />
          <NumberField label="Interest %" value={form.interest_rate_percent} onChange={(v) => setForm({ ...form, interest_rate_percent: v })} />
          <div className="flex items-center gap-5 pt-6">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.fixed} onChange={(e) => setForm({ ...form, fixed: e.target.checked })} className="rounded border-slate-300 text-amber-500" />
              Fixed
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="rounded border-slate-300 text-amber-500" />
              Active
            </label>
          </div>
          <div className="md:col-span-2">
            <Field label="Notes">
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className={`${inputCls} resize-y`} />
            </Field>
          </div>
          {error && <div className="md:col-span-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          {entry && (
            <button type="button" onClick={() => del.mutate()} disabled={del.isPending} className="mr-auto text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50">
              {del.isPending ? 'Deleting...' : 'Delete'}
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={save.isPending || !form.name.trim()} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:bg-slate-300">
            {save.isPending ? 'Saving...' : 'Save cost'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${highlight ? 'text-emerald-800' : 'text-slate-950'}`}>{value}</div>
    </div>
  )
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>
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
      <input type="number" min={0} step="0.01" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </Field>
  )
}

function money(value: number): string {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function str(value: number | null | undefined): string {
  return value == null ? '' : String(value)
}

function num(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function labelForType(type: string): string {
  return COMPANY_COST_ENTRY_TYPE_LABELS[type as CompanyCostEntryType] ?? type
}
