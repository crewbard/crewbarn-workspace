import { sanitizeHtml } from '@/components/SafeHtml'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, API_URL, getStoredToken, getActingTenant } from '@/lib/api'
import type { ApiError } from '@/lib/api'
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad'

/**
 * Service-agreements workflow on a WO. Mirrors the inspections panel
 * shape: list view with "+ Add agreement" → drill into one record.
 *
 * Lifecycle:
 *   draft → sent (customer gets emailed link) → customer_signed
 *         → vendor counter-signs → fully_signed (PDF auto-rendered)
 *   any non-terminal status can be void'd.
 */

type AgreementStatus =
  | 'draft'
  | 'sent'
  | 'customer_signed'
  | 'fully_signed'
  | 'declined'
  | 'expired'
  | 'void'

interface Agreement {
  id: string
  work_order_id: string
  document_template_id: string | null
  title: string
  body_html: string
  rendered_body_html: string
  status: AgreementStatus
  customer_email: string | null
  sent_at: string | null
  expires_at: string | null
  customer_signed_at: string | null
  customer_signer_name: string | null
  customer_signer_role: string | null
  vendor_signed_at: string | null
  vendor_signer_name: string | null
  declined_at: string | null
  declined_reason: string | null
  voided_at: string | null
  has_signed_pdf: boolean
  is_terminal: boolean
  created_at: string | null
}

interface DocTemplateRow {
  id: string
  name: string
  type: string | null
  is_default: boolean
}

const SIGNABLE_TEMPLATE_TYPES = new Set(['contract', 'estimate', 'work_order', 'sub_work_order'])

function isSignableTemplateType(type: string | null): boolean {
  return SIGNABLE_TEMPLATE_TYPES.has((type ?? '').toLowerCase())
}

function formatTemplateType(type: string | null): string {
  const normalized = (type ?? '').replace(/_/g, ' ').trim()
  return normalized ? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Template'
}

const STATUS_LABEL: Record<AgreementStatus, string> = {
  draft: 'Draft',
  sent: 'Awaiting customer',
  customer_signed: 'Awaiting your signature',
  fully_signed: 'Fully signed',
  declined: 'Declined',
  expired: 'Expired',
  void: 'Void',
}
const STATUS_COLOR: Record<AgreementStatus, string> = {
  draft: 'bg-slate-100 text-slate-800 border-slate-300',
  sent: 'bg-blue-100 text-blue-800 border-blue-300',
  customer_signed: 'bg-amber-100 text-amber-900 border-amber-300',
  fully_signed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  declined: 'bg-rose-100 text-rose-800 border-rose-300',
  expired: 'bg-slate-100 text-slate-500 border-slate-300',
  void: 'bg-slate-100 text-slate-500 border-slate-300',
}

