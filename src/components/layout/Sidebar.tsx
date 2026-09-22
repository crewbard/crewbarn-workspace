import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { useNavBadges } from '@/hooks/useNavBadges'
import { useUnhandledIncomingCalls } from '@/hooks/useUnhandledIncomingCalls'
import { useIntakePendingCount } from '@/hooks/useIntakePendingCount'
import { useModuleVisibility } from '@/hooks/useModuleVisibility'
import { useFranchiseFeature } from '@/hooks/useFranchiseFeature'
import { PRIMARY_NAV } from './TopBar'
import { TOOL_SHED_SECTIONS, type ToolShedSection } from './ToolShedMenu'

/**
 * Sidebar — the dark navy left rail of the CrewBarn "pro" theme. A vertical
 * nav that mirrors the classic TopBar (same PRIMARY_NAV, same queue badges,
 * same Tool Shed sections) laid out as a two-column shell. The rail + the
 * top bar share the navy chrome so the app frame reads as one piece, with a
 * light page body inside it. Desktop only — on mobile the pro theme falls
 * back to the TopBar hamburger + MobileNavDrawer.
 *
 * The slim action bar (AI, quick-create, account) stays in TopBar so we
 * don't duplicate that chrome; this rail owns navigation + brand only.
 */

type NavIcon =
  | 'dashboard'
  | 'jobs'
  | 'estimates'
  | 'customers'
  | 'schedule'
  | 'dispatch'
  | 'money'
  | 'reports'
  | 'messages'
  | 'toolshed'
  | 'inventory'

const ICON_FOR_ROUTE: Record<string, NavIcon> = {
  '/': 'dashboard',
  '/jobs': 'jobs',
  '/estimates': 'estimates',
  '/customers': 'customers',
  '/schedule': 'schedule',
  '/dispatch': 'dispatch',
  '/accounting': 'money',
  '/reports': 'reports',
  '/inventory': 'inventory',
}

interface BadgePill {
  count: number
  color: 'amber' | 'emerald' | 'sky'
}

