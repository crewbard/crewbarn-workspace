import { Link } from 'react-router-dom'

/**
 * Persistent customer + location strip. Lives between the tabs and
 * per-tab content on the WO + Estimate detail pages so the office
 * always knows who the job is for and where it's happening, no
 * matter which tab is active.
 *
 * Customer name is a Link to /customers/{id}; address is a Google
 * Maps link (opens in a new tab).
 */
export function CustomerLocationStrip({
  customer,
  location,
}: {
  customer: {
    id: string
    display_name: string
    vip?: boolean | null
    customer_type?: string | null
    is_net_account?: boolean | null
  } | null
  location: {
    nickname?: string | null
    street_address?: string | null
    apt_unit?: string | null
    city?: string | null
    state?: string | null
    postal_code?: string | null
  } | null
}) {
  if (!customer && !location) return null

  const addrLine = location
    ? [
        [location.street_address, location.apt_unit].filter(Boolean).join(' '),
        location.city,
        location.state,
        location.postal_code,
      ]
        .filter((s) => s && s.toString().trim() !== '')
        .join(', ')
    : ''
  const mapsUrl = addrLine
    ? `https://maps.google.com/?q=${encodeURIComponent(addrLine)}`
    : null

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4 flex flex-wrap items-start gap-x-6 gap-y-2">
      {customer && (
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
            Customer
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Link
              to={`/customers/${customer.id}`}
              className="text-base font-semibold text-amber-700 hover:underline truncate"
              title="Open customer account"
            >
              {customer.display_name}
            </Link>
            {customer.vip && (
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">
                VIP
              </span>
            )}
            {customer.is_net_account && (
              <span
                className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-semibold"
                title="NET-terms account — only cash-flow managers can record payments"
              >
                📅 NET
              </span>
            )}
          </div>
        </div>
      )}
      {(location?.nickname || addrLine) && (
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
            Location
          </div>
          <div className="text-sm text-slate-900 mt-0.5 truncate">
            {location?.nickname && <strong>{location.nickname}</strong>}
            {location?.nickname && addrLine && (
              <span className="text-slate-400 mx-1">·</span>
            )}
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-700 hover:text-amber-700 hover:underline"
              >
                {addrLine}
              </a>
            ) : (
              <span className="text-slate-700">{addrLine}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
