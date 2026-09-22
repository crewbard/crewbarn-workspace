import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, API_URL, getStoredToken, getActingTenant } from '@/lib/api'
import type { ApiError } from '@/lib/api'
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad'

/**
 * Phase 2 inspection workflow on the WO detail page.
 *
 * Flow:
 *   No record yet → "Start inspection" button (if a checklist is attached)
 *   In progress   → render every item with pass/fail/N/A buttons + notes
 *                   + photo upload (visible on fail). Rolling tally at top.
 *                   "Finalize" button enables once every item answered.
 *   Finalized     → read-only summary + overall_status + summary notes
 *                   + "Reset" if user has jobs.edit (scrap + start fresh).
 */

interface InspectionItem {
  id: string
  checklist_item_id: string
  prompt: string
  severity: 'life_safety' | '30_day' | 'next_cycle' | 'info'
  status: 'pass' | 'fail' | 'na' | null
  notes: string | null
  photo_url: string | null
  answered_at: string | null
}

interface SignatureBlock {
  url: string
  name: string | null
  role?: string | null
  at: string | null
}

interface InspectionRecord {
  id: string
  work_order_id: string
  asset_id: string | null
  asset: { id: string; name: string } | null
  checklist_id: string
  overall_status:
    | 'in_progress'
    | 'passed'
    | 'passed_with_deficiencies'
    | 'needs_action'
    | 'failed'
  started_at: string
  finalized_at: string | null
  summary_notes: string | null
  inspector: { id: string; name: string | null } | null
  inspector_signature: SignatureBlock | null
  contact_signature: SignatureBlock | null
  rollup: {
    total: number
    pass: number
    fail: number
    na: number
    unanswered: number
  }
  items: InspectionItem[]
}

const SEVERITY_LABEL: Record<string, string> = {
  life_safety: 'Life safety',
  '30_day': '30-day',
  next_cycle: 'Next cycle',
  info: 'Info',
}

const SEVERITY_COLOR: Record<string, string> = {
  life_safety: 'bg-red-100 text-red-800 border-red-200',
  '30_day': 'bg-amber-100 text-amber-800 border-amber-200',
  next_cycle: 'bg-slate-100 text-slate-700 border-slate-200',
  info: 'bg-slate-100 text-slate-700 border-slate-200',
}

const OVERALL_COLOR: Record<string, string> = {
  in_progress: 'bg-slate-100 text-slate-800 border-slate-300',
  passed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  passed_with_deficiencies: 'bg-amber-100 text-amber-900 border-amber-300',
  needs_action: 'bg-orange-100 text-orange-900 border-orange-300',
  failed: 'bg-red-100 text-red-900 border-red-300',
}

const OVERALL_LABEL: Record<string, string> = {
  in_progress: 'In progress',
  passed: 'Passed',
  passed_with_deficiencies: 'Passed with deficiencies',
  needs_action: 'Needs action (30-day)',
  failed: 'Failed (life-safety)',
}

