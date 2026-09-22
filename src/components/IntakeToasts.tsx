import { useState } from 'react'
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
    <NotificationCard key={draft.id} kind="New intake" customer={who} tone="violet"
      avatar={{ id: draft.customer_avatar_id, imageUrl: draft.customer_avatar_url, preset: draft.customer_avatar_preset }}
      subtitle={draft.source || 'Service request'}
      description={`${what}${confidencePct !== null ? ` · ${confidencePct}% confidence` : ''}`}
      onDismiss={() => setDraft(null)}
      actions={<Link to="/intake" onClick={() => setDraft(null)} className="rounded border px-3 py-1.5 text-xs font-semibold">Review intake</Link>}
    />
  )
}
