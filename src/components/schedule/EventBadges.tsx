import type { ScheduleFlags } from '@/types/schedule'
import { StatusIcon } from '@/lib/statusIcons'

/**
 * EventBadges — at-a-glance flag icons for a calendar card. Each badge
 * answers a dispatcher "what do I need to know?" question. Money is
 * payment-aware: a coin once collected, cash while a balance is owed (or COD).
 * Badges render clean Tabler line icons (same set as the job types), not emoji.
 *
 * `labeled` renders the human label next to each icon (used in the job-detail
 * side panel where there's room); compact mode (default) shows icon-only with
 * a hover tooltip and is used on the cards.
 */

interface BadgeDef {
  key: string
  label: string
  /** A Tabler icon name (preferred); falls back to `node` text when absent. */
  icon?: string
  /** Text glyph fallback — used for the "NTE" text badge and any non-icon node. */
  node: string
  cls: string
  /** Render a pulsing dot instead of an icon (the "on site" badge). */
  dot?: boolean
  /** Short text shown in compact mode (cards) next to the icon/dot. */
  short?: string
}

/** Open-visit field status (from the calendar serializer). */
export interface FieldVisit {
  state: string
  auto_checked_in: boolean
  left_site: boolean
}

// Non-payment flag badges (cod/paid/due are handled by the money slot).
const FLAG_BADGES: Array<{ key: keyof ScheduleFlags; label: string; icon?: string; node: string; cls: string }> = [
  { key: 'dormant', label: 'Dormant — no recent update', icon: 'hourglass', node: '', cls: 'bg-red-500 text-white' },
  { key: 'nte', label: 'Not-to-exceed cap set', node: 'NTE', cls: 'bg-slate-800 text-white' },
  { key: 'signature', label: 'Signature required', icon: 'writing-sign', node: '', cls: 'bg-black/10 text-current' },
  { key: 'photos', label: 'Photos required', icon: 'camera', node: '', cls: 'bg-black/10 text-current' },
  { key: 'geofence', label: 'Geofence check-in / out', icon: 'map-pin', node: '', cls: 'bg-black/10 text-current' },
  { key: 'subbed', label: 'Subbed out to a vendor', icon: 'link', node: '', cls: 'bg-black/10 text-current' },
]

