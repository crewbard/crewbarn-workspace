import { useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Account } from '@/lib/auth'
import { getRealtimeEcho, resolveTenantId } from '@/lib/realtimeEcho'

/**
 * Dashboard live bridge — listens (on the ONE shared app connection, see
 * lib/realtimeEcho) to the channels we ALREADY broadcast and invalidates the
 * dashboard's polling queries so the operational widgets go live without each
 * one opening its own socket or hammering the API:
 *   - work-order.changed → every Today's Ops card (all keyed ['dashboard',…])
 *   - comms.message      → unanswered calls + message surfaces
 *   - position.updated   → the techs-on-map widget (debounced — positions are chatty)
 * Money charts are intentionally left on their cache-backed poll; they need a
 * payment/invoice event, not this. Mounted only by DashboardPage, so the
 * channels are left (not the connection) when you leave the dashboard.
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

    // Jobs changed → refresh every Today's Ops card (all keyed ['dashboard',…]).
    echo.private(woName).listen('.work-order.changed', () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    })

    // New message/call → refresh unanswered calls + the message surfaces.
    echo.private(commsName).listen('.comms.message', () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['comms'] })
    })

    // Team sticky note posted/dismissed anywhere (incl. CBI) → refresh the board.
    echo.private(dashName).listen('.team-note.changed', () => {
      qc.invalidateQueries({ queryKey: ['team-notes'] })
    })

    // Positions fire constantly — debounce the techs-map refresh to ~8s.
    echo.private(posName).listen('.position.updated', () => {
      if (posTimer.current !== null) return
      posTimer.current = window.setTimeout(() => {
        posTimer.current = null
        qc.invalidateQueries({ queryKey: ['dash', 'tech-positions'] })
      }, 8000)
    })

    return () => {
      if (posTimer.current !== null) {
        window.clearTimeout(posTimer.current)
        posTimer.current = null
      }
      try {
        echo.leave(woName)
        echo.leave(commsName)
        echo.leave(posName)
        echo.leave(dashName)
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])
}
