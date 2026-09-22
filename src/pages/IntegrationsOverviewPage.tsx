import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'

/**
 * Tool Shed → Connections → Integrations.
 *
 * Aggregator dashboard that shows which external services are configured.
 * Each card deep-links to its dedicated settings page. No secrets are
 * returned by the backend — only "configured / not" + display fields.
 */

interface Payload {
  google_maps: { configured: boolean; mode: 'unconfigured' | 'byo' | 'platform' }
  storage?: { configured: boolean; mode: 'unconfigured' | 'byo' | 'platform' }
  ai: { configured: boolean; enabled: boolean; provider: string | null }
  email: {
    configured: boolean
    mode: 'unconfigured' | 'byo' | 'platform'
    provider?: 'resend' | 'smtp' | null
    verified?: boolean
    from_address: string | null
  }
  sms: {
    configured: boolean
    active?: boolean
    mode: 'unconfigured' | 'byo' | 'platform'
    provider?: 'twilio_hosted' | 'twilio_byo' | 'net2phone' | null
    from_number: string | null
  }
  gps: { configured: boolean; active_device_count: number }
  brand: { configured: boolean; has_logo: boolean; has_color: boolean }
}

interface CardProps {
  title: string
  description: string
  configured: boolean
  status: string
  href: string
}

function Card({ title, description, configured, status, href }: CardProps) {
  return (
    <Link
      to={href}
      className="bg-white border border-slate-200 rounded-lg p-5 hover:border-amber-300 hover:shadow-sm transition block"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <span
          className={[
            'text-[10px] uppercase font-bold tracking-wide px-2 py-1 rounded-full',
            configured
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200',
          ].join(' ')}
        >
          {configured ? '✓ Configured' : '⚠ Not set up'}
        </span>
      </div>
      <p className="text-sm text-slate-600 mb-3">{description}</p>
      <div className="text-[12px] text-slate-500 border-t border-slate-100 pt-3">{status}</div>
    </Link>
  )
}

export function IntegrationsOverviewPage() {
  const query = useQuery({
    queryKey: ['integrations-overview'],
    queryFn: () => apiRequest<{ data: Payload }>('/v1/tenant-settings/integrations-overview'),
  })

  const d = query.data?.data

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="text-sm text-slate-500 mt-1">
          External services your shop is plugged into. Click any card to
          configure or update it. No secrets are shown here.
        </p>
      </div>

      {query.isLoading && <p className="text-sm text-slate-500 italic">Loading…</p>}
      {query.isError && (
        <p className="text-sm text-red-700">
          {(query.error as Error).message ?? 'Failed to load.'}
        </p>
      )}

      {d && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            title="Storage ownership"
            description="Photos, videos, call recordings, signatures, PDFs, and exports."
            configured={d.storage?.configured ?? true}
            status={
              (d.storage?.mode ?? 'platform') === 'platform'
                ? 'Using CrewBarn-managed Cloudflare R2. BYO storage adapter is the recommended ownership path and is planned next.'
                : d.storage?.mode === 'byo'
                  ? 'Tenant-owned storage connected.'
                  : 'No storage provider configured.'
            }
            href="/settings/integrations"
          />

          <Card
            title="Google Maps"
            description="Address autocomplete, map views, geocoding."
            configured={d.google_maps.configured}
            status={
              d.google_maps.mode === 'platform'
                ? 'Using the platform-managed key.'
                : d.google_maps.mode === 'byo'
                  ? 'Custom API key configured.'
                  : 'No key configured — map features disabled.'
            }
            href="/settings/integrations"
          />

          <Card
            title="AI"
            description="LLM that drafts emails, summarises jobs, and answers asks."
            configured={d.ai.configured}
            status={
              !d.ai.configured
                ? 'Pick a provider and paste a key.'
                : d.ai.enabled
                  ? `Active · ${d.ai.provider}`
                  : `Configured but disabled · ${d.ai.provider}`
            }
            href="/settings/ai"
          />

          <Card
            title="Email"
            description="Outbound mail (estimates, invoices, scheduled emails)."
            configured={d.email.configured}
            status={
              d.email.mode === 'platform'
                ? 'Using the platform mail relay.'
                : d.email.mode === 'byo'
                  ? d.email.provider === 'smtp'
                    ? `BYO SMTP · sends as ${d.email.from_address ?? '—'}`
                    : d.email.verified
                      ? `Sending as ${d.email.from_address ?? '—'}`
                      : 'Domain added — finish DNS verification to send from it.'
                  : 'No mail provider configured — email features off.'
            }
            href="/settings/communication"
          />

          <Card
            title="SMS"
            description="Outbound text messages to customers + techs."
            configured={d.sms.configured}
            status={
              d.sms.mode === 'platform'
                ? 'Using the CrewBarn-hosted SMS relay.'
                : d.sms.provider === 'net2phone'
                  ? d.sms.active
                    ? `BYO Net2Phone · sends from ${d.sms.from_number ?? '—'}`
                    : `BYO Net2Phone credentials are saved, but customer SMS is off. Activate Net2Phone in Communication Settings.`
                  : d.sms.provider === 'twilio_byo'
                    ? d.sms.active
                      ? `BYO Twilio · sends from ${d.sms.from_number ?? '—'}`
                      : `BYO Twilio credentials are saved, but customer SMS is off. Activate Twilio in Communication Settings.`
                  : 'No SMS provider configured.'
            }
            href="/settings/communication"
          />

          <Card
            title="GPS Tracking"
            description="Device-side location ingestion for the dispatch live map."
            configured={d.gps.configured}
            status={
              d.gps.configured
                ? `${d.gps.active_device_count} active device${d.gps.active_device_count === 1 ? '' : 's'} registered.`
                : 'No tracking devices registered yet.'
            }
            href="/tool-shed/gps"
          />

          <Card
            title="Brand & Logo"
            description="The logo + colour shown on customer-facing documents."
            configured={d.brand.configured}
            status={[
              d.brand.has_logo ? '✓ Logo' : 'No logo',
              d.brand.has_color ? '✓ Colour' : 'No colour',
            ].join(' · ')}
            href="/tool-shed/brand"
          />
        </div>
      )}
    </div>
  )
}
