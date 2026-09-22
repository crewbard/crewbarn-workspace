import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ToastPrefToggle } from '@/components/ToastPrefToggle'
import { IconRefresh } from '@tabler/icons-react'
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

type DraftStatus = 'pending' | 'reviewed' | 'failed' | 'dismissed' | 'all'

const STATUS_FILTERS: Array<{ id: DraftStatus; label: string }> = [
  { id: 'pending', label: 'Pending' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'failed', label: 'Failed' },
  { id: 'dismissed', label: 'Dismissed' },
  { id: 'all', label: 'All' },
]

const QUEUE_KEY = ['ai-intake-drafts', 'intake'] as const

export function AiIntakeQueuePage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<DraftStatus>('pending')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const query = useQuery({
    queryKey: [...QUEUE_KEY, status],
    queryFn: () => listAiIntakeDrafts({ status, profile: 'intake', perPage: 50 }),
    // New drafts arrive live over Reverb (IntakeToasts invalidates this key);
    // this poll is just a backstop + a focus refetch. Overrides the app-wide
    // refetchOnWindowFocus:false.
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  const drafts = query.data?.data ?? []
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
    <div className="flex h-[calc(100vh-5rem)] flex-col bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-navy-900">Intake Queue</h1>
            <p className="text-sm text-slate-500">
              Review AI-extracted service intake messages before creating jobs or estimates.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ToastPrefToggle area="intake" label="New intake" />
            <div className="text-xs text-slate-400">
              {query.data?.total ?? drafts.length} draft{(query.data?.total ?? drafts.length) === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 grid grid-cols-1 lg:grid-cols-[25rem_1fr]">
        <aside className="min-h-0 border-r border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-3">
            <div className="grid grid-cols-5 gap-1 rounded-lg bg-slate-100 p-1">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setStatus(item.id)
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

          <div className="h-[calc(100%-3.75rem)] overflow-y-auto">
            {query.isLoading ? (
              <ListSkeleton />
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
        </aside>

        <main className="hidden min-w-0 overflow-y-auto lg:block">
          {selected ? (
            <DraftDetail
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
            {typeof draft.confidence === 'number' && <Pill>{Math.round(draft.confidence * 100)}% confidence</Pill>}
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
          {draft.status === 'dismissed' ? (
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
          {draft.status === 'failed' ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-60"
            >
              <IconRefresh size={16} aria-hidden="true" />
              {retrying ? 'Queuing retry...' : 'Retry AI extraction'}
            </button>
          ) : (
            <Link
              to={createPath}
              className="rounded-md bg-amber-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              {draft.classification === 'estimate' ? 'Create estimate' : 'Create job'}
            </Link>
          )}
        </div>
      </div>

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
            <Field label="Vehicle" value={[vehicle.year, vehicle.make, vehicle.model, vehicle.trim].map(stringValue).filter(Boolean).join(' ')} />
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
            <Field label="Scope" value={stringValue(job.description) || stringValue(estimate.scope)} multiline />
          </InfoSection>

          <InfoSection title="Service Address">
            <Field label="Address" value={addressLine(location)} multiline />
            <Field label="Entry notes" value={stringValue(location.entry_notes)} multiline />
            <Field label="Vehicle notes" value={stringValue(location.vehicle_location_notes)} multiline />
          </InfoSection>

          {/* The AI's reading of a photo is in the transcript, but a locksmith
              deciding what to put on the truck wants to see the lock, not a
              description of it. Thumbnails open full size in a new tab. */}
          {(draft.comms_message?.media_urls?.length ?? 0) > 0 && (
            <InfoSection title="Photos sent">
              <div className="flex flex-wrap gap-2">
                {draft.comms_message!.media_urls.map((url, i) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-lg border border-slate-200 hover:border-amber-400"
                  >
                    <img
                      src={url}
                      alt={`Attachment ${i + 1}`}
                      loading="lazy"
                      className="h-28 w-28 bg-slate-50 object-cover"
                      // Video and audio come down the same MMS pipe and will
                      // never render as an <img>; hide rather than show a
                      // broken-image icon that reads as a bug.
                      onError={(e) => { e.currentTarget.parentElement!.style.display = 'none' }}
                    />
                  </a>
                ))}
              </div>
            </InfoSection>
          )}

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
function PartCorrection({ draft }: { draft: AiIntakeDraft }) {
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
      decider: decider.trim() || null,
      notes: notes.trim() || null,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUEUE_KEY })
      // New parts mean new stock, a different truck, possibly a different tech.
      void queryClient.invalidateQueries({ queryKey: availabilityKey(draft.id) })
      reset()
    },
  })

  function reset() {
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
              CBI learned this — the next call about this vehicle will use it.
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

  const canSave = selected.length > 0 && !mutation.isPending

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
          {mutation.isPending ? 'Saving…' : `Save + teach CBI${selected.length > 1 ? ` (${selected.length})` : ''}`}
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

function Field({ label, value, mono, multiline }: { label: string; value?: string | null; mono?: boolean; multiline?: boolean }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_1fr]">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`${mono ? 'font-mono' : ''} ${multiline ? 'whitespace-pre-wrap' : ''} text-sm text-slate-700`}>
        {value || <span className="text-slate-400">Not captured</span>}
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
