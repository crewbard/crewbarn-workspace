import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { TerminalWaitPanel } from '@/components/TerminalWaitPanel'
import type { Invoice } from '@/types/invoice'

/**
 * "Charge on Smart Terminal" for one invoice — the whole balance, to a
 * ticked GoDaddy terminal, then a waiting screen until the customer taps.
 * Renders nothing unless the tenant has a terminal ticked, so a shop that
 * doesn't use GoDaddy never sees it.
 *
 * Two looks: `compact` is one button sized like its neighbours (the job
 * header); the default stacks a picker above a full-width button (the
 * invoice Actions column). With several terminals ticked, compact opens a
 * small menu on click instead of showing a select all the time.
 */
export function TerminalChargeButton({
  invoice,
  disabled,
  compact = false,
  onSettled,
}: {
  invoice: Invoice
  disabled?: boolean
  compact?: boolean
  onSettled: () => void
}) {
  const godaddy = useQuery({
    queryKey: ['godaddy-status'],
    queryFn: () =>
      apiRequest<{ data: { connected: boolean; terminals: Array<{ id: string; name: string | null; selected?: boolean }> } }>(
        '/v1/payments/godaddy/status',
      ),
    staleTime: 60_000,
  })
  const terminals = (godaddy.data?.data.connected ? godaddy.data.data.terminals : []).filter((t) => t.selected)
  const [terminalId, setTerminalId] = useState<string | null>(null)
  const chosen = terminals.find((t) => t.id === terminalId) ?? terminals[0]

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const [waiting, setWaiting] = useState<{ paymentId: string; terminalName: string; amountCents: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const push = useMutation({
    mutationFn: (terminal: { id: string }) =>
      apiRequest<{ data: { payment_id: string; terminal: { id: string; name: string }; amount_cents: number } }>(
        '/v1/payments/godaddy/terminal-charge',
        {
          method: 'POST',
          body: {
            customer_id: invoice.customer_id,
            work_order_id: invoice.work_order_id ?? null,
            amount_cents: invoice.money.balance_due_cents,
            terminal_id: terminal.id,
            allocations: [{ invoice_id: invoice.id, amount_cents: invoice.money.balance_due_cents }],
          },
        },
      ),
    onSuccess: (res) => {
      setError(null)
      setMenuOpen(false)
      setWaiting({ paymentId: res.data.payment_id, terminalName: res.data.terminal.name, amountCents: res.data.amount_cents })
    },
    onError: (e: Error) => setError(e.message),
  })

  if (terminals.length === 0 || invoice.money.balance_due_cents <= 0) return null

  const dollars = (invoice.money.balance_due_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const label = push.isPending
    ? 'Sending…'
    : terminals.length > 1 && compact
      ? `Charge $${dollars} on terminal`
      : `Charge $${dollars} on ${chosen?.name ?? 'terminal'}`

  const waitModal = waiting && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <TerminalWaitPanel
          paymentId={waiting.paymentId}
          terminalName={waiting.terminalName}
          amountCents={waiting.amountCents}
          onSettled={() => { onSettled(); setTimeout(() => setWaiting(null), 1500) }}
          onCancelled={() => setTimeout(() => setWaiting(null), 1500)}
        />
      </div>
    </div>
  )

  if (compact) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          disabled={disabled || push.isPending || !chosen}
          onClick={() => (terminals.length > 1 ? setMenuOpen((o) => !o) : chosen && push.mutate(chosen))}
          title={error ?? 'Send the balance to the Smart Terminal for the customer to tap'}
          className={`rounded-lg px-3 py-2 text-sm font-semibold text-white whitespace-nowrap disabled:opacity-50 ${error ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-700'}`}
        >
          {error ? 'Terminal error — retry' : label}
        </button>
        {menuOpen && (
          <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Send to</div>
            {terminals.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTerminalId(t.id); push.mutate(t) }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-amber-50"
              >
                {t.name ?? t.id}
              </button>
            ))}
          </div>
        )}
        {waitModal}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-1.5">
        {terminals.length > 1 && (
          <select
            value={chosen?.id ?? ''}
            onChange={(e) => setTerminalId(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
          >
            {terminals.map((t) => <option key={t.id} value={t.id}>{t.name ?? t.id}</option>)}
          </select>
        )}
        <button
          type="button"
          disabled={disabled || push.isPending || !chosen}
          onClick={() => chosen && push.mutate(chosen)}
          className="w-full text-sm px-3 py-2 rounded bg-slate-900 hover:bg-slate-700 text-white font-semibold disabled:opacity-50"
        >
          {label}
        </button>
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
      </div>
      {waitModal}
    </>
  )
}
