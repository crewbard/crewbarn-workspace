import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'
import { AgreementBuilderModal, type AgreementSourceRef } from '@/components/estimates/AgreementBuilderModal'

/**
 * "Build service agreement" from anywhere: a property, a piece of
 * equipment, a customer or a plan request. Opens the same builder the
 * estimate page uses, started from that record.
 */
export function AgreementBuilderButton({ source, tour, className, label = 'Build service agreement' }: {
  source: AgreementSourceRef
  tour?: string
  className?: string
  label?: string
}) {
  const { has } = usePermissions()
  const [open, setOpen] = useState(false)
  if (!has('contracts.edit') || !has('contracts.view')) return null
  return <>
    <button type="button" data-tour={tour} onClick={() => setOpen(true)}
      className={className ?? 'rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap'}>
      {label}
    </button>
    {open && <AgreementBuilderModal source={source} canSaveTemplates={has('templates.edit')} onClose={() => setOpen(false)} />}
  </>
}

type PlanRow = { contract_id: string; title: string; status: string; visit_booking: string | null }

/** "Covered by plan" for one piece of equipment, with a link to each plan. */
export function CoveredByPlan({ assetId }: { assetId: string }) {
  const [plans, setPlans] = useState<PlanRow[] | null>(null)
  useEffect(() => {
    let cancelled = false
    apiRequest<{ data: PlanRow[] }>(`/v1/assets/${encodeURIComponent(assetId)}/plan-coverage`)
      .then(r => { if (!cancelled) setPlans(r.data) })
      .catch(() => { if (!cancelled) setPlans([]) })
    return () => { cancelled = true }
  }, [assetId])
  if (!plans) return null
  if (!plans.length) return <span data-tour="asset-plan-coverage" data-covered="no" className="text-xs text-slate-500">Not on a service plan</span>
  return <span data-tour="asset-plan-coverage" data-covered="yes" className="inline-flex flex-wrap items-center gap-1.5 text-xs">
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">Covered by plan</span>
    {plans.map(p => <Link key={p.contract_id} to={`/maintenance-contracts/${p.contract_id}`} className="font-semibold text-amber-700 hover:underline">
      {p.title}{p.status === 'pending_signature' ? ' (waiting for signature)' : p.status === 'paused' ? ' (paused)' : ''}
    </Link>)}
  </span>
}
