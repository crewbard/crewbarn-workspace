import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ToastPrefToggle } from '@/components/ToastPrefToggle'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { IconRefresh } from '@tabler/icons-react'
import { IntakePhotos } from '@/components/ai/IntakePhotos'
import { VehicleKeyLink } from '@/components/VehicleKeyOverlay'
import { ReferencedText } from '@/components/ReferencedText'
import { IntakeFollowUp } from '@/components/ai/IntakeFollowUp'
import { IntakeReplies } from '@/components/ai/IntakeReplies'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listCatalogItems } from '@/lib/catalogItems'
import type { CatalogItem } from '@/types/catalogItem'
import {
  correctAiIntakePart,
  dismissAiIntakeDraft,
  formatPhone,
  getAiIntakePartAvailability,
  researchAiIntakePart,
  type IntakeCorrectionPart,
  type IntakePartResearch,
  listAiIntakeDrafts,
  retryAiIntakeDraft,
  updateAiIntakeDraft,
  type AiIntakeDraft,
} from '@/lib/comms'
import { relativeTime } from '@/components/comms/ConversationThread'

type DraftStatus = 'pending' | 'reviewed' | 'approved' | 'failed' | 'dismissed' | 'all'

const STATUS_FILTERS: Array<{ id: DraftStatus; label: string }> = [
  { id: 'pending', label: 'Pending' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'approved', label: 'Approved' },
  { id: 'failed', label: 'Failed' },
  { id: 'dismissed', label: 'Dismissed' },
  { id: 'all', label: 'All' },
]

const QUEUE_KEY = ['ai-intake-drafts', 'intake'] as const

