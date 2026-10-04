import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { useRealtimeIntake, type IntakeDraftEvent } from '@/hooks/useRealtimeIntake'
import { NotificationCard } from '@/components/NotificationCard'
import { useToastPref } from '@/hooks/useToastPrefs'

/**
 * App-wide "new AI intake" toast, over Reverb. This is also the SINGLE intake
 * subscription for the whole app: on every new draft it invalidates the
 * pending-count + queue caches, so the nav badges (Sidebar/TopBar), the Today's
 * Ops widget, and the Intake queue all refresh off one websocket instead of
 * each opening their own. The toast itself only pops for a fresh, pending
 * intake-profile draft.
 */
const seenIntakeIds = new Set<string>()

export function IntakeToasts() {
  const { account } = useAuth()
  const queryClient = useQueryClient()
  const { has, isLoading } = usePermissions()
  const [toastsOn] = useToastPref('intake')
  const canSee = !isLoading && has(PERM.CUSTOMERS_VIEW)
  const [draft, setDraft] = useState<IntakeDraftEvent | null>(null)

  useRealtimeIntake(canSee ? account : null, (d) => {
    // Refresh every intake surface (badges + queue) regardless of toast logic.
    queryClient.invalidateQueries({ queryKey: ['intake-pending-count'] })
    queryClient.invalidateQueries({ queryKey: ['ai-intake-drafts'] })

    // Pop a toast only for a fresh, pending, intake-profile draft.
    if (d.status !== 'pending') return
    if (d.profile && d.profile !== 'intake') return
    // Phone-sourced intakes (call/voicemail) are already surfaced by the
    // incoming-call toast — don't double-pop the purple intake toast for them.
    // They still hit the queue + badges via the cache invalidation above.
    if (d.source === 'call' || d.source === 'voicemail') return
    if (seenIntakeIds.has(d.id)) return
    seenIntakeIds.add(d.id)
    setDraft(d)
  })

  // Cache invalidation above still runs when off — the badge and queue keep
  // working, it is only the pop-up that goes quiet.
  if (!canSee || !toastsOn || !draft) return null

  const who = draft.customer_name || 'New caller'
  const what = draft.classification ? draft.classification.replace(/_/g, ' ') : 'New intake'
  const confidencePct =
    draft.confidence !== null && draft.confidence !== undefined
      ? Math.round(draft.confidence * 100)
      : null

  return (
    <NotificationCard key={draft.id} type="intake" kind="New intake" customer={who}
      avatar={{ id: draft.customer_avatar_id, imageUrl: draft.customer_avatar_url, preset: draft.customer_avatar_preset }}
      subtitle={draft.source || 'Service request'}
      description={`${what}${confidencePct !== null ? ` · ${confidencePct}% confidence` : ''}`}
      body={<>
        <p className="cb-toast-clamp2 text-[13px] font-bold text-[#0F1A2E]">{what}</p>
        {confidencePct !== null && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-violet-100">
              <b className="block h-full rounded-full bg-violet-600" style={{ width: `${confidencePct}%` }} />
            </span>
            <span className="text-[11px] font-bold text-violet-700">{confidencePct}% sure</span>
          </div>
        )}
      </>}
      onDismiss={() => setDraft(null)}
      actions={<>
        <Link
          to="/intake"
          onClick={() => setDraft(null)}
          className="cb-toast-act flex-1"
          /* Intake is the one toast whose primary is not navy. The fill
             goes through the variable so it keeps the hover the shared
             class gives everything else. */
          style={{ '--cb-act': '#6D28D9', '--cb-act-hover': '#5B21B6' } as CSSProperties}
        >
          Review intake
        </Link>
        <Link to="/communications" onClick={() => setDraft(null)} className="cb-toast-act-quiet">Open thread →</Link>
      </>}
    />
  )
}
