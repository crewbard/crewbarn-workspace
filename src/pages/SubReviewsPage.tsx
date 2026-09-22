import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { AttachmentOverlay } from '@/components/ui/AttachmentOverlay'

/**
 * SubReviewsPage — tenant-side inbox for sub-submitted artifacts.
 *
 * Two queues:
 *   1. NTE extension requests — sub asked for more headroom
 *   2. Sub invoices — sub uploaded their PDF + total, waiting on
 *      approve → mark-paid
 *
 * Per-row inline actions hit the WorkOrderSubReviewController
 * endpoints; on success the list refetches.
 */

interface PendingExtension {
  id: string
  work_order_id: string
  sub_wo_number: string | null
  subcontractor_id: string
  subcontractor_name: string | null
  requested_amount_cents: number
  reason: string
  requested_at: string | null
}
interface PendingInvoice {
  id: string
  work_order_id: string
  sub_wo_number: string | null
  subcontractor_id: string
  subcontractor_name: string | null
  invoice_number: string
  total_cents: number
  completion_date: string | null
  submitted_at: string | null
}
interface InboxEnvelope {
  data: {
    nte_extensions: PendingExtension[]
    invoices: PendingInvoice[]
  }
}

const inboxKey = ['sub-reviews-pending'] as const

export function SubReviewsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: inboxKey,
    queryFn: () => apiRequest<InboxEnvelope>('/v1/sub-reviews/pending'),
    refetchInterval: 60_000,
  })

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="mb-6">
        <Link to="/jobs" className="inline-flex items-center text-sm font-medium text-amber-700 hover:text-amber-800 hover:underline mb-3">
          ← Back to Jobs
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Sub reviews</h1>
        <p className="text-sm text-slate-500 mt-1">
          NTE extension requests and submitted invoices from subcontractors awaiting your approval.
        </p>
      </div>

      {error && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2 mb-4">
          Failed to load: {String((error as Error).message)}
        </div>
      )}

      {isLoading && !data && (
        <div className="text-sm text-slate-500">Loading…</div>
      )}

      {data && (
        <div className="space-y-8">
          <NteExtensionsSection rows={data.data.nte_extensions} />
          <InvoicesSection rows={data.data.invoices} />
        </div>
      )}
    </div>
  )
}

// ---------- NTE extensions section ----------

function NteExtensionsSection({ rows }: { rows: PendingExtension[] }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900 mb-3">
        NTE extension requests
        {rows.length > 0 && (
          <span className="ml-2 text-xs font-normal text-slate-500">({rows.length} pending)</span>
        )}
      </h2>
      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500 text-center">
          No pending NTE extension requests.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => <ExtensionRow key={row.id} row={row} />)}
        </div>
      )}
    </section>
  )
}

function ExtensionRow({ row }: { row: PendingExtension }) {
  const queryClient = useQueryClient()
  const [denyReason, setDenyReason] = useState('')
  const [showDeny, setShowDeny] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const approve = useMutation({
    mutationFn: () => apiRequest(`/v1/work-orders/${row.work_order_id}/nte-extensions/${row.id}/approve`, { method: 'PATCH' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: inboxKey }) },
    onError: (e) => setErr(e instanceof Error ? e.message : 'Approve failed'),
  })

  const deny = useMutation({
    mutationFn: () => apiRequest(`/v1/work-orders/${row.work_order_id}/nte-extensions/${row.id}/deny`, {
      method: 'PATCH',
      body: { denial_reason: denyReason.trim() },
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: inboxKey }) },
    onError: (e) => setErr(e instanceof Error ? e.message : 'Deny failed'),
  })

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Link to={`/jobs/${row.work_order_id}`} className="font-mono text-xs text-amber-700 hover:underline">
              {row.sub_wo_number ?? row.work_order_id}
            </Link>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-sm font-medium text-slate-900">{row.subcontractor_name ?? '(unknown sub)'}</span>
          </div>
          <div className="text-sm text-slate-800">
            Requesting <strong className="text-amber-700">+ ${money(row.requested_amount_cents)}</strong> on top of base NTE
          </div>
          <p className="text-xs text-slate-600 mt-2 whitespace-pre-line border-l-2 border-slate-200 pl-3">
            {row.reason}
          </p>
          {row.requested_at && (
            <div className="text-[11px] text-slate-400 mt-2">
              Requested {new Date(row.requested_at).toLocaleString()}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={() => approve.mutate()}
            disabled={approve.isPending || deny.isPending}
            className="px-3 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md disabled:opacity-50"
          >
            {approve.isPending ? 'Approving…' : 'Approve'}
          </button>
          {!showDeny ? (
            <button
              type="button"
              onClick={() => setShowDeny(true)}
              disabled={approve.isPending}
              className="px-3 py-1.5 text-sm font-medium border border-slate-300 hover:bg-slate-50 rounded-md disabled:opacity-50"
            >
              Deny
            </button>
          ) : null}
        </div>
      </div>
      {showDeny && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <textarea
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
            rows={2}
            placeholder="Why are you denying this? (required)"
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (denyReason.trim().length < 1) { setErr('Reason required.'); return }
                deny.mutate()
              }}
              disabled={deny.isPending}
              className="px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
            >
              {deny.isPending ? 'Denying…' : 'Confirm deny'}
            </button>
            <button
              type="button"
              onClick={() => { setShowDeny(false); setDenyReason('') }}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {err && <div className="mt-2 text-xs text-red-700">{err}</div>}
    </div>
  )
}

