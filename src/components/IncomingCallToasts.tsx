import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useRealtimeComms } from '@/hooks/useRealtimeComms'
import { formatPhone } from '@/lib/comms'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { ClickToCallButton } from '@/components/comms/ClickToCallButton'
import { CallToastCard, type CallCardWhy } from '@/components/CallToastCard'
import { afterHoursNote, callCardState, callerIdentity, pillCount, waitingCalls } from '@/lib/callCard'
import { setCallSpam } from '@/lib/callSpam'
import { CallWaitingPill, type WaitingCall } from '@/components/CallWaitingPill'
import { bindToastPause } from '@/components/NotificationStack'
import { VehicleKeyLink } from '@/components/VehicleKeyOverlay'
import { startToastPlacement } from '@/lib/toastPlacement'
import { useToastPref } from '@/hooks/useToastPrefs'
import { apiRequest } from '@/lib/api'
import {
  fetchRecentIncomingCalls,
  HANDLED_CALLS_CHANGED_EVENT,
  incomingCallKey,
  isIncomingCallHandled,
  isIncomingCallQueued,
  markIncomingCallHandled,
  markIncomingCallQueued,
  mergeIncomingCallAlerts,
  MISSED_CALL_LOOKBACK_HOURS,
  readQueuedIncomingCallKeys,
  RECENT_INCOMING_CALLS_QUERY_KEY,
  type IncomingCallAlert,
} from '@/lib/incomingCalls'
import { useNow } from '@/lib/useNow'