export function Sidebar({
  onOpenHelp,
}: {
  onOpenHelp?: () => void
}) {
  const { account, logout } = useAuth()
  const { has, isLoading, isPlatformAdmin } = usePermissions()
  const callAlerts = useUnhandledIncomingCalls()
  const intakeCount = useIntakePendingCount()
  const badges = useNavBadges()
  const { isRouteVisible } = useModuleVisibility()
  const franchise = useFranchiseFeature()
  const [toolShedOpen, setToolShedOpen] = useState(false)
  const linkSize = 'normal' as const
  const orderedPrimary = PRIMARY_NAV.filter((item) => isRouteVisible(item.to))

  // Badges keyed by route — same semantics as TopBar / MobileNavDrawer.
  const badgesFor: Record<string, BadgePill[]> = {
    '/dispatch':
      badges.dispatchPendingCount > 0
        ? [{ count: badges.dispatchPendingCount, color: 'amber' }]
        : [],
    '/jobs': [
      ...(badges.subReviewPendingCount > 0
        ? [{ count: badges.subReviewPendingCount, color: 'emerald' as const }]
        : []),
      ...(badges.inboundMirrorPendingCount > 0
        ? [{ count: badges.inboundMirrorPendingCount, color: 'sky' as const }]
        : []),
    ],
    '/accounting':
      badges.pendingPaymentsCount > 0
        ? [{ count: badges.pendingPaymentsCount, color: 'amber' }]
        : [],
  }

  // Tool Shed sections filtered by permission (mirrors the mega-menu).
  const toolShedSections: ToolShedSection[] = isLoading
    ? []
    : TOOL_SHED_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(
          (it) =>
            !(it.hideForPlatformAdmin && isPlatformAdmin) &&
            !(it.franchiseOnly && !franchise.isFranchise) &&
            (!it.requires || has(it.requires)) &&
            isRouteVisible(it.to),
        ),
      })).filter((section) => section.items.length > 0)

  const userInitials = (() => {
    const first = account?.extension?.first_name
    const last = account?.extension?.last_name
    if (first && last) return (first[0] + last[0]).toUpperCase()
    if (first) return first.slice(0, 2).toUpperCase()
    if (account?.email) return account.email.split('@')[0].slice(0, 2).toUpperCase()
    return 'U'
  })()

  const roleLabel = account?.is_platform_admin
    ? 'Platform admin'
    : account?.extension?.role ?? account?.account_type ?? 'Member'

  return (
    <aside
      className="hidden md:flex flex-col shrink-0 h-screen w-60 bg-[var(--chrome-bg)] text-white/80"
    >
      {/* Brand */}
      <div className="flex items-center px-4 border-b border-white/10 shrink-0 h-14">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-lg font-bold text-white">
            Crew<span className="text-amber-400">Barn</span>
          </span>
          {account?.tenant?.name && (
            <>
              <span className="text-white/40">·</span>
              <span className="text-sm text-white/70 group-hover:text-white transition-colors">
                {account.tenant.name}
              </span>
            </>
          )}
        </Link>
      </div>

      {/* Nav — scrolls independently of the brand + account footer */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {orderedPrimary.map((item) => (
          <SidebarLink
            key={item.to}
            to={item.to}
            end={item.end}
            label={item.label}
            icon={ICON_FOR_ROUTE[item.to] ?? 'dashboard'}
            badges={badgesFor[item.to] ?? []}
            size={linkSize}
          />
        ))}

        <SidebarSectionLabel>Communication</SidebarSectionLabel>
        <SidebarLink to="/communications" label="Messages" icon="messages" badges={[]} size={linkSize} />
        {!isLoading && has(PERM.CALLS_VIEW) && (
          <SidebarLink
            to="/calls"
            label="Calls"
            icon="messages"
            badges={callAlerts.count > 0 ? [{ count: callAlerts.count, color: 'amber' }] : []}
            size={linkSize}
          />
        )}
        <SidebarLink to="/intake" label="Intake Queue" icon="messages" badges={intakeCount > 0 ? [{ count: intakeCount, color: 'amber' }] : []} size={linkSize} />

        {/* Franchise Dashboard — only when the tenant is a franchisor + the
            user can view franchises. */}
        {franchise.enabled && has('franchises.view') && (
          <SidebarLink to="/franchises" label="Franchise" icon="reports" badges={[]} size={linkSize} />
        )}

        {/* Tool Shed — collapsible group of every settings section */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setToolShedOpen((v) => !v)}
            className="group w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white transition-colors"
            aria-expanded={toolShedOpen}
          >
            <SidebarGlyph icon="toolshed" />
            <span className="flex-1 text-left">Tool Shed</span>
            <svg
              className={[
                'w-3.5 h-3.5 transition-transform',
                toolShedOpen ? 'rotate-180' : '',
              ].join(' ')}
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M3 4.5L6 7.5L9 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {toolShedOpen && (
            <div className="mt-1 mb-1 space-y-2">
              {toolShedSections.map((section) => (
                <div key={section.title}>
                  <div className="px-3 pt-1.5 pb-0.5 text-[10px] uppercase tracking-wide font-semibold text-white/45">
                    {section.title}
                  </div>
                  {section.items.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      className={({ isActive }) =>
                        [
                          'block pl-9 pr-3 py-1.5 text-[13px] rounded-md transition-colors',
                          isActive
                            ? 'bg-white/15 text-white'
                            : 'text-white/75 hover:bg-white/10 hover:text-white',
                        ].join(' ')
                      }
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate">{it.label}</span>
                        {it.comingSoon && (
                          <span className="text-[9px] uppercase tracking-wide text-white/45 font-medium shrink-0">
                            Soon
                          </span>
                        )}
                      </span>
                    </NavLink>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform-admin shortcuts — only for staff accounts */}
        {account?.is_platform_admin && (
          <div className="pt-2 mt-1 border-t border-white/10">
            <div className="px-3 pt-1.5 pb-0.5 text-[10px] uppercase tracking-wide font-semibold text-white/45">
              Staff
            </div>
            <SidebarLink to="/admin/tenants" label="Tenants" icon="toolshed" badges={[]} size={linkSize} />
            <SidebarLink to="/admin/franchise-billing" label="Franchise billing" icon="money" badges={[]} size={linkSize} />
            <SidebarLink to="/admin/testers" label="Testers" icon="toolshed" badges={[]} size={linkSize} />
            <SidebarLink to="/admin/inbox" label="Inbox" icon="messages" badges={[]} size={linkSize} />
          </div>
        )}
      </nav>

      {/* Account footer */}
      <div className="border-t border-white/10 p-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/15 text-white text-xs font-semibold flex items-center justify-center shrink-0">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-white truncate">
              {account?.email ?? 'Signed in'}
            </div>
            <div className="text-[11px] text-white/55 truncate">{roleLabel}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {onOpenHelp && (
            <button
              type="button"
              onClick={onOpenHelp}
              className="flex-1 text-center py-1.5 text-xs font-medium text-white/75 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            >
              Help
            </button>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className="flex-1 text-center py-1.5 text-xs font-medium text-white/75 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}

function SidebarLink({
  to,
  end,
  label,
  icon,
  badges,
  size = 'normal',
}: {
  to: string
  end?: boolean
  label: string
  icon: NavIcon
  badges: BadgePill[]
  size?: 'dense' | 'normal' | 'large'
}) {
  const sizeClass =
    size === 'large'
      ? 'px-3 py-3 text-base'
      : size === 'dense'
        ? 'px-3 py-1.5 text-sm'
        : 'px-3 py-2 text-sm'

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          `group relative flex items-center gap-3 rounded-md font-medium transition-colors ${sizeClass}`,
          isActive
            ? 'bg-white/15 text-white'
            : 'text-white/75 hover:bg-white/10 hover:text-white',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-amber-400" />
          )}
          <SidebarGlyph icon={icon} />
          <span className="flex-1 truncate">{label}</span>
          {badges.length > 0 && (
            <span className="flex items-center gap-1 shrink-0">
              {badges.map((b, i) => (
                <span
                  key={i}
                  className={[
                    'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full text-white',
                    b.color === 'amber'
                      ? 'bg-amber-500'
                      : b.color === 'emerald'
                        ? 'bg-emerald-600'
                        : 'bg-sky-600',
                  ].join(' ')}
                >
                  {b.count > 99 ? '99+' : b.count}
                </span>
              ))}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wide font-semibold text-white/45">
      {children}
    </div>
  )
}

function SidebarGlyph({ icon }: { icon: NavIcon }) {
  const cls = 'w-5 h-5 shrink-0'
  switch (icon) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )
    case 'jobs':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <rect x="3" y="6" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M7 6V4.5A1.5 1.5 0 018.5 3h3A1.5 1.5 0 0113 4.5V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'estimates':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <path d="M5 3h7l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M7 11h6M7 14h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'customers':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <circle cx="7.5" cy="7" r="2.75" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 16a4.5 4.5 0 019 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M13 5.5a2.5 2.5 0 010 5M14 16a4.5 4.5 0 00-2-3.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'schedule':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <rect x="3" y="4.5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 8h14M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'dispatch':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <path d="M2 6.5h8v7H2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M10 8.5h4l3 3v2h-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="5" cy="14.5" r="1.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="14" cy="14.5" r="1.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )
    case 'money':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <rect x="2.5" y="5" width="15" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="10" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 8v4M15 8v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'reports':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <path d="M3 16V4M3 16h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M7 13V9M11 13V6M15 13v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'messages':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <path d="M3 6.5C3 5.67 3.67 5 4.5 5h11c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5h-7L5 17.5V15H4.5A1.5 1.5 0 013 13.5v-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      )
    case 'inventory':
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <path d="M4 6l6-3 6 3-6 3-6-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M4 6v8l6 3 6-3V6M10 9v8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      )
    case 'toolshed':
    default:
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <path d="M13.5 3a3.5 3.5 0 00-3.4 4.4L3.5 14l1.5 1.5 6.6-6.6A3.5 3.5 0 1013.5 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      )
  }
}
