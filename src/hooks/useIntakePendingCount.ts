import { useQuery } from '@tanstack/react-query'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { getIntakePendingCount } from '@/lib/comms'

/**
 * Live count of pending intake drafts for the "Intake" nav badge.
 *
 * Polls every 15s (matching the Calls badge cadence) so the count updates
 * without a page refresh. Silently degrades to 0 for roles without
 * customers.view — the endpoint is route-gated on that permission.
 */
export function useIntakePendingCount(): number {
  const { has, isLoading } = usePermissions()
  const canView = !isLoading && has(PERM.CUSTOMERS_VIEW)

  const query = useQuery({
    queryKey: ['intake-pending-count'],
    queryFn: () => getIntakePendingCount().catch(() => 0),
    enabled: canView,
    // Backstop only — Reverb (IntakeToasts) invalidates this key on new drafts.
    refetchInterval: 60000,
  })

  return query.data ?? 0
}
