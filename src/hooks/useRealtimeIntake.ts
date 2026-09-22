import { useEffect, useMemo, useRef } from 'react'
import type { Account } from '@/lib/auth'
import { getRealtimeEcho, resolveTenantId } from '@/lib/realtimeEcho'

/**
 * Live AI intake drafts over Reverb — replaces the 5s background poll on the
 * Intake queue and powers the app-wide intake toast + the Today's Ops widget.
 * Calls `onDraft` for every `intake.draft` broadcast. Subscribes on the ONE
 * shared app connection (see lib/realtimeEcho) — never opens its own socket.
 */

export interface IntakeDraftEvent {
  id: string
  status: string
  source: string | null
  classification: string | null
  confidence: number | null
  profile: string | null
  customer_name: string | null
  customer_avatar_id?: string | null
  customer_avatar_url?: string | null
  customer_avatar_preset?: string | null
  matched_customer_id: string | null
  created_at: string | null
}

export function useRealtimeIntake(
  account: Account | null,
  onDraft: (d: IntakeDraftEvent) => void,
): void {
  const tenantId = useMemo(() => resolveTenantId(account), [account])
  const cb = useRef(onDraft)
  useEffect(() => {
    cb.current = onDraft
  }, [onDraft])

  useEffect(() => {
    if (!tenantId) return
    const echo = getRealtimeEcho(account)
    if (!echo) return

    const channelName = `tenant.${tenantId}.intake`
    echo.private(channelName).listen('.intake.draft', (d: IntakeDraftEvent) => cb.current(d))

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
