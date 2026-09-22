import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  getQuickBooksStatus,
  startQuickBooksConnect,
  testQuickBooks,
  disconnectQuickBooks,
  updateQuickBooksSettings,
  runQuickBooksSync,
  pushToQuickBooks,
  type QuickBooksSyncSettings,
  type QuickBooksSyncResult,
} from '@/lib/quickbooks'

/**
 * "Import from QuickBooks Online" card for the Import page. Tenants connect
 * by OAuth login (no API keys). Once connected they choose what to bring
 * over; the actual pull/sync runs from here.
 */
export function QuickBooksConnectCard() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const justConnected = params.get('qbo') === 'connected'

  const statusQ = useQuery({ queryKey: ['qbo-status'], queryFn: getQuickBooksStatus })
  const [err, setErr] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<QuickBooksSyncResult | null>(null)

  const connect = useMutation({
    mutationFn: startQuickBooksConnect,
    onSuccess: (url) => {
      window.location.href = url
    },
    onError: (e) => setErr(e instanceof Error ? e.message : String(e)),
  })

  const test = useMutation({
    mutationFn: testQuickBooks,
    onSuccess: (r) => setTestMsg(r.company_name ? `Connected to ${r.company_name}` : 'Connection OK'),
    onError: (e) => setErr(e instanceof Error ? e.message : String(e)),
  })

  const disconnect = useMutation({
    mutationFn: disconnectQuickBooks,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qbo-status'] }),
    onError: (e) => setErr(e instanceof Error ? e.message : String(e)),
  })

  const saveSettings = useMutation({
    mutationFn: (s: Partial<QuickBooksSyncSettings>) => updateQuickBooksSettings(s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qbo-status'] }),
    onError: (e) => setErr(e instanceof Error ? e.message : String(e)),
  })

  const runSync = useMutation({
    mutationFn: runQuickBooksSync,
    onSuccess: (res) => {
      setSyncResult(res)
      // Imported records may show up in customers/catalog/invoices lists.
      qc.invalidateQueries({ queryKey: ['qbo-status'] })
    },
    onError: (e) => setErr(e instanceof Error ? e.message : String(e)),
  })

  const runPush = useMutation({
    mutationFn: pushToQuickBooks,
    onSuccess: (res) => setSyncResult({ results: res.results, last_synced_at: null }),
    onError: (e) => setErr(e instanceof Error ? e.message : String(e)),
  })

  const status = statusQ.data
  if (statusQ.isLoading || !status) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-500">
        Checking QuickBooks…
      </div>
    )
  }

  // Server has no Intuit app credentials — nothing the tenant can do.
  if (!status.configured) return null

  const entities = status.sync_settings.entities
  const toggleEntity = (key: keyof typeof entities) =>
    saveSettings.mutate({ entities: { ...entities, [key]: !entities[key] } })

  const busy =
    connect.isPending ||
    disconnect.isPending ||
    saveSettings.isPending ||
    runSync.isPending ||
    runPush.isPending
  const anyEntity = Object.values(entities).some(Boolean)

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            Import from QuickBooks Online
            {status.environment === 'sandbox' && (
              <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                Sandbox
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Connect your QuickBooks and pull customers, products &amp; services, and invoices —
            no spreadsheet needed.
          </p>
        </div>
        {status.connected ? (
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded shrink-0">
            ● Connected
          </span>
        ) : (
          <span className="text-[11px] font-medium text-slate-500 shrink-0">Not connected</span>
        )}
      </div>

      {justConnected && status.connected && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
          QuickBooks connected. Choose what to bring over below.
        </div>
      )}

      {err && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {err}
        </div>
      )}

      {!status.connected ? (
        <button
          type="button"
          onClick={() => {
            setErr(null)
            connect.mutate()
          }}
          disabled={connect.isPending}
          className="text-sm px-4 py-2 rounded-md bg-[#2CA01C] hover:bg-[#258016] text-white font-semibold disabled:opacity-50"
        >
          {connect.isPending ? 'Redirecting…' : 'Connect QuickBooks'}
        </button>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="text-xs font-medium text-slate-700 mb-1.5">What to bring over</div>
            <div className="flex flex-wrap gap-3">
              {(['customers', 'items', 'invoices'] as const).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={entities[key]}
                    onChange={() => toggleEntity(key)}
                    disabled={busy}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  {key === 'items' ? 'Products & Services' : key.charAt(0).toUpperCase() + key.slice(1)}
                </label>
              ))}
            </div>
          </div>

          {/* Primary action — pull the selected entities now. */}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => {
                setErr(null)
                setSyncResult(null)
                runSync.mutate()
              }}
              disabled={busy || !anyEntity}
              className="flex-1 text-sm px-4 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
            >
              {runSync.isPending ? 'Importing from QuickBooks…' : '↓ Import from QuickBooks'}
            </button>
            <button
              type="button"
              onClick={() => {
                setErr(null)
                setSyncResult(null)
                runPush.mutate()
              }}
              disabled={busy || !anyEntity}
              title="Send CrewBarn records that aren't in QuickBooks yet"
              className="flex-1 text-sm px-4 py-2.5 rounded-md border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-semibold disabled:opacity-50"
            >
              {runPush.isPending ? 'Pushing to QuickBooks…' : '↑ Push to QuickBooks'}
            </button>
          </div>

          {syncResult && <SyncResults result={syncResult} />}

          {testMsg && (
            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-3 py-2">
              {testMsg}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setErr(null)
                setTestMsg(null)
                test.mutate()
              }}
              disabled={test.isPending}
              className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {test.isPending ? 'Testing…' : 'Test connection'}
            </button>
            <button
              type="button"
              onClick={() => {
                setErr(null)
                if (justConnected) setParams({}, { replace: true })
                disconnect.mutate()
              }}
              disabled={disconnect.isPending}
              className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            Re-running an import updates records already linked to QuickBooks instead of creating
            duplicates. Invoice and job numbers are kept conflict-free automatically.
          </p>
        </div>
      )}
    </div>
  )
}

const ENTITY_LABELS: Record<string, string> = {
  customers: 'Customers',
  items: 'Products & Services',
  invoices: 'Invoices',
}

function SyncResults({ result }: { result: QuickBooksSyncResult }) {
  const entries = Object.entries(result.results)
  if (entries.length === 0) return null

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 border-b border-emerald-100">
        Import complete
      </div>
      <div className="divide-y divide-slate-100">
        {entries.map(([entity, r]) => (
          <div key={entity} className="px-3 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-800">{ENTITY_LABELS[entity] ?? entity}</span>
              <span className="text-xs text-slate-600">
                <span className="text-emerald-700 font-semibold">{r.created}</span> created ·{' '}
                {r.updated} updated · {r.skipped} skipped
                {r.errors.length > 0 && (
                  <span className="text-red-700 font-semibold"> · {r.errors.length} errors</span>
                )}
              </span>
            </div>
            {r.errors.length > 0 && (
              <div className="mt-1.5 max-h-32 overflow-y-auto space-y-1">
                {r.errors.slice(0, 25).map((e, i) => (
                  <div key={i} className="text-[11px] text-slate-500 flex gap-2">
                    <span className="text-slate-400 shrink-0">{e.ref}</span>
                    <span>{e.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
