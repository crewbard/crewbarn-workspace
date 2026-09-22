import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import {
  createWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  getWebhookEvents,
  listWebhooks,
  testWebhook,
  updateWebhook,
  type WebhookEndpoint,
  type WebhookEndpointInput,
} from '@/lib/webhooks'

const inputCls =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500'

export function SettingsWebhooksPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<WebhookEndpoint | null | 'new'>(null)

  const q = useQuery({ queryKey: ['webhooks'], queryFn: listWebhooks })
  const eventsQ = useQuery({ queryKey: ['webhook-events'], queryFn: getWebhookEvents, staleTime: 300_000 })

  const refresh = () => qc.invalidateQueries({ queryKey: ['webhooks'] })
  const endpoints = q.data ?? []

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-navy-900">Webhooks</h1>
          <p className="text-sm text-slate-600 mt-1">
            Send CrewBarn events to your own systems. We POST a signed JSON payload to your URL
            when a subscribed event fires — verify it with the <code>x-crewbarn-signature</code>{' '}
            header (HMAC-SHA256 of the body using your endpoint secret).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="shrink-0 px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold"
        >
          + Add endpoint
        </button>
      </div>

      {q.isLoading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : endpoints.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">
          No webhook endpoints yet. Add one to start receiving events.
        </div>
      ) : (
        <div className="space-y-3">
          {endpoints.map((e) => (
            <EndpointCard key={e.id} endpoint={e} onEdit={() => setEditing(e)} onChanged={refresh} />
          ))}
        </div>
      )}

      {editing && (
        <EndpointEditor
          endpoint={editing === 'new' ? null : editing}
          allEvents={eventsQ.data ?? []}
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

function EndpointCard({
  endpoint,
  onEdit,
  onChanged,
}: {
  endpoint: WebhookEndpoint
  onEdit: () => void
  onChanged: () => void
}) {
  const qc = useQueryClient()
  const [showLog, setShowLog] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [testMsg, setTestMsg] = useState<string | null>(null)

  const test = useMutation({
    mutationFn: () => testWebhook(endpoint.id),
    onSuccess: (r) => {
      setTestMsg(r.ok ? `✓ ${r.status_code} (${r.duration_ms}ms)` : `✗ ${r.error ?? 'failed'}`)
      onChanged()
    },
    onError: (e) => setTestMsg(e instanceof ApiError ? e.message : 'Test failed'),
  })

  const del = useMutation({
    mutationFn: () => deleteWebhook(endpoint.id),
    onSuccess: onChanged,
  })

  const logQ = useQuery({
    queryKey: ['webhook-deliveries', endpoint.id],
    queryFn: () => getWebhookDeliveries(endpoint.id),
    enabled: showLog,
  })

  const healthBad = !endpoint.active || endpoint.consecutive_failures > 0

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                !endpoint.active ? 'bg-slate-400' : endpoint.consecutive_failures > 0 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
            />
            <span className="text-sm font-medium text-navy-900 break-all">{endpoint.url}</span>
            {!endpoint.active && (
              <span className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                Disabled
              </span>
            )}
          </div>
          {endpoint.description && (
            <p className="text-xs text-slate-500 mt-0.5">{endpoint.description}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {endpoint.events.map((ev) => (
              <span key={ev} className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                {ev}
              </span>
            ))}
          </div>
          {healthBad && endpoint.consecutive_failures > 0 && (
            <p className="text-[11px] text-rose-600 mt-1">
              {endpoint.consecutive_failures} consecutive failure{endpoint.consecutive_failures === 1 ? '' : 's'}
              {endpoint.last_status ? ` · last HTTP ${endpoint.last_status}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => test.mutate()}
            disabled={test.isPending}
            className="text-xs px-2.5 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            {test.isPending ? 'Testing…' : 'Send test'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLog((v) => !v)
              if (!showLog) qc.invalidateQueries({ queryKey: ['webhook-deliveries', endpoint.id] })
            }}
            className="text-xs px-2.5 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            {showLog ? 'Hide log' : 'Log'}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="text-xs px-2.5 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Delete this webhook endpoint?')) del.mutate()
            }}
            disabled={del.isPending}
            className="text-xs px-2.5 py-1.5 rounded text-rose-700 hover:bg-rose-50"
          >
            Delete
          </button>
        </div>
      </div>

      {testMsg && <div className="text-xs mt-2 text-slate-600">{testMsg}</div>}

      {/* Secret */}
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="text-slate-500">Signing secret:</span>
        <code className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">
          {showSecret ? endpoint.secret : '••••••••••••••••'}
        </code>
        <button type="button" onClick={() => setShowSecret((v) => !v)} className="text-amber-700 hover:underline">
          {showSecret ? 'Hide' : 'Reveal'}
        </button>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(endpoint.secret)}
          className="text-amber-700 hover:underline"
        >
          Copy
        </button>
      </div>

      {/* Delivery log */}
      {showLog && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {logQ.isLoading ? (
            <div className="text-xs text-slate-500">Loading log…</div>
          ) : (logQ.data ?? []).length === 0 ? (
            <div className="text-xs text-slate-400">No deliveries yet.</div>
          ) : (
            <div className="space-y-1">
              {(logQ.data ?? []).map((d) => (
                <div key={d.id} className="flex items-center gap-2 text-[11px]">
                  <span className={d.ok ? 'text-emerald-600' : 'text-rose-600'}>{d.ok ? '✓' : '✗'}</span>
                  <span className="font-mono text-slate-600">{d.event}</span>
                  <span className="text-slate-400">{d.status_code ?? '—'}</span>
                  <span className="text-slate-400">{d.duration_ms != null ? `${d.duration_ms}ms` : ''}</span>
                  <span className="text-slate-400">
                    {d.created_at ? new Date(d.created_at).toLocaleString() : ''}
                  </span>
                  {d.error && <span className="text-rose-500 truncate">{d.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EndpointEditor({
  endpoint,
  allEvents,
  onClose,
  onSaved,
}: {
  endpoint: WebhookEndpoint | null
  allEvents: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = endpoint !== null
  const [url, setUrl] = useState(endpoint?.url ?? '')
  const [description, setDescription] = useState(endpoint?.description ?? '')
  const [events, setEvents] = useState<string[]>(endpoint?.events ?? [])
  const [active, setActive] = useState(endpoint?.active ?? true)
  const [regen, setRegen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => {
      const input: WebhookEndpointInput = {
        url: url.trim(),
        events,
        description: description.trim() || null,
        active,
      }
      if (isEdit) {
        return updateWebhook(endpoint!.id, { ...input, regenerate_secret: regen })
      }
      return createWebhook(input)
    },
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Save failed'),
  })

  const toggle = (ev: string) =>
    setEvents((prev) => (prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev]))

  const canSave = url.trim() !== '' && events.length > 0 && !save.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-navy-900 mb-4">
          {isEdit ? 'Edit webhook endpoint' : 'New webhook endpoint'}
        </h2>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">Endpoint URL</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhooks/crewbarn"
            className={inputCls}
          />
        </label>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            placeholder="What this endpoint is for"
            className={inputCls}
          />
        </label>

        <div className="mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">Events</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {allEvents.map((ev) => (
              <label key={ev} className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={events.includes(ev)}
                  onChange={() => toggle(ev)}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                />
                <span className="font-mono text-xs">{ev}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-700 mb-3">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
          />
          Active
        </label>

        {isEdit && (
          <label className="block mb-3 inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={regen}
              onChange={(e) => setRegen(e.target.checked)}
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            Regenerate signing secret
          </label>
        )}

        {error && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 mb-3">{error}</div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!canSave}
            className="text-sm px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsWebhooksPage
