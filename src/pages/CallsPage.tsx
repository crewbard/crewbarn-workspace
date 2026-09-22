import { Link } from 'react-router-dom'
import { formatPhone } from '@/lib/comms'
import { ToastPrefToggle } from '@/components/ToastPrefToggle'
import { ClickToCallButton } from '@/components/comms/ClickToCallButton'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { useUnhandledIncomingCalls } from '@/hooks/useUnhandledIncomingCalls'
import { markIncomingCallHandled, type IncomingCallAlert } from '@/lib/incomingCalls'

export function CallsPage() {
  const { calls, isLoading, count } = useUnhandledIncomingCalls()
  const { has, isLoading: permsLoading } = usePermissions()
  const canViewCustomers = !permsLoading && has(PERM.CUSTOMERS_VIEW)

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Unreviewed Calls</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Incoming call and voicemail alerts that have not been opened, called back, or marked reviewed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ToastPrefToggle area="calls" label="Incoming call" />
          <div className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
            {count} unreviewed
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Loading calls...</div>
        ) : calls.length === 0 ? (
          <div className="p-8 text-center">
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CallRow({
  call,
  canViewCustomers,
}: {
  call: IncomingCallAlert
  canViewCustomers: boolean
}) {
  const callerIdName = normalizeText(call.caller_id_name)
  const rawPhone = callerIdNumber(call)
  const phone = formatPhone(rawPhone)
  const title = callerIdName || call.customer?.display_name || phone || 'Unknown caller'
  const created = call.created_at ? new Date(call.created_at) : null
  const transcript = call.body?.trim()

  return (
    <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
            {call.channel === 'voicemail' ? 'Voicemail' : 'Incoming call'}
          </span>
          {created && <span className="text-xs text-slate-500">{created.toLocaleString()}</span>}
          {call.customer?.vip && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700">VIP</span>}
        </div>
        <div className="mt-1 text-base font-semibold text-navy-950">{title}</div>
        <div className="mt-0.5 flex flex-wrap gap-2 text-sm text-slate-500">
          {phone && <span>{phone}</span>}
          {call.customer && <span>Matched: {call.customer.display_name}</span>}
          {call.customer?.customer_type && <span>{call.customer.customer_type}</span>}
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">
          {transcript || (call.customer
            ? 'Matched to an existing customer. Open the account or thread to review the call.'
            : 'No customer match yet. Open the message thread to review the call.')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 md:justify-end">
        {rawPhone ? (
          <ClickToCallButton
            phone={rawPhone}
            customerId={call.customer?.id}
            label="Call back"
            onStarted={() => markIncomingCallHandled(call)}
            className="border-navy-900 bg-navy-900 px-3.5 py-2 text-sm text-white shadow-sm hover:bg-navy-800"
          />
        ) : null}
        {call.customer && canViewCustomers ? (
          <Link
            to={`/customers/${call.customer.id}`}
            onClick={() => markIncomingCallHandled(call)}
            className="rounded-md border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
          >
            Go to customer
          </Link>
        ) : null}
        {canViewCustomers ? (
          <Link
            to={`/communications?conversation=${encodeURIComponent(call.conversation_id)}`}
            onClick={() => markIncomingCallHandled(call)}
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Open thread
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => markIncomingCallHandled(call)}
          className="rounded-md border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
        >
          Mark reviewed
        </button>
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
