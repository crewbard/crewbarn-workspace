import { useMemo, useState } from 'react'
import { tenantDate, useTenantTimezone } from '@/hooks/useTenantTime'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL, apiRequest, getActingTenant, getFranchiseActAs, getStoredToken } from '@/lib/api'
import type { PaginatedResponse } from '@/types/api'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'

type Provider = 'quickbooks' | 'xero' | 'csv' | 'accountant_export'
type MappingType = 'account' | 'tax_code' | 'payment_method' | 'item' | 'vendor' | 'customer' | 'class' | 'location' | 'tracking_category' | 'other'

type SyncMapping = {
  id: string
  provider: Provider
  mapping_type: MappingType
  crewbarn_type?: string | null
  crewbarn_id?: string | null
  crewbarn_key?: string | null
  external_id?: string | null
  external_name?: string | null
  external_code?: string | null
  settings?: Record<string, unknown>
  active: boolean
  updated_at?: string | null
}

const providerOptions: Array<{ value: Provider; label: string }> = [
  { value: 'accountant_export', label: 'Accountant export' },
  { value: 'quickbooks', label: 'QuickBooks' },
  { value: 'xero', label: 'Xero' },
  { value: 'csv', label: 'CSV' },
]

const mappingTypeOptions: Array<{ value: MappingType; label: string }> = [
  { value: 'account', label: 'Account' },
  { value: 'tax_code', label: 'Tax code' },
  { value: 'payment_method', label: 'Payment method' },
  { value: 'item', label: 'Item' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'customer', label: 'Customer' },
  { value: 'class', label: 'Class' },
  { value: 'location', label: 'Location' },
  { value: 'tracking_category', label: 'Tracking category' },
  { value: 'other', label: 'Other' },
]

