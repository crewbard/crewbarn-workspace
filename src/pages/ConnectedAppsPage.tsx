import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { QuickBooksConnectCard } from '@/components/QuickBooksConnectCard'

/**
 * Tool Shed → Connections → Connected Apps.
 *
 * The OAuth/account-linked apps a tenant connects (QuickBooks today) plus a
 * quick status of the other external connections, each deep-linking to where
 * it's managed. Distinct from "Integrations" (credential config) — this is
 * about apps you authorize and can disconnect.
 */

interface OverviewData {
  google_maps: { configured: boolean; mode: string }
  email: { configured: boolean; mode: string; from_address: string | null }
  sms: { configured: boolean; mode: string; from_number: string | null }
  gps: { configured: boolean; active_device_count: number }
}

export function ConnectedAppsPage() {
  const q = useQuery({
    queryKey: ['integrations-overview'],
    queryFn: () => apiRequest<{ data: OverviewData }>('/v1/tenant-settings/integrations-overview'),
  })
  const o = q.data?.data

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-navy-900">Connected Apps</h1>
        <p className="text-sm text-slate-600 mt-1">
          Apps you connect to your CrewBarn account, plus the status of your other external
          connections. Manage credentials under each service's settings page.
        </p>
      </div>

      {/* OAuth-connected apps */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Apps</h2>
        <QuickBooksConnectCard />
      </section>

      {/* Other connections — status + deep links */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Other connections</h2>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
          <ConnectionRow
            name="Text messaging (SMS)"
            connected={!!o?.sms.configured}
            detail={o?.sms.from_number ? `From ${o.sms.from_number}` : undefined}
            to="/settings/communication"
            loading={q.isLoading}
          />
          <ConnectionRow
            name="Email (SMTP)"
            connected={!!o?.email.configured}
            detail={o?.email.from_address ?? undefined}
            to="/settings/communication"
            loading={q.isLoading}
          />
          <ConnectionRow
            name="Google Maps"
            connected={!!o?.google_maps.configured}
            detail={o?.google_maps.mode === 'platform' ? 'Platform key' : o?.google_maps.mode === 'byo' ? 'Your key' : undefined}
            to="/tool-shed/integrations"
            loading={q.isLoading}
          />
          <ConnectionRow
            name="GPS tracking"
            connected={!!o?.gps.configured}
            detail={o?.gps.active_device_count ? `${o.gps.active_device_count} device${o.gps.active_device_count === 1 ? '' : 's'}` : undefined}
            to="/tool-shed/gps"
            loading={q.isLoading}
          />
        </div>
      </section>
    </div>
  )
}

function ConnectionRow({
  name,
  connected,
  detail,
  to,
  loading,
}: {
  name: string
  connected: boolean
  detail?: string
  to: string
  loading: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            loading ? 'bg-slate-300' : connected ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        />
        <div className="min-w-0">
          <div className="text-sm font-medium text-navy-900">{name}</div>
          <div className="text-xs text-slate-500">
            {loading ? '…' : connected ? detail ?? 'Connected' : 'Not connected'}
          </div>
        </div>
      </div>
      <Link to={to} className="text-xs font-medium text-amber-700 hover:text-amber-800 shrink-0">
        Manage →
      </Link>
    </div>
  )
}

export default ConnectedAppsPage
