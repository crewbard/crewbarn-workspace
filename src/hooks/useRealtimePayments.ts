import { useEffect, useMemo, useRef } from 'react'
import type { Account } from '@/lib/auth'
import { getRealtimeEcho, resolveTenantId } from '@/lib/realtimeEcho'

/**
 * Payments as they land, over Reverb.
 *
 * Subscribes on the ONE shared app connection (see lib/realtimeEcho) — never
 * opens its own socket. The backend only broadcasts after the transaction
 * commits, so anything arriving here is money that is really recorded.
 */

export interface PaymentReceivedEvent {
  id: string
  amount_cents: number
  tip_cents: number
  payment_method: string | null
  payment_reference: string | null
  work_order_id: string | null
  work_order_number: string | null
  customer_id: string | null
  customer_name: string | null
  customer_vip: boolean
  customer_avatar_preset: string | null
  customer_avatar_url: string | null
  created_at: string | null
}

export function useRealtimePayments(
  account: Account | null,
  onPayment: (p: PaymentReceivedEvent) => void,
): void {
  const tenantId = useMemo(() => resolveTenantId(account), [account])
  const cb = useRef(onPayment)
  useEffect(() => {
    cb.current = onPayment
  }, [onPayment])

  useEffect(() => {
    if (!tenantId) return
    const echo = getRealtimeEcho(account)
    if (!echo) return

    const channelName = `tenant.${tenantId}.payments`
    echo.private(channelName).listen('.payment.received', (p: PaymentReceivedEvent) => cb.current(p))

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
