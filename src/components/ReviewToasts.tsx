import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { useRealtimeReviews, type GoogleReviewEvent } from '@/hooks/useRealtimeReviews'
import { useToastPref } from '@/hooks/useToastPrefs'
import { NotificationCard } from '@/components/NotificationCard'

/**
 * "New review" — the last of the eight toast types to get a backend.
 *
 * Until the Business Profile connection existed there was no way to know a
 * review had arrived: the public Places lookup returns five "most relevant"
 * excerpts that rotate, so polling it would have missed real reviews and
 * announced old ones as new. This fires off the hourly sync, which knows
 * what it has seen before.
 *
 * The card says the stars and the words, because "you got a review" with no
 * indication of whether it was one star or five is a small cruelty.
 */
const seenReviewIds = new Set<string>()

export function ReviewToasts() {
  const { account } = useAuth()
  const queryClient = useQueryClient()
  const { has, isLoading } = usePermissions()
  const [enabled] = useToastPref('reviews')
  const canSee = !isLoading && has(PERM.SETTINGS_VIEW)
  const [review, setReview] = useState<GoogleReviewEvent | null>(null)

  useRealtimeReviews(canSee ? account : null, (r) => {
    // The list refreshes whether or not the pop-up is wanted.
    queryClient.invalidateQueries({ queryKey: ['google-reviews'] })
    queryClient.invalidateQueries({ queryKey: ['google-reviews', 'status'] })

    if (!enabled) return
    if (seenReviewIds.has(r.id)) return
    seenReviewIds.add(r.id)
    setReview(r)
  })

  if (!canSee || !enabled || !review) return null

  const stars = review.star_rating ?? 0
  const who = review.reviewer_name || 'A customer'
  const kind = stars === 5 ? 'New 5-star review' : stars > 0 ? `New ${stars}-star review` : 'New review'

  return (
    <NotificationCard
      key={review.id}
      type="review"
      kind={kind}
      customer={who}
      avatar={{ imageUrl: review.reviewer_photo_url }}
      subtitle="Google"
      description={review.comment || `${who} left ${stars || 'a'} star${stars === 1 ? '' : 's'}.`}
      body={
        <>
          <div className="cb-toast-stars" aria-label={`${stars} out of 5 stars`}>
            {'★'.repeat(Math.max(0, stars))}
            <span className="text-slate-300">{'★'.repeat(Math.max(0, 5 - stars))}</span>
          </div>
          {review.comment && (
            <p className="cb-toast-clamp4 mt-1 text-[12px] text-slate-600">{review.comment}</p>
          )}
        </>
      }
      onDismiss={() => setReview(null)}
      actions={
        <>
          <Link
            to="/tool-shed/google-reviews"
            onClick={() => setReview(null)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[11px] px-3 font-extrabold text-white"
            style={{ background: '#D97706' }}
          >
            {review.has_reply ? 'See it' : 'Reply to it'}
          </Link>
        </>
      }
    />
  )
}
