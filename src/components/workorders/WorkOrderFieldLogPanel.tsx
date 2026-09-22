import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, type ApiError } from '@/lib/api'
import type { WorkOrder, WorkOrderVisit, WorkOrderSignature, WorkOrderNteExtension } from '@/types/workOrder'
import { WorkOrderTemplateUpload } from '@/components/workorders/WorkOrderTemplateUpload'

/**
 * Field Log tab on the WO detail page. Surfaces everything captured by
 * the field-workflow endpoints:
 *
 *  - Policy header: what this WO requires (check-in / sig / photos / NTE)
 *  - Visit timeline: check-in / check-out cycles, geofence + override info,
 *    outcomes, signatures captured on each visit
 *  - NTE extension review: dispatcher approves / denies pending requests
 *    inline (POST /v1/nte-extensions/{id}/approve | /deny)
 */

function dollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—'
  return '$' + (cents / 100).toFixed(2)
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function fmtElapsed(visit: WorkOrderVisit): string {
  if (!visit.check_in_at) return '—'
  const start = new Date(visit.check_in_at).getTime()
  const end = visit.check_out_at ? new Date(visit.check_out_at).getTime() : Date.now()
  const mins = Math.round((end - start) / 60000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function OutcomePill({ outcome }: { outcome: WorkOrderVisit['outcome'] }) {
  if (!outcome) {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-800">
        Open
      </span>
    )
  }
  if (outcome === 'completed') {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-emerald-100 text-emerald-800">
        Completed
      </span>
    )
  }
  return (
    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
      Needs return
    </span>
  )
}

