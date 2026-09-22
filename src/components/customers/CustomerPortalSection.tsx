import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, type ApiError } from '@/lib/api'

/**
 * Provider-side card on the customer detail page that controls the
 * customer's portal access. Hits the same /v1/customers/{id}/portal-invite
 * routes that the backend exposes — GET for the badge state, POST to
 * send/resend, DELETE to revoke.
 *
 * States rendered:
 *   not_invited — primary button "Send portal invite"
 *   invited     — sent timestamp + expiry + Resend / Cancel buttons
 *   expired     — "Invite expired" notice + Send new + Cancel
 *   linked      — "Active since X" notice + Revoke
 *
 * Customer needs an email on file — backend 422s without one and the UI
 * surfaces that message.
 */

interface PortalStatus {
  status: 'not_invited' | 'invited' | 'expired' | 'linked'
  invited_at?: string | null
  expires_at?: string | null
  expired_at?: string | null
  linked_at?: string | null
}

function fmtRel(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Math.round((Date.now() - d.getTime()) / 1000)
  if (diff < 90) return 'just now'
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  if (diff < 86400 * 30) return `${Math.round(diff / 86400)}d ago`
  return d.toLocaleDateString()
}

function fmtUntil(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Math.round((d.getTime() - Date.now()) / 1000)
  if (diff <= 0) return 'expired'
  if (diff < 3600) return `in ${Math.round(diff / 60)}m`
  if (diff < 86400) return `in ${Math.round(diff / 3600)}h`
  return `in ${Math.round(diff / 86400)}d`
}

export function CustomerPortalSection({
  customerId,
  customerEmail,
}: {
  customerId: string
  customerEmail: string | null
}) {
  const qc = useQueryClient()

  const status = useQuery({
    queryKey: ['customer-portal-status', customerId],
    queryFn: () =>
      apiRequest<{ data: PortalStatus }>(`/v1/customers/${customerId}/portal-invite`),
  })

  const invite = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/customers/${customerId}/portal-invite`, { method: 'POST' }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['customer-portal-status', customerId] }),
  })

  const revoke = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/customers/${customerId}/portal-invite`, { method: 'DELETE' }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['customer-portal-status', customerId] }),
  })

  const noEmail = !customerEmail
  const data = status.data?.data
  const busy = invite.isPending || revoke.isPending || status.isLoading

  return (
    <section className="bg-white rounded-lg border border-navy-100 p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-navy-800 uppercase tracking-wider">
          Customer Portal
        </h2>
        {data && <StatusPill status={data.status} />}
      </div>
      <p className="text-xs text-navy-500 mb-4 max-w-xl">
        Let this customer log in to their CrewBarn portal to see work orders, view
        invoices, and pay online. Sharing is opt-in — nothing is exposed unless
        you invite them.
      </p>

      {noEmail && (
        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-3 py-2 mb-3">
          Add an email to this customer's contact info before inviting them — the
          invite link goes to their email.
        </div>
      )}

      {invite.isError && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 mb-3">
          {(invite.error as ApiError).message ?? 'Failed to send invite.'}
        </div>
      )}

      {revoke.isError && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 mb-3">
          {(revoke.error as ApiError).message ?? 'Failed to revoke.'}
        </div>
      )}

      {status.isLoading && (
        <p className="text-xs text-navy-400 italic">Loading status…</p>
      )}

      {data?.status === 'not_invited' && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => invite.mutate()}
            disabled={busy || noEmail}
            className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
          >
            {invite.isPending ? 'Sending…' : 'Send portal invite'}
          </button>
          {customerEmail && (
            <span className="text-xs text-navy-500">
              Goes to <span className="font-mono">{customerEmail}</span>
            </span>
          )}
        </div>
      )}

      {data?.status === 'invited' && (
        <div className="space-y-2">
          <p className="text-xs text-navy-600">
            Sent {fmtRel(data.invited_at)} · Expires {fmtUntil(data.expires_at)}
            {customerEmail && (
              <>
                {' '}to <span className="font-mono">{customerEmail}</span>
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => invite.mutate()}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-md border border-navy-200 text-navy-700 hover:bg-navy-50 disabled:opacity-50"
            >
              {invite.isPending ? 'Resending…' : 'Resend invite'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm('Cancel the pending invite?')) revoke.mutate()
              }}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Cancel invite
            </button>
          </div>
        </div>
      )}

      {data?.status === 'expired' && (
        <div className="space-y-2">
          <p className="text-xs text-navy-600">
            Invite expired {fmtRel(data.expired_at)} without being accepted.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => invite.mutate()}
              disabled={busy || noEmail}
              className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {invite.isPending ? 'Sending…' : 'Send new invite'}
            </button>
            <button
              type="button"
              onClick={() => revoke.mutate()}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-md border border-navy-200 text-navy-700 hover:bg-navy-50 disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {data?.status === 'linked' && (
        <div className="space-y-2">
          <p className="text-xs text-navy-600">
            Portal access active since {fmtRel(data.linked_at)}. This customer can
            sign in to see jobs, estimates, and invoices you've shared with them.
          </p>
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  "Revoke portal access? They'll lose the ability to log in and see their data through CrewBarn until you re-invite them.",
                )
              ) {
                revoke.mutate()
              }
            }}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Revoke portal access
          </button>
        </div>
      )}
    </section>
  )
}

function StatusPill({ status }: { status: PortalStatus['status'] }) {
  const meta: Record<PortalStatus['status'], { label: string; cls: string }> = {
    not_invited: { label: 'Not invited', cls: 'bg-slate-100 text-slate-700' },
    invited: { label: 'Invite pending', cls: 'bg-amber-50 text-amber-800 border border-amber-200' },
    expired: { label: 'Invite expired', cls: 'bg-red-50 text-red-800 border border-red-200' },
    linked: { label: 'Active', cls: 'bg-emerald-50 text-emerald-800 border border-emerald-200' },
  }
  const m = meta[status]
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] uppercase tracking-wide font-bold ${m.cls}`}
    >
      {m.label}
    </span>
  )
}