export function WorkOrderAgreementsPanel({ workOrderId }: { workOrderId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (selectedId) {
    return (
      <AgreementDetailView
        workOrderId={workOrderId}
        agreementId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    )
  }

  return <AgreementListView workOrderId={workOrderId} onOpen={setSelectedId} />
}

// ---------- List view + create modal ----------

function AgreementListView({
  workOrderId,
  onOpen,
}: {
  workOrderId: string
  onOpen: (id: string) => void
}) {
  const [showCreate, setShowCreate] = useState(false)

  const q = useQuery({
    queryKey: ['wo-agreements', workOrderId],
    queryFn: () =>
      apiRequest<{ data: Agreement[] }>(`/v1/work-orders/${workOrderId}/agreements`),
    staleTime: 10_000,
  })

  if (q.isLoading) {
    return <div className="text-sm text-slate-500 italic">Loading agreements…</div>
  }

  const rows = q.data?.data ?? []

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-sm font-semibold text-navy-900 uppercase tracking-wider">
            Service agreements ({rows.length})
          </h2>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="text-xs px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold"
          >
            + Add agreement
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-3">
            No agreements yet. Add one from a signable template — customer signs
            via email link, you counter-sign here.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onOpen(a.id)}
                  className="w-full text-left border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 rounded-lg p-3 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900 truncate min-w-0 flex-1">
                      {a.title}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_COLOR[a.status]}`}
                    >
                      {STATUS_LABEL[a.status]}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {a.customer_email && <span>{a.customer_email}</span>}
                    {a.sent_at && (
                      <>
                        {' · '}
                        Sent {new Date(a.sent_at).toLocaleDateString()}
                      </>
                    )}
                    {a.expires_at && a.status === 'sent' && (
                      <>
                        {' · '}
                        expires {new Date(a.expires_at).toLocaleDateString()}
                      </>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showCreate && (
        <CreateAgreementModal
          workOrderId={workOrderId}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false)
            onOpen(id)
          }}
        />
      )}
    </div>
  )
}

function CreateAgreementModal({
  workOrderId,
  onClose,
  onCreated,
}: {
  workOrderId: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [templateId, setTemplateId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [pickedTemplate, setPickedTemplate] = useState(false)

  // List signable templates first, while still allowing any doc template.
  const tplQ = useQuery({
    queryKey: ['document-templates-for-agreement'],
    queryFn: () => apiRequest<{ data: DocTemplateRow[] }>('/v1/document-templates'),
    staleTime: 60_000,
  })

  // Pre-fetch the WO so we can seed customer_email from its service customer.
  // Skip if user already typed one.
  const woQ = useQuery({
    queryKey: ['wo-for-agreement', workOrderId],
    queryFn: () =>
      apiRequest<{ data: { service_customer?: { email?: string | null } | null } }>(
        `/v1/work-orders/${workOrderId}`,
      ),
    staleTime: 60_000,
  })

  useEffect(() => {
    const fromWo = woQ.data?.data?.service_customer?.email
    if (fromWo && !customerEmail) setCustomerEmail(fromWo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [woQ.data])

  const renderTpl = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ data: { title: string; body_html: string; document_template_id: string } }>(
        `/v1/work-orders/${workOrderId}/agreements/render-template/${id}`,
      ),
    onSuccess: (resp) => {
      setTitle(resp.data.title)
      setBodyHtml(resp.data.body_html)
      setPickedTemplate(true)
    },
  })

  const create = useMutation({
    mutationFn: () =>
      apiRequest<{ data: Agreement }>(`/v1/work-orders/${workOrderId}/agreements`, {
        method: 'POST',
        body: {
          document_template_id: templateId || null,
          title: title.trim(),
          body_html: bodyHtml,
          customer_email: customerEmail.trim() || null,
        },
      }),
    onSuccess: (resp) => onCreated(resp.data.id),
  })

  const templates = tplQ.data?.data ?? []
  const signableTemplates = templates.filter((t) => isSignableTemplateType(t.type))
  const otherTemplates = templates.filter((t) => !isSignableTemplateType(t.type))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-navy-900 mb-1">
          New service agreement
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Pick a signable template — its body is filled with the job's data via
          merge tags. Edit anything before sending.
        </p>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            Start from template
          </span>
          <select
            value={templateId}
            onChange={(e) => {
              const id = e.target.value
              setTemplateId(id)
              if (id) renderTpl.mutate(id)
            }}
            className="w-full text-sm rounded border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="">— Blank —</option>
            {signableTemplates.length > 0 && (
              <optgroup label="Signable templates">
                {signableTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {formatTemplateType(t.type)}
                    {t.is_default ? ' · default' : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {otherTemplates.length > 0 && (
              <optgroup label="Other document templates">
                {otherTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            Title <span className="text-rose-600">*</span>
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="w-full text-sm rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            Body (HTML — what the customer sees)
            {pickedTemplate && (
              <span className="ml-2 text-[10px] text-emerald-700 font-semibold uppercase">
                Filled from template
              </span>
            )}
          </span>
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={10}
            className="w-full text-xs font-mono rounded border border-slate-300 px-3 py-2"
            placeholder="Paste HTML or write plain text…"
          />
        </label>

        <label className="block mb-4">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            Customer email (where the signing link will go)
          </span>
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="w-full text-sm rounded border border-slate-300 px-3 py-2"
          />
        </label>

        {create.isError && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-2 py-1.5 mb-3">
            {(create.error as ApiError).message ?? 'Failed to create agreement.'}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => create.mutate()}
            disabled={!title.trim() || !bodyHtml || create.isPending}
            className="text-sm px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
          >
            {create.isPending ? 'Creating…' : 'Create draft'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Detail view ----------

function AgreementDetailView({
  workOrderId,
  agreementId,
  onBack,
}: {
  workOrderId: string
  agreementId: string
  onBack: () => void
}) {
  const qc = useQueryClient()
  const [showSend, setShowSend] = useState(false)
  const [showSign, setShowSign] = useState(false)

  const q = useQuery({
    queryKey: ['wo-agreement', workOrderId, agreementId],
    queryFn: () =>
      apiRequest<{ data: Agreement }>(
        `/v1/work-orders/${workOrderId}/agreements/${agreementId}`,
      ),
    staleTime: 10_000,
    refetchInterval: (qry) => {
      const a = qry.state.data?.data
      // Poll faster while waiting for customer signature so the UI flips
      // automatically when they sign.
      if (a && (a.status === 'sent' || a.status === 'customer_signed')) return 10_000
      return 60_000
    },
  })

  const voidIt = useMutation({
    mutationFn: () =>
      apiRequest<{ data: Agreement }>(
        `/v1/work-orders/${workOrderId}/agreements/${agreementId}/void`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wo-agreement', workOrderId, agreementId] })
      qc.invalidateQueries({ queryKey: ['wo-agreements', workOrderId] })
    },
  })

  const destroy = useMutation({
    mutationFn: () =>
      apiRequest<void>(`/v1/work-orders/${workOrderId}/agreements/${agreementId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wo-agreements', workOrderId] })
      onBack()
    },
  })

  if (q.isLoading) {
    return <div className="text-sm text-slate-500 italic">Loading agreement…</div>
  }
  if (q.error || !q.data) {
    return (
      <div>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-amber-700 hover:underline"
        >
          ← Back to agreements
        </button>
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 mt-2">
          {(q.error as ApiError)?.message ?? 'Agreement not found.'}
        </div>
      </div>
    )
  }

  const a = q.data.data

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-amber-700 hover:underline"
      >
        ← Back to agreements
      </button>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-navy-900 truncate">
              {a.title}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_COLOR[a.status]}`}
              >
                {STATUS_LABEL[a.status]}
              </span>
              {a.customer_email && (
                <span className="text-[11px] text-slate-500">{a.customer_email}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {a.status === 'draft' && (
              <button
                type="button"
                onClick={() => setShowSend(true)}
                className="text-xs px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              >
                Send for signature →
              </button>
            )}
            {a.status === 'customer_signed' && (
              <button
                type="button"
                onClick={() => setShowSign(true)}
                className="text-xs px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                Counter-sign
              </button>
            )}
            {(a.has_signed_pdf || a.status !== 'draft') && (
              <DownloadAgreementPdfButton
                workOrderId={workOrderId}
                agreementId={agreementId}
              />
            )}
            {a.status === 'draft' && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this draft? It hasn\'t been sent yet.')) {
                    destroy.mutate()
                  }
                }}
                disabled={destroy.isPending}
                className="text-xs px-3 py-1.5 rounded text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                Delete draft
              </button>
            )}
            {!a.is_terminal && a.status !== 'draft' && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Void this agreement? The customer link will stop working.')) {
                    voidIt.mutate()
                  }
                }}
                disabled={voidIt.isPending}
                className="text-xs px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 disabled:opacity-50"
              >
                Void
              </button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <TimelineCell
            label="Sent"
            value={a.sent_at ? new Date(a.sent_at).toLocaleString() : '—'}
          />
          <TimelineCell
            label="Customer signed"
            value={
              a.customer_signed_at
                ? `${new Date(a.customer_signed_at).toLocaleString()}${a.customer_signer_name ? ` · ${a.customer_signer_name}` : ''}`
                : '—'
            }
            sub={a.customer_signer_role ?? null}
          />
          <TimelineCell
            label="Vendor signed"
            value={
              a.vendor_signed_at
                ? `${new Date(a.vendor_signed_at).toLocaleString()}${a.vendor_signer_name ? ` · ${a.vendor_signer_name}` : ''}`
                : '—'
            }
          />
        </div>

        {a.declined_at && (
          <div className="mt-3 text-xs bg-rose-50 border border-rose-200 rounded px-3 py-2">
            <strong className="text-rose-900">Declined</strong>{' '}
            {new Date(a.declined_at).toLocaleString()}
            {a.declined_reason && (
              <div className="text-rose-800 mt-1">{a.declined_reason}</div>
            )}
          </div>
        )}
      </section>

      {/* Body preview */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Agreement body
        </div>
        <div
          className="prose prose-sm max-w-none"
          // Trusted: body is staff-authored HTML; signature slots are rendered
          // server-side with the captured signature image + name + date.
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(a.rendered_body_html || a.body_html, { document: true }) }}
        />
      </section>

      {showSend && (
        <SendAgreementModal
          workOrderId={workOrderId}
          agreementId={agreementId}
          initialEmail={a.customer_email ?? ''}
          onClose={() => setShowSend(false)}
          onSent={() => {
            setShowSend(false)
            qc.invalidateQueries({ queryKey: ['wo-agreement', workOrderId, agreementId] })
            qc.invalidateQueries({ queryKey: ['wo-agreements', workOrderId] })
          }}
        />
      )}

      {showSign && (
        <VendorSignModal
          workOrderId={workOrderId}
          agreementId={agreementId}
          onClose={() => setShowSign(false)}
          onSigned={() => {
            setShowSign(false)
            qc.invalidateQueries({ queryKey: ['wo-agreement', workOrderId, agreementId] })
            qc.invalidateQueries({ queryKey: ['wo-agreements', workOrderId] })
          }}
        />
      )}
    </div>
  )
}

function TimelineCell({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string | null
}) {
  return (
    <div className="border border-slate-200 rounded p-2 bg-slate-50">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm text-slate-800 mt-1">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

function SendAgreementModal({
  workOrderId,
  agreementId,
  initialEmail,
  onClose,
  onSent,
}: {
  workOrderId: string
  agreementId: string
  initialEmail: string
  onClose: () => void
  onSent: () => void
}) {
  const [email, setEmail] = useState(initialEmail)
  // 0 means "never" in the payload; default 30 matches the old hardcoded behavior.
  const [expiresInDays, setExpiresInDays] = useState<number>(30)
  const send = useMutation({
    mutationFn: () =>
      apiRequest<{ email_sent: boolean; email_error: string | null }>(
        `/v1/work-orders/${workOrderId}/agreements/${agreementId}/send`,
        {
          method: 'POST',
          body: {
            customer_email: email.trim() || null,
            expires_in_days: expiresInDays,
          },
        },
      ),
    onSuccess: () => onSent(),
  })

  const expiryHint = expiresInDays > 0
    ? `Link expires ${new Date(Date.now() + expiresInDays * 86_400_000).toLocaleDateString()}.`
    : 'Link does not expire.'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-navy-900 mb-1">
          Send for signature
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Customer gets a tokenized link to review and sign.
        </p>
        <label className="block mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            Customer email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full text-sm rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            Signing link expires
          </span>
          <select
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value))}
            className="w-full text-sm rounded border border-slate-300 px-3 py-2 bg-white"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
            <option value={180}>6 months</option>
            <option value={365}>1 year</option>
            <option value={0}>Never expires</option>
          </select>
          <span className="block text-[11px] text-slate-500 mt-1">{expiryHint}</span>
        </label>
        {send.isError && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-2 py-1.5 mb-3">
            {(send.error as ApiError).message ?? 'Failed to send.'}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => send.mutate()}
            disabled={!email.trim() || send.isPending}
            className="text-sm px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
          >
            {send.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

function VendorSignModal({
  workOrderId,
  agreementId,
  onClose,
  onSigned,
}: {
  workOrderId: string
  agreementId: string
  onClose: () => void
  onSigned: () => void
}) {
  const [name, setName] = useState('')
  const pad = useRef<SignaturePadHandle>(null)

  const sign = useMutation({
    mutationFn: () => {
      const sig = pad.current?.toDataUrl()
      if (!sig) throw new Error('Sign the pad before submitting.')
      return apiRequest<{ data: Agreement }>(
        `/v1/work-orders/${workOrderId}/agreements/${agreementId}/vendor-sign`,
        { method: 'POST', body: { signature: sig, signer_name: name.trim() } },
      )
    },
    onSuccess: () => onSigned(),
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-navy-900 mb-1">
          Counter-sign agreement
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          The customer has signed. Your signature finalizes the agreement and
          generates the signed PDF.
        </p>
        <SignaturePad ref={pad} hint="Sign above" />
        <label className="block mt-3 mb-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            Printed name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            className="w-full text-sm rounded border border-slate-300 px-3 py-2"
          />
        </label>
        {sign.isError && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-2 py-1.5 mb-3">
            {(sign.error as Error).message}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => sign.mutate()}
            disabled={!name.trim() || sign.isPending}
            className="text-sm px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
          >
            {sign.isPending ? 'Signing…' : 'Sign & finalize'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DownloadAgreementPdfButton({
  workOrderId,
  agreementId,
}: {
  workOrderId: string
  agreementId: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function open() {
    setBusy(true)
    setErr(null)
    try {
      const token = getStoredToken()
      const tenant = getActingTenant()
      const headers: Record<string, string> = { Accept: 'application/pdf' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      if (tenant) headers['X-Act-As-Tenant'] = tenant
      const res = await fetch(
        `${API_URL}/v1/work-orders/${workOrderId}/agreements/${agreementId}/pdf`,
        { headers },
      )
      if (!res.ok) {
        const text = await res.text()
        let msg = `Failed (${res.status})`
        try { msg = JSON.parse(text).message ?? msg } catch { /* ignore */ }
        throw new Error(msg)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="text-xs px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold disabled:opacity-50"
      >
        {busy ? 'Generating…' : 'Download PDF'}
      </button>
      {err && <span className="text-xs text-red-700">{err}</span>}
    </div>
  )
}
