import { useQuery } from '@tanstack/react-query'
import { getLateRisks, type LateRisk } from '@/lib/lateRisks'
import { PERM, usePermissions } from '@/hooks/usePermissions'

export interface LateRiskState {
  enabled: boolean
  items: LateRisk[]
  /** Not seen by anybody yet: these make the Schedule button flash. */
  unseen: LateRisk[]
  flashing: boolean
  toastAfterMinutes: number
}

/**
 * The jobs a tech may be late for, shared by every Schedule button (top bar,
 * sidebar, rail, mobile drawer), the Schedule page and the toast. One query
 * key, so they all read one request. The server pushes late-risk.changed on
 * the ops channel (useRealtimeWorkOrders refreshes this); the poll is the
 * fallback when the socket is down.
 */
export function useLateRisks(): LateRiskState {
  const { has, isLoading } = usePermissions()
  const canSee = !isLoading && has(PERM.JOBS_VIEW)
  const q = useQuery({
    queryKey: ['late-risks'],
    queryFn: () => getLateRisks().catch(() => ({ enabled: false, toast_after_minutes: 5, items: [] })),
    enabled: canSee,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  })

  const data = canSee ? q.data : undefined
  const items = data?.enabled ? data.items : []
  const unseen = items.filter((r) => !r.acknowledged_at)

  return {
    enabled: Boolean(data?.enabled),
    items,
    unseen,
    flashing: unseen.length > 0,
    toastAfterMinutes: data?.toast_after_minutes ?? 5,
  }
}