export function AiIntakeQueuePage({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<DraftStatus>('pending')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: [...QUEUE_KEY, status, page],
    queryFn: () => listAiIntakeDrafts({ status, profile: 'intake', perPage: 50, page }),
    // New drafts arrive live over Reverb (IntakeToasts invalidates this key);
    // this poll is just a backstop + a focus refetch. Overrides the app-wide
    // refetchOnWindowFocus:false.
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  const drafts = query.data?.data ?? []
  useEffect(() => {
    if (query.data && page > Math.max(1, query.data.last_page)) {
      setPage(Math.max(1, query.data.last_page))
      setSelectedId(null)
    }
  }, [query.data, page])
  const selected = useMemo(
    () => drafts.find((draft) => draft.id === selectedId) ?? drafts[0] ?? null,
    [drafts, selectedId],
  )

  const dismissMutation = useMutation({
    mutationFn: dismissAiIntakeDraft,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUEUE_KEY }),
  })

  const reopenMutation = useMutation({
    mutationFn: (id: string) => updateAiIntakeDraft(id, { status: 'pending' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUEUE_KEY }),
  })

  const retryMutation = useMutation({
    mutationFn: retryAiIntakeDraft,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUEUE_KEY }),
  })

  return (
    <div className={embedded ? 'flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50' : 'flex h-[calc(100vh-5rem)] flex-col bg-slate-50'}>
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-navy-900">{embedded ? 'Hands-on intake training' : 'Intake Queue'}</h1>
            <p className="text-sm text-slate-500">
              Review AI-extracted service intake messages before creating jobs or estimates.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ToastPrefToggle area="intake" label="New intake" />
            <div className="text-xs text-slate-400">
              {query.isSuccess ? (query.data?.total ?? drafts.length) : '—'} draft{(query.data?.total ?? drafts.length) === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </div>

      <div className={`min-h-0 flex-1 grid grid-cols-1 ${embedded ? '' : 'lg:grid-cols-[25rem_1fr]'}`}>
        <aside className={`${selectedId && !query.isError ? (embedded ? 'hidden' : 'hidden lg:block') : ''} min-h-0 border-r border-slate-200 bg-white`}>
          <div className="border-b border-slate-100 p-3">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 sm:grid-cols-6">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={status === item.id}
                  data-easy-view-option
                  onClick={() => {
                    setStatus(item.id)
                    setPage(1)
                    setSelectedId(null)
                  }}
                  className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                    status === item.id
                      ? 'bg-white text-navy-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className={embedded ? 'max-h-[36rem] overflow-y-auto' : 'h-[calc(100%-8rem)] overflow-y-auto'}>
            {query.isLoading ? (
              <ListSkeleton />
            ) : query.isError ? (
              <div role="alert" className="p-4 text-sm text-red-700">Intake drafts could not be loaded. <button type="button" onClick={() => { void query.refetch() }} disabled={query.isFetching} className="underline disabled:opacity-50">Retry</button></div>
            ) : drafts.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                No {status === 'all' ? 'intake' : status} drafts right now.
              </div>
            ) : (
              drafts.map((draft) => (
                <DraftRow
                  key={draft.id}
                  draft={draft}
                  active={draft.id === selected?.id}
                  onClick={() => setSelectedId(draft.id)}
                />
              ))
            )}
          </div>
          {query.data && <nav aria-label="Intake queue pages" className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-3 text-xs"><button type="button" disabled={page <= 1 || query.isFetching} onClick={() => { setPage(value => value - 1); setSelectedId(null) }} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold disabled:opacity-40">← Previous</button><span role="status">Page {page} of {Math.max(1, query.data.last_page)} · {query.data.total} drafts</span><button type="button" disabled={page >= query.data.last_page || query.isFetching} onClick={() => { setPage(value => value + 1); setSelectedId(null) }} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold disabled:opacity-40">Next →</button></nav>}
        </aside>

        <main className={`${selectedId && !query.isError ? '' : 'hidden'} min-w-0 overflow-y-auto ${embedded ? '' : 'lg:block'}`}>
          <button type="button" onClick={() => setSelectedId(null)} className={`m-3 min-h-11 rounded-lg border border-slate-300 px-4 text-sm ${embedded ? '' : 'lg:hidden'}`}>← Back to intake</button>
          {(dismissMutation.isError || reopenMutation.isError || retryMutation.isError) && <p role="alert" className="m-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">The action could not be completed. Please try again.</p>}
          {selected && !query.isError ? (
            <DraftDetail
              key={selected.id}
              draft={selected}
              dismissing={dismissMutation.isPending}
              reopening={reopenMutation.isPending}
              retrying={retryMutation.isPending}
              onDismiss={() => dismissMutation.mutate(selected.id)}
              onReopen={() => reopenMutation.mutate(selected.id)}
              onRetry={() => retryMutation.mutate(selected.id)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Select an intake draft to review.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function DraftRow({
  draft,
  active,
  onClick,
}: {
  draft: AiIntakeDraft
  active: boolean
  onClick: () => void
}) {
  const extracted = draft.extracted_json ?? {}
  const vehicle = objectValue(extracted.vehicle)
  const customer = draft.proposed_customer_json ?? {}
  const title = stringValue(customer.display_name)
    || stringValue(customer.business_name)
    || stringValue(customer.first_name)
    || formatPhone(draft.comms_message?.from_number)
    || 'Unknown intake'
  const vin = stringValue(vehicle.vin)
  const vehicleLabel = [stringValue(vehicle.year), stringValue(vehicle.make), stringValue(vehicle.model)]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
        active ? 'border-l-4 border-l-amber-500 bg-amber-50 pl-3' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-navy-900">{title}</span>
            <StatusBadge status={draft.status} />
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-400">
            {vehicleLabel || vin || draft.classification || 'AI extracted intake'}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {/* Worth seeing before opening: a photo intake is usually the one
              you can act on fastest, because the customer already showed you
              the problem. */}
          {(draft.comms_message?.media_urls?.length ?? 0) > 0 && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              {draft.comms_message!.media_urls.length} 📷
            </span>
          )}
          <span className="text-xs text-slate-400">{relativeTime(draft.created_at ?? null)}</span>
        </div>
      </div>
      <div className="mt-2 line-clamp-2 text-xs text-slate-600">
        {draft.transcript_text || draft.error || 'No transcript text.'}
      </div>
    </button>
  )
}

function DraftDetail({
  draft,
  dismissing,
  reopening,
  retrying,
  onDismiss,
  onReopen,
  onRetry,
}: {
  draft: AiIntakeDraft
  dismissing: boolean
  reopening: boolean
  retrying: boolean
  onDismiss: () => void
  onReopen: () => void
  onRetry: () => void
}) {
  const extracted = draft.extracted_json ?? {}
  const customer = draft.proposed_customer_json ?? {}
  const location = draft.proposed_location_json ?? {}
  const job = draft.proposed_job_json ?? {}
  const estimate = draft.proposed_estimate_json ?? {}
  const vehicle = objectValue(extracted.vehicle ?? job.vehicle)
  const keyFob = objectValue(extracted.key_fob ?? job.key_fob)
  const equipment = objectValue(extracted.equipment ?? job.equipment)
  const asset = objectValue(extracted.asset ?? job.asset)
  const parts = objectValue(extracted.parts ?? job.parts)
  const dealer = objectValue(extracted.dealer ?? job.dealer)
  const billing = objectValue(extracted.billing ?? job.billing)
  const warnings = Array.isArray(extracted.warnings)
    ? extracted.warnings.filter((warning): warning is string => typeof warning === 'string')
    : []
  const converted = draft.status === 'approved' || Boolean(draft.created_work_order_id)
  const createPath = draft.classification === 'estimate'
    ? `/estimates/new?ai_intake_draft_id=${encodeURIComponent(draft.id)}`
    : `/jobs/new?ai_intake_draft_id=${encodeURIComponent(draft.id)}`

  return (
    <div className="mx-auto max-w-6xl px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-navy-900">{detailTitle(draft)}</h2>
            <StatusBadge status={draft.status} />
            {draft.classification && <Pill>{draft.classification}</Pill>}
            {typeof draft.confidence === 'number' && <Pill>{Math.round(draft.confidence * 100)}% extraction confidence · not readiness</Pill>}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {sourceLine(draft)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {draft.comms_message?.conversation_id && (
            <Link
              to={`/communications?conversation=${encodeURIComponent(draft.comms_message.conversation_id)}`}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Open thread
            </Link>
          )}
          {converted ? null : draft.status === 'dismissed' ? (
            <button
              type="button"
              onClick={onReopen}
              disabled={reopening}
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
            >
              {reopening ? 'Reopening...' : 'Reopen'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              disabled={dismissing}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-60"
            >
              {dismissing ? 'Dismissing...' : 'Dismiss'}
            </button>
          )}
          {converted ? (draft.created_work_order_id ? <Link to={`/jobs/${encodeURIComponent(draft.created_work_order_id)}`} className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Open approved job →</Link> : <span className="text-sm text-slate-500">Already approved</span>) : draft.status === 'failed' ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-60"
            >
              <IconRefresh size={16} aria-hidden="true" />
              {retrying ? 'Queuing retry...' : 'Retry AI extraction'}
            </button>
          ) : draft.status === 'pending' || draft.status === 'reviewed' ? (
            <Link
              to={createPath}
              className="rounded-md bg-amber-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              {draft.classification === 'estimate' ? 'Create estimate' : 'Create job'}
            </Link>
          ) : null}
        </div>
      </div>

      <IntakeTrainingReview draft={draft} />
      <IntakeFollowUp key={draft.id} draft={draft} />
      <IntakeReplies key={`replies:${draft.id}`} draft={draft} />

      {draft.error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {intakeErrorMessage(draft.error)}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Warnings</div>
          <ul className="mt-1 space-y-1 text-sm text-amber-900">
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="space-y-5">
          <InfoSection title="Customer">
            <Field label="Name" value={stringValue(customer.display_name) || personName(customer)} />
            <Field label="Business" value={stringValue(customer.business_name)} />
            <Field label="Phone" value={formatPhone(stringValue(customer.phone))} />
            <Field label="Email" value={stringValue(customer.email)} />
          </InfoSection>

          <InfoSection title="Asset / Equipment">
            <Field label="VIN" value={stringValue(vehicle.vin)} mono />
            {/* A VIN read off a photo that fails its own check digit was
                misread. Saying so beside the number is the difference between
                a dispatcher confirming it and a wrong key being ordered — the
                characters still look perfectly legitimate. */}
            {Boolean(vehicle.vin) && vehicle.vin_checksum_valid === false && (
              <p className="-mt-1 pl-1 text-xs font-semibold text-rose-700">
                ⚠ Check digit fails — misread from the photo. Confirm against the
                document before ordering.
              </p>
            )}
            <Field label="Vehicle">
              {/*
                The keys, parts and tools for this vehicle, one click
                from the draft. Linked from the extracted fields rather
                than from the sentence they came out of.
              */}
              <VehicleKeyLink
                make={stringValue(vehicle.make)}
                model={[vehicle.model, vehicle.trim].map(stringValue).filter(Boolean).join(' ')}
                year={stringValue(vehicle.year)}
                label={[vehicle.year, vehicle.make, vehicle.model, vehicle.trim].map(stringValue).filter(Boolean).join(' ')}
              />
            </Field>
            <Field label="Stock" value={stringValue(vehicle.stock_number)} />
            <Field label="Plate" value={stringValue(vehicle.license_plate)} />
            <Field label="Key / fob" value={keyFobSummary(keyFob)} multiline />
            <Field label="Equipment" value={equipmentSummary(equipment, asset)} multiline />
            <Field label="NHTSA" value={nhtsaSummary(vehicle)} />
          </InfoSection>

          <InfoSection title="Part Guess">
            <Field label="Best guess" value={stringValue(parts.best_guess)} />
            <Field label="Confidence" value={percentValue(parts.confidence)} />
            <Field label="Alternates" value={partCandidates(parts)} multiline />
            <PartAvailability key={`avail-${draft.id}`} draft={draft} />
            <PartCorrection key={draft.id} draft={draft} />
          </InfoSection>

          <InfoSection title="Dealer / Billing">
            <Field label="Dealer" value={stringValue(dealer.name)} />
            <Field label="Contact" value={stringValue(dealer.contact_name)} />
            <Field label="RO / PO" value={stringValue(dealer.po_or_ro_number)} />
            <Field label="Bill to" value={stringValue(billing.bill_to)} />
            <Field label="Dealer auth" value={stringValue(billing.dealer_authorized_amount)} />
            <Field label="Customer part" value={stringValue(billing.customer_responsibility)} />
          </InfoSection>
        </section>

        <section className="space-y-5">
          <InfoSection title={draft.classification === 'estimate' ? 'Estimate Draft' : 'Job Draft'}>
            <Field label="Title" value={stringValue(job.title) || stringValue(estimate.title)} />
            <Field label="Service" value={stringValue(job.requested_service)} />
            <Field label="Priority" value={stringValue(job.priority)} />
            <Field label="Requested" value={[job.requested_date, job.requested_time].map(stringValue).filter(Boolean).join(' ')} />
            <Field label="Scope" multiline>
              <ReferencedText text={stringValue(job.description) || stringValue(estimate.scope)} />
            </Field>
          </InfoSection>

          <InfoSection title="Service Address">
            <Field label="Address" value={addressLine(location)} multiline />
            <Field label="Entry notes" value={stringValue(location.entry_notes)} multiline />
            <Field label="Vehicle notes" value={stringValue(location.vehicle_location_notes)} multiline />
          </InfoSection>


          <IntakePhotos key={draft.id} draftId={draft.id} />
          <InfoSection title="Transcript">
            <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {draft.transcript_text || 'No transcript text.'}
            </div>
          </InfoSection>
        </section>
      </div>
    </div>
  )
}

/**
 * Teach the AI the right part when it guessed wrong.
 *
 * Worth more than this one draft: the correction saves to the shop's AI memory,
 * so the next call about the same vehicle is guessed correctly. A wrong part is
 * the expensive mistake — it sends a tech out with the wrong key.
 *
 * The AI's original guess stays on the card above this. Keeping the wrong guess
 * visible next to the correction is the point: it's the evidence of what the AI
 * got wrong, and it's how you can tell the correction actually took.
 *
 * Remount with key={draft.id} at the callsite — otherwise a half-typed
 * correction would follow you onto the next draft you click.
 */
function IntakeTrainingReview({ draft }: { draft: AiIntakeDraft }) {
  const review = objectValue(draft.extracted_json?._human_review)
  const history = Array.isArray(review.history) ? review.history.map(objectValue).slice().reverse() : []
  const approved = draft.status === 'approved' || Boolean(draft.created_work_order_id)
  const labels: Record<string, string> = {
    proposed_customer_json: 'Customer details', proposed_location_json: 'Service address',
    proposed_job_json: 'Job details', proposed_estimate_json: 'Estimate details',
    matched_customer_id: 'Customer match', matched_location_id: 'Location match',
    classification: 'Request type', confidence: 'Confidence value',
    parts_correction: 'Parts correction',
    photo_annotation: 'Photo identification',
  }
  const fields = Array.isArray(review.edited_fields) ? review.edited_fields.filter((field): field is string => typeof field === 'string') : []
  const actionLabels: Record<string, string> = {
    reviewed: 'Intake reviewed', dismissed: 'Intake set aside',
    job_created_by_human: 'Job created by a person',
    parts_corrected_locally: 'Parts corrected · this intake only',
    photo_identified: 'Photo identified · this intake only',
    photo_lesson_saved: 'Photo identified · lasting lesson saved',
    parts_corrected_and_remembered: 'Parts corrected · lasting lesson saved',
  }
  const date = typeof review.reviewed_at === 'string' ? new Date(review.reviewed_at) : null
  const recordedAt = date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : null
  return <section aria-label="Intake training review" className="my-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-start justify-between gap-3 bg-navy-900 p-5 text-white">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Teach CBI · Intake</p><h3 className="mt-1 text-lg font-bold">{approved ? 'Approved by your team' : draft.status === 'dismissed' ? 'Set aside by your team' : 'Your review comes first'}</h3><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">Check the original message, correct the details, then choose whether to create the job. Extraction confidence is not permission to act.</p></div>
      <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold">Human-controlled workflow</span>
    </div>
    <div className="grid gap-4 p-5 md:grid-cols-3">
      <div><h4 className="text-sm font-bold text-navy-900">1 · Check the source</h4><p className="mt-2 text-sm text-slate-600">Compare the customer’s request with the proposed details. Resolve missing or uncertain information.</p></div>
      <div><h4 className="text-sm font-bold text-navy-900">2 · Correct this intake</h4><p className="mt-2 text-sm text-slate-600">Corrections apply to this request. Lasting CBI rules require training permission and a separate teaching action.</p></div>
      <div><h4 className="text-sm font-bold text-navy-900">3 · Approve the work</h4><p className="mt-2 text-sm text-slate-600">Job creation stays a human decision. No automatic customer follow-up is enabled by this review.</p></div>
    </div>
    <div className="border-t border-slate-100 px-5 py-4">
      <p className="text-sm font-semibold text-navy-900">{recordedAt ? `Latest recorded review · ${recordedAt}` : 'No review evidence recorded yet'}</p>
      {fields.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{fields.map(field => <span key={field} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{labels[field] ?? field.replaceAll('_', ' ')}</span>)}</div>}
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{fields.length ? 'These areas were edited during review. ' : ''}Recent history retains up to 50 events, starting when history recording was deployed. It is not a permanent audit trail or an agreement score.</p>
      {history.length > 0 && <details className="mt-4 rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-navy-900">Recent review history · {history.length} recorded events</summary>
        <ol className="mt-3 max-h-80 space-y-3 overflow-y-auto">
          {history.map((event, index) => <li key={index} className="border-t border-slate-100 pt-3 text-sm">
            <p className="font-semibold text-slate-800">{actionLabels[stringValue(event.action)] ?? (stringValue(event.action).replaceAll('_', ' ') || 'Review')}</p>
            <p className="mt-1 break-words text-xs text-slate-500">{stringValue(event.reviewed_at)} · Reviewer: {stringValue(event.actor_id) || 'Not recorded'}</p>
            <p className="mt-1 text-xs text-slate-600">{Array.isArray(event.edited_fields) && event.edited_fields.length ? event.edited_fields.filter((field): field is string => typeof field === 'string').map(field => labels[field] ?? field.replaceAll('_', ' ')).join(', ') : 'No field changes recorded for this action.'}</p>
          </li>)}
        </ol>
      </details>}
    </div>
  </section>
}

function PartCorrection({ draft }: { draft: AiIntakeDraft }) {
  const permissions = usePermissions()
  const canTeach = permissions.has(PERM.AI_TRAIN)
  const [remember, setRemember] = useState(false)
  const queryClient = useQueryClient()
  const parts = objectValue(objectValue(draft.extracted_json ?? {}).parts)
  const saved = objectValue(parts.shop_correction)
  const savedParts = Array.isArray(saved.parts) ? saved.parts.map(objectValue) : []
  const savedDecider = stringValue(saved.decider)
  const savedNotes = stringValue(saved.notes)

  const [open, setOpen] = useState(false)
  // A LIST: on a changeover year several parts are all correct, and saving one
  // would teach CBI half the truth.
  const [selected, setSelected] = useState<IntakeCorrectionPart[]>([])
  const [part, setPart] = useState('')
  const [decider, setDecider] = useState('')
  const [notes, setNotes] = useState('')
  const [research, setResearch] = useState<IntakePartResearch | null>(null)

  // Debounced so a typed part number is one search, not one per keystroke.
  const [term, setTerm] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setTerm(part.trim()), 250)
    return () => clearTimeout(timer)
  }, [part])

  const suggestions = useQuery({
    queryKey: ['catalog-items', 'intake-part-picker', term],
    queryFn: () => listCatalogItems({ q: term, per_page: 6 }),
    enabled: open && term.length >= 2,
    staleTime: 60_000,
  })

  // A proposal, never an action: it fills the list and a human still saves.
  const researchMutation = useMutation({
    mutationFn: (refresh: boolean) => researchAiIntakePart(draft.id, refresh),
    onSuccess: (data) => {
      setResearch(data)
      // The decider is the most valuable thing research produces — it's what
      // teaches CBI to ask for the VIN instead of guessing. Don't make someone
      // retype it, but never clobber what they wrote themselves.
      if (data.decider && !decider.trim()) setDecider(data.decider)
    },
  })

  const mutation = useMutation({
    mutationFn: () => correctAiIntakePart(draft.id, {
      parts: selected,
      remember: remember && canTeach,
      decider: decider.trim() || null,
      notes: notes.trim() || null,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUEUE_KEY })
      // New parts mean new stock, a different truck, possibly a different tech.
      void queryClient.invalidateQueries({ queryKey: availabilityKey(draft.id) })
      void queryClient.invalidateQueries({ queryKey: ['photo-training-history', draft.id] })
      reset()
    },
  })

  function reset() {
    setRemember(false)
    setOpen(false)
    setSelected([])
    setPart('')
    setDecider('')
    setNotes('')
    setResearch(null)
  }

  function addPart(next: IntakeCorrectionPart) {
    const label = next.label.trim()
    if (label.length < 2) return
    setSelected((current) =>
      current.some((item) => item.label.toLowerCase() === label.toLowerCase())
        ? current
        : [...current, { ...next, label }],
    )
    setPart('')
  }

  function removePart(label: string) {
    setSelected((current) => current.filter((item) => item.label !== label))
  }

  const isSelected = (label: string) =>
    selected.some((item) => item.label.toLowerCase() === label.trim().toLowerCase())

  if (savedParts.length && !open) {
    return (
      <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Corrected by shop
            </div>

            <ul className="mt-1 space-y-0.5">
              {savedParts.map((item, index) => (
                <li key={`${stringValue(item.label)}-${index}`} className="text-sm text-emerald-900">
                  <span className="font-semibold">{stringValue(item.label)}</span>
                  {stringValue(item.fits) ? (
                    <span className="text-emerald-700"> — fits {stringValue(item.fits)}</span>
                  ) : null}
                </li>
              ))}
            </ul>

            {/* Without this, a list of parts reads as "any of these will do". */}
            {savedDecider ? (
              <div className="mt-1 text-xs font-medium text-emerald-800">
                {savedDecider} decides which.
              </div>
            ) : null}

            {savedNotes ? (
              <div className="mt-1 whitespace-pre-wrap text-sm text-emerald-800">{savedNotes}</div>
            ) : null}

            <div className="mt-2 text-xs text-emerald-700">
              {saved.memory_id ? 'Saved as CBI knowledge for future matching.' : 'Corrected for this intake only. No new lasting knowledge was saved.'}
            </div>
          </div>

          <button
            type="button"
            className="shrink-0 text-xs font-medium text-emerald-700 underline hover:text-emerald-900"
            onClick={() => {
              setSelected(savedParts.map((item) => ({
                label: stringValue(item.label),
                fits: stringValue(item.fits) || null,
                catalog_item_id: stringValue(item.catalog_item_id) || null,
              })))
              setDecider(savedDecider)
              setNotes(savedNotes)
              setOpen(true)
            }}
          >
            Change
          </button>
        </div>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        onClick={() => setOpen(true)}
      >
        Wrong part? Teach CBI the right one
      </button>
    )
  }

  const canSave = selected.length > 0 && !mutation.isPending && draft.supports_local_correction === true

  return (
    <form
      className="mt-3 space-y-3 rounded-md border border-slate-300 bg-slate-50 p-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSave) mutation.mutate()
      }}
    >
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="correct-part">
          Correct parts
        </label>

        {selected.length ? (
          <ul className="mt-1 space-y-1">
            {selected.map((item) => (
              <li
                key={item.label}
                className="flex items-start justify-between gap-2 rounded-md border border-navy-200 bg-white px-2 py-1.5"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm font-medium text-navy-900">{item.label}</div>
                  {item.fits ? (
                    <div className="text-xs text-slate-500">fits {item.fits}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 text-xs font-medium text-slate-400 hover:text-red-600"
                  onClick={() => removePart(item.label)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-1 flex gap-2">
          <input
            id="correct-part"
            type="text"
            autoComplete="off"
            value={part}
            onChange={(event) => setPart(event.target.value)}
            onKeyDown={(event) => {
              // Enter adds the part; it must not submit the half-built form.
              if (event.key === 'Enter') {
                event.preventDefault()
                addPart({ label: part })
              }
            }}
            placeholder={selected.length ? 'Add another part' : 'Search the catalog, or type the part'}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={part.trim().length < 2}
            className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            onClick={() => addPart({ label: part })}
          >
            Add
          </button>
        </div>

        {/* Free text still saves and still teaches — picking is better because
            it pins an exact item for the stock lookup, but a part you don't
            stock shouldn't be unrecordable. */}
        {suggestions.data?.data?.length ? (
          <ul className="mt-1 divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
            {suggestions.data.data.map((item: CatalogItem) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={isSelected(item.name)}
                  className="flex w-full items-baseline justify-between gap-2 px-2 py-1.5 text-left hover:bg-slate-50 disabled:opacity-40"
                  onClick={() => addPart({ label: item.name, catalog_item_id: item.id })}
                >
                  <span className="truncate text-sm text-slate-700">{item.name}</span>
                  {item.sku ? (
                    <span className="shrink-0 font-mono text-xs text-slate-400">{item.sku}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {term.length >= 2 && !suggestions.isFetching && suggestions.data?.data?.length === 0 ? (
          <div className="mt-1 text-xs text-slate-500">
            No catalog match — adding as text still teaches CBI.
          </div>
        ) : null}
      </div>

      {/* Research lives INSIDE the correction flow on purpose: it only runs
          once a human has judged the guess wrong, so a draft it got right never
          costs a search. */}
      {!research ? (
        <button
          type="button"
          onClick={() => researchMutation.mutate(false)}
          disabled={researchMutation.isPending}
          className="text-xs font-medium text-navy-700 underline hover:text-navy-900 disabled:opacity-50"
        >
          {researchMutation.isPending ? 'Researching…' : 'Not sure? Research what it takes'}
        </button>
      ) : null}

      {research && !research.ok ? (
        <div className="text-xs text-red-600">{research.error ?? 'Research failed.'}</div>
      ) : null}

      {research?.ok ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-800">
            Researched — add the ones that apply
          </div>

          {research.no_part_needed ? (
            <div className="mt-1 text-sm font-semibold text-amber-950">
              No part needed — this one is labor only.
            </div>
          ) : null}

          {research.parts.length ? (
            <ul className="mt-2 space-y-2">
              {research.parts.map((item) => (
                <li
                  key={`${item.part_number}-${item.fits ?? ''}`}
                  className="rounded border border-amber-200 bg-white p-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-amber-950">
                      {item.part_number}
                    </span>
                    {item.confidence !== null ? (
                      <span className="text-xs text-amber-700">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    ) : null}
                  </div>

                  {item.type ? (
                    <div className="text-sm text-amber-900">
                      {item.type}
                      {item.buttons ? ` · ${item.buttons} button` : ''}
                    </div>
                  ) : null}

                  {/* On a split year this is the line that matters — it's what
                      tells you WHICH of these the truck in front of you takes. */}
                  {item.fits ? (
                    <div className="text-xs text-amber-800">Fits {item.fits}</div>
                  ) : null}

                  {item.fcc_id && item.fcc_id !== item.part_number ? (
                    <div className="font-mono text-xs text-amber-700">FCC {item.fcc_id}</div>
                  ) : null}

                  {item.catalog_sku ? (
                    <div className="mt-0.5 font-mono text-xs text-emerald-700">
                      {item.catalog_sku} — you stock this
                    </div>
                  ) : null}

                  <button
                    type="button"
                    disabled={isSelected(item.part_number)}
                    className="mt-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-40"
                    onClick={() => addPart({ label: item.part_number, fits: item.fits })}
                  >
                    {isSelected(item.part_number) ? 'Added' : 'Add'}
                  </button>
                </li>
              ))}
            </ul>
          ) : !research.no_part_needed ? (
            <div className="mt-1 text-sm text-amber-900">
              No part numbers came back. Research again, or type the part.
            </div>
          ) : null}

          {research.reasoning ? (
            <div className="mt-2 whitespace-pre-wrap text-sm text-amber-900">{research.reasoning}</div>
          ) : null}

          {research.cautions ? (
            <div className="mt-1 text-xs font-medium text-amber-800">Watch out: {research.cautions}</div>
          ) : null}

          {research.sources.length ? (
            <ul className="mt-2 space-y-0.5">
              {research.sources.map((source) => (
                <li key={source.url} className="truncate text-xs">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-amber-800 underline hover:text-amber-950"
                  >
                    {source.title ?? source.url}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 text-xs text-amber-700">
              {research.searched_web
                ? 'No sources cited — check this before approving.'
                : 'Your AI provider has no web search, so this is the model’s own knowledge with no sources. Check it before approving.'}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="text-xs font-medium text-amber-700 hover:text-amber-900"
              onClick={() => researchMutation.mutate(true)}
              disabled={researchMutation.isPending}
            >
              {researchMutation.isPending ? 'Researching…' : 'Research again'}
            </button>
            <button
              type="button"
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
              onClick={() => setResearch(null)}
            >
              Discard
            </button>
          </div>
        </div>
      ) : null}

      {/* Only meaningful with more than one part — with a single part there is
          nothing to decide between. */}
      {selected.length > 1 ? (
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="correct-part-decider">
            What decides which one
          </label>
          <input
            id="correct-part-decider"
            type="text"
            autoComplete="off"
            value={decider}
            onChange={(event) => setDecider(event.target.value)}
            placeholder="e.g. ignition type — match the FCC ID on the customer's key"
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <div className="mt-1 text-xs text-slate-500">
            This is what teaches CBI to ask instead of guess.
          </div>
        </div>
      ) : null}

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="correct-part-notes">
          Why (optional)
        </label>
        <textarea
          id="correct-part-notes"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="What the AI missed — this is what teaches it the rule, not just the answer."
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        {!draft.supports_local_correction && <p role="alert" className="mb-3 text-sm text-amber-900">Update the API and refresh this intake before saving. The older API does not support the “fix only” choice.</p>}
        <label className="flex items-start gap-3 text-sm font-semibold text-navy-900"><input type="checkbox" checked={remember && canTeach} disabled={!canTeach || mutation.isPending} onChange={e => setRemember(e.target.checked)} className="mt-1" />Also teach CBI this correction</label>
        <p className="mt-2 text-xs text-slate-600">{canTeach ? 'Off fixes only this intake. On saves these parts, fit conditions, and notes as confirmed knowledge for future matching. It does not grant permission to order parts or create jobs automatically.' : 'You can correct this intake. An owner must grant “Can train and correct CBI” before you can save lasting knowledge.'}</p>
        {remember && canTeach && <div className="mt-3 rounded-lg bg-white p-3 text-sm"><strong>CBI will remember</strong><p className="mt-1">{selected.map(part => part.label).join(' · ')}</p>{decider.trim() && <p className="mt-1">Which one applies: {decider.trim()}</p>}{notes.trim() && <p className="mt-1 whitespace-pre-wrap">{notes.trim()}</p>}<p className="mt-2 text-xs text-slate-500">Saved with this intake as its source.</p></div>}
      </div>
      {mutation.isError ? (
        <div className="text-xs text-red-600">
          Couldn&apos;t save that correction. Try again.
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!canSave}
          className="rounded-md bg-navy-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : remember && canTeach ? 'Fix it and remember' : 'Just fix this intake'}
        </button>
        <button
          type="button"
          className="text-xs font-medium text-slate-500 hover:text-slate-700"
          onClick={reset}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

const availabilityKey = (draftId: string) => ['ai-intake-part-availability', draftId] as const

/**
 * Do we have it, whose truck is it on, and who can program it — the three
 * things dispatch needs before promising a customer anything, which until now
 * lived across three screens and were only reachable by asking CBI in chat.
 *
 * Never cached: stock and truck contents move all day, and this drives a
 * promise to a customer. staleTime 0 so it re-reads on focus rather than
 * showing what was true when the tab was opened.
 */
function PartAvailability({ draft }: { draft: AiIntakeDraft }) {
  const query = useQuery({
    queryKey: availabilityKey(draft.id),
    queryFn: () => getAiIntakePartAvailability(draft.id),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  if (query.isPending) {
    return <div className="mt-3 text-xs text-slate-400">Checking stock…</div>
  }

  if (query.isError || !query.data) {
    return <div className="mt-3 text-xs text-slate-400">Couldn&apos;t check stock right now.</div>
  }

  const { parts, programmers, decider, note } = query.data

  if (!parts.length && !programmers.length) {
    return note ? <div className="mt-3 text-xs text-slate-500">{note}</div> : null
  }

  return (
    <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
      {parts.length ? (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Stock</div>

          {/* Several parts can all be right on a changeover year, so stock alone
              would read as "we have it" for a key this truck may not take. The
              decider says which one to actually reach for. */}
          {decider ? (
            <div className="mt-1 text-xs font-medium text-amber-700">{decider} decides which.</div>
          ) : null}

          <ul className="mt-2 space-y-2">
            {parts.map((item) => (
              <li key={item.catalog_item_id}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0 truncate text-sm text-slate-700">
                    {item.name}
                    {item.sku ? (
                      <span className="ml-2 font-mono text-xs text-slate-400">{item.sku}</span>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
                      item.in_stock
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    {item.in_stock ? `${item.total_available} available` : 'None on hand'}
                  </span>
                </div>

                {item.fits ? <div className="text-xs text-slate-500">fits {item.fits}</div> : null}

                {item.locations.length ? (
                  <ul className="mt-1 space-y-0.5">
                    {item.locations.map((row, index) => (
                      <li
                        key={`${row.location ?? 'loc'}-${row.bin ?? index}`}
                        className="text-sm text-slate-700"
                      >
                        <span className="font-medium">{row.location ?? 'Unknown location'}</span>
                        {row.bin ? <span className="text-slate-500"> · {row.bin}</span> : null}
                        <span className="text-slate-500"> · {row.qty_available}</span>
                        {/* The tech is the point on a truck row: it turns "we
                            have one" into "Mike has one" — who gets dispatched. */}
                        {row.tech ? (
                          <span className="ml-1 text-slate-500">— {row.tech.name}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>

          {note ? <div className="mt-1 text-xs text-slate-500">{note}</div> : null}
        </div>
      ) : (
        note ? <div className="text-xs text-slate-500">{note}</div> : null
      )}

      {programmers.length ? (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Can program</div>
          <ul className="mt-1 space-y-1">
            {programmers.map((row) => (
              <li key={`${row.tech.id}-${row.asset}`} className="text-sm text-slate-700">
                <span className="font-medium">{row.tech.name}</span>
                <span className="text-slate-500"> — {row.asset}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  )
}

function Field({ label, value, mono, multiline, children }: {
  label: string
  value?: string | null
  mono?: boolean
  multiline?: boolean
  /* Rendered in place of the plain value, for a field that links. */
  children?: React.ReactNode
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_1fr]">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`${mono ? 'font-mono' : ''} ${multiline ? 'whitespace-pre-wrap' : ''} text-sm text-slate-700`}>
        {children ?? value ?? <span className="text-slate-400">Not captured</span>}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'pending'
    ? 'border-amber-300 bg-amber-100 text-amber-800'
    : status === 'failed'
      ? 'border-red-200 bg-red-50 text-red-700'
      : status === 'dismissed'
        ? 'border-slate-200 bg-slate-100 text-slate-600'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'

  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{status}</span>
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
      {children}
    </span>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="h-3 w-40 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-56 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

function detailTitle(draft: AiIntakeDraft): string {
  const customer = draft.proposed_customer_json ?? {}
  return stringValue(customer.display_name)
    || stringValue(customer.business_name)
    || personName(customer)
    || formatPhone(draft.comms_message?.from_number)
    || 'Unknown intake'
}

function sourceLine(draft: AiIntakeDraft): string {
  const from = formatPhone(draft.comms_message?.from_number)
  const to = formatPhone(draft.comms_message?.to_number)

  if (from || to) {
    return [from, to ? `via ${to}` : ''].filter(Boolean).join(' ')
  }

  if (draft.source === 'web') return 'Website request'
  return draft.source ? `${draft.source} intake` : 'Intake draft'
}

function intakeErrorMessage(error: string): string {
  const normalized = error.toLowerCase()
  const transient = ['529', '429', 'overload', 'rate limit', 'timeout', 'timed out', 'temporarily unavailable', 'service unavailable']
    .some((term) => normalized.includes(term))

  return transient
    ? 'The AI provider was temporarily busy. CrewBarn retries these failures automatically; select Retry AI extraction if this older draft still needs processing.'
    : error
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringValue(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' ? value.trim() : ''
}

function personName(customer: Record<string, unknown>): string {
  return [customer.first_name, customer.last_name].map(stringValue).filter(Boolean).join(' ')
}

function addressLine(location: Record<string, unknown>): string {
  const line1 = [location.street_address, location.apt_unit].map(stringValue).filter(Boolean).join(' ')
  const line2 = [location.city, location.state, location.postal_code].map(stringValue).filter(Boolean).join(', ')
  return [line1, line2].filter(Boolean).join('\n')
}

function nhtsaSummary(vehicle: Record<string, unknown>): string {
  const nhtsa = objectValue(vehicle.nhtsa)
  if (!Object.keys(nhtsa).length) return ''
  const errorText = stringValue(nhtsa.error_text)
  const source = stringValue(nhtsa.source)
  return errorText && !errorText.toLowerCase().includes('no error')
    ? errorText
    : source === 'nhtsa_vpic'
      ? 'Decoded by NHTSA vPIC'
      : ''
}

function keyFobSummary(keyFob: Record<string, unknown>): string {
  if (!Object.keys(keyFob).length) return ''
  const buttons = Array.isArray(keyFob.buttons)
    ? keyFob.buttons.map(stringValue).filter(Boolean).join(', ')
    : ''
  return [
    stringValue(keyFob.button_count) && `${stringValue(keyFob.button_count)} buttons`,
    buttons,
    stringValue(keyFob.blade_type),
    stringValue(keyFob.fcc_id) && `FCC ${stringValue(keyFob.fcc_id)}`,
    stringValue(keyFob.logo_or_markings),
  ].filter(Boolean).join('\n')
}

function equipmentSummary(equipment: Record<string, unknown>, asset: Record<string, unknown>): string {
  const source = Object.keys(equipment).length ? equipment : asset
  if (!Object.keys(source).length) return ''
  return [
    [source.unit_type, source.type, source.brand, source.model_number, source.model].map(stringValue).filter(Boolean).join(' '),
    stringValue(source.serial_number || source.serial) && `Serial: ${stringValue(source.serial_number || source.serial)}`,
    stringValue(source.tonnage) && `Tonnage: ${stringValue(source.tonnage)}`,
    stringValue(source.refrigerant) && `Refrigerant: ${stringValue(source.refrigerant)}`,
    stringValue(source.location_notes),
  ].filter(Boolean).join('\n')
}

function percentValue(value: unknown): string {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : ''
}

function partCandidates(parts: Record<string, unknown>): string {
  if (!Array.isArray(parts.candidates)) return ''
  return parts.candidates
    .map((candidate) => {
      const row = objectValue(candidate)
      const confidence = percentValue(row.confidence)
      return [stringValue(row.part_name), confidence, stringValue(row.reason)].filter(Boolean).join(' - ')
    })
    .filter(Boolean)
    .join('\n')
}

export default AiIntakeQueuePage
