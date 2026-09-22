import { useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { useModuleVisibility } from '@/hooks/useModuleVisibility'
import { useUnhandledIncomingCalls } from '@/hooks/useUnhandledIncomingCalls'
import { useIntakePendingCount } from '@/hooks/useIntakePendingCount'
import { useFranchiseFeature } from '@/hooks/useFranchiseFeature'
import { TOOL_SHED_SECTIONS, type ToolShedSection } from './ToolShedMenu'

interface PrimaryNavItem {
  to: string
  label: string
  end?: boolean
  badge?: number
}

/**
 * Navigation drawer — slides in from the left on phones, tablets, and
 * smaller desktop screens when the TopBar hamburger is tapped. Renders:
 *
 *   - The primary nav (Dashboard, Jobs, Estimates, Customers, …)
 *   - Every Tool Shed section, grouped + collapsible
 *   - Bottom: sign-out + account email
 *
 * Backdrop click + Esc both close it. Body scroll is locked while open
 * so the drawer doesn't fight with page scroll.
 *
 * Patterns mirror sub.crewbarn.com (which is already mobile-first) — card
 * style, larger touch targets, full-width links.
 */
export function MobileNavDrawer({
  open,
  onClose,
  primaryNav,
  badges,
  accountEmail,
  onSignOut,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  primaryNav: PrimaryNavItem[]
  /** Badge counts keyed by route — drives the colored bubbles on items
   *  like /jobs (sub reviews), /dispatch (incoming requests), /money
   *  (pending turnover). */
  badges: Record<string, { count: number; color: 'amber' | 'emerald' | 'sky' }[]>
  accountEmail: string | null
  onSignOut: () => void
  wide?: boolean
}) {
  const { has, isLoading } = usePermissions()
  const callAlerts = useUnhandledIncomingCalls()
  const intakeCount = useIntakePendingCount()

  // Esc closes — standard modal affordance.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // Body scroll lock while drawer is open. Mirrors sub-app behavior.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className={`fixed inset-0 z-40 ${wide ? 'xl:hidden' : 'md:hidden'}`}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
      />

      {/* Drawer panel — slides in from left */}
      <div className="absolute inset-y-0 left-0 w-[85vw] max-w-sm bg-white shadow-xl overflow-y-auto flex flex-col">
        {/* Drawer header — brand + close */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-10">
          <Link
            to="/"
            onClick={onClose}
            className="text-lg font-bold text-navy-800"
          >
            Crew<span className="text-amber-500">Barn</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="w-10 h-10 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Primary nav — large touch targets */}
        <nav className="flex-1 py-2">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wide font-semibold text-slate-400">
            Main
          </div>
          {primaryNav.map((item) => {
            const itemBadges = badges[item.to] ?? []
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  [
                    'flex items-center justify-between px-4 py-3 text-base font-medium border-l-4 transition-colors',
                    isActive
                      ? 'border-amber-500 bg-amber-50 text-navy-900'
                      : 'border-transparent text-slate-700 hover:bg-slate-50',
                  ].join(' ')
                }
              >
                <span>{item.label}</span>
                {itemBadges.length > 0 && (
                  <span className="flex items-center gap-1">
                    {itemBadges.map((b, i) => (
                      <span
                        key={i}
                        className={
                          'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full text-white ' +
                          (b.color === 'amber'
                            ? 'bg-amber-500'
                            : b.color === 'emerald'
                              ? 'bg-emerald-600'
                              : 'bg-sky-600')
                        }
                      >
                        {b.count > 99 ? '99+' : b.count}
                      </span>
                    ))}
                  </span>
                )}
              </NavLink>
            )
          })}
          <NavLink
            to="/communications"
            onClick={onClose}
            className={({ isActive }) =>
              [
                'flex items-center px-4 py-3 text-base font-medium border-l-4 transition-colors',
                isActive
                  ? 'border-amber-500 bg-amber-50 text-navy-900'
                  : 'border-transparent text-slate-700 hover:bg-slate-50',
              ].join(' ')
            }
          >
            Messages
          </NavLink>
          {!isLoading && has(PERM.CALLS_VIEW) && (
            <NavLink
              to="/calls"
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'flex items-center justify-between px-4 py-3 text-base font-medium border-l-4 transition-colors',
                  isActive
                    ? 'border-amber-500 bg-amber-50 text-navy-900'
                    : 'border-transparent text-slate-700 hover:bg-slate-50',
                ].join(' ')
              }
            >
              <span>Calls</span>
              {callAlerts.count > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                  {callAlerts.count > 99 ? '99+' : callAlerts.count}
                </span>
              )}
            </NavLink>
          )}
          <NavLink
            to="/intake"
            onClick={onClose}
            className={({ isActive }) =>
              [
                'flex items-center justify-between px-4 py-3 text-base font-medium border-l-4 transition-colors',
                isActive
                  ? 'border-amber-500 bg-amber-50 text-navy-900'
                  : 'border-transparent text-slate-700 hover:bg-slate-50',
              ].join(' ')
            }
          >
            <span>Intake Queue</span>
            {intakeCount > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                {intakeCount > 99 ? '99+' : intakeCount}
              </span>
            )}
          </NavLink>

          {/* Tool Shed sections */}
          <ToolShedMobileSections onLinkClick={onClose} />
        </nav>

        {/* Drawer footer — account + sign-out */}
        <div className="border-t border-slate-200 px-4 py-3 sticky bottom-0 bg-white">
          {accountEmail && (
            <div className="text-xs text-slate-500 mb-2 truncate">{accountEmail}</div>
          )}
          <Link
            to="/my-time-off"
            onClick={onClose}
            className="block py-2 text-sm font-medium text-slate-700 hover:text-navy-900"
          >
            My time off
          </Link>
          {has(PERM.SETTINGS_EDIT) && (
            <Link to="/me/ai-connectors" onClick={onClose} className="block py-2 text-sm font-medium text-slate-700 hover:text-navy-900">
              AI connectors
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              onClose()
              onSignOut()
            }}
            className="w-full text-left py-2 text-sm font-medium text-slate-700 hover:text-red-600"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Renders each Tool Shed section with its items, filtered by the
 * user's permissions. Items with `requires` get hidden when the user
 * doesn't have that permission. "Coming soon" items render disabled.
 */
function ToolShedMobileSections({ onLinkClick }: { onLinkClick: () => void }) {
  const { has, isPlatformAdmin } = usePermissions()
  const { isRouteVisible } = useModuleVisibility()
  const { isFranchise } = useFranchiseFeature()

  return (
    <>
      {TOOL_SHED_SECTIONS.map((section: ToolShedSection) => {
        const items = section.items.filter(
          (it) =>
            !(it.hideForPlatformAdmin && isPlatformAdmin) &&
            !(it.franchiseOnly && !isFranchise) &&
            (!it.requires || has(it.requires)) &&
            isRouteVisible(it.to),
        )
        if (items.length === 0) return null
        return (
          <div key={section.title} className="mt-3">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wide font-semibold text-slate-400">
              {section.title}
            </div>
            {items.map((it) =>
              it.comingSoon ? (
                <span
                  key={it.to}
                  className="block px-4 py-2.5 text-sm text-slate-400 italic cursor-not-allowed"
                >
                  {it.label}{' '}
                  <span className="text-[10px] uppercase ml-1">Soon</span>
                </span>
              ) : (
                <Link
                  key={it.to}
                  to={it.to}
                  onClick={onLinkClick}
                  className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-navy-900"
                >
                  {it.label}
                </Link>
              ),
            )}
          </div>
        )
      })}
    </>
  )
}
