import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, ApiError } from '@/lib/api'
import { useNow } from '@/lib/useNow'

/**
 * A customer asked from their portal to move this visit.
 *
 * The job stays where it is until somebody here answers. Approve moves it to
 * the time they asked for (keeping the job's own length); decline leaves it,
 * with a note the customer reads in their portal. Renders nothing unless
 * there is a request waiting or one was answered in the last two weeks.
 */

interface MoveRequest {
  id: string
  status: 'pending' | 'approved' | 'declined'
  source: 'slot' | 'suggested' | 'call'
  requested_label: string
  from_label: string | null
  note: string | null
  office_note: string | null
  requested_by_name: string | null
  created_at: string | null
  decided_at: string | null
}

const RECENT_MS = 14 * 24 * 60 * 60 * 1000

export function RescheduleRequestsPanel({ workOrderId, canEdit }: { workOrderId: string; canEdit: boolean }) {
  const now = useNow(60_000)
  const qc = useQueryClient()
  const key = ['work-order-reschedule-requests', workOrderId]
  const q = useQuery({
    queryKey: key,
    queryFn: () => apiRequest<{ data: MoveRequest[] }>(`/v1/work-orders/${workOrderId}/reschedule-requests`),
  })
  const [note, setNote] = useState('')
  const [declining, setDeclining] = useState(false)

  const answer = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: 'approve' | 'decline' }) =>
      apiRequest(`/v1/work-orders/${workOrderId}/reschedule-requests/${id}/${verb}`, {
        method: 'POST',
        body: { note: note.trim() || null },
      }),
    onSuccess: () => {
      setNote('')
      setDeclining(false)
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })

  const rows = q.data?.data ?? []
  const pending = rows.find((r) => r.status === 'pending')
  const recent = !pending
    ? rows.find((r) => r.decided_at && now - new Date(r.decided_at).getTime() < RECENT_MS)
    : undefined

  if (!pending && !recent) return null

  if (recent) {
    return (
      <section data-tour="wo-reschedule-request" data-request-state="answered" className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        {recent.status === 'approved'
          ? <>Moved to <strong>{recent.requested_label}</strong> at the customer’s request.</>
          : <>Declined the customer’s ask to move to <strong>{recent.requested_label}</strong>.</>}
        {recent.office_note && <span className="text-slate-500"> Note: {recent.office_note}</span>}
      </section>
    )
  }

  const r = pending!
  const error = answer.error instanceof ApiError ? answer.error.message : answer.error ? 'That didn’t save. Try again.' : null

  return (
    <section data-tour="wo-reschedule-request" data-request-state="pending" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-amber-900">
            {r.requested_by_name ?? 'The customer'} asked to move this visit
          </h2>
          <p className="mt-1 text-sm text-amber-900">
            {r.from_label ? <>From {r.from_label} to </> : <>To </>}
            <strong>{r.requested_label}</strong>
            {r.source === 'call' ? ' (asked for on a call)' : r.source === 'suggested' ? ' (a time they suggested)' : ' (one of your open times)'}
          </p>
          {r.note && <p className="mt-1 text-sm text-amber-800">“{r.note}”</p>}
        </div>
        {canEdit && !declining && (
          <div className="flex flex-shrink-0 gap-2">
            <button
              type="button"
              disabled={answer.isPending}
              onClick={() => setDeclining(true)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Decline
            </button>
            <button
              type="button"
              disabled={answer.isPending}
              onClick={() => answer.mutate({ id: r.id, verb: 'approve' })}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {answer.isPending ? 'Moving…' : 'Approve and move the job'}
            </button>
          </div>
        )}
      </div>
      {canEdit && declining && (
        <div className="mt-3 grid gap-2">
          <label className="text-xs font-medium text-amber-900" htmlFor="reschedule-decline-note">
            Note for the customer (they see it in their portal)
          </label>
          <textarea
            id="reschedule-decline-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="For example: that day is full. Could Thursday morning work instead?"
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={answer.isPending}
              onClick={() => answer.mutate({ id: r.id, verb: 'decline' })}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {answer.isPending ? 'Sending…' : 'Decline the move'}
            </button>
            <button type="button" onClick={() => setDeclining(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
              Back
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  )
}
