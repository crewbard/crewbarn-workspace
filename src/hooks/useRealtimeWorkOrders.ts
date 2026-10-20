import { useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Account } from '@/lib/auth'
import { getRealtimeEcho, listenPrivate, resolveTenantId } from '@/lib/realtimeEcho'

type WorkOrderChangedEvent = {
  tenant_id: string
  action: 'created' | 'updated' | 'deleted' | string
  changed?: string[]
  work_order?: {
    id?: string
  } | null
}

const LIVE_QUERY_ROOTS = new Set([
  'accounting',
  'dashboard',
  'dispatch',
  'estimates',
  'reports',
  'schedule',
  'tasks',
  'work-order-invoices',
  'work-order-payments',
  'work-order-reimbursements',
  'work-orders',
  'work-orders-incoming-requests',
])

/**
 * Jobs, tasks, estimates and late-risk changes, live. Mounted once for the
 * whole app by AppLayout, on the one shared connection (lib/realtimeEcho):
 * it used to open its own websocket, so every tab held a second one.
 */
export function useRealtimeWorkOrders(account: Account | null): void {
  const queryClient = useQueryClient()
  const tenantId = useMemo(() => resolveTenantId(account), [account])

  useEffect(() => {
    if (!tenantId) return
    const echo = getRealtimeEcho(account)
    if (!echo) return

    // The dashboard listens on this channel too; each cleanup below removes
    // only this hook's own listener.
    const channelName = `tenant.${tenantId}.work-orders`

    const invalidateLive = () => {
      queryClient.invalidateQueries({
        predicate: (query) => LIVE_QUERY_ROOTS.has(String(query.queryKey[0] ?? '')),
      })
    }

    const stops = [
      listenPrivate(echo, channelName, '.work-order.changed', (event: WorkOrderChangedEvent) => {
        const workOrderId = event.work_order?.id

        invalidateLive()

        if (workOrderId) {
          queryClient.invalidateQueries({ queryKey: ['work-orders', 'detail', workOrderId] })
          queryClient.invalidateQueries({ queryKey: ['work-order-invoices', workOrderId] })
          queryClient.invalidateQueries({ queryKey: ['work-order-payments', workOrderId] })
          queryClient.invalidateQueries({ queryKey: ['work-order-reimbursements', workOrderId] })
        }

        window.dispatchEvent(new CustomEvent('crewbarn:work-order-live', { detail: event }))
      }),

      // Tasks + estimates ride the same channel — a change to either refreshes the
      // calendar / task + estimate lists (both are in LIVE_QUERY_ROOTS).
      listenPrivate(echo, channelName, '.task.changed', () => invalidateLive()),
      listenPrivate(echo, channelName, '.estimate.changed', () => invalidateLive()),

      // A tech may be late, or it's been seen or is over: the Schedule button
      // starts or stops flashing now rather than at its next poll.
      listenPrivate(echo, channelName, '.late-risk.changed', () => {
        queryClient.invalidateQueries({ queryKey: ['late-risks'] })
      }),
    ]

    return () => stops.forEach((stop) => stop())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, tenantId])
}
