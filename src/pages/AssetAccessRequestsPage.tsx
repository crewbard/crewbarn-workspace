import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { usePermissions, PERM } from '@/hooks/usePermissions'

/**
 * Tool Shed -> Assets -> Access requests. Owner review of secured-asset scan
 * requests. Approval generates a 24-hour access code for the requester.
 */
interface AccessRequest {
  id: string
  scannable_type: string
  scannable_name: string | null
  scannable_code: string | null
  scan_url: string | null
  requester_name: string
  requester_email: string | null
  requester_phone: string | null
  message: string | null
  status: 'pending' | 'approved' | 'denied'
  access_scope?: 'item' | 'tree'
  access_code?: string
  access_code_delivery?: {
    email_sent: boolean
    sms_sent: boolean
    sms_error: string | null
  }
  access_code_expires_at: string | null
  access_code_sent_at: string | null
  access_granted_at: string | null
  handled_at: string | null
  created_at: string
}

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'denied', label: 'Denied' },
  { key: '', label: 'All' },
] as const

export function AssetAccessRequestsPage() {
  const { has } = usePermissions()
  const canEdit = has(PERM.ASSETS_EDIT)
  const qc = useQueryClient()
  const [tab, setTab] = useState<string>('pending')
  const [generatedCodes, setGeneratedCodes] = useState<Record<string, { code: string; delivery?: AccessRequest['access_code_delivery'] }>>({})
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)

  const list = useQuery({
    queryKey: ['asset-access-requests', tab],
    queryFn: () =>
      apiRequest<{ data: AccessRequest[] }>(
        '/v1/asset-access-requests' + (tab ? `?status=${tab}` : ''),
      ),
  })

  const pendingList = useQuery({
    queryKey: ['asset-access-requests', 'pending-count'],
    queryFn: () => apiRequest<{ data: AccessRequest[] }>('/v1/asset-access-requests?status=pending'),
  })

  const setStatus = useMutation<
    { data: AccessRequest },
    Error,
    { id: string; status: AccessRequest['status']; access_scope?: 'item' | 'tree' }
  >({
    mutationFn: ({ id, status, access_scope }) => {
      setActiveRequestId(id)
      return apiRequest(`/v1/asset-access-requests/${id}`, { method: 'PATCH', body: { status, access_scope } })
    },
    onSuccess: (res) => {
      if (res.data.access_code) {
        setGeneratedCodes((prev) => ({
          ...prev,
          [res.data.id]: { code: res.data.access_code!, delivery: res.data.access_code_delivery },
        }))
      }
      qc.invalidateQueries({ queryKey: ['asset-access-requests'] })
    },
    onSettled: () => setActiveRequestId(null),
  })

  const rows = useMemo(() => list.data?.data ?? [], [list.data])
  const pendingCount = pendingList.data?.data.length ?? (tab === 'pending' ? rows.length : 0)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Asset access requests</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            People who scanned a secured asset and asked for access. Approve only the scanned item, or approve the full asset tree so the same 24-hour code opens related secured items under that location or group.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-right">
          <div className="text-2xl font-bold text-amber-700">{pendingCount}</div>
          <div className="text-xs font-medium text-amber-800">pending review</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <InfoCard
          title="1. Review the request"
          text="Confirm who is asking and which QR asset, group, or location they scanned."
        />
        <InfoCard
          title="2. Choose the scope"
          text="Approve just that item, or approve the full asset tree for related secured items at the same location or group."
        />
        <InfoCard
          title="3. Send the code"
          text="CrewBarn texts and emails the code when contact info is provided. Copy the code if manual follow-up is needed."
        />
      </div>

      <div className="mt-6 border-b border-slate-200 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={[
              'relative px-4 py-2.5 text-sm font-medium',
              tab === t.key ? 'text-navy-900' : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            {t.label}
            {tab === t.key && <span className="absolute left-3 right-3 -bottom-px h-[3px] bg-amber-500" />}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {list.isLoading && <div className="text-sm text-slate-500 py-10 text-center">Loading...</div>}
        {setStatus.isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not update this request. Refresh and try again.
          </div>
        )}
        {!list.isLoading && rows.length === 0 && (
          <div className="text-sm text-slate-500 py-10 text-center border border-dashed border-slate-300 rounded-xl">
            No {tab === 'pending' ? 'pending ' : ''}access requests.
          </div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-navy-900">{r.scannable_name ?? 'Secured item'}</div>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {r.scannable_type}
                  </span>
                  {r.scannable_code && (
                    <span className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-navy-700">
                      {r.scannable_code}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-700 mt-1">
                  <span className="font-medium">{r.requester_name}</span>
                  <span className="text-slate-400"> requested secured access</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {r.requester_email && <CopyInline label={r.requester_email} value={r.requester_email} />}
                  {r.requester_phone && <CopyInline label={r.requester_phone} value={r.requester_phone} />}
                  <span>Requested {formatDateTime(r.created_at)}</span>
                  <span>Scope: <span className="font-semibold text-slate-700">{scopeLabel(r.access_scope)}</span></span>
                </div>
                {r.scan_url && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">QR scan page</div>
                      <div className="flex items-center gap-2">
                        <a
                          href={r.scan_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                        >
                          Open page
                        </a>
                        <button
                          type="button"
                          onClick={() => void navigator.clipboard?.writeText(r.scan_url!)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                        >
                          Copy link
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 break-all font-mono text-xs text-slate-700">{r.scan_url}</div>
                  </div>
                )}
                {r.message && (
                  <div className="text-sm text-slate-600 mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    {r.message}
                  </div>
                )}
                {generatedCodes[r.id] && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">Access code generated</div>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard?.writeText(generatedCodes[r.id].code)}
                        className="rounded border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        Copy code
                      </button>
                    </div>
                    <div className="mt-1 font-mono text-lg tracking-widest text-emerald-950">{generatedCodes[r.id].code}</div>
                    <div className="mt-1 text-xs text-emerald-700">{deliveryMessage(generatedCodes[r.id].delivery)}</div>
                  </div>
                )}
                {r.status === 'approved' && (
                  <LifecycleMeta
                    label="Approved"
                    details={[
                      r.access_code_sent_at ? `Code issued ${formatDateTime(r.access_code_sent_at)}` : null,
                      r.access_code_expires_at ? `Expires ${formatDateTime(r.access_code_expires_at)}` : null,
                      r.access_granted_at ? `Used ${formatDateTime(r.access_granted_at)}` : 'Not used yet',
                    ]}
                  />
                )}
                {r.status === 'denied' && (
                  <LifecycleMeta label="Denied" details={[r.handled_at ? `Handled ${formatDateTime(r.handled_at)}` : null]} />
                )}
              </div>
              <StatusBadge status={r.status} />
            </div>
            {canEdit && r.status === 'pending' && (
              <div className="flex flex-wrap gap-2 mt-3 justify-end">
                <button
                  type="button"
                  onClick={() => setStatus.mutate({ id: r.id, status: 'denied' })}
                  disabled={setStatus.isPending && activeRequestId === r.id}
                  className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {setStatus.isPending && activeRequestId === r.id ? 'Denying...' : 'Deny'}
                </button>
                <button
                  type="button"
                  onClick={() => setStatus.mutate({ id: r.id, status: 'approved', access_scope: 'item' })}
                  disabled={setStatus.isPending && activeRequestId === r.id}
                  className="text-xs px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
                >
                  {setStatus.isPending && activeRequestId === r.id ? 'Approving...' : 'Approve item'}
                </button>
                <button
                  type="button"
                  onClick={() => setStatus.mutate({ id: r.id, status: 'approved', access_scope: 'tree' })}
                  disabled={setStatus.isPending && activeRequestId === r.id}
                  className="text-xs px-3 py-1.5 rounded-md bg-navy-900 hover:bg-navy-800 text-white font-medium disabled:opacity-50"
                >
                  {setStatus.isPending && activeRequestId === r.id ? 'Approving...' : 'Approve full tree'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-navy-900">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-600">{text}</div>
    </div>
  )
}

function CopyInline({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard?.writeText(value)}
      className="rounded text-left hover:text-navy-700 hover:underline"
      title="Copy"
    >
      {label}
    </button>
  )
}

function scopeLabel(scope?: AccessRequest['access_scope']) {
  return scope === 'tree' ? 'Full tree' : 'Scanned item only'
}

function deliveryMessage(delivery?: AccessRequest['access_code_delivery']) {
  if (!delivery) return 'Valid for 24 hours. Copy this code if the requester needs it.'
  const sent = [delivery.sms_sent ? 'text' : null, delivery.email_sent ? 'email' : null].filter(Boolean)
  if (sent.length > 0) return `Valid for 24 hours. CrewBarn sent it by ${sent.join(' and ')}.`
  if (delivery.sms_error) return `Valid for 24 hours. Text delivery failed: ${delivery.sms_error}. Copy this code and send it manually.`
  return 'Valid for 24 hours. Copy this code if the requester needs it.'
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    denied: 'bg-slate-100 text-slate-500',
  }
  return (
    <span className={`text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded shrink-0 ${styles[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

function LifecycleMeta({ label, details }: { label: string; details: Array<string | null> }) {
  const visible = details.filter(Boolean)
  if (!visible.length) return null
  return (
    <div className="mt-3 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-slate-500">
      <span className="font-semibold text-slate-700">{label}:</span> {visible.join(' - ')}
    </div>
  )
}

function formatDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}