const CALL_TOAST_SUPPRESSION_MS = 45_000
/** A queued call this recent still counts as waiting for the pill. */
const WAITING_WINDOW_MS = 10 * 60_000
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
  const canCreateJobs = !isLoading && has(PERM.JOBS_EDIT)
  const canCreateCustomers = !isLoading && has(PERM.CUSTOMERS_EDIT)
  const recentCallsQ = useQuery({
    queryKey: RECENT_INCOMING_CALLS_QUERY_KEY,
    queryFn: () => fetchRecentIncomingCalls(MISSED_CALL_LOOKBACK_HOURS),
    enabled: canSeeIncomingCalls,
    /*
     * The FALLBACK, not the mechanism.
     *
     * A ringing phone reaches the toast over Reverb, below — that path is
     * immediate. This poll exists for when the socket is down, and at 15
     * seconds it made a dropped socket look like a slow product: the
     * phone rings, nothing happens, and the card turns up after the call
     * has gone to voicemail. Five seconds is still cheap (one small
     * request, only for staff who can see calls) and bounds the worst
     * case to something a person reads as "a moment" rather than "it
     * didn't work".
     */
    refetchInterval: 5000,
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

  // The queue lives in localStorage and changes in other tabs too; re-read
  // it when it does, so the pill agrees with the Calls badge.
  const [queueTick, setQueueTick] = useState(0)
  useEffect(() => {
    const bump = () => setQueueTick((t) => t + 1)
    window.addEventListener(HANDLED_CALLS_CHANGED_EVENT, bump)
    window.addEventListener('storage', bump)
    const every = window.setInterval(bump, 30_000)
    return () => {
      window.removeEventListener(HANDLED_CALLS_CHANGED_EVENT, bump)
      window.removeEventListener('storage', bump)
      window.clearInterval(every)
    }
  }, [])

  const now = useNow(30_000)
  const waiting = useMemo<Array<{ call: IncomingCallAlert; view: WaitingCall }>>(() => {
    void queueTick
    return waitingCalls(recentCallsQ.data ?? [], {
      keyOf: incomingCallKey,
      queued: readQueuedIncomingCallKeys(),
      isHandled: isIncomingCallHandled,
      shownKey: toastShowing && visibleCall ? incomingCallKey(visibleCall) : null,
      now,
      windowMs: WAITING_WINDOW_MS,
    }).map((call) => ({ call, view: waitingView(call, incomingCallKey(call)) }))
  }, [recentCallsQ.data, visibleCall, toastShowing, queueTick, now])

  // Two or more calls at once: the card plus one waiting, or two waiting.
  const pillCalls = pillCount(waiting.length, toastShowing) ? waiting : []
  const pillSig = pillCalls.map((w) => w.view.key).join('|')
  const [pillHiddenSig, setPillHiddenSig] = useState<string | null>(null)
  const showPill = pillCalls.length > 0 && pillHiddenSig !== pillSig

  // Only the pop-up is suppressed. The subscription above keeps running so
  // badges and the Calls list still update for someone who silenced alerts.
  if (!toastsOn) return null
  if (!toastShowing && !showPill) return null

  const bringForward = (key: string) => {
    const chosen = waiting.find((w) => w.view.key === key)?.call
    if (!chosen) return
    if (visibleCall && toastShowing) markIncomingCallQueued(visibleCall)
    setHiddenToastKeys((prev) => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
    setVisibleCall(chosen)
  }

  return (
    <CallLayer>
      {toastShowing && visibleCall && (
        <IncomingCallToast
          key={visibleCall.id}
          call={visibleCall}
          canViewCustomers={canViewCustomers}
          canCreateJobs={canCreateJobs}
          canCreateCustomers={canCreateCustomers}
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
      )}
      {showPill && (
        <CallWaitingPill
          calls={pillCalls.map((w) => w.view)}
          showingOne={toastShowing}
          onShow={bringForward}
          onCalled={(key) => {
            const call = waiting.find((w) => w.view.key === key)?.call
            if (call) markIncomingCallHandled(call)
          }}
          onDismiss={() => setPillHiddenSig(pillSig)}
        />
      )}
    </CallLayer>
  )
}

/**
 * Calls get their own fixed layer above the shared stack (a ringing phone
 * outranks a new text, and this card fits its content where the stack's
 * overlap needs one height). It sits under the measured top bar, pauses
 * every toast while hovered like the stack does, and publishes its height
 * as --cb-call-h so the stack starts below it rather than behind it.
 */
function CallLayer({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const unbind = bindToastPause(el)
    const stopPlacement = startToastPlacement()
    const root = document.documentElement
    const sync = () => {
      const h = el.offsetHeight
      root.style.setProperty('--cb-call-h', h > 0 ? `${h + 8}px` : '0px')
    }
    const resize = new ResizeObserver(sync)
    resize.observe(el)
    sync()
    return () => {
      resize.disconnect()
      unbind()
      stopPlacement()
      root.style.setProperty('--cb-call-h', '0px')
    }
  }, [])
  return createPortal(
    <div ref={ref} className="cb-call-layer" aria-label="Calls">
      {children}
    </div>,
    document.body,
  )
}

function waitingView(call: IncomingCallAlert, key: string): WaitingCall {
  const { title, rawPhone } = callerIdentity(call, formatPhone)
  return {
    key,
    name: title,
    phone: rawPhone,
    customerId: call.customer?.id ?? null,
    avatar: call.customer ? { id: call.customer.id, imageUrl: call.customer.avatar_url, preset: call.customer.avatar_preset } : null,
    since: call.created_at,
  }
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

/** GET /v1/customers/{id}/caller-snapshot: what whoever answers needs to know. */
interface CallerSnapshot {
  open_jobs_count: number
  open_jobs: Array<{ id: string; number: number | null; title: string | null; status: string | null; scheduled_start_at: string | null }>
  /** Null when this person may not see invoices. */
  balance_cents: number | null
  /** API 34.271: the newest finished job, their tags, where they are, and the vehicles their jobs name. */
  last_job?: { id: string; number: number | null; title: string | null; completed_at: string | null } | null
  tags?: string[]
  address?: string | null
  vehicles?: Array<{ label: string; make: string; model: string | null; year: number | null }>
  /** API 34.273: closed right now, and whether the calling number is on the spam list. */
  after_hours?: boolean
  spam?: boolean
}

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const dayFmt: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }

function jobLabel(job: { number: number | null; title: string | null }): string {
  return [job.number ? `#${job.number}` : null, job.title].filter(Boolean).join(' · ') || 'Job'
}

function IncomingCallToast({
  call,
  canViewCustomers,
  canCreateJobs,
  canCreateCustomers,
  onHide,
  onHandled,
}: {
  call: IncomingCallAlert
  canViewCustomers: boolean
  canCreateJobs: boolean
  canCreateCustomers: boolean
  onHide: () => void
  onHandled: () => void
}) {
  const queryClient = useQueryClient()
  const customer = call.customer
  const customerId = customer?.id ?? null
  const { title, rawPhone, callerIdName, sub } = callerIdentity(call, formatPhone)
  // Only for a matched caller, and only once the card is showing.
  const snapshot = useQuery({
    queryKey: ['caller-snapshot', customerId, rawPhone],
    queryFn: () => apiRequest<{ data: CallerSnapshot }>(
      `/v1/customers/${encodeURIComponent(customerId ?? '')}/caller-snapshot${rawPhone ? `?${new URLSearchParams({ phone: rawPhone }).toString()}` : ''}`,
    ),
    enabled: Boolean(customerId) && canViewCustomers,
    staleTime: 60_000,
  })
  const snap = snapshot.data?.data
  const state = callCardState(call, { spam: snap?.spam })
  // The header already says After hours; the note is for what CBI made of it.
  const afterHours = state === 'spam' ? null : afterHoursNote(call.meta)
  const note = afterHours && (afterHours.summary || afterHours.label !== 'Came in after hours') ? afterHours : null
  // A missed call after hours is still a missed call: text them back.
  const missed = state === 'missed' || (state === 'after_hours' && String(call.call_event || call.meta?.type || '').toLowerCase() === 'call_missed')
  const [marking, setMarking] = useState(false)
  const [markError, setMarkError] = useState(false)
  const markSpam = (spam: boolean) => {
    if (!rawPhone || marking) return
    setMarking(true)
    setMarkError(false)
    setCallSpam(queryClient, rawPhone, spam)
      .then(() => {
        // Spam is dealt with: the card goes, the call stays in Calls.
        if (spam) onHandled()
      })
      .catch(() => setMarkError(true))
      .finally(() => setMarking(false))
  }
  const body = call.body?.trim() || null

  const sub2 = customer ? snap?.address ?? null : callerIdName ? 'Not a customer yet' : null

  const next = snap?.open_jobs[0]
  const why: CallCardWhy | null = next
    ? {
        to: `/jobs/${encodeURIComponent(next.id)}`,
        title: `Open job ${jobLabel(next)}`,
        detail: [next.status, next.scheduled_start_at ? new Date(next.scheduled_start_at).toLocaleString(undefined, { ...dayFmt, hour: 'numeric', minute: '2-digit' }) : null]
          .filter(Boolean)
          .join(' · ') || null,
      }
    : snap?.last_job
      ? {
          to: `/jobs/${encodeURIComponent(snap.last_job.id)}`,
          title: `Last job ${jobLabel(snap.last_job)}`,
          detail: snap.last_job.completed_at ? `Finished ${new Date(snap.last_job.completed_at).toLocaleDateString(undefined, dayFmt)}` : null,
        }
      : null

  // Chips only for what is known.
  const chips: ReactNode[] = []
  for (const v of snap?.vehicles ?? []) {
    chips.push(
      <VehicleKeyLink key={`v-${v.label}`} make={v.make} model={v.model} year={v.year} label={v.label} className="cb-call-chip-link" />,
    )
  }
  if (snap && snap.balance_cents !== null && snap.balance_cents > 0) {
    chips.push(<span key="owed" className="cb-call-chip" data-tone="money">{moneyFmt.format(snap.balance_cents / 100)} owed</span>)
  }
  if (snap && snap.open_jobs_count > 1) {
    chips.push(<span key="more" className="cb-call-chip">{snap.open_jobs_count} open jobs</span>)
  }
  if (next && snap?.last_job?.completed_at) {
    chips.push(<span key="last" className="cb-call-chip">Last job {new Date(snap.last_job.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>)
  }
  for (const tag of (snap?.tags ?? []).slice(0, 3)) {
    chips.push(<span key={`t-${tag}`} className="cb-call-chip">{tag}</span>)
  }

  const threadTo = `/communications?conversation=${encodeURIComponent(call.conversation_id)}`
  const createTo = rawPhone ? `/customers/new?${new URLSearchParams({ phone: rawPhone }).toString()}` : '/customers/new'

  return (
    <CallToastCard
      state={state}
      title={title}
      titleTo={customer && canViewCustomers ? `/customers/${encodeURIComponent(customer.id)}` : null}
      avatar={customer ? { id: customer.id, imageUrl: customer.avatar_url, preset: customer.avatar_preset } : null}
      vip={Boolean(customer?.vip)}
      sub={sub}
      sub2={sub2}
      since={call.created_at}
      why={why}
      text={state === 'voicemail' ? null : body}
      voicemail={state === 'voicemail' ? { url: call.recording_url, transcript: body } : null}
      chips={chips.length > 0 ? chips : undefined}
      note={note}
      onHide={onHide}
      onLink={onHandled}
      actions={<>
        {rawPhone ? (
          <ClickToCallButton
            phone={rawPhone}
            customerId={customer?.id}
            label="Call back"
            onStarted={onHandled}
            wrapperClassName="flex flex-[2_1_auto] min-w-max"
            className="cb-call-btn cb-call-btn-primary w-full"
          />
        ) : null}
        {canViewCustomers ? (
          <Link to={threadTo} onClick={onHandled} className="cb-call-btn">
            {missed ? 'Text back' : 'Open thread'}
          </Link>
        ) : null}
        {customer && canCreateJobs ? (
          <Link to={`/jobs/new?customer_id=${encodeURIComponent(customer.id)}`} onClick={onHandled} className="cb-call-btn">
            New job
          </Link>
        ) : null}
        {!customer && canCreateCustomers && state !== 'spam' ? (
          <Link to={createTo} onClick={onHandled} className="cb-call-btn">
            Create customer
          </Link>
        ) : null}
        {rawPhone ? (
          <button
            type="button"
            onClick={() => markSpam(state !== 'spam')}
            disabled={marking}
            className="cb-call-btn cb-call-btn-quiet"
            title={markError ? 'That didn’t save. Try again.' : state === 'spam' ? 'This number is on your spam list.' : 'Calls from this number will show as Likely spam.'}
          >
            {markError ? 'Try again' : state === 'spam' ? 'Not spam' : 'Mark as spam'}
          </button>
        ) : null}
      </>}
    />
  )
}