const emptyForm = {
  provider: 'accountant_export' as Provider,
  mapping_type: 'account' as MappingType,
  crewbarn_type: '',
  crewbarn_id: '',
  crewbarn_key: '',
  external_id: '',
  external_name: '',
  external_code: '',
  active: true,
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function AccountingSyncMappingsPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const tenantTimezone = useTenantTimezone()
  const tenantToday = tenantDate(tenantTimezone)
  const queryClient = useQueryClient()
  const defaultRange = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      from: isoDate(start),
      to: isoDate(now),
    }
  }, [])
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    provider: '',
    mapping_type: '',
    active: '1',
    q: '',
  })
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportingXero, setExportingXero] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [xeroExportError, setXeroExportError] = useState<string | null>(null)
  const [xeroRange, setXeroRange] = useState(defaultRange)

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ per_page: '50', page: String(page) })
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    return params.toString()
  }, [filters, page])

  const exportQueryString = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    return params.toString()
  }, [filters])

  const mappingsQ = useQuery({
    queryKey: ['accounting', 'sync-mappings', queryString],
    queryFn: () => apiRequest<PaginatedResponse<SyncMapping>>(`/v1/accounting/sync-mappings?${queryString}`),
  })

  const saveMapping = useMutation({
    mutationFn: (payload: typeof form) => {
      const body = {
        provider: payload.provider,
        mapping_type: payload.mapping_type,
        crewbarn_type: payload.crewbarn_type || null,
        crewbarn_id: payload.crewbarn_id || null,
        crewbarn_key: payload.crewbarn_key || null,
        external_id: payload.external_id || null,
        external_name: payload.external_name || null,
        external_code: payload.external_code || null,
        active: payload.active,
      }

      if (editingId) {
        return apiRequest<{ data: SyncMapping }>(`/v1/accounting/sync-mappings/${editingId}`, {
          method: 'PATCH',
          body,
        })
      }

      return apiRequest<{ data: SyncMapping }>('/v1/accounting/sync-mappings', {
        method: 'POST',
        body,
      })
    },
    onSuccess: () => {
      setForm(emptyForm)
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: ['accounting', 'sync-mappings'] })
    },
  })

  const deleteMapping = useMutation({
    mutationFn: (mapping: SyncMapping) =>
      apiRequest<void>(`/v1/accounting/sync-mappings/${mapping.id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounting', 'sync-mappings'] }),
  })

  const mappings = mappingsQ.data?.data ?? []
  const meta = mappingsQ.data?.meta

  function submit(event: FormEvent) {
    event.preventDefault()
    saveMapping.mutate(form)
  }

  function edit(mapping: SyncMapping) {
    setEditingId(mapping.id)
    setForm({
      provider: mapping.provider,
      mapping_type: mapping.mapping_type,
      crewbarn_type: mapping.crewbarn_type ?? '',
      crewbarn_id: mapping.crewbarn_id ?? '',
      crewbarn_key: mapping.crewbarn_key ?? '',
      external_id: mapping.external_id ?? '',
      external_name: mapping.external_name ?? '',
      external_code: mapping.external_code ?? '',
      active: mapping.active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function remove(mapping: SyncMapping) {
    if (!window.confirm(`Remove mapping for ${mapping.crewbarn_key || mapping.crewbarn_type || mapping.external_name || mapping.id}?`)) return
    deleteMapping.mutate(mapping)
  }

  async function exportCsv() {
    setExporting(true)
    setExportError(null)
    try {
      const headers: Record<string, string> = { Accept: 'text/csv' }
      const token = getStoredToken()
      const actingTenant = getActingTenant()
      const franchiseActAs = getFranchiseActAs()
      if (token) headers.Authorization = `Bearer ${token}`
      if (actingTenant) headers['X-Act-As-Tenant'] = actingTenant
      if (franchiseActAs) headers['X-Franchise-Act-As'] = franchiseActAs.id

      const response = await fetch(`${API_URL}/v1/accounting/sync-mappings/export?${exportQueryString}`, { headers })
      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `accounting-sync-mappings-${tenantToday}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not export sync mappings.')
    } finally {
      setExporting(false)
    }
  }

  async function exportXeroJournalCsv() {
    setExportingXero(true)
    setXeroExportError(null)
    try {
      const headers: Record<string, string> = { Accept: 'text/csv' }
      const token = getStoredToken()
      const actingTenant = getActingTenant()
      const franchiseActAs = getFranchiseActAs()
      if (token) headers.Authorization = `Bearer ${token}`
      if (actingTenant) headers['X-Act-As-Tenant'] = actingTenant
      if (franchiseActAs) headers['X-Franchise-Act-As'] = franchiseActAs.id

      const params = new URLSearchParams({
        format: 'xero_csv',
        from: xeroRange.from,
        to: xeroRange.to,
        status: 'posted',
      })
      const response = await fetch(`${API_URL}/v1/accounting/journal-entries?${params.toString()}`, { headers })
      if (!response.ok) {
        throw new Error(`Xero export failed with status ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `xero-journal-entries-${xeroRange.from}-${xeroRange.to}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      setXeroExportError(error instanceof Error ? error.message : 'Could not export Xero journal CSV.')
    } finally {
      setExportingXero(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-4 text-slate-950 sm:px-6 sm:py-6 2xl:px-8">
      <div className="mx-auto w-full max-w-none space-y-6">
<header data-easy-accounting-header={easy || undefined} className={easy ? 'flex min-w-0 w-full flex-col items-stretch gap-4' : 'flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'}>
          <div className={easy ? 'min-w-0 w-full' : undefined}>
            {easy ? <EasyPageHeading title="Accounting mappings" description="Choose an export provider, match CrewBarn records to its codes, then review your mappings before exporting." /> : <>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Accounting</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Sync Mappings</h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Map CrewBarn accounts, tax codes, payment methods, items, vendors, and customers to accountant exports or optional accounting apps.
            </p>
            </>}
          </div>
          <Link className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm" to="/accounting">
            Money desk
          </Link>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold">{editingId ? 'Edit mapping' : 'Add mapping'}</h2>
            <p className="text-sm text-slate-500">
              These mappings support exports. They do not make QuickBooks or Xero the source of truth.
            </p>
          </div>
          <form className="mt-4 grid gap-3 lg:grid-cols-12" onSubmit={submit}>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Provider
              <select className="rounded-md border border-slate-300 px-3 py-2" value={form.provider} onChange={(event) => setForm((old) => ({ ...old, provider: event.target.value as Provider }))}>
                {providerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              Type
              <select className="rounded-md border border-slate-300 px-3 py-2" value={form.mapping_type} onChange={(event) => setForm((old) => ({ ...old, mapping_type: event.target.value as MappingType }))}>
                {mappingTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              CrewBarn type
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.crewbarn_type} onChange={(event) => setForm((old) => ({ ...old, crewbarn_type: event.target.value }))} placeholder="account, item, payment" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
              CrewBarn ID
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.crewbarn_id} onChange={(event) => setForm((old) => ({ ...old, crewbarn_id: event.target.value }))} placeholder="Optional record ID" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-4">
              CrewBarn key
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.crewbarn_key} onChange={(event) => setForm((old) => ({ ...old, crewbarn_key: event.target.value }))} placeholder="cash:1000, tax:state, payment:card" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-3">
              External name
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.external_name} onChange={(event) => setForm((old) => ({ ...old, external_name: event.target.value }))} placeholder="Checking, Sales Tax Payable" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-3">
              External code
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.external_code} onChange={(event) => setForm((old) => ({ ...old, external_code: event.target.value }))} placeholder="1000, 2100, TAX" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-3">
              External ID
              <input className="rounded-md border border-slate-300 px-3 py-2" value={form.external_id} onChange={(event) => setForm((old) => ({ ...old, external_id: event.target.value }))} placeholder="Provider record ID" />
            </label>
            <label className="flex items-end gap-2 text-sm font-semibold text-slate-700 lg:col-span-1">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm((old) => ({ ...old, active: event.target.checked }))} />
              Active
            </label>
            <div className="flex items-end gap-2 lg:col-span-2">
              <button className="rounded-md bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-60" disabled={saveMapping.isPending}>
                {saveMapping.isPending ? 'Saving...' : editingId ? 'Update' : 'Save'}
              </button>
              {editingId ? (
                <button
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"
                  type="button"
                  onClick={() => {
                    setEditingId(null)
                    setForm(emptyForm)
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
          {saveMapping.error ? <p className="mt-3 text-sm font-semibold text-red-700">Could not save this mapping.</p> : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <h2 className="text-lg font-bold">Xero journal export</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Download posted CrewBarn journal entries in a Xero-oriented CSV. Account codes use active Xero account mappings when they exist.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[160px_160px_auto] sm:items-end">
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                From
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  type="date"
                  value={xeroRange.from}
                  onChange={(event) => setXeroRange((old) => ({ ...old, from: event.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                To
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  type="date"
                  value={xeroRange.to}
                  onChange={(event) => setXeroRange((old) => ({ ...old, to: event.target.value }))}
                />
              </label>
              <button
                className="rounded-md bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-60"
                disabled={exportingXero}
                type="button"
                onClick={exportXeroJournalCsv}
              >
                {exportingXero ? 'Exporting...' : 'Xero journal CSV'}
              </button>
            </div>
          </div>
          {xeroExportError ? <p className="mt-3 text-sm font-semibold text-red-700">{xeroExportError}</p> : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-12">
            <input className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-4" placeholder="Search mappings..." value={filters.q} onChange={(event) => { setPage(1); setFilters((old) => ({ ...old, q: event.target.value })) }} />
            <select className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" value={filters.provider} onChange={(event) => { setPage(1); setFilters((old) => ({ ...old, provider: event.target.value })) }}>
              <option value="">All providers</option>
              {providerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" value={filters.mapping_type} onChange={(event) => { setPage(1); setFilters((old) => ({ ...old, mapping_type: event.target.value })) }}>
              <option value="">All types</option>
              {mappingTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 lg:col-span-2" value={filters.active} onChange={(event) => { setPage(1); setFilters((old) => ({ ...old, active: event.target.value })) }}>
              <option value="">All status</option>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
            <button className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold lg:col-span-2" type="button" onClick={() => { setPage(1); setFilters({ provider: '', mapping_type: '', active: '1', q: '' }) }}>
              Clear
            </button>
            <button className="rounded-md bg-slate-950 px-3 py-2 font-semibold text-white disabled:opacity-60 lg:col-span-2" disabled={exporting} type="button" onClick={exportCsv}>
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
          {exportError ? <p className="px-4 pt-3 text-sm font-semibold text-red-700">{exportError}</p> : null}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">CrewBarn</th>
                  <th className="px-4 py-3">External</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {mappingsQ.isLoading ? (
                  <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={6}>Loading mappings...</td></tr>
                ) : mappingsQ.isError ? (
                  <tr><td className="px-4 py-8 text-center text-red-700" colSpan={6}>
                    <div role="alert">Mappings could not be loaded.</div>
                    <button type="button" onClick={() => void mappingsQ.refetch()} className="mt-2 rounded-md border border-red-300 px-3 py-2 font-semibold">Try again</button>
                  </td></tr>
                ) : mappings.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={6}>No mappings in this filter.</td></tr>
                ) : mappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className="px-4 py-3 font-semibold capitalize text-slate-900">{mapping.provider.replace('_', ' ')}</td>
                    <td className="px-4 py-3 capitalize text-slate-700">{mapping.mapping_type.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{mapping.crewbarn_key || mapping.crewbarn_id || 'General mapping'}</div>
                      <div className="text-xs text-slate-500">{mapping.crewbarn_type || 'No CrewBarn type'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{mapping.external_name || mapping.external_code || mapping.external_id || 'Not set'}</div>
                      <div className="text-xs text-slate-500">
                        {[mapping.external_code, mapping.external_id].filter(Boolean).join(' / ') || 'No external key'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${mapping.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {mapping.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="rounded-md border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-700" type="button" onClick={() => edit(mapping)}>
                          Edit
                        </button>
                        <button className="rounded-md border border-red-200 bg-white px-3 py-1 font-semibold text-red-700 disabled:opacity-60" disabled={deleteMapping.isPending} type="button" onClick={() => remove(mapping)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {meta?.total ? `Showing ${meta.from ?? 0}-${meta.to ?? 0} of ${meta.total}` : 'No mappings'}
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold disabled:opacity-50" disabled={!meta || meta.current_page <= 1 || mappingsQ.isFetching} onClick={() => setPage((old) => Math.max(1, old - 1))} type="button">
                Previous
              </button>
              <span className="min-w-20 text-center font-semibold">Page {meta?.current_page ?? page} of {meta?.last_page ?? 1}</span>
              <button className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold disabled:opacity-50" disabled={!meta || meta.current_page >= meta.last_page || mappingsQ.isFetching} onClick={() => setPage((old) => old + 1)} type="button">
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
