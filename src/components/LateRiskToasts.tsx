import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NotificationCard } from '@/components/NotificationCard'
import { useLateRisks } from '@/hooks/useLateRisks'
import { acknowledgeLateRisk, lateRiskLine, type LateRisk } from '@/lib/lateRisks'

/**
 * The flashing Schedule button that nobody answered.
 *
 * A tech who may be late makes Schedule flash (useLateRisks). If nobody in
 * the office says they've seen it within the company's few minutes
 * (`toast_at`), it pops up here on every office screen. "Got it" or opening
 * the job acknowledges it everywhere. Letting the toast run out does not:
 * it comes back after the same few minutes, until somebody answers.
 */
export function LateRiskToasts() {
  const late = useLateRisks()
  const queryClient = useQueryClient()
  const [now, setNow] = useState(() => Date.now())
  // Run out without an answer: back after the company's minutes again.
  const [snoozed, setSnoozed] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!late.flashing) return
    const tick = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(tick)
  }, [late.flashing])

  const ack = useMutation({
    mutationFn: (id: string) => acknowledgeLateRisk(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['late-risks'] }),
  })

  const due = late.unseen.filter(
    (r) => r.toast_at && Date.parse(r.toast_at) <= now && (snoozed[r.id] ?? 0) <= now,
  )
  const risk: LateRisk | undefined = due[0]
  if (!risk) return null

  const more = due.length - 1
  const job = risk.work_order_number ? `Job #${risk.work_order_number}` : 'A job'
  const start = risk.scheduled_start_at
    ? new Date(risk.scheduled_start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null
  const unseenFor = risk.detected_at ? Math.max(1, Math.round((now - Date.parse(risk.detected_at)) / 60_000)) : null

  return (
    <NotificationCard
      key={`${risk.id}:${risk.detected_at}`}
      type="late"
      kind="Tech may be late"
      customer={risk.customer_name ?? 'A customer'}
      subtitle={`${job}${start ? ` · starts ${start}` : ''}`}
      description={lateRiskLine(risk)}
      body={
        <>
          <p className="text-[13px] font-semibold leading-snug text-slate-800">{lateRiskLine(risk)}</p>
          <p className="mt-1 text-[11.5px] text-slate-500">
            {unseenFor ? `Schedule has been flashing ${unseenFor} min and nobody has answered.` : 'Nobody has answered the Schedule button.'}
            {more > 0 ? ` ${more} more ${more === 1 ? 'job' : 'jobs'} too.` : ''}
          </p>
        </>
      }
      onDismiss={() => setSnoozed((s) => ({ ...s, [risk.id]: Date.now() + late.toastAfterMinutes * 60_000 }))}
      actions={
        <>
          <Link
            to={`/jobs/${risk.work_order_id}`}
            onClick={() => ack.mutate(risk.id)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[11px] px-3 font-extrabold text-white"
            style={{ background: '#DC2626' }}
          >
            Open the job
          </Link>
          <button
            type="button"
            onClick={() => ack.mutate(risk.id)}
            disabled={ack.isPending}
            className="inline-flex items-center justify-center gap-1 rounded-[11px] bg-white px-3 font-extrabold text-[#0F1A2E] shadow-[inset_0_0_0_1.5px_#CBD5E1] hover:shadow-[inset_0_0_0_1.5px_#2563EB]"
          >
            Got it
          </button>
        </>
      }
    />
  )
}
