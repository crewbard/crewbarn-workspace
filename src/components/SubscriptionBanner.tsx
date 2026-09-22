import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import type { SubscriptionSummary } from '@/types/subscription'

/**
 * Shown on every page while the CrewBarn subscription is in trouble: amber
 * during the grace window (everything still works), red once the account is
 * read-only. Silent for everyone else — including tenants that aren't on a
 * subscription at all.
 */
export function SubscriptionBanner() {
  const { data } = useQuery({
    queryKey: ['tenant-subscription'],
    queryFn: () => apiRequest<{ data: SubscriptionSummary }>('/v1/tenant-settings/subscription'),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
  })
  const d = data?.data
  if (!d || d.state === 'off' || d.state === 'active') return null

  const grace = d.state === 'grace'
  if (d.billing_mode === 'free') {
    return (
      <div className="flex shrink-0 items-center justify-between gap-3 bg-slate-800 px-4 py-2 text-sm text-white">
        <span>Free plan — <strong>read-only</strong>. Subscribe to unlock editing for your team.</span>
        <Link to="/tool-shed/subscription" className="shrink-0 rounded-md bg-white/15 px-3 py-1 text-xs font-bold hover:bg-white/25">{d.can_manage ? 'Subscribe' : 'Details'}</Link>
      </div>
    )
  }
  const until = d.grace_ends_at ? new Date(d.grace_ends_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''

  return (
    <div className={`flex shrink-0 items-center justify-between gap-3 px-4 py-2 text-sm text-white ${grace ? 'bg-amber-500' : 'bg-red-600'}`}>
      <span>
        {grace
          ? <>Your CrewBarn payment didn't go through. Everything keeps working until <strong>{until}</strong> — please update your card.</>
          : <>Your CrewBarn subscription has lapsed — the account is <strong>read-only</strong>. Nothing has been deleted; fix billing to keep working.</>}
      </span>
      <Link to="/tool-shed/subscription" className="shrink-0 rounded-md bg-white/15 px-3 py-1 text-xs font-bold hover:bg-white/25">
        {d.can_manage ? 'Fix billing' : 'Details'}
      </Link>
    </div>
  )
}