function NteStatusPill({ status }: { status: WorkOrderNteExtension['status'] }) {
  const cls =
    status === 'pending'
      ? 'bg-amber-100 text-amber-800'
      : status === 'approved'
      ? 'bg-emerald-100 text-emerald-800'
      : 'bg-rose-100 text-rose-800'
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${cls}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export function WorkOrderFieldLogPanel({ wo }: { wo: WorkOrder }) {
  const qc = useQueryClient()

  const visitsQ = useQuery({
    queryKey: ['wo-visits', wo.id],
    queryFn: () =>
      apiRequest<{ data: WorkOrderVisit[] }>(`/v1/work-orders/${wo.id}/visits`),
  })

  const sigsQ = useQuery({
    queryKey: ['wo-signatures', wo.id],
    queryFn: () =>
      apiRequest<{ data: WorkOrderSignature[] }>(`/v1/work-orders/${wo.id}/signatures`),
  })

  const extQ = useQuery({
    queryKey: ['wo-nte-extensions', wo.id],
    queryFn: () =>
      apiRequest<{ data: WorkOrderNteExtension[] }>(`/v1/work-orders/${wo.id}/nte-extensions`),
  })

  const visits = visitsQ.data?.data ?? []
  const sigs = sigsQ.data?.data ?? []
  const extensions = extQ.data?.data ?? []

  const policy = wo.field_policy
  const hasAnyPolicy =
    policy.requires_check_in_out ||
    policy.requires_signature ||
    policy.min_photos_required > 0 ||
    wo.nte.cents !== null

  return (
    <div className="space-y-6">
      {/* Customer's WO/PO template upload — per job */}
      <WorkOrderTemplateUpload workOrderId={wo.id} />

      {/* Policy header */}
      <section className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
          Field requirements (snapshotted at job creation)
        </div>
        {!hasAnyPolicy ? (
          <div className="text-sm text-slate-500">
            No special requirements on this job. The customer doesn't have a
            field-workflow policy set.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <PolicyCell
              label="Check in / out"
              value={policy.requires_check_in_out ? 'Required' : 'Optional'}
            />
            <PolicyCell
              label="Geofence"
              value={
                policy.requires_check_in_out
                  ? `${policy.geofence_radius_m ?? 150}m`
                  : '—'
              }
            />
            <PolicyCell
              label="Signature"
              value={policy.requires_signature ? 'Required' : 'Optional'}
            />
            <PolicyCell
              label="Min photos"
              value={
                policy.min_photos_required > 0
                  ? `${policy.min_photos_required}${
                      policy.requires_before_after_photos ? ' (before/after)' : ''
                    }`
                  : 'None'
              }
            />
            <PolicyCell
              label="NTE cap"
              value={dollars(wo.nte.cents)}
              sublabel={wo.nte.status ?? undefined}
            />
            <PolicyCell label="Total visits" value={visits.length.toString()} />
            <PolicyCell label="Signatures captured" value={sigs.length.toString()} />
            <PolicyCell
              label="Pending extensions"
              value={extensions.filter((e) => e.status === 'pending').length.toString()}
            />
          </div>
        )}
      </section>

      {/* NTE extension reviews — surface pending ones first, prominently */}
      {extensions.some((e) => e.status === 'pending') && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">
            NTE extension requests
          </h3>
          <div className="space-y-3">
            {extensions
              .filter((e) => e.status === 'pending')
              .map((e) => (
                <ExtensionRow key={e.id} ext={e} woId={wo.id} qc={qc} />
              ))}
          </div>
        </section>
      )}

      {/* Visit timeline */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Visit log
        </h3>
        {visitsQ.isLoading ? (
          <div className="text-sm text-slate-500 italic">Loading visits…</div>
        ) : visits.length === 0 ? (
          <div className="text-sm text-slate-500 italic bg-slate-50 border border-slate-200 rounded p-4">
            No visits yet. The tech hasn't checked in.
          </div>
        ) : (
          <div className="space-y-3">
            {visits.map((v) => (
              <VisitRow
                key={v.id}
                visit={v}
                signatures={sigs.filter((s) => s.visit_id === v.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Closed extensions (collapsed history) */}
      {extensions.some((e) => e.status !== 'pending') && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">
            NTE extension history
          </h3>
          <div className="space-y-2">
            {extensions
              .filter((e) => e.status !== 'pending')
              .map((e) => (
                <ClosedExtensionRow key={e.id} ext={e} />
              ))}
          </div>
        </section>
      )}
    </div>
  )
}

function PolicyCell({
  label,
  value,
  sublabel,
}: {
  label: string
  value: string
  sublabel?: string
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-medium text-navy-900">{value}</div>
      {sublabel && <div className="text-[11px] text-slate-400">{sublabel}</div>}
    </div>
  )
}

function VisitRow({
  visit,
  signatures,
}: {
  visit: WorkOrderVisit
  signatures: WorkOrderSignature[]
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-sm font-semibold text-navy-900">
            Visit #{visit.visit_number}
          </span>
          <span className="ml-2 text-xs text-slate-500">
            {visit.tech?.name ?? visit.tech_account_id}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {visit.auto_checked_in && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700" title="Checked in automatically by geofence">
              Auto check-in
            </span>
          )}
          {visit.left_site_at && !visit.check_out_at && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-700" title="Tech left the geofence without checking out">
              Left site
            </span>
          )}
          {visit.gps_issue_reported_at && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-600" title="Tech reported still working / GPS issue">
              GPS issue
            </span>
          )}
          <OutcomePill outcome={visit.outcome} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <div className="text-slate-500">Checked in</div>
          <div className="text-slate-900">{fmtDate(visit.check_in_at)}</div>
        </div>
        <div>
          <div className="text-slate-500">Checked out</div>
          <div className="text-slate-900">{fmtDate(visit.check_out_at)}</div>
        </div>
        <div>
          <div className="text-slate-500">Elapsed</div>
          <div className="text-slate-900">{fmtElapsed(visit)}</div>
        </div>
        <div>
          <div className="text-slate-500">GPS distance</div>
          <div className="text-slate-900">
            {visit.check_in_distance_m !== null
              ? `${visit.check_in_distance_m}m`
              : '—'}
          </div>
        </div>
      </div>

      {visit.geofence_overridden && (
        <div className="mt-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-3 py-2">
          <strong>Geofence override:</strong> {visit.geofence_override_reason ?? '(no reason given)'}
        </div>
      )}

      {visit.outcome === 'return_needed' && visit.return_reason && (
        <div className="mt-2 text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded px-3 py-2">
          <strong>Return reason:</strong> {visit.return_reason}
        </div>
      )}

      {visit.gps_issue_reported_at && (
        <div className="mt-2 text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded px-3 py-2">
          <strong>Still working / GPS issue</strong>
          {visit.gps_issue_note ? `: ${visit.gps_issue_note}` : ' reported'}
          {' — '}{fmtDate(visit.gps_issue_reported_at)}
        </div>
      )}

      {visit.notes && (
        <div className="mt-2 text-xs text-slate-600 italic">{visit.notes}</div>
      )}

      {signatures.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
            Signatures on this visit
          </div>
          <div className="flex flex-wrap gap-3">
            {signatures.map((s) => (
              <div key={s.id} className="text-xs">
                <div className="font-medium text-slate-900">{s.signer_name}</div>
                {s.signer_role && <div className="text-slate-500">{s.signer_role}</div>}
                <div className="text-slate-400">{fmtDate(s.captured_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ExtensionRow({
  ext,
  woId,
  qc,
}: {
  ext: WorkOrderNteExtension
  woId: string
  qc: ReturnType<typeof useQueryClient>
}) {
  const [notes, setNotes] = useState('')

  const approve = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/nte-extensions/${ext.id}/approve`, {
        method: 'POST',
        body: { review_notes: notes || null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wo-nte-extensions', woId] })
      qc.invalidateQueries({ queryKey: ['work-order', woId] })
    },
  })

  const deny = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/nte-extensions/${ext.id}/deny`, {
        method: 'POST',
        body: { review_notes: notes || null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wo-nte-extensions', woId] })
      qc.invalidateQueries({ queryKey: ['work-order', woId] })
    },
  })

  const busy = approve.isPending || deny.isPending

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-sm font-semibold text-navy-900">
            +{dollars(ext.requested_increase_cents)} requested
          </div>
          <div className="text-xs text-slate-600">{fmtDate(ext.requested_at)}</div>
        </div>
        <NteStatusPill status={ext.status} />
      </div>
      <p className="text-sm text-slate-700 mb-3 whitespace-pre-wrap">{ext.reason}</p>
      {(approve.isError || deny.isError) && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 mb-2">
          {((approve.error ?? deny.error) as ApiError)?.message ?? 'Action failed.'}
        </div>
      )}
      <textarea
        className="w-full text-xs rounded border border-slate-300 px-2 py-1 mb-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
        rows={2}
        placeholder="Review notes (optional)…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => approve.mutate()}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50"
        >
          {approve.isPending ? 'Approving…' : `Approve +${dollars(ext.requested_increase_cents)}`}
        </button>
        <button
          type="button"
          onClick={() => deny.mutate()}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
        >
          {deny.isPending ? 'Denying…' : 'Deny'}
        </button>
      </div>
    </div>
  )
}

function ClosedExtensionRow({ ext }: { ext: WorkOrderNteExtension }) {
  return (
    <div className="bg-white border border-slate-200 rounded p-3 text-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">
          +{dollars(ext.requested_increase_cents)}
        </span>
        <NteStatusPill status={ext.status} />
      </div>
      <div className="text-xs text-slate-600 mb-1">{ext.reason}</div>
      {ext.review_notes && (
        <div className="text-xs text-slate-500 italic">Review: {ext.review_notes}</div>
      )}
      <div className="text-[11px] text-slate-400 mt-1">
        Requested {fmtDate(ext.requested_at)}
        {ext.reviewed_at && ` · Reviewed ${fmtDate(ext.reviewed_at)}`}
      </div>
    </div>
  )
}
