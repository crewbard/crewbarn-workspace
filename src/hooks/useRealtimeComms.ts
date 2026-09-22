import { useEffect, useMemo, useRef } from 'react'
import type { Account } from '@/lib/auth'
import { getRealtimeEcho, resolveTenantId } from '@/lib/realtimeEcho'

/**
 * Live comms messages over Reverb (replaces the worker-pinning SSE streams).
 * `suffix` selects the channel/permission scope:
 *   - 'comms'          → full feed (customers.view), used by the Messages inbox.
 *   - 'incoming-calls' → inbound call/voicemail only (calls.view), app-wide toasts.
 * Subscribes on the ONE shared app connection (see lib/realtimeEcho) — never
 * opens its own socket.
 */

export interface CommsMessageEvent {
  id: string
  conversation_id: string | null
  direction: string
  channel: string
  body: string | null
  provider_message_id: string | null
  meta: Record<string, unknown>
  call_id: string | null
  call_event: string | null
  caller_id_name: string | null
  caller_id_number: string | null
  recording_url: string | null
  transcription_status: string | null
  from_number: string | null
  to_number: string | null
  external_number: string | null
  internal_number: string | null
  created_at: string | null
  customer: {
    id: string
    display_name: string | null
    avatar_url?: string | null
    avatar_preset?: string | null
    customer_type: string | null
    vip: boolean
    lifetime_value_cents: number
    last_contact_at: string | null
  } | null
}

export function useRealtimeComms(
  account: Account | null,
  suffix: 'comms' | 'incoming-calls',
  onMessage: (m: CommsMessageEvent) => void,
): void {
  const tenantId = useMemo(() => resolveTenantId(account), [account])
  const cb = useRef(onMessage)
  useEffect(() => {
    cb.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (!tenantId) return
    const echo = getRealtimeEcho(account)
    if (!echo) return

    const channelName = `tenant.${tenantId}.${suffix}`
    echo.private(channelName).listen('.comms.message', (m: CommsMessageEvent) => cb.current(m))

    return () => {
      try {
        echo.leave(channelName)
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, suffix])
}
