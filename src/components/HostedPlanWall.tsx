import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, ApiError } from '@/lib/api'
import type { SubscriptionSummary } from '@/types/subscription'
import { useState, type ReactNode } from 'react'

/**
 * A workspace on the Self-hosted (connect) plan doesn't get app.crewbarn.com —
 * the API answers 402 hosted_plan_required for it. Instead of a broken app,
 * show what's going on and the one-click way up. Comped/legacy tenants
 * (billing off) never see this.
 */
export function HostedPlanWall({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['tenant-subscription'],
    queryFn: () => apiRequest<{ data: SubscriptionSummary }>('/v1/tenant-settings/subscription'),
    staleTime: 5 * 60_000,
    retry: false,
  })
  const [err, setErr] = useState<string | null>(null)
  const up = useMutation({
    mutationFn: () => apiRequest<{ data: SubscriptionSummary }>('/v1/tenant-settings/subscription/tier', { method: 'PATCH', body: JSON.stringify({ tier: 'hosted' }) }),
    onSuccess: (r) => { qc.setQueryData(['tenant-subscription'], r); qc.invalidateQueries() },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Something went wrong.'),
  })
  const d = data?.data
  if (!d || d.hosted_app_allowed) return <>{children}</>

  const money = (c: number) => (c / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Self-hosted plan</div>
        <h1 className="mt-2 text-xl font-bold text-navy-900">This workspace doesn't include the CrewBarn web app</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your plan covers connect.crewbarn.com, the API, the open-source tenant page on your own domain, and the phone app. The full web app here at app.crewbarn.com is part of the <strong>Hosted</strong> plan — {money(d.hosted_seat_cents)} per seat instead of {money(d.connect_seat_cents)}, same {money(d.base_cents)} base.
        </p>
        {err && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>}
        <div className="mt-5 flex flex-wrap gap-2">
          {d.can_manage ? (
            <button type="button" onClick={() => up.mutate()} disabled={up.isPending} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50">
              {up.isPending ? 'Switching…' : `Switch to Hosted — ${money(d.base_cents + d.hosted_seat_cents * d.seats_purchased)}/mo`}
            </button>
          ) : (
            <span className="text-sm text-slate-500">Ask your owner to switch the plan to Hosted.</span>
          )}
          <a href="https://connect.crewbarn.com" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Go to connect.crewbarn.com</a>
        </div>
        {d.billing_mode === 'subscription' && d.seats_purchased > 0 && <p className="mt-3 text-xs text-slate-500">Switching moves your {d.seats_purchased} seat{d.seats_purchased === 1 ? '' : 's'} to the Hosted price, prorated from today.</p>}
      </div>
    </div>
  )
}
