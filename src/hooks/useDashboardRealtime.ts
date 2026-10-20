import { useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Account } from '@/lib/auth'
import { getRealtimeEcho, listenPrivate, resolveTenantId } from '@/lib/realtimeEcho'

/**
 * Dashboard live bridge — listens (on the ONE shared app connection, see
 * lib/realtimeEcho) to the channels we ALREADY broadcast and invalidates the
 * dashboard's polling queries so the operational widgets go live without each
 * one opening its own socket or hammering the API:
 *   - work-order.changed → every Today's Ops card (all keyed ['dashboard',…])
 *   - comms.message      → unanswered calls + message surfaces
 *   - position.updated   → the techs-on-map widget (debounced — positions are chatty)
 * Money charts are intentionally left on their cache-backed poll; they need a
 * payment/invoice event, not this. Mounted only by DashboardPage, so its
 * listeners (not the connection) go when you leave the dashboard; a channel
 * is only left once nothing else in the app is listening to it.
 */

export function useDashboardRealtime(account: Account | null): void {
  const tenantId = useMemo(() => resolveTenantId(account), [account])
  const qc = useQueryClient()
  const posTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!tenantId) return
    const echo = getRealtimeEcho(account)
    if (!echo) return

    const woName = `tenant.${tenantId}.work-orders`
    const commsName = `tenant.${tenantId}.comms`
    const posName = `tenant.${tenantId}.positions`
    const dashName = `tenant.${tenantId}.dashboard`

    // Each cleanup removes only the dashboard's own listener. The comms channel
    // in particular is shared with the app-wide message toasts and the
    // Messages page, so leaving it outright would cut them off too.
    const stops = [
      // Jobs changed → refresh every Today's Ops card (all keyed ['dashboard',…]).
      listenPrivate(echo, woName, '.work-order.changed', () => {
        qc.invalidateQueries({ queryKey: ['dashboard'] })
      }),

      // New message/call → refresh unanswered calls + the message surfaces.
      listenPrivate(echo, commsName, '.comms.message', () => {
        qc.invalidateQueries({ queryKey: ['dashboard'] })
        qc.invalidateQueries({ queryKey: ['comms'] })
      }),

      // Team sticky note posted/dismissed anywhere (incl. CBI) → refresh the board.
      listenPrivate(echo, dashName, '.team-note.changed', () => {
        qc.invalidateQueries({ queryKey: ['team-notes'] })
      }),

      // Positions fire constantly — debounce the techs-map refresh to ~8s.
      listenPrivate(echo, posName, '.position.updated', () => {
        if (posTimer.current !== null) return
        posTimer.current = window.setTimeout(() => {
          posTimer.current = null
          qc.invalidateQueries({ queryKey: ['dash', 'tech-positions'] })
        }, 8000)
      }),
    ]

    return () => {
      if (posTimer.current !== null) {
        window.clearTimeout(posTimer.current)
        posTimer.current = null
      }
      stops.forEach((stop) => stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])
}
