import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { AttachmentOverlay } from '@/components/ui/AttachmentOverlay'

/**
 * Sub invoice tab on the staff WO detail page. Shows the single
 * submitted invoice (one-per-WO contract) with inline PDF preview +
 * the same Approve / Decline / Mark paid actions that live on the
 * /sub-reviews inbox — so the office doesn't have to leave the WO to
 * action it.
 *
 * Only rendered when wo.is_subbed (the page guards this).
 */

interface SubInvoiceRow {
  id: string
  invoice_number: string
  total_cents: number
  status: 'submitted' | 'approved' | 'declined' | 'paid'
  completion_date: string | null
  submitted_at: string | null
  approved_at: string | null
  paid_at: string | null
  declined_reason: string | null
  paid_via: string | null
  paid_reference: string | null
  pdf_url: string | null
  subcontractor: { id: string; business_name: string } | null
}

export function WorkOrderSubInvoicePanel({ workOrderId }: { workOrderId: string }) {
  const qc = useQueryClient()
  const invKey = ['wo-sub-invoice', workOrderId] as const

  const q = useQuery<{ data: SubInvoiceRow | null }>({
    queryKey: invKey,
    queryFn: async (): Promise<{ data: SubInvoiceRow | null }> => {
      try {
        return await apiRequest<{ data: SubInvoiceRow }>(
          `/v1/work-orders/${workOrderId}/sub-invoice`,
        )
      } catch (e) {
        // 404 = no invoice submitted yet; render the empty state.
        if ((e as { status?: number }).status === 404) {
          return { data: null }
        }
        throw e
      }
    },
  })

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: invKey })
    qc.invalidateQueries({ queryKey: ['work-orders'] })
    qc.invalidateQueries({ queryKey: ['sub-reviews-pending'] })
    qc.invalidateQueries({ queryKey: ['topbar-sub-reviews-pending'] })
  }

  const approve = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/work-orders/${workOrderId}/sub-invoice/approve`, { method: 'PATCH' }),
    onSuccess: () => invalidateAll(),
  })
  const decline = useMutation({
    mutationFn: (reason: string) =>
      apiRequest(`/v1/work-orders/${workOrderId}/sub-invoice/decline`, {
        method: 'PATCH',
        body: { reason },
      }),
    onSuccess: () => invalidateAll(),
  })
  const markPaid = useMutation({
    mutationFn: (payload: { paid_via: string; paid_reference?: string }) =>
      apiRequest(`/v1/work-orders/${workOrderId}/sub-invoice/mark-paid`, {
        method: 'PATCH',
        body: payload,
      }),
    onSuccess: () => invalidateAll(),
  })

  const [showDecline, setShowDecline] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [showMarkPaid, setShowMarkPaid] = useState(false)
  const [paidVia, setPaidVia] = useState('ach')
  const [paidRef, setPaidRef] = useState('')
  const [showPdfOverlay, setShowPdfOverlay] = useState(false)

  if (q.isLoading) return <div className="text-sm text-slate-500">Loading invoice…</div>
  if (q.isError) return <div className="text-sm text-red-700">{(q.error as Error).message}</div>

  const inv = q.data?.data

  if (!inv) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">
        No invoice submitted yet. The sub uploads from their portal once the job is complete.
      </div>
    )
  }

  const statusBadge =
    inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800'
      : inv.status === 'approved' ? 'bg-amber-100 text-amber-800'
        : inv.status === 'declined' ? 'bg-red-100 text-red-800'
          : 'bg-sky-100 text-sky-800'

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded ${statusBadge}`}>
                {inv.status}
              </span>
              <span className="text-xs font-mono text-slate-500">#{inv.invoice_number}</span>
            </div>
            <div className="text-base font-semibold text-slate-900">
              {inv.subcontractor?.business_name ?? '(unknown sub)'}
            </div>
            <div className="text-xs text-slate-500">
              {inv.submitted_at ? `Submitted ${new Date(inv.submitted_at).toLocaleString()}` : '—'}
              {inv.completion_date && ` · Completed ${inv.completion_date}`}
            </div>
            {inv.declined_reason && (
              <div className="mt-2 text-xs bg-red-50 border border-red-200 text-red-800 rounded p-2">
                <strong>Declined:</strong> {inv.declined_reason}
              </div>
            )}
            {inv.status === 'paid' && (
              <div className="mt-2 text-xs text-emerald-800">
                Paid {inv.paid_at && `· ${new Date(inv.paid_at).toLocaleDateString()}`}
                {inv.paid_via && ` · ${inv.paid_via.toUpperCase()}`}
                {inv.paid_reference && ` · ${inv.paid_reference}`}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase text-slate-500">Total</div>
            <div className="text-xl font-mono font-bold text-slate-900">
              ${(inv.total_cents / 100).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Actions row */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {inv.pdf_url && (
            <button
              type="button"
              onClick={() => setShowPdfOverlay(true)}
              className="text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md px-3 py-1.5"
            >
              View PDF
            </button>
          )}
          {inv.status === 'submitted' && (
            <>
              <button
                type="button"
                onClick={() => approve.mutate()}
                disabled={approve.isPending}
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                {approve.isPending ? 'Approving…' : 'Approve'}
              </button>
              <button
                type="button"
                onClick={() => setShowDecline((v) => !v)}
                className="text-xs font-semibold border border-red-300 text-red-700 hover:bg-red-50 rounded-md px-3 py-1.5"
              >
                Decline
              </button>
            </>
          )}
          {inv.status === 'approved' && (
            <button
              type="button"
              onClick={() => setShowMarkPaid((v) => !v)}
              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-1.5"
            >
              Mark paid
            </button>
          )}
        </div>

        {showDecline && inv.status === 'submitted' && (
          <div className="mt-3 space-y-2">
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={2}
              placeholder="Why are you declining? (sent to the sub)"
              className="w-full text-sm border border-slate-300 rounded px-2 py-2"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowDecline(false); setDeclineReason('') }}
                className="text-xs text-slate-600 px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!declineReason.trim() || decline.isPending}
                onClick={() => decline.mutate(declineReason.trim())}
                className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                {decline.isPending ? 'Sending…' : 'Confirm decline'}
              </button>
            </div>
          </div>
        )}

        {showMarkPaid && inv.status === 'approved' && (
          <div className="mt-3 space-y-2 bg-slate-50 border border-slate-200 rounded p-3">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={paidVia}
                onChange={(e) => setPaidVia(e.target.value)}
                className="text-sm border border-slate-300 rounded px-2 py-2 bg-white"
              >
                <option value="ach">ACH</option>
                <option value="check">Check</option>
                <option value="card">Card</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
              <input
                type="text"
                value={paidRef}
                onChange={(e) => setPaidRef(e.target.value)}
                placeholder="Reference # (optional)"
                className="text-sm border border-slate-300 rounded px-2 py-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMarkPaid(false)}
                className="text-xs text-slate-600 px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={markPaid.isPending}
                onClick={() =>
                  markPaid.mutate({ paid_via: paidVia, paid_reference: paidRef.trim() || undefined })
                }
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                {markPaid.isPending ? 'Saving…' : 'Confirm paid'}
              </button>
            </div>
          </div>
        )}
      </section>

      {showPdfOverlay && inv.pdf_url && (
        <AttachmentOverlay
          url={inv.pdf_url}
          filename={`Sub Invoice ${inv.invoice_number}.pdf`}
          kind="document"
          onClose={() => setShowPdfOverlay(false)}
        />
      )}
    </div>
  )
}