export function WorkOrderInspectionPanel({
  workOrderId,
  hasChecklist,
}: {
  workOrderId: string
  hasChecklist: boolean
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (!hasChecklist) {
    return (
      <section className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm">
        <strong className="text-amber-900">No checklist attached.</strong>
        <p className="text-amber-800 mt-1 text-xs">
          Pick an inspection checklist (NFPA 80, NFPA 25, NFPA 10, or custom)
          on the WO Quick edit / Edit form before starting an inspection.
        </p>
      </section>
    )
  }

  if (selectedId) {
    return (
      <InspectionDetailView
        workOrderId={workOrderId}
        inspectionId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    )
  }

  return (
    <InspectionListView
      workOrderId={workOrderId}
      onOpen={(id) => setSelectedId(id)}
    />
  )
}

function InspectionDetailView({
  workOrderId,
  inspectionId,
  onBack,
}: {
  workOrderId: string
  inspectionId: string
  onBack: () => void
}) {
  const qc = useQueryClient()
  const [showRepair, setShowRepair] = useState(false)

  const q = useQuery({
    queryKey: ['wo-inspection', workOrderId, inspectionId],
    queryFn: () =>
      apiRequest<{ data: InspectionRecord }>(
        `/v1/work-orders/${workOrderId}/inspections/${inspectionId}`,
      ),
    staleTime: 10_000,
  })

  const resetReq = useMutation({
    mutationFn: () =>
      apiRequest<void>(
        `/v1/work-orders/${workOrderId}/inspections/${inspectionId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wo-inspections', workOrderId] })
      onBack()
    },
  })

  if (q.isLoading) {
    return <div className="text-sm text-slate-500 italic">Loading inspection…</div>
  }
  if (q.error || !q.data) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-amber-700 hover:underline"
        >
          ← Back to inspections
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          {(q.error as ApiError)?.message ?? 'Inspection not found.'}
        </div>
      </div>
    )
  }

  const rec = q.data.data
  const isFinalized = rec.finalized_at !== null
  const failedItems = rec.items.filter((i) => i.status === 'fail')

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-amber-700 hover:underline"
      >
        ← Back to inspections
      </button>

      {/* Header summary */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-navy-900 uppercase tracking-wider">
              {rec.asset ? rec.asset.name : 'Property-level inspection'}
            </h2>
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${OVERALL_COLOR[rec.overall_status]}`}
            >
              {OVERALL_LABEL[rec.overall_status]}
            </span>
            {isFinalized && rec.finalized_at && (
              <span className="text-[11px] text-slate-500">
                Finalized {new Date(rec.finalized_at).toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isFinalized && (
              <DownloadReportButton
                workOrderId={workOrderId}
                inspectionId={inspectionId}
              />
            )}
            {isFinalized && failedItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowRepair(true)}
                className="text-xs px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              >
                Create repair from {failedItems.length} deficienc
                {failedItems.length === 1 ? 'y' : 'ies'} →
              </button>
            )}
            {isFinalized && (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      'Reset this inspection? The current answers, photos, and rollup will be deleted.',
                    )
                  ) {
                    resetReq.mutate()
                  }
                }}
                disabled={resetReq.isPending}
                className="text-xs px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 disabled:opacity-50"
              >
                {resetReq.isPending ? 'Deleting…' : 'Delete inspection'}
              </button>
            )}
          </div>
        </div>

        {showRepair && (
          <CreateRepairModal
            workOrderId={workOrderId}
            inspectionId={inspectionId}
            failedItems={failedItems}
            onClose={() => setShowRepair(false)}
          />
        )}

        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
          <RollupTile label="Total" value={rec.rollup.total} />
          <RollupTile label="Passed" value={rec.rollup.pass} color="emerald" />
          <RollupTile label="Failed" value={rec.rollup.fail} color="red" />
          <RollupTile label="N/A" value={rec.rollup.na} />
          <RollupTile label="To do" value={rec.rollup.unanswered} color="amber" />
        </div>

        {rec.inspector && (
          <div className="text-[11px] text-slate-500 mt-3">
            Inspector: <strong>{rec.inspector.name}</strong>
          </div>
        )}
        {rec.summary_notes && (
          <div className="mt-3 text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2 whitespace-pre-wrap">
            <span className="font-semibold text-slate-700">Summary: </span>
            {rec.summary_notes}
          </div>
        )}

        {(rec.inspector_signature || rec.contact_signature) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {rec.inspector_signature && (
              <SignatureCard
                label="Inspector"
                sig={rec.inspector_signature}
              />
            )}
            {rec.contact_signature && (
              <SignatureCard
                label="Property contact"
                sig={rec.contact_signature}
                role={rec.contact_signature.role ?? null}
              />
            )}
          </div>
        )}
      </section>

      {/* Items list */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-3">
        {rec.items.map((item) => (
          <InspectionItemRow
            key={item.id}
            workOrderId={workOrderId}
            inspectionId={inspectionId}
            item={item}
            disabled={isFinalized}
          />
        ))}
      </section>

      {!isFinalized && (
        <FinalizeBar
          workOrderId={workOrderId}
          inspectionId={inspectionId}
          rec={rec}
        />
      )}
    </div>
  )
}

