import { useState } from 'react'
import { tenantDate, useTenantTimezone } from '@/hooks/useTenantTime'
import { useQuery } from '@tanstack/react-query'
import { apiRequest, API_URL, getStoredToken, getActingTenant } from '@/lib/api'

/**
 * Tool Shed → Account → Data Export.
 *
 * Read manifest, then fetch each CSV via fetch+blob so the bearer token
 * rides the Authorization header (downloads can't use a plain anchor
 * tag for token-protected URLs). The streamed file is built directly in
 * memory as a Blob and handed to a temporary anchor for download.
 */

interface EntityDef {
  key: string
  label: string
  description: string
  columns: string[]
}

interface Payload {
  entities: EntityDef[]
}

export function DataExportPage() {
  const tenantTimezone = useTenantTimezone()
  const tenantToday = tenantDate(tenantTimezone)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['data-export-manifest'],
    queryFn: () => apiRequest<{ data: Payload }>('/v1/tenant-settings/data-export'),
  })

  const download = async (entity: EntityDef) => {
    setError(null)
    setBusyKey(entity.key)
    try {
      const token = getStoredToken()
      // This blob download bypasses apiRequest, so it must replicate the
      // headers apiRequest sets — including X-Act-As-Tenant. Without it a
      // platform admin acting as a tenant downloads in bypass/no-tenant
      // context and the CSV fails or exports the wrong tenant.
      const headers: Record<string, string> = { Accept: 'text/csv' }
      if (token) headers.Authorization = `Bearer ${token}`
      const actingTenant = getActingTenant()
      if (actingTenant) headers['X-Act-As-Tenant'] = actingTenant
      const res = await fetch(
        `${API_URL}/v1/tenant-settings/data-export/${entity.key}.csv`,
        { headers },
      )
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(body || `Download failed (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crewbarn-${entity.key}-${tenantToday}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Free the blob URL after a beat so the click handler has fired.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  const entities = query.data?.data.entities ?? []

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Data Export</h1>
        <p className="text-sm text-slate-500 mt-1">
          Download a CSV snapshot of any major table in your shop's data. Each
          export is scoped to this tenant only — RLS at the database level
          guarantees you can't see another tenant's rows.
        </p>
      </div>

      {query.isLoading && <p className="text-sm text-slate-500 italic">Loading…</p>}
      {query.isError && (
        <p className="text-sm text-red-700">
          {(query.error as Error).message ?? 'Failed to load.'}
        </p>
      )}

      {error && (
        <div className="mb-4 text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2">
          {error}
        </div>
      )}

      {entities.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {entities.map((e) => (
              <li key={e.key} className="px-4 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{e.label}</div>
                  <div className="text-[12px] text-slate-500 mt-1">{e.description}</div>
                  <div className="text-[11px] text-slate-400 mt-2 font-mono break-all">
                    {e.columns.join(', ')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => download(e)}
                  disabled={busyKey === e.key}
                  className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50 shrink-0"
                >
                  {busyKey === e.key ? 'Downloading…' : 'Download CSV'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 leading-relaxed">
        <strong>What you get:</strong> a CSV with one row per record, headers
        on the first line. Encrypted columns (API keys, SMTP credentials) are
        excluded. Soft-deleted rows are excluded.
        <br />
        <strong>What you don't get yet:</strong> related rows (e.g. line items
        on an invoice). Each export is a single-table snapshot — joining
        happens in your spreadsheet.
      </div>
    </div>
  )
}
