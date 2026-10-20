import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { afterHoursNote, callCardState } from '@/lib/callCard'
import { setCallSpam } from '@/lib/callSpam'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'
import { formatPhone } from '@/lib/comms'
import { ToastPrefToggle } from '@/components/ToastPrefToggle'
import { ClickToCallButton } from '@/components/comms/ClickToCallButton'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { useUnhandledIncomingCalls } from '@/hooks/useUnhandledIncomingCalls'
import { markIncomingCallHandled, type IncomingCallAlert } from '@/lib/incomingCalls'
import { ReferencedText } from '@/components/ReferencedText'
import { PartsMentioned } from '@/components/flash/PartsMentioned'

export function CallsPage() {
  const { calls, isLoading, isError, isFetching, refetch, count } = useUnhandledIncomingCalls()
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const { has, isLoading: permsLoading } = usePermissions()
  const canViewCustomers = !permsLoading && has(PERM.CUSTOMERS_VIEW)
  const canCallThroughApp = !permsLoading && has(PERM.CUSTOMERS_EDIT)

  return (
    <div className={easy ? 'w-full min-w-0 px-3 py-4 sm:px-6 sm:py-6' : 'mx-auto max-w-6xl px-6 py-8'}>
      {easy && <EasyPageHeading title="Calls to review" description="Review a call, call the customer back, or open its message thread. Your existing call controls and toast preferences stay available below." />}
      <div data-tour="calls-header" className="flex flex-wrap items-end justify-between gap-4">
        <div className={easy ? 'hidden' : undefined}>
          <h1 className="text-2xl font-bold text-navy-900">Unreviewed Calls</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Incoming call and voicemail alerts that have not been opened, called back, or marked reviewed.
          </p>
        </div>
        <div className="flex items-center gap-3" data-tour="calls-alerts">
          <ToastPrefToggle area="calls" label="Incoming call" />
          <div data-tour="calls-count" className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
            {isLoading || isError ? '—' : count} unreviewed
          </div>
        </div>
      </div>

      <div data-tour="calls-list" className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Loading calls...</div>
        ) : isError ? (
          <div role="alert" className="p-6 text-sm text-red-700">Calls could not be loaded. <button type="button" onClick={() => { void refetch() }} disabled={isFetching} className="ml-2 underline disabled:opacity-50">Retry</button></div>
        ) : calls.length === 0 ? (
          <div className="p-8 text-center" data-tour="calls-empty">
            <div className="text-sm font-semibold text-navy-900">No unreviewed calls</div>
            <p className="mt-1 text-sm text-slate-500">New incoming calls will appear here if the toast is not opened.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {calls.map((call) => (
              <CallRow
                key={call.id}
                call={call}
                canViewCustomers={canViewCustomers}
                canCallThroughApp={canCallThroughApp}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


/*
 * One shape for every button in a call row.
 *
 * They were three: a navy slab, an amber one and a slate one, which put
 * the loudest colour in the app on the SECOND most important action and
 * left amber meaning two different things — here, and on the VIP pill.
 * Same shape, and only the fill says which is which.
 */
const CALL_ACTION = 'inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 '
  + 'text-sm font-medium shadow-sm transition-colors focus-visible:outline-none '
  + 'focus-visible:ring-2 focus-visible:ring-[var(--accent-500,#E8902C)] focus-visible:ring-offset-2'

function CallRow({
  call,
  canViewCustomers,
  canCallThroughApp,
}: {
  call: IncomingCallAlert
  canViewCustomers: boolean
  canCallThroughApp: boolean
}) {
  const callerIdName = normalizeText(call.caller_id_name)
  const rawPhone = callerIdNumber(call)
  const phone = formatPhone(rawPhone)
  const title = callerIdName || call.customer?.display_name || phone || 'Unknown caller'
  const created = call.created_at ? new Date(call.created_at) : null
  const transcript = call.body?.trim()
  const queryClient = useQueryClient()
  const state = callCardState(call)
  const spam = state === 'spam'
  const note = afterHoursNote(call.meta)
  const [marking, setMarking] = useState(false)
  const [markError, setMarkError] = useState(false)
  const markSpam = () => {
    if (!rawPhone || marking) return
    setMarking(true)
    setMarkError(false)
    setCallSpam(queryClient, rawPhone, !spam)
      .catch(() => setMarkError(true))
      .finally(() => setMarking(false))
  }

  return (
    <div data-tour="calls-row" data-channel={call.channel} data-matched={call.customer ? 'yes' : 'no'} data-state={state} className={`grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center${spam ? ' opacity-70' : ''}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
            {call.channel === 'voicemail' ? 'Voicemail' : 'Incoming call'}
          </span>
          {created && <span className="text-xs text-slate-500">{created.toLocaleString()}</span>}
          {call.customer?.vip && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700">VIP</span>}
          {spam && <span data-tour="calls-spam" className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">Likely spam</span>}
          {!spam && note && <span data-tour="calls-after-hours" className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-violet-700">After hours</span>}
          {!spam && note?.urgent && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">Urgent</span>}
        </div>
        <div className="mt-1 text-base font-semibold text-navy-950">{title}</div>
        <div className="mt-0.5 flex flex-wrap gap-2 text-sm text-slate-500">
          {phone && <span>{phone}</span>}
          {call.customer && <span>Matched: {call.customer.display_name}</span>}
          {call.customer?.customer_type && <span>{call.customer.customer_type}</span>}
        </div>
        {!spam && note && (note.summary || note.label !== 'Came in after hours') && (
          <p className="mt-1 text-sm text-violet-800">
            <span className="font-medium">{note.label}</span>
            {note.summary ? ` · ${note.summary}` : null}
          </p>
        )}
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">
          {transcript ? <ReferencedText text={transcript} source="transcript" /> : (call.customer
            ? 'Matched to an existing customer. Open the account or thread to review the call.'
            : 'No customer match yet. Open the message thread to review the call.')}
        </p>
        {transcript && (
          <PartsMentioned
            sourceType="comms_message"
            sourceId={call.id}
            tour="calls-parts"
            showCandidates={false}
            className="mt-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2"
          />
        )}
      </div>

      <div data-tour="calls-row-actions" className="flex flex-wrap gap-2 md:justify-end">
        {rawPhone && !canCallThroughApp ? (
          // Without customers.edit the in-app dialer is off; dial from this
          // device instead so the button doesn't just vanish.
          <a
            href={`tel:${rawPhone}`}
            onClick={() => markIncomingCallHandled(call)}
            className={`${CALL_ACTION} border border-navy-800 bg-navy-800 text-white hover:bg-navy-700`}
          >
            Call back
          </a>
        ) : null}
        {rawPhone && canCallThroughApp ? (
          <ClickToCallButton
            phone={rawPhone}
            customerId={call.customer?.id}
            label="Call back"
            onStarted={() => markIncomingCallHandled(call)}
            className={`${CALL_ACTION} border border-navy-800 bg-navy-800 text-white hover:bg-navy-700`}
          />
        ) : null}
        {call.customer && canViewCustomers ? (
          <Link
            data-tour="calls-go-customer"
            to={`/customers/${call.customer.id}`}
            onClick={() => markIncomingCallHandled(call)}
            className={`${CALL_ACTION} border border-navy-200 bg-white text-navy-800 hover:bg-navy-50`}
          >
            Go to customer
          </Link>
        ) : null}
        {canViewCustomers ? (
          <Link
            data-tour="calls-open-thread"
            to={`/communications?conversation=${encodeURIComponent(call.conversation_id)}`}
            onClick={() => markIncomingCallHandled(call)}
            className={`${CALL_ACTION} border border-navy-200 bg-white text-navy-800 hover:bg-navy-50`}
          >
            Open thread
          </Link>
        ) : null}
        <button
          type="button"
          data-tour="calls-reviewed"
          onClick={() => markIncomingCallHandled(call)}
          /* The one action that is not going anywhere, and the only one
             allowed to be quieter than the rest. */
          className={`${CALL_ACTION} border border-transparent text-navy-500 hover:bg-navy-50`}
        >
          Mark reviewed
        </button>
        {rawPhone ? (
          <button
            type="button"
            data-tour="calls-spam-toggle"
            onClick={markSpam}
            disabled={marking}
            title={spam ? 'This number is on your spam list.' : 'Calls from this number will show as Likely spam.'}
            className={`${CALL_ACTION} border border-transparent text-navy-500 hover:bg-navy-50 disabled:opacity-50`}
          >
            {markError ? 'Didn’t save. Try again' : spam ? 'Not spam' : 'Mark as spam'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function callerIdNumber(call: IncomingCallAlert): string {
  return normalizeText(call.caller_id_number) || call.external_number || call.from_number || ''
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (['anonymous', 'restricted', 'unavailable', 'unknown'].includes(trimmed.toLowerCase())) return null
  return trimmed
}

export default CallsPage
