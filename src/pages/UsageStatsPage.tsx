import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * Tool Shed → Account → Usage & Limits.
 *
 * Read-only counter rollup of how much of each entity the tenant has.
 * No hard limits enforced yet — plan-tier caps will land with billing.
 */

interface StatItem {
  label: string
  count: number
}
interface StatSection {
  label: string
  items: StatItem[]
}
interface Payload {
  generated_at: string
  sections: StatSection[]
  plan: { tier: string | null; limits: unknown; note: string }
}

function formatCount(n: number): string {
  return n.toLocaleString()
}

export function UsageStatsPage() {
  const query = useQuery({
    queryKey: ['usage-stats'],
    queryFn: () => apiRequest<{ data: Payload }>('/v1/tenant-settings/usage'),
  })

  const d = query.data?.data

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usage &amp; Limits</h1>
          <p className="text-sm text-slate-500 mt-1">
            How much of each entity your shop has on CrewBarn right now.
            {d?.plan.tier && (
              <>
                {' '}
                Plan:{' '}
                <span className="font-semibold text-slate-700 uppercase">{d.plan.tier}</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="text-sm px-3 py-2 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
        >
          {query.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {query.isLoading && <p className="text-sm text-slate-500 italic">Loading…</p>}
      {query.isError && (
        <p className="text-sm text-red-700">
          {(query.error as Error).message ?? 'Failed to load.'}
        </p>
      )}

      {d && (
        <>
          <div className="space-y-4">
            {d.sections.map((section) => (
              <div key={section.label} className="bg-white border border-slate-200 rounded-lg p-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-3">
                  {section.label}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {section.items.map((item) => (
                    <div
                      key={item.label}
                      className="bg-slate-50 border border-slate-200 rounded-md p-3"
                    >
                      <div className="text-[11px] text-slate-500">{item.label}</div>
                      <div className="text-2xl font-bold text-slate-900 mt-0.5">
                        {formatCount(item.count)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 leading-relaxed">
            <strong>Note:</strong> {d.plan.note}
          </div>

          <div className="mt-4 text-[11px] text-slate-400 text-right">
            Generated {new Date(d.generated_at).toLocaleString()}
          </div>
        </>
      )}
    </div>
  )
}
