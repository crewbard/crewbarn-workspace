import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * "Waiting for the customer to tap" — shown after a payment has been pushed
 * to a GoDaddy Smart Terminal. Polls until the terminal's callback moves
 * the payment to received or voided. Cancel takes the request back off
 * the terminal screen.
 */
export function TerminalWaitPanel({
  paymentId,
  terminalName,
  amountCents,
  onSettled,
  onCancelled,
}: {
  paymentId: string
  terminalName: string
  amountCents: number
  onSettled: () => void
  onCancelled: () => void
}) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const status = useQuery({
    queryKey: ['godaddy-terminal-charge', paymentId],
    queryFn: () =>
      apiRequest<{ data: { status: string; notes: string | null } }>(`/v1/payments/godaddy/terminal-charge/${paymentId}`),
    refetchInterval: (q) => {
      const s = q.state.data?.data.status
      return s === 'received' || s === 'voided' ? false : 2000
    },
  })
  const s = status.data?.data.status

  useEffect(() => {
    if (s === 'received') onSettled()
    if (s === 'voided') onCancelled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s])

  const cancel = useMutation({
    mutationFn: () => apiRequest(`/v1/payments/godaddy/terminal-charge/${paymentId}/cancel`, { method: 'POST' }),
    onSuccess: () => status.refetch(),
  })

  const dollars = (amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="px-5 py-8 text-center">
      {s === 'received' ? (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div>
          <h3 className="mt-3 text-lg font-bold text-slate-900">Paid — ${dollars}</h3>
          <p className="mt-1 text-sm text-slate-500">The card went through on {terminalName}.</p>
        </>
      ) : s === 'voided' ? (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-500">✕</div>
          <h3 className="mt-3 text-lg font-bold text-slate-900">Not charged</h3>
          <p className="mt-1 text-sm text-slate-500">{status.data?.data.notes ?? 'The terminal request was cancelled.'}</p>
        </>
      ) : (
        <>
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-amber-500" />
          <h3 className="mt-4 text-lg font-bold text-slate-900">${dollars} sent to {terminalName}</h3>
          <p className="mt-1 text-sm text-slate-500">
            Waiting for the customer to tap or insert their card. This updates on its own.
          </p>
          <p className="mt-3 text-xs tabular-nums text-slate-400">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} · the request clears from the terminal after 5 minutes</p>
          {status.isError && <p className="mt-2 text-xs text-rose-600">Lost contact with the server — still checking.</p>}
          <button
            type="button"
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending}
            className="mt-6 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {cancel.isPending ? 'Cancelling…' : 'Cancel on terminal'}
          </button>
        </>
      )}
    </div>
  )
}
