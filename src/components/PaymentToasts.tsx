import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { useRealtimePayments, type PaymentReceivedEvent } from '@/hooks/useRealtimePayments'
import { useToastPref } from '@/hooks/useToastPrefs'
import { NotificationCard } from '@/components/NotificationCard'

/**
 * "Payment received" — the one notification people ask for by name.
 *
 * It pops wherever the money came from: a tech's phone in a driveway, the
 * customer portal at midnight, a terminal on the counter, or the hourly
 * processor sync. The backend broadcasts after the transaction commits, so
 * a toast here is money that is really recorded.
 *
 * Like the other producers, this is also the single payments subscription
 * for the app: the caches refresh on every payment whether or not a toast
 * is wanted, because silencing the pop-up should quieten the alert, not
 * stop the invoice list updating.
 */
const seenPaymentIds = new Set<string>()

/** Exact cents, always. A payment shown as $534.5 is worse than none. */
function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** "card_manual" is not how anybody says it. */
function methodLabel(method: string | null): string {
  if (!method) return 'Payment'
  const words: Record<string, string> = {
    cash: 'Cash',
    check: 'Check',
    card: 'Card',
    card_manual: 'Card',
    card_present: 'Card in person',
    ach: 'Bank transfer',
    bank_transfer: 'Bank transfer',
    customer_credit: 'Account credit',
    other: 'Payment',
  }
  return words[method] ?? method.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

export function PaymentToasts() {
  const { account } = useAuth()
  const queryClient = useQueryClient()
  const { has, isLoading } = usePermissions()
  const [enabled] = useToastPref('payments')
  const canSee = !isLoading && has(PERM.INVOICES_VIEW)
  const [payment, setPayment] = useState<PaymentReceivedEvent | null>(null)

  useRealtimePayments(canSee ? account : null, (p) => {
    // Whether or not a toast is wanted, the money moved — anything showing a
    // balance is now out of date.
    queryClient.invalidateQueries({ queryKey: ['invoices'] })
    queryClient.invalidateQueries({ queryKey: ['payments'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })

    if (!enabled) return
    if (seenPaymentIds.has(p.id)) return
    seenPaymentIds.add(p.id)
    setPayment(p)
  })

  if (!canSee || !enabled || !payment) return null

  const who = payment.customer_name || 'A customer'
  const tip = payment.tip_cents > 0 ? ` · ${money(payment.tip_cents)} tip` : ''
  const forJob = payment.work_order_number ? ` · Job ${payment.work_order_number}` : ''

  return (
    <NotificationCard
      key={payment.id}
      type="paid"
      kind="Payment received"
      customer={who}
      customerId={payment.customer_id ?? undefined}
      vip={payment.customer_vip}
      avatar={{
        id: payment.customer_id ?? undefined,
        imageUrl: payment.customer_avatar_url,
        preset: payment.customer_avatar_preset,
      }}
      subtitle={`${methodLabel(payment.payment_method)}${forJob}`}
      description={`${money(payment.amount_cents)} from ${who}${tip}`}
      body={
        <>
          <p className="cb-toast-money">{money(payment.amount_cents)}</p>
          {tip && <p className="text-[12px] font-semibold text-emerald-700">{tip.replace(' · ', '')}</p>}
        </>
      }
      onDismiss={() => setPayment(null)}
      actions={
        <>
          <Link
            to={payment.customer_id ? `/customers/${payment.customer_id}` : '/invoices'}
            onClick={() => setPayment(null)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[11px] px-3 font-extrabold text-white"
            style={{ background: '#047857' }}
          >
            See the customer
          </Link>
          <Link
            to="/invoices"
            onClick={() => setPayment(null)}
            className="inline-flex items-center justify-center gap-1 rounded-[11px] bg-white px-3 font-extrabold text-[#0F1A2E] shadow-[inset_0_0_0_1.5px_#CBD5E1] hover:shadow-[inset_0_0_0_1.5px_#047857]"
          >
            Invoices →
          </Link>
        </>
      }
    />
  )
}
