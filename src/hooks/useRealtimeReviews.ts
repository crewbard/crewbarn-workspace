import { useEffect, useMemo, useRef } from 'react'
import type { Account } from '@/lib/auth'
import { getRealtimeEcho, resolveTenantId } from '@/lib/realtimeEcho'

/**
 * New Google reviews, over Reverb.
 *
 * Only ever fired for a review CrewBarn had not seen before, and never for
 * the history pulled in when a shop first connects — the sync marks all of
 * that as already announced, so connecting on a Tuesday does not produce
 * four hundred pop-ups.
 *
 * Subscribes on the ONE shared app connection (see lib/realtimeEcho).
 */

export interface GoogleReviewEvent {
  id: string
  name: string
  reviewer_name: string | null
  reviewer_photo_url: string | null
  star_rating: number | null
  comment: string | null
  create_time: string | null
  has_reply: boolean
}

export function useRealtimeReviews(
  account: Account | null,
  onReview: (r: GoogleReviewEvent) => void,
): void {
  const tenantId = useMemo(() => resolveTenantId(account), [account])
  const cb = useRef(onReview)
  useEffect(() => {
    cb.current = onReview
  }, [onReview])

  useEffect(() => {
    if (!tenantId) return
    const echo = getRealtimeEcho(account)
    if (!echo) return

    const channelName = `tenant.${tenantId}.reviews`
    echo.private(channelName).listen('.review.received', (r: GoogleReviewEvent) => cb.current(r))

    return () => {
      try {
        echo.leave(channelName)
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])
}
