import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useRealtimeComms } from '@/hooks/useRealtimeComms'
import { formatPhone } from '@/lib/comms'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { ClickToCallButton } from '@/components/comms/ClickToCallButton'
import { NotificationCard } from '@/components/NotificationCard'
import { useToastPref } from '@/hooks/useToastPrefs'
import {
  fetchRecentIncomingCalls,
  incomingCallKey,
  isIncomingCallHandled,
  isIncomingCallQueued,
  markIncomingCallHandled,
  markIncomingCallQueued,
  mergeIncomingCallAlerts,
  MISSED_CALL_LOOKBACK_HOURS,
  RECENT_INCOMING_CALLS_QUERY_KEY,
  type IncomingCallAlert,
} from '@/lib/incomingCalls'

const CALL_TOAST_SUPPRESSION_MS = 45_000
const seenStreamMessageIds = new Set<string>()
const recentIncomingCallKeys = new Map<string, number>()

export function IncomingCallToasts() {
  const queryClient = useQueryClient()
  const { has, isLoading } = usePermissions()
  const [visibleCall, setVisibleCall] = useState<IncomingCallAlert | null>(null)
  const [hiddenToastKeys, setHiddenToastKeys] = useState<Set<string>>(() => new Set())
  const [toastsOn] = useToastPref('calls')
  const canSeeIncomingCalls = !isLoading && has(PERM.CALLS_VIEW)
  const canViewCustomers = !isLoading && has(PERM.CUSTOMERS_VIEW)
  const recentCallsQ = useQuery({
    queryKey: RECENT_INCOMING_CALLS_QUERY_KEY,
    queryFn: () => fetchRecentIncomingCalls(MISSED_CALL_LOOKBACK_HOURS),
    enabled: canSeeIncomingCalls,
    refetchInterval: 15000,
  })

  useEffect(() => {
    if (!canSeeIncomingCalls) return

    const latestUnopened = (recentCallsQ.data ?? [])
      .filter((call) => isCallAlert(call, true))
      .filter((call) => !hiddenToastKeys.has(incomingCallKey(call)))
      .filter((call) => !isIncomingCallQueued(call))
      .filter((call) => !isIncomingCallHandled(call))
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0]

    if (!latestUnopened) return

    // Nothing showing yet → show the newest unopened call.
    if (!visibleCall) {
      setVisibleCall(latestUnopened)
      return
    }

    // Same call still on screen → leave it.
    if (incomingCallKey(visibleCall) === incomingCallKey(latestUnopened)) return

    // A newer call is waiting while an older toast is still up (nobody acted
    // on it, and the live SSE stream wasn't connected to hand it off). Mirror
    // the stream's behavior: push the older toast into Calls and show the new
    // one — so an unattended call is never lost just because no one clicked it.
    if (
      new Date(latestUnopened.created_at ?? 0).getTime() >=
      new Date(visibleCall.created_at ?? 0).getTime()
    ) {
      markIncomingCallQueued(visibleCall)
      queryClient.setQueryData<IncomingCallAlert[]>(
        RECENT_INCOMING_CALLS_QUERY_KEY,
        (prev = []) => mergeIncomingCallAlerts([visibleCall], prev),
      )
      setVisibleCall(latestUnopened)
    }
  }, [canSeeIncomingCalls, hiddenToastKeys, recentCallsQ.data, visibleCall, queryClient])

  const { account } = useAuth()
  // Live incoming-call toasts over Reverb — replaces the worker-pinning
  // /v1/comms/incoming-calls/stream SSE. Passing a null account when the user
  // can't see calls keeps the hook from opening a socket. Same dedup +
  // suppression as the old stream handler.
  useRealtimeComms(canSeeIncomingCalls ? account : null, 'incoming-calls', (m) => {
    const payload = m as unknown as IncomingCallAlert
    if (!isCallAlert(payload, false)) return
    if (seenStreamMessageIds.has(payload.id)) return

    const callKey = incomingCallKey(payload)
    const now = Date.now()
    pruneRecentCallKeys(now)
    const lastSeen = recentIncomingCallKeys.get(callKey)
    if (lastSeen && now - lastSeen < CALL_TOAST_SUPPRESSION_MS) return

    seenStreamMessageIds.add(payload.id)
    recentIncomingCallKeys.set(callKey, now)
    setHiddenToastKeys((prev) => {
      if (!prev.has(callKey)) return prev
      const next = new Set(prev)
      next.delete(callKey)
      return next
    })
    setVisibleCall((current) => {
      if (current) {
        markIncomingCallQueued(current)
        queryClient.setQueryData<IncomingCallAlert[]>(
          RECENT_INCOMING_CALLS_QUERY_KEY,
          (prev = []) => mergeIncomingCallAlerts([current], prev),
        )
      }

      return payload
    })
    queryClient.setQueryData<IncomingCallAlert[]>(
      RECENT_INCOMING_CALLS_QUERY_KEY,
      (prev = []) => mergeIncomingCallAlerts([payload], prev),
    )
  })

  const toastShowing = !!visibleCall && !hiddenToastKeys.has(incomingCallKey(visibleCall))

  // Only the pop-up is suppressed. The subscription above keeps running so
  // badges and the Calls list still update for someone who silenced alerts.
  if (!toastsOn) return null
  if (!toastShowing || !visibleCall) return null

  return (
    <div className="pointer-events-auto w-full">
      <IncomingCallToast
        key={visibleCall.id}
        call={visibleCall}
        canViewCustomers={canViewCustomers}
        onHide={() => {
          markIncomingCallQueued(visibleCall)
          setHiddenToastKeys((prev) => new Set(prev).add(incomingCallKey(visibleCall)))
          setVisibleCall(null)
        }}
        onHandled={() => {
          markIncomingCallHandled(visibleCall)
          setVisibleCall(null)
        }}
      />
    </div>
  )
}

