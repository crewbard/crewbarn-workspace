import { useState } from 'react'
import { DraftBadge } from '@/components/fitment/FitsSection'
import { LEARNED_FROM_LABELS, useFitDrafts, useReviewFitDraft, useScanFitHistory, type LearnedFit } from '@/lib/fitment'

/**
 * Fitment → Suggested fits (Fitment P4, docs/notes/fitment-p4-plan.md).
 * Fits CBI learned from chats, jobs and notes, or found in job history, wait
 * here as drafts. They never match a filter or the fits card until a person
 * confirms them; a rejected one isn't suggested again.
 */

const ghostBtn = 'rounded-md border border-[var(--bins-border)] bg-[var(--bins-surface)] px-2.5 py-1 text-[13px] font-medium text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)] disabled:cursor-not-allowed disabled:opacity-60'
const primaryBtn = 'rounded-md bg-[var(--bins-accent)] px-2.5 py-1 text-[13px] font-semibold text-[var(--bins-surface)] hover:bg-[var(--bins-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60'

function when(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function DraftRow({ fit, canEdit }: { fit: LearnedFit; canEdit: boolean }) {
  const review = useReviewFitDraft()
  const busy = review.isPending
  const from = fit.learned_from_type ? LEARNED_FROM_LABELS[fit.learned_from_type] ?? fit.learned_from_type : null
  return (
    <li data-fit-draft={fit.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--bins-border)] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--bins-text)]">
          <strong>{fit.item?.name ?? 'A part'}</strong>
          {fit.item?.sku && <span className="text-[var(--bins-muted)]"> ({fit.item.sku})</span>}
          <span className="text-[var(--bins-text-2)]"> fits </span>
          <strong>{fit.label}</strong>
        </p>
        <p className="mt-0.5 truncate text-[12px] text-[var(--bins-muted)]">
          {[from && `From ${from}`, fit.created_by_name, when(fit.created_at)].filter(Boolean).join(' · ')}
          {fit.note && <span> · {fit.note}</span>}
        </p>
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <button type="button" data-fit-reject="" className={ghostBtn} disabled={busy} onClick={() => review.mutate({ id: fit.id, action: 'reject' })}>Doesn’t fit</button>
          <button type="button" data-fit-confirm="" className={primaryBtn} disabled={busy} onClick={() => review.mutate({ id: fit.id, action: 'confirm' })}>Confirm</button>
        </div>
      )}
    </li>
  )
}

export function SuggestedFits({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading } = useFitDrafts()
  const scan = useScanFitHistory()
  const [showAll, setShowAll] = useState(false)
  const drafts = data ?? []
  const shown = showAll ? drafts : drafts.slice(0, 8)
  const result = scan.data
  return (
    <section data-suggested-fits="" className="space-y-2 rounded-xl border border-[var(--bins-border-soft)] bg-[var(--bins-softer)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-[var(--bins-text)]">Suggested fits</h3>
        {drafts.length > 0 && <DraftBadge />}
        <span className="text-[12px] text-[var(--bins-muted)]">{drafts.length ? `${drafts.length} to review` : ''}</span>
        {canEdit && (
          <button type="button" data-fit-scan="" className={`${ghostBtn} ml-auto`} disabled={scan.isPending} onClick={() => scan.mutate()}>
            {scan.isPending ? 'Looking…' : 'Find fits in job history'}
          </button>
        )}
      </div>
      <p className="text-[12.5px] text-[var(--bins-text-2)]">
        What CBI picked up from chats, jobs and notes. A suggestion only counts once someone confirms it.
      </p>
      {result && (
        <p data-fit-scan-result="" className="text-[12.5px] text-[var(--bins-text)]">
          {result.reason === 'no_vehicle_subject'
            ? 'Job history suggestions need a vehicle subject in your fields for now.'
            : result.reason === 'fitment_off'
              ? 'Fitment is off.'
              : `Looked at ${result.scanned} job parts: ${result.drafted} new suggestion${result.drafted === 1 ? '' : 's'}.`}
        </p>
      )}
      {scan.isError && <p className="text-[12.5px] text-[var(--color-danger)]">{scan.error instanceof Error ? scan.error.message : 'Could not look.'}</p>}
      {isLoading ? (
        <div className="h-10 animate-pulse rounded-lg bg-[var(--bins-soft)]" />
      ) : drafts.length === 0 ? (
        <p className="text-[12.5px] text-[var(--bins-muted)]">Nothing to review.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((f) => <DraftRow key={f.id} fit={f} canEdit={canEdit} />)}
        </ul>
      )}
      {drafts.length > 8 && (
        <button type="button" className="text-[13px] font-medium text-[var(--bins-accent-ink)] hover:underline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${drafts.length}`}
        </button>
      )}
    </section>
  )
}