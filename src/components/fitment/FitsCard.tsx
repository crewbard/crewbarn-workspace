import '@/components/inventory/bins/bins.css'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { fitTitle, useFitsCard, type FitmentSubject } from '@/lib/fitment'
import { PartsThatFit } from './PartsThatFit'

/**
 * The fits card: Parts that fit one subject that is not a vehicle -- a Trane
 * 4TTR4036 condenser, a Kwikset KW1 lock, a 16x7 door, a LiftMaster 8500W.
 *
 * Built from the existing card pieces: the same right-hand drawer as the
 * vehicle and reference cards (into the body, scrim and Esc close it), and
 * the same PartsThatFit list the vehicle card's tab uses, whose rows open
 * into the flash card. A vehicle opens the vehicle card instead.
 *
 * Opened today from a fit line in a product's Fits section ("What else fits
 * this"); text mentions open it in P3 (detection). Tenant side only.
 */
export function FitsCard({ subject, asked, onClose }: {
  subject: FitmentSubject
  asked: Record<string, string>
  onClose: () => void
}) {
  const q = useFitsCard(subject.key, asked)
  const title = fitTitle(subject, asked) || subject.label

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div data-bins-ui="" className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--bins-dark)_50%,transparent)]" onClick={onClose}>
      <div
        data-fits-card=""
        role="dialog"
        aria-label={`Parts that fit ${title}`}
        onClick={(e) => e.stopPropagation()}
        className="fixed inset-y-0 right-0 z-50 flex w-[min(35rem,100vw)] flex-col border-l border-[var(--bins-border)] bg-[var(--bins-surface)] shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--bins-border)] px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-[var(--bins-text)]">{title}</h2>
            <p className="text-[11px] text-[var(--bins-muted)]">{subject.label} · Parts that fit</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="h-8 w-8 rounded-full text-2xl leading-none text-[var(--bins-muted)] hover:bg-[var(--bins-soft)]">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {q.isLoading && <p className="text-sm text-[var(--bins-muted)]">Looking it up…</p>}
          {q.isError && <p className="text-sm text-[var(--color-danger)]">Could not load the parts that fit this {subject.label.toLowerCase()}.</p>}
          {q.data && <PartsThatFit data={q.data} title={title} />}
        </div>
      </div>
    </div>,
    document.body,
  )
}
