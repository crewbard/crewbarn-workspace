import { useQuery } from '@tanstack/react-query'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { emptyIfNotForYou } from '@/hooks/useNavBadges'
import { getIntakePendingCount } from '@/lib/comms'

/**
 * Live count of pending intake drafts for the "Intake" nav badge.
 *
 * Only asks for roles with customers.view (the endpoint is route-gated on
 * that permission). A 403 or 402 still comes back as 0: there is nothing
 * here for this person. Any other failure keeps the last count on the badge
 * while React Query tries again, rather than dropping it to 0 on a blip.
 */
export function useIntakePendingCount(): number {
  const { has, isLoading } = usePermissions()
  const canView = !isLoading && has(PERM.CUSTOMERS_VIEW)

  const query = useQuery({
    queryKey: ['intake-pending-count'],
    queryFn: () => getIntakePendingCount().catch(emptyIfNotForYou(0)),
    enabled: canView,
    // Backstop only — Reverb (IntakeToasts) invalidates this key on new drafts.
    refetchInterval: 60000,
  })

  return query.data ?? 0
}
