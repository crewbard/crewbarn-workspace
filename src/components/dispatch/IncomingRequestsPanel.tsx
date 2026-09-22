import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest, type ApiError } from '@/lib/api'

/**
 * Banner at the top of the dispatch board that surfaces customer-initiated
 * work requests still pending vendor review. When a portal customer hits
 * "Request service" on a provider card, the WO lands here as pending —
 * the dispatcher accepts (it joins the normal queue) or declines (with
 * an optional reason that flows back to the customer's portal).
 *
 * Hides itself completely when zero pending requests.
 */

interface IncomingRequest {
  id: string
  number: string
  title: string
  description: string | null
  priority: 'low' | 'normal' | 'urgent' | 'emergency'
  customer: { id: string; display_name: string } | null
  location: { nickname: string | null; address: string } | null
  created_at: string | null
}

function fmtRel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso).getTime()
  const diff = Math.round((Date.now() - d) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function PriorityChip({ priority }: { priority: IncomingRequest['priority'] }) {
  const cls: Record<IncomingRequest['priority'], string> = {
    low: 'bg-slate-100 text-slate-600',
    normal: 'bg-slate-100 text-slate-700',
    urgent: 'bg-orange-100 text-orange-800',
    emergency: 'bg-rose-100 text-rose-800 font-bold',
  }
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider rounded ${cls[priority]}`}>
      {priority}
    </span>
  )
}

export function IncomingRequestsPanel() {
  const q = useQuery({
    queryKey: ['work-orders-incoming-requests'],
    queryFn: () =>
      apiRequest<{ data: IncomingRequest[] }>('/v1/work-orders/incoming-requests'),
    refetchInterval: 30000, // light poll — these arrive infrequently
  })

  const requests = q.data?.data ?? []
  if (q.isLoading || requests.length === 0) return null

  return (
    <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-amber-900 uppercase tracking-wider">
          Incoming requests · {requests.length}
        </h3>
        <span className="text-[11px] text-amber-700">From customer portal</span>
      </div>
      <div className="space-y-3">
        {requests.map((r) => (
          <RequestRow key={r.id} req={r} />
        ))}
      </div>
    </section>
  )
}

function RequestRow({ req }: { req: IncomingRequest }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showDecline, setShowDecline] = useState(false)
  const [reason, setReason] = useState('')

  const accept = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/work-orders/${req.id}/accept`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders-incoming-requests'] })
      qc.invalidateQueries({ queryKey: ['work-orders'] })
      qc.invalidateQueries({ queryKey: ['dispatch-board'] })
      // Accepting means "we're doing this": the next thing is a date and a
      // tech, so go straight to the job instead of letting it drop out of
      // sight until someone finds it on the customer's account.
      navigate(`/jobs/${req.id}`)
    },
  })

  const decline = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/work-orders/${req.id}/decline`, {
        method: 'POST',
        body: { reason: reason.trim() || null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders-incoming-requests'] })
    },
  })

  const busy = accept.isPending || decline.isPending

  return (
    <div className="bg-white border border-amber-100 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-slate-500">{req.number}</span>
            <PriorityChip priority={req.priority} />
            <span className="text-[11px] text-slate-400">{fmtRel(req.created_at)}</span>
          </div>
          <h4 className="text-sm font-semibold text-navy-900">{req.title}</h4>
          {req.customer && (
            <div className="text-xs text-slate-600 mt-0.5">
              <Link
                to={`/customers/${req.customer.id}`}
                className="hover:underline text-amber-700"
              >
                {req.customer.display_name}
              </Link>
              {req.location && (
                <span className="text-slate-500">
                  {' '}
                  ·{' '}
                  {req.location.nickname ? `${req.location.nickname}, ` : ''}
                  {req.location.address}
                </span>
              )}
            </div>
          )}
          {req.description && (
            <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap line-clamp-3">
              {req.description}
            </p>
          )}
        </div>
      </div>

      {(accept.isError || decline.isError) && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 mb-2">
          {((accept.error ?? decline.error) as ApiError)?.message ?? 'Action failed.'}
        </div>
      )}

      {!showDecline ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => accept.mutate()}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
          >
            {accept.isPending ? 'Accepting…' : 'Accept & schedule'}
          </button>
          <button
            type="button"
            onClick={() => setShowDecline(true)}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            Decline
          </button>
          <Link
            to={`/jobs/${req.id}`}
            className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 ml-auto"
          >
            Open job
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            className="w-full text-xs rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
            rows={2}
            placeholder="Reason (optional, shown to customer)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => decline.mutate()}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50"
            >
              {decline.isPending ? 'Declining…' : 'Confirm decline'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDecline(false)
                setReason('')
              }}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