function buildBadges(
  flags?: ScheduleFlags,
  onSiteAt?: string | null,
  onSite?: boolean,
  fieldVisit?: FieldVisit | null,
): BadgeDef[] {
  const out: BadgeDef[] = []

  // Field visit takes priority over the plain on-site dot: an open visit can
  // still be "on site", but if the tech has LEFT or flagged a GPS issue that's
  // the more important signal (and we suppress the green pulse).
  if (fieldVisit?.state === 'left_site_checkout_needed') {
    out.push({ key: 'leftsite', label: 'Left site — checkout needed', short: 'LEFT SITE', node: '🚶', cls: 'bg-rose-500 text-white' })
  } else if (fieldVisit?.state === 'gps_issue') {
    out.push({ key: 'gpsissue', label: 'GPS issue — tech reports still working', short: 'GPS', icon: 'antenna', node: '', cls: 'bg-slate-400 text-white' })
  } else if (onSite) {
    // On site = tech is physically there right now (authoritative server flag:
    // On Site status or an open visit). on_site_at is only the "since" time.
    const since = onSiteAt
      ? ` since ${new Date(onSiteAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : ''
    const auto = fieldVisit?.auto_checked_in ? ' (auto)' : ''
    out.push({
      key: 'onsite',
      dot: true,
      label: `On site${since}${auto}`,
      short: fieldVisit?.auto_checked_in ? 'ON SITE · AUTO' : 'ON SITE',
      node: '',
      cls: 'bg-emerald-500 text-white',
    })
  }

  // Money: paid wins; otherwise show "collect" when a balance is due or it's COD.
  if (flags?.paid) {
    out.push({ key: 'paid', label: 'Paid in full', icon: 'coin', node: '', cls: 'bg-emerald-100 text-emerald-800' })
  } else if (flags && (flags.due || flags.cod)) {
    out.push({
      key: 'money',
      label: flags.due ? 'Payment due — not collected' : 'COD — collect on site',
      icon: 'cash',
      node: '',
      cls: 'bg-amber-100 text-amber-900',
    })
  }

  if (flags) {
    for (const b of FLAG_BADGES) {
      if (flags[b.key]) out.push({ key: b.key, label: b.label, icon: b.icon, node: b.node, cls: b.cls })
    }
  }

  return out
}

export function EventBadges({
  flags,
  onSiteAt,
  onSite,
  fieldVisit,
  billTo,
  labeled = false,
  className = '',
}: {
  flags?: ScheduleFlags
  /** First-arrival timestamp — only used as the "on site since" label. */
  onSiteAt?: string | null
  /** Authoritative "on site right now" (On Site status or open visit). */
  onSite?: boolean
  /** Open-visit field status → left-site / GPS-issue / auto-checkin badge. */
  fieldVisit?: FieldVisit | null
  /** Bill-to (dealer) → round "belongs to" stamp. */
  billTo?: { name: string; initials: string } | null
  /** Show the text label next to each icon (detail panel). */
  labeled?: boolean
  className?: string
}) {
  const badges = buildBadges(flags, onSiteAt, onSite, fieldVisit)
  if (badges.length === 0 && !billTo) return null

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {billTo &&
        (labeled ? (
          <span className="inline-flex items-center gap-1.5 rounded px-1.5 text-[11px] font-bold leading-[18px] bg-indigo-100 text-indigo-800">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white text-[8px] leading-none">
              {billTo.initials}
            </span>
            Billed to {billTo.name}
          </span>
        ) : (
          <span
            title={`Billed to ${billTo.name}`}
            aria-label={`Billed to ${billTo.name}`}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[9px] font-bold leading-none"
          >
            {billTo.initials}
          </span>
        ))}
      {badges.map((b) => (
        <span
          key={b.key}
          title={b.label}
          aria-label={b.label}
          className={`inline-flex items-center gap-1 rounded px-1.5 text-[11px] font-bold leading-[18px] ${b.cls}`}
        >
          {b.dot ? (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden />
          ) : b.icon ? (
            <StatusIcon name={b.icon} size={13} className="shrink-0" />
          ) : (
            <span aria-hidden>{b.node}</span>
          )}
          {labeled ? (
            <span className="font-medium">{b.label}</span>
          ) : (
            b.short && <span>{b.short}</span>
          )}
        </span>
      ))}
    </div>
  )
}

// ---- Legend (sidebar) ----

const BADGE_LEGEND: Array<{ node?: string; icon?: string; label: string; cls: string; dot?: boolean }> = [
  { dot: true, label: 'Tech on site', cls: 'bg-emerald-500 text-white' },
  { node: '🚶', label: 'Left site — checkout needed', cls: 'bg-rose-500 text-white' },
  { icon: 'antenna', label: 'GPS issue — tech reports still working', cls: 'bg-slate-400 text-white' },
  { icon: 'coin', label: 'Paid in full', cls: 'bg-emerald-100 text-emerald-800' },
  { icon: 'cash', label: 'Payment due / COD — collect', cls: 'bg-amber-100 text-amber-900' },
  { icon: 'hourglass', label: 'Dormant — no recent update', cls: 'bg-red-500 text-white' },
  { node: 'NTE', label: 'Not-to-exceed cap set', cls: 'bg-slate-800 text-white' },
  { icon: 'writing-sign', label: 'Signature required', cls: 'bg-black/10' },
  { icon: 'camera', label: 'Photos required', cls: 'bg-black/10' },
  { icon: 'map-pin', label: 'Geofence check-in / out', cls: 'bg-black/10' },
  { icon: 'link', label: 'Subbed out to a vendor', cls: 'bg-black/10' },
]

/** Read-only legend explaining every card badge. */
export function BadgeLegend() {
  return (
    <ul className="space-y-1.5">
      {BADGE_LEGEND.map((b) => (
        <li key={b.label} className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center rounded px-1.5 text-[11px] font-bold leading-[18px] min-w-[22px] ${b.cls}`}
          >
            {b.dot ? (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-white" />
            ) : b.icon ? (
              <StatusIcon name={b.icon} size={13} />
            ) : (
              b.node
            )}
          </span>
          <span className="text-xs text-slate-700">{b.label}</span>
        </li>
      ))}
    </ul>
  )
}

export default EventBadges