function SignatureCard({
  label,
  sig,
  role,
}: {
  label: string
  sig: SignatureBlock
  role?: string | null
}) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
        {label}
      </div>
      <div className="bg-white border-b border-slate-300 h-14 flex items-end">
        <img
          src={sig.url}
          alt={`${label} signature`}
          className="max-h-14 max-w-full object-contain"
        />
      </div>
      <div className="text-xs text-slate-800 font-medium mt-1">
        {sig.name ?? '—'}
      </div>
      {role && <div className="text-[11px] text-slate-500">{role}</div>}
      {sig.at && (
        <div className="text-[11px] text-slate-400">
          {new Date(sig.at).toLocaleString()}
        </div>
      )}
    </div>
  )
}

function RollupTile({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: 'emerald' | 'red' | 'amber'
}) {
  const colorClass =
    color === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : color === 'red'
      ? 'bg-red-50 text-red-800 border-red-200'
      : color === 'amber' && value > 0
      ? 'bg-amber-50 text-amber-900 border-amber-200'
      : 'bg-slate-50 text-slate-700 border-slate-200'
  return (
    <div className={`border rounded p-2 ${colorClass}`}>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider">{label}</div>
    </div>
  )
}

function InspectionItemRow({
  workOrderId,
  inspectionId,
  item,
  disabled,
}: {
  workOrderId: string
  inspectionId: string
  item: InspectionItem
  disabled: boolean
}) {
  const qc = useQueryClient()
  const [notes, setNotes] = useState<string>(item.notes ?? '')
  const [showNotes, setShowNotes] = useState<boolean>(!!item.notes)

  const base = `/v1/work-orders/${workOrderId}/inspections/${inspectionId}`
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['wo-inspection', workOrderId, inspectionId] })
    qc.invalidateQueries({ queryKey: ['wo-inspections', workOrderId] })
  }

  const answer = useMutation({
    mutationFn: (input: { status: 'pass' | 'fail' | 'na'; notes: string | null }) =>
      apiRequest<{ data: InspectionItem }>(`${base}/items/${item.id}`, {
        method: 'PATCH', body: input,
      }),
    onSuccess: invalidate,
  })

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('photo', file)
      const token = getStoredToken()
      const tenant = getActingTenant()
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      if (tenant) headers['X-Act-As-Tenant'] = tenant
      const res = await fetch(`${API_URL}${base}/items/${item.id}/photo`, {
        method: 'POST', headers, body: fd,
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = `Upload failed (${res.status})`
        try { msg = JSON.parse(text).message ?? msg } catch { /* ignore */ }
        throw new Error(msg)
      }
      return res.json()
    },
    onSuccess: invalidate,
  })

  const removePhoto = useMutation({
    mutationFn: () =>
      apiRequest<void>(`${base}/items/${item.id}/photo`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  function pick(status: 'pass' | 'fail' | 'na') {
    answer.mutate({ status, notes: notes.trim() || null })
    if (status === 'fail') setShowNotes(true)
  }

  function saveNotes() {
    if (!item.status) return
    answer.mutate({ status: item.status, notes: notes.trim() || null })
  }

  const sevLabel = SEVERITY_LABEL[item.severity] ?? item.severity
  const sevColor = SEVERITY_COLOR[item.severity] ?? SEVERITY_COLOR.next_cycle

  return (
    <div
      className={`border rounded-lg p-3 ${
        item.status === 'pass'
          ? 'border-emerald-200 bg-emerald-50/40'
          : item.status === 'fail'
          ? 'border-red-200 bg-red-50/40'
          : item.status === 'na'
          ? 'border-slate-200 bg-slate-50'
          : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${sevColor}`}
            >
              {sevLabel}
            </span>
            <span className="text-sm font-medium text-slate-900">{item.prompt}</span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <StatusBtn
            label="Pass"
            active={item.status === 'pass'}
            onClick={() => pick('pass')}
            disabled={disabled || answer.isPending}
            tone="emerald"
          />
          <StatusBtn
            label="Fail"
            active={item.status === 'fail'}
            onClick={() => pick('fail')}
            disabled={disabled || answer.isPending}
            tone="red"
          />
          <StatusBtn
            label="N/A"
            active={item.status === 'na'}
            onClick={() => pick('na')}
            disabled={disabled || answer.isPending}
            tone="slate"
          />
        </div>
      </div>

      {/* Notes + photo only meaningful once answered */}
      {item.status && (
        <div className="mt-3 space-y-2">
          {!showNotes && !disabled && !item.notes && (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="text-xs text-slate-600 hover:underline"
            >
              + Add notes
            </button>
          )}
          {(showNotes || item.notes) && (
            <div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveNotes}
                disabled={disabled}
                rows={2}
                placeholder={
                  item.status === 'fail'
                    ? 'What was wrong? Be specific so this becomes a clean repair quote.'
                    : 'Optional notes'
                }
                className="w-full text-xs rounded border border-slate-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-50"
              />
            </div>
          )}

          {/* Photo: encouraged on fail */}
          {item.status === 'fail' && (
            <div className="flex items-center gap-2">
              {item.photo_url ? (
                <>
                  <a
                    href={item.photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block"
                  >
                    <img
                      src={item.photo_url}
                      alt="Deficiency"
                      className="w-20 h-20 object-cover rounded border border-slate-300"
                    />
                  </a>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removePhoto.mutate()}
                      disabled={removePhoto.isPending}
                      className="text-xs text-rose-700 hover:underline"
                    >
                      Remove photo
                    </button>
                  )}
                </>
              ) : (
                !disabled && (
                  <label className="text-xs px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 cursor-pointer inline-flex items-center gap-2">
                    {uploadPhoto.isPending ? 'Uploading…' : '+ Attach photo of deficiency'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) uploadPhoto.mutate(f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                )
              )}
              {uploadPhoto.isError && (
                <span className="text-xs text-red-700">
                  {(uploadPhoto.error as Error).message}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusBtn({
  label,
  active,
  onClick,
  disabled,
  tone,
}: {
  label: string
  active: boolean
  onClick: () => void
  disabled: boolean
  tone: 'emerald' | 'red' | 'slate'
}) {
  const activeColor =
    tone === 'emerald'
      ? 'bg-emerald-600 text-white border-emerald-600'
      : tone === 'red'
      ? 'bg-red-600 text-white border-red-600'
      : 'bg-slate-700 text-white border-slate-700'
  const idleColor = 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-xs font-semibold px-2.5 py-1 rounded border disabled:opacity-50 ${active ? activeColor : idleColor}`}
    >
      {label}
    </button>
  )
}

function FinalizeBar({
  workOrderId,
  inspectionId,
  rec,
}: {
  workOrderId: string
  inspectionId: string
  rec: InspectionRecord
}) {
  const [showModal, setShowModal] = useState(false)
  const ready = rec.rollup.unanswered === 0

  return (
    <>
      <section className="bg-slate-900 text-white rounded-xl shadow-lg p-4 sticky bottom-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            {ready ? (
              <>
                <strong>All items answered.</strong> Add a summary + capture
                signatures on the next step.
              </>
            ) : (
              <>
                <strong>{rec.rollup.unanswered}</strong> item
                {rec.rollup.unanswered === 1 ? '' : 's'} still to do.
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            disabled={!ready}
            className="text-sm px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
          >
            Finalize inspection
          </button>
        </div>
      </section>

      {showModal && (
        <FinalizeModal
          workOrderId={workOrderId}
          inspectionId={inspectionId}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}

function FinalizeModal({
  workOrderId,
  inspectionId,
  onClose,
}: {
  workOrderId: string
  inspectionId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [summary, setSummary] = useState('')
  const [inspectorName, setInspectorName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactRole, setContactRole] = useState('Property Manager')
  const inspectorPad = useRef<SignaturePadHandle>(null)
  const contactPad = useRef<SignaturePadHandle>(null)

  const finalize = useMutation({
    mutationFn: () => {
      const inspectorSig = inspectorPad.current?.toDataUrl() ?? null
      const contactSig = contactPad.current?.toDataUrl() ?? null
      return apiRequest<{ data: InspectionRecord }>(
        `/v1/work-orders/${workOrderId}/inspections/${inspectionId}/finalize`,
        {
          method: 'POST',
          body: {
            summary_notes: summary.trim() || null,
            inspector_signature: inspectorSig,
            inspector_signature_name: inspectorSig ? inspectorName.trim() || null : null,
            contact_signature: contactSig,
            contact_signature_name: contactSig ? contactName.trim() || null : null,
            contact_signature_role: contactSig ? contactRole.trim() || null : null,
          },
        },
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wo-inspection', workOrderId, inspectionId] })
      qc.invalidateQueries({ queryKey: ['wo-inspections', workOrderId] })
      onClose()
    },
  })

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
          Finalize inspection
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Adds a final summary and (optionally) signatures from the inspector
          and on-site contact. Signatures are embedded in the compliance PDF.
        </p>

        <label className="block mb-4">
          <span className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
            Inspector summary (optional)
          </span>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="Overall observations, recommendations…"
            className="w-full text-sm rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Inspector signature */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Inspector signature
            </div>
            <SignaturePad ref={inspectorPad} hint="Sign above" />
            <label className="block mt-2">
              <span className="text-[11px] text-slate-500">Printed name</span>
              <input
                type="text"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                maxLength={200}
                className="w-full mt-0.5 text-sm rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </label>
          </div>

          {/* Contact signature */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Property contact signature
            </div>
            <SignaturePad ref={contactPad} hint="On-site contact signs above" />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className="block">
                <span className="text-[11px] text-slate-500">Printed name</span>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  maxLength={200}
                  className="w-full mt-0.5 text-sm rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-500">Role</span>
                <select
                  value={contactRole}
                  onChange={(e) => setContactRole(e.target.value)}
                  className="w-full mt-0.5 text-sm rounded border border-slate-300 px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Property Manager">Property Manager</option>
                  <option value="Property Owner">Property Owner</option>
                  <option value="Tenant">Tenant</option>
                  <option value="On-site Contact">On-site Contact</option>
                  <option value="Maintenance Supervisor">Maintenance Supervisor</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {finalize.isError && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-2 py-1.5 mb-3">
            {(finalize.error as ApiError).message ?? 'Finalize failed.'}
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
            onClick={() => finalize.mutate()}
            disabled={finalize.isPending}
            className="text-sm px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
          >
            {finalize.isPending ? 'Finalizing…' : 'Finalize inspection'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Auth'd PDF fetch → opens the report inline in a new tab. We can't use
 * a plain <a href> because the Authorization + X-Act-As-Tenant headers
 * aren't sent on a normal link, so the server would 401.
 */
function DownloadReportButton({
  workOrderId,
  inspectionId,
}: {
  workOrderId: string
  inspectionId: string
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
        `${API_URL}/v1/work-orders/${workOrderId}/inspections/${inspectionId}/report.pdf`,
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
      // Revoke after a beat — Safari needs the URL to be live when the
      // new tab actually loads it; 60s is plenty.
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
        className="text-xs px-3 py-1.5 rounded border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-semibold disabled:opacity-50"
      >
        {busy ? 'Generating…' : 'Download report PDF'}
      </button>
      {err && <span className="text-xs text-red-700">{err}</span>}
    </div>
  )
}

/**
 * Bundles selected failed items into a new repair Estimate or Work Order,
 * chained back to the parent via parent_work_order_id (WO path) or copied
 * as line items on a draft estimate (estimate path).
 */
function CreateRepairModal({
  workOrderId,
  inspectionId,
  failedItems,
  onClose,
}: {
  workOrderId: string
  inspectionId: string
  failedItems: InspectionItem[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [kind, setKind] = useState<'estimate' | 'work_order'>('estimate')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(failedItems.map((i) => i.id)),
  )

  const create = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { kind: string; id: string; redirect: string } }>(
        `/v1/work-orders/${workOrderId}/inspections/${inspectionId}/create-repair`,
        {
          method: 'POST',
          body: {
            kind,
            inspection_item_ids: Array.from(selected),
          },
        },
      ),
    onSuccess: (resp) => navigate(resp.data.redirect),
  })

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-navy-900 mb-1">
          Create repair from deficiencies
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Each selected failure becomes a line item on the new record. Set
          pricing on the next page.
        </p>

        <div className="mb-4 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded p-2">
          <KindBtn
            label="Estimate (customer approves first)"
            active={kind === 'estimate'}
            onClick={() => setKind('estimate')}
          />
          <KindBtn
            label="Work order (direct, no quote)"
            active={kind === 'work_order'}
            onClick={() => setKind('work_order')}
          />
        </div>

        <div className="space-y-2 mb-4">
          {failedItems.map((item) => {
            const isSel = selected.has(item.id)
            return (
              <label
                key={item.id}
                className={`flex items-start gap-2 p-2 rounded border cursor-pointer ${
                  isSel
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggle(item.id)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${SEVERITY_COLOR[item.severity] ?? SEVERITY_COLOR.next_cycle}`}
                    >
                      {SEVERITY_LABEL[item.severity] ?? item.severity}
                    </span>
                    <span className="text-sm font-medium text-slate-900">
                      {item.prompt}
                    </span>
                  </div>
                  {item.notes && (
                    <div className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">
                      {item.notes}
                    </div>
                  )}
                </div>
                {item.photo_url && (
                  <img
                    src={item.photo_url}
                    alt=""
                    className="w-12 h-12 object-cover rounded border border-slate-300 shrink-0"
                  />
                )}
              </label>
            )
          })}
        </div>

        {create.isError && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-2 py-1.5 mb-3">
            {(create.error as ApiError).message ?? 'Failed to create repair.'}
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
            disabled={selected.size === 0 || create.isPending}
            onClick={() => create.mutate()}
            className="text-sm px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
          >
            {create.isPending
              ? 'Creating…'
              : `Create ${kind === 'estimate' ? 'estimate' : 'work order'} (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}

function KindBtn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-xs font-semibold px-3 py-2 rounded border ${
        active
          ? 'bg-amber-500 text-white border-amber-500'
          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  )
}

// ---------- Multi-asset shell: list view + start modal ----------

interface CoveredAssetRef {
  id: string
  name: string
}

function InspectionListView({
  workOrderId,
  onOpen,
}: {
  workOrderId: string
  onOpen: (id: string) => void
}) {
  const [showStart, setShowStart] = useState(false)

  const q = useQuery({
    queryKey: ['wo-inspections', workOrderId],
    queryFn: () =>
      apiRequest<{ data: InspectionRecord[] }>(`/v1/work-orders/${workOrderId}/inspections`),
    staleTime: 10_000,
  })

  if (q.isLoading) {
    return <div className="text-sm text-slate-500 italic">Loading inspections…</div>
  }

  const records = q.data?.data ?? []
  const startedAssetIds = new Set(records.map((r) => r.asset_id).filter(Boolean) as string[])
  const hasPropertyLevel = records.some((r) => !r.asset_id)

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-sm font-semibold text-navy-900 uppercase tracking-wider">
            Inspections ({records.length})
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            {records.some((r) => r.finalized_at) && (
              <DownloadRollupButton workOrderId={workOrderId} />
            )}
            <button
              type="button"
              onClick={() => setShowStart(true)}
              className="text-xs px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold"
            >
              + Add inspection
            </button>
          </div>
        </div>

        {records.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-3">
            No inspections started yet. Add one for a covered asset or run a
            property-level inspection of the attached checklist.
          </p>
        ) : (
          <ul className="space-y-2">
            {records.map((r) => (
              <InspectionRowSummary
                key={r.id}
                rec={r}
                onClick={() => onOpen(r.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {showStart && (
        <StartInspectionModal
          workOrderId={workOrderId}
          startedAssetIds={startedAssetIds}
          propertyLevelStarted={hasPropertyLevel}
          onClose={() => setShowStart(false)}
          onStarted={(id) => {
            setShowStart(false)
            onOpen(id)
          }}
        />
      )}
    </div>
  )
}

function InspectionRowSummary({
  rec,
  onClick,
}: {
  rec: InspectionRecord
  onClick: () => void
}) {
  const isFinalized = rec.finalized_at !== null
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 rounded-lg p-3 transition-colors"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-sm font-semibold text-slate-900 truncate">
              {rec.asset ? rec.asset.name : 'Property-level inspection'}
            </span>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${OVERALL_COLOR[rec.overall_status]}`}
            >
              {OVERALL_LABEL[rec.overall_status]}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-3 shrink-0">
            <span>
              <strong className="text-emerald-700">{rec.rollup.pass}</strong> pass
            </span>
            <span>
              <strong className="text-red-700">{rec.rollup.fail}</strong> fail
            </span>
            <span>
              <strong className="text-slate-700">{rec.rollup.na}</strong> n/a
            </span>
            {rec.rollup.unanswered > 0 && (
              <span>
                <strong className="text-amber-700">{rec.rollup.unanswered}</strong> to do
              </span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          {isFinalized && rec.finalized_at
            ? `Finalized ${new Date(rec.finalized_at).toLocaleString()}`
            : `Started ${new Date(rec.started_at).toLocaleString()}`}
          {rec.inspector?.name && ` · ${rec.inspector.name}`}
        </div>
      </button>
    </li>
  )
}

function StartInspectionModal({
  workOrderId,
  startedAssetIds,
  propertyLevelStarted,
  onClose,
  onStarted,
}: {
  workOrderId: string
  startedAssetIds: Set<string>
  propertyLevelStarted: boolean
  onClose: () => void
  onStarted: (id: string) => void
}) {
  const [picked, setPicked] = useState<string>('') // '' = property-level
  const qc = useQueryClient()

  // Covered assets on this WO drive the picker. If the WO has none, the
  // user can still run a property-level inspection.
  const assetsQ = useQuery({
    queryKey: ['wo-covered-assets-for-inspection', workOrderId],
    queryFn: async () => {
      const res = await apiRequest<{ data: { covered_assets?: CoveredAssetRef[] } }>(
        `/v1/work-orders/${workOrderId}`,
      )
      return res.data.covered_assets ?? []
    },
    staleTime: 60_000,
  })

  const start = useMutation({
    mutationFn: () =>
      apiRequest<{ data: InspectionRecord }>(
        `/v1/work-orders/${workOrderId}/inspections`,
        {
          method: 'POST',
          body: { asset_id: picked || null },
        },
      ),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['wo-inspections', workOrderId] })
      onStarted(resp.data.id)
    },
  })

  const assets = assetsQ.data ?? []
  const propertyDisabled = propertyLevelStarted

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-navy-900 mb-1">
          Start a new inspection
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Run the WO's attached checklist against a specific asset, or do a
          property-level pass.
        </p>

        <div className="space-y-2 mb-4">
          <PickRow
            label="Property-level (no specific asset)"
            value=""
            picked={picked}
            disabled={propertyDisabled}
            disabledHint="Already started"
            onPick={setPicked}
          />
          {assetsQ.isLoading && (
            <p className="text-xs text-slate-500 italic">Loading covered assets…</p>
          )}
          {!assetsQ.isLoading && assets.length === 0 && (
            <p className="text-xs text-slate-500 italic">
              No assets attached to this WO. Use Quick edit / Edit to add covered assets,
              then come back.
            </p>
          )}
          {assets.map((a) => {
            const already = startedAssetIds.has(a.id)
            return (
              <PickRow
                key={a.id}
                label={a.name}
                value={a.id}
                picked={picked}
                disabled={already}
                disabledHint="Already started"
                onPick={setPicked}
              />
            )
          })}
        </div>

        {start.isError && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-2 py-1.5 mb-3">
            {(start.error as ApiError).message ?? 'Failed to start inspection.'}
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
            onClick={() => start.mutate()}
            disabled={start.isPending || (picked === '' && propertyDisabled)}
            className="text-sm px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
          >
            {start.isPending ? 'Starting…' : 'Start inspection'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DownloadRollupButton({ workOrderId }: { workOrderId: string }) {
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
        `${API_URL}/v1/work-orders/${workOrderId}/inspections/report.pdf`,
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
        className="text-xs px-3 py-1.5 rounded border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-semibold disabled:opacity-50"
      >
        {busy ? 'Generating…' : 'Download combined PDF'}
      </button>
      {err && <span className="text-xs text-red-700">{err}</span>}
    </div>
  )
}

function PickRow({
  label,
  value,
  picked,
  disabled,
  disabledHint,
  onPick,
}: {
  label: string
  value: string
  picked: string
  disabled: boolean
  disabledHint?: string
  onPick: (v: string) => void
}) {
  const isPicked = picked === value
  return (
    <label
      className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${
        disabled
          ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
          : isPicked
          ? 'border-amber-400 bg-amber-50'
          : 'border-slate-200 hover:bg-slate-50'
      }`}
    >
      <input
        type="radio"
        name="inspection-asset"
        value={value}
        checked={isPicked}
        disabled={disabled}
        onChange={() => onPick(value)}
      />
      <span className="text-sm flex-1">{label}</span>
      {disabled && disabledHint && (
        <span className="text-[11px] text-slate-500">{disabledHint}</span>
      )}
    </label>
  )
}