function isCallAlert(call: IncomingCallAlert, includeFinishedCalls: boolean): boolean {
  if (call.direction !== 'inbound') return false
  if (call.channel !== 'call' && call.channel !== 'voicemail') return false
  if (call.channel !== 'call' || includeFinishedCalls) return true

  return isPopupCallEvent(call)
}

function isPopupCallEvent(call: IncomingCallAlert): boolean {
  const event = String(call.call_event || call.meta?.type || '').toLowerCase()
  if (!event) return true

  return event === 'call_ringing'
    || event === 'ring_group_call_queue_entered'
    || event === 'ring_group_call_tier_ringing'
}

function pruneRecentCallKeys(now: number) {
  for (const [key, lastSeen] of recentIncomingCallKeys.entries()) {
    if (now - lastSeen > CALL_TOAST_SUPPRESSION_MS * 4) {
      recentIncomingCallKeys.delete(key)
    }
  }
}

function IncomingCallToast({
  call,
  canViewCustomers,
  onHide,
  onHandled,
}: {
  call: IncomingCallAlert
  canViewCustomers: boolean
  onHide: () => void
  onHandled: () => void
}) {
  const customerName = call.customer?.display_name
  const callerIdName = normalizeText(call.caller_id_name)
  const callerIdNumber = normalizeText(call.caller_id_number)
  const rawPhone = callerIdNumber || call.external_number || call.from_number
  const phone = formatPhone(rawPhone)
  const title = customerName || callerIdName || phone || 'Unknown caller'
  return (
    <NotificationCard kind={call.channel === 'voicemail' ? 'New voicemail' : 'Incoming call'}
      customer={title}
      avatar={{ id: call.customer?.id, imageUrl: call.customer?.avatar_url, preset: call.customer?.avatar_preset }}
      subtitle={[phone, call.customer?.vip ? 'VIP' : '', call.customer?.customer_type].filter(Boolean).join(' · ')}
      description={call.body?.trim() || (call.customer ? 'Matched to an existing customer. Open their account or call back.' : 'No customer match yet. Open the thread to review this call.')}
      onDismiss={onHide}
      actions={<>
            {rawPhone ? (
              <ClickToCallButton
                phone={rawPhone}
                customerId={call.customer?.id}
                label="Call back"
                onStarted={onHandled}
                className="border-navy-900 bg-navy-900 px-3.5 py-2 text-sm text-white shadow-sm hover:bg-navy-800"
              />
            ) : null}
            {call.customer && canViewCustomers ? (
              <Link
                to={`/customers/${call.customer.id}`}
                onClick={onHandled}
                className="rounded-md border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
              >
                Go to customer
              </Link>
            ) : null}
            {canViewCustomers ? (
              <Link
                to={`/communications?conversation=${encodeURIComponent(call.conversation_id)}`}
                onClick={onHandled}
                className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Open thread
              </Link>
            ) : null}
      </>}
    />
  )
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (['anonymous', 'restricted', 'unavailable', 'unknown'].includes(trimmed.toLowerCase())) return null
  return trimmed
}