// ---------- Invoices section ----------

function InvoicesSection({ rows }: { rows: PendingInvoice[] }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900 mb-3">
        Sub invoices
        {rows.length > 0 && (
          <span className="ml-2 text-xs font-normal text-slate-500">({rows.length} submitted)</span>
        )}
      </h2>
      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500 text-center">
          No sub invoices awaiting review.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => <InvoiceRow key={row.id} row={row} />)}
        </div>
      )}
    </section>
  )
}

function InvoiceRow({ row }: { row: PendingInvoice }) {
  const queryClient = useQueryClient()
  const [showDecline, setShowDecline] = useState(false)
  const [showPay, setShowPay] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [paidVia, setPaidVia] = useState<'check' | 'ach' | 'zelle' | 'cash' | 'other'>('check')
  const [paidRef, setPaidRef] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pdfOverlayUrl, setPdfOverlayUrl] = useState<string | null>(null)

  const approve = useMutation({
    mutationFn: () => apiRequest(`/v1/work-orders/${row.work_order_id}/sub-invoice/approve`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxKey }),
    onError: (e) => setErr(e instanceof Error ? e.message : 'Approve failed'),
  })

  const decline = useMutation({
    mutationFn: () => apiRequest(`/v1/work-orders/${row.work_order_id}/sub-invoice/decline`, {
      method: 'PATCH',
      body: { declined_reason: declineReason.trim() },
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxKey }),
    onError: (e) => setErr(e instanceof Error ? e.message : 'Decline failed'),
  })

  const markPaid = useMutation({
    mutationFn: () => apiRequest(`/v1/work-orders/${row.work_order_id}/sub-invoice/mark-paid`, {
      method: 'PATCH',
      body: { paid_via: paidVia, paid_reference: paidRef.trim() || null },
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxKey }),
    onError: (e) => setErr(e instanceof Error ? e.message : 'Mark-paid failed'),
  })

  async function viewPdf() {
    setErr(null)
    try {
      const res = await apiRequest<{ data: { url: string } }>(`/v1/work-orders/${row.work_order_id}/sub-invoice/pdf`)
      setPdfOverlayUrl(res.data.url)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load PDF')
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link to={`/jobs/${row.work_order_id}`} className="font-mono text-xs text-amber-700 hover:underline">
              {row.sub_wo_number ?? row.work_order_id}
            </Link>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-sm font-medium text-slate-900">{row.subcontractor_name ?? '(unknown sub)'}</span>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs font-mono text-slate-600">#{row.invoice_number}</span>
          </div>
          <div className="text-sm text-slate-800">
            Total <strong className="font-mono">${money(row.total_cents)}</strong> · Completed {row.completion_date}
          </div>
          {row.submitted_at && (
            <div className="text-[11px] text-slate-400 mt-2">
              Submitted {new Date(row.submitted_at).toLocaleString()}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={viewPdf}
            className="px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 border border-amber-300 rounded-md"
          >
            View PDF
          </button>
          <button
            type="button"
            onClick={() => approve.mutate()}
            disabled={approve.isPending}
            className="px-3 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md disabled:opacity-50"
          >
            {approve.isPending ? 'Approving…' : 'Approve'}
          </button>
          <button
            type="button"
            onClick={() => setShowPay((v) => !v)}
            className="px-3 py-1.5 text-sm font-medium border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-md"
          >
            Mark paid
          </button>
          <button
            type="button"
            onClick={() => setShowDecline((v) => !v)}
            className="px-3 py-1.5 text-sm font-medium border border-slate-300 hover:bg-slate-50 rounded-md"
          >
            Decline
          </button>
        </div>
      </div>

      {showDecline && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={2}
            placeholder="Why are you declining? Sub can re-submit after fixing. (required)"
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (declineReason.trim().length < 1) { setErr('Reason required.'); return }
                decline.mutate()
              }}
              disabled={decline.isPending}
              className="px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
            >
              {decline.isPending ? 'Declining…' : 'Confirm decline'}
            </button>
            <button
              type="button"
              onClick={() => { setShowDecline(false); setDeclineReason('') }}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showPay && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="text-xs text-slate-500 mb-2">
            Only approved invoices can be marked paid. (Click Approve first if needed.)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-700 mb-1">Paid via</span>
              <select
                value={paidVia}
                onChange={(e) => setPaidVia(e.target.value as typeof paidVia)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="check">Check</option>
                <option value="ach">ACH</option>
                <option value="zelle">Zelle</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-700 mb-1">Reference (check # / txn id)</span>
              <input
                type="text"
                value={paidRef}
                onChange={(e) => setPaidRef(e.target.value)}
                placeholder="optional"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              />
            </label>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => markPaid.mutate()}
              disabled={markPaid.isPending}
              className="px-3 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md disabled:opacity-50"
            >
              {markPaid.isPending ? 'Marking…' : 'Confirm paid'}
            </button>
            <button
              type="button"
              onClick={() => setShowPay(false)}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {err && <div className="mt-2 text-xs text-red-700">{err}</div>}

      {pdfOverlayUrl && (
        <AttachmentOverlay
          url={pdfOverlayUrl}
          filename={`Sub Invoice ${row.invoice_number}.pdf`}
          kind="document"
          onClose={() => setPdfOverlayUrl(null)}
        />
      )}
    </div>
  )
}

function money(cents: number): string {
  return (cents / 100).toFixed(2)
}
