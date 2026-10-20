import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLateRisks } from '@/hooks/useLateRisks'
import { acknowledgeLateRisk, callCustomerAboutLate, lateRiskLine } from '@/lib/lateRisks'

/**
 * Top of the Schedule page: the techs who may be late, which is what the
 * flashing Schedule button is about. "Got it" stops the flash for everyone
 * and keeps the toast from coming; the row stays until the tech arrives,
 * the job moves, or they're back on time.
 */
function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function LateRiskPanel() {
  const late = useLateRisks()
  const queryClient = useQueryClient()
  const ack = useMutation({
    mutationFn: (id: string) => acknowledgeLateRisk(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['late-risks'] }),
  })
  // The automated call to the customer (their call script), where allowed.
  const callCustomer = useMutation({
    mutationFn: (id: string) => callCustomerAboutLate(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['late-risks'] }),
  })

  if (!late.enabled || late.items.length === 0) return null

  return (
    <section
      data-tour="schedule-late-risks"
      aria-label="Techs who may be late"
      className="shrink-0 border-b border-red-200 bg-gradient-to-r from-red-50 to-blue-50 px-3 py-2 sm:px-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-red-800">
          {late.items.length === 1 ? 'A tech may be late' : `${late.items.length} techs may be late`}
        </h2>
        <Link to="/tool-shed/preferences/late-techs" className="text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:underline">
          Late alert settings
        </Link>
      </div>
      <ul className="mt-1.5 space-y-1.5">
        {late.items.map((r) => {
          const start = r.scheduled_start_at
            ? new Date(r.scheduled_start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
            : null
          return (
            <li
              key={r.id}
              data-tour="schedule-late-risk"
              data-seen={r.acknowledged_at ? 'yes' : 'no'}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-sm ${
                r.acknowledged_at ? 'border-slate-200' : 'border-red-300 shadow-[0_0_0_2px_rgba(220,38,38,0.15)]'
              }`}
            >
              <div className="min-w-0">
                <div className="font-semibold text-slate-900">
                  {r.work_order_number ? `Job #${r.work_order_number}` : 'Job'}
                  {r.customer_name ? ` · ${r.customer_name}` : ''}
                  {start ? <span className="font-normal text-slate-500"> · starts {start}</span> : null}
                </div>
                <div className="text-xs text-slate-600">{lateRiskLine(r)}</div>
                <div className="text-[11px] text-slate-500">
                  {r.customer_called_at
                    ? `${r.acknowledged_by_name ?? 'Someone'} called the customer at ${clock(r.customer_called_at)}.`
                    : r.tech_seen_at
                      ? `${r.tech_name ?? 'The tech'} opened the warning at ${clock(r.tech_seen_at)} but hasn’t called the customer yet.`
                      : r.tech_alerted_at
                        ? `${r.tech_name ?? 'The tech'} was warned at ${clock(r.tech_alerted_at)} and hasn’t opened it.`
                        : null}
                  {r.acknowledged_at && !r.customer_called_at ? ` Seen by ${r.acknowledged_by_name ?? 'the office'}.` : ''}
                  {r.tech_call ? ` CBI called ${r.tech_name ?? 'the tech'}: ${r.tech_call.error ?? r.tech_call.outcome}${r.tech_call.pressed ? `, ${r.tech_call.pressed.toLowerCase()}` : ''}.` : ''}
                  {r.customer_call?.last ? ` CBI called the customer: ${r.customer_call.last.error ?? r.customer_call.last.outcome}${r.customer_call.last.pressed ? `, ${r.customer_call.last.pressed.toLowerCase()}` : ''}.` : ''}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {!r.customer_called_at && (
                  <button
                    type="button"
                    onClick={() => callCustomer.mutate(r.id)}
                    disabled={callCustomer.isPending || r.customer_call?.why_not !== null}
                    title={r.customer_call?.why_not ?? 'CBI calls the customer with your customer call script'}
                    className="rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    CBI: call customer
                  </button>
                )}
                <Link
                  to={`/jobs/${r.work_order_id}`}
                  onClick={() => { if (!r.acknowledged_at) ack.mutate(r.id) }}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open job
                </Link>
                {!r.acknowledged_at && (
                  <button
                    type="button"
                    onClick={() => ack.mutate(r.id)}
                    disabled={ack.isPending}
                    className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    Got it
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {callCustomer.data && <p className={`mt-1.5 text-xs ${callCustomer.data.ok ? 'text-emerald-700' : 'text-red-700'}`}>{callCustomer.data.message}</p>}
      {callCustomer.isError && <p className="mt-1.5 text-xs text-red-700">{callCustomer.error instanceof Error ? callCustomer.error.message : 'The call didn’t go out.'}</p>}
    </section>
  )
}
