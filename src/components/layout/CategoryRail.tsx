import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { useModuleVisibility } from '@/hooks/useModuleVisibility'
import { useNavBadges } from '@/hooks/useNavBadges'
import { useLateRisks } from '@/hooks/useLateRisks'
import { useUnhandledIncomingCalls } from '@/hooks/useUnhandledIncomingCalls'
import { useIntakePendingCount } from '@/hooks/useIntakePendingCount'
import { useFranchiseFeature } from '@/hooks/useFranchiseFeature'
import { useTheme } from '@/hooks/useTheme'
import { useSettingsInWorkspace } from '@/hooks/useSettingsInWorkspace'
import { isCompanySetting } from '@/lib/workspaceScope'
import { canViewSetting, cbiLearningAccess } from '@/lib/settingAccess'
import {
  NAV_CATEGORIES,
  categoryForPath,
  type CategoryId,
  type NavItem,
} from '@/lib/navTaxonomy'

/**
 * What each page's route checks (RequirePermission in main.tsx), for rail
 * items whose taxonomy gate is missing or differs. Any one key is enough.
 * Keeps the rail from offering a page that answers "access denied".
 */
const ROUTE_ACCESS: Record<string, string[]> = {
  '/schedule': ['jobs.view'],
  '/dispatch': ['jobs.view'],
  '/tasks': ['tasks.view', 'jobs.view', 'customers.view'],
  '/sub-reviews': ['jobs.view'],
  '/inbound-sub-jobs': ['jobs.view'],
  '/sub-payouts': ['jobs.view'],
  '/company-assets': ['assets.view'],
  '/communications': ['customers.view'],
  '/intake': ['customers.view'],
  '/accounting': ['invoices.view'],
  '/vendors': ['inventory.view'],
  '/tool-shed/company-files': ['company.secure_files.list'],
  '/tool-shed/data-export': ['settings.edit'],
  '/tool-shed/pricing': ['catalog.view'],
  '/tool-shed/roles': ['staff.view'],
  '/tool-shed/subcontractors': ['jobs.view'],
  '/tool-shed': ['settings.view'],
}

/**
 * Rail shell — categories on the left edge, their contents in the panel.
 *
 * The app has around a hundred and sixty routes. A flat nav can hold maybe
 * eight before it stops being scannable, which is why the previous one kept
 * having to demote things: Assets to the Tool Shed, Reports into Accounting,
 * Comms into the right-hand cluster. Every demotion was correct on its own and
 * the list still ran out of room.
 *
 * Two levels fixes the shape rather than the symptom. Five things on the rail
 * is a number you can hold in your head, and each opens onto a panel with room
 * for everything that belongs under it — with the same names it had before, so
 * a demoted feature comes back rather than staying hidden.
 *
 * The panel shows the CURRENT category by default and switches when you pick a
 * different one, which means it is a navigation surface and not a menu: it does
 * not close after a click, because the next thing you want is usually its
 * neighbour.
 */

const RAIL_ICONS: Record<CategoryId, string[]> = {
  // Briefcase — the job of the day.
  work: ['M4 8.5h16a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a1 1 0 0 1 1-1z', 'M9 8.5V6.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6.5v2', 'M3 13h18'],
  // Speech bubble.
  comms: ['M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5v-3.5H5.5A1.5 1.5 0 0 1 4 14.5z'],
  // Coin on edge.
  money: ['M12 3.5v17', 'M15.5 7H10a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5H8'],
  // Page with a fold.
  files: ['M13 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V8.5z', 'M13 3.5V8.5H18', 'M9 13h6M9 16h4'],
  // Wrench.
  setup: ['M20 5.5a4.5 4.5 0 0 1-5.9 5.7L6.6 18.7a2 2 0 1 1-2.8-2.8l7.5-7.5A4.5 4.5 0 0 1 17 2.5l-3 3 1.5 1.5 3-3q.5.7.5 1.5z'],
}

const COLLAPSE_KEY = 'crewbarn_rail_collapsed'
const FOCUS_COLLAPSE_KEY = 'crewbarn_focus_rail_collapsed'

function RailIcon({ id }: { id: CategoryId }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" aria-hidden="true">
      {RAIL_ICONS[id].map((d) => (
        <path key={d} d={d} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

export function CategoryRail() {
  const { theme } = useTheme()
  const focus = theme === 'focus'
  const location = useLocation()
  const { has, hasAny, isLoading } = usePermissions()
  const { show: showCompanySettings } = useSettingsInWorkspace()
  const { isRouteVisibleInWork: isRouteVisible, isRouteVisible: isEnabledRoute } = useModuleVisibility()
  const badges = useNavBadges()
  const lateRisks = useLateRisks()
  const calls = useUnhandledIncomingCalls()
  const intakeCount = useIntakePendingCount()
  const franchise = useFranchiseFeature()

  const activeCategory = categoryForPath(location.pathname)
  // What the panel shows. Follows the route, but a click on another category
  // pins it there so you can look around without navigating first.
  const [shown, setShown] = useState<CategoryId>(activeCategory)
  const [railCollapsed, setRailCollapsed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(COLLAPSE_KEY) === '1',
  )
  const [focusCollapsed, setFocusCollapsed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(FOCUS_COLLAPSE_KEY) === '1',
  )
  const collapsed = focus ? focusCollapsed : railCollapsed
  const setCollapsed = focus ? setFocusCollapsed : setRailCollapsed

  useEffect(() => {
    setShown(activeCategory)
  }, [activeCategory])

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, railCollapsed ? '1' : '0')
  }, [railCollapsed])
  useEffect(() => {
    localStorage.setItem(FOCUS_COLLAPSE_KEY, focusCollapsed ? '1' : '0')
  }, [focusCollapsed])

  const badgeFor = (item: NavItem): number => {
    switch (item.badge) {
      case 'dispatch':
        return badges.dispatchPendingCount
      case 'subReviews':
        return badges.subReviewPendingCount
      case 'inbound':
        return badges.inboundMirrorPendingCount
      case 'payments':
        return badges.pendingPaymentsCount
      case 'tasks':
        return badges.taskCount
      case 'calls':
        return calls.canViewCalls ? calls.count : 0
      case 'intake':
        return intakeCount
      default:
        return 0
    }
  }

  // Permission and module filtering, then drop any group left empty — an
  // "Everything else" heading over nothing reads as a bug.
  const visibleCategories = NAV_CATEGORIES.map((cat) => ({
    ...cat,
    groups: cat.groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            !isLoading &&
            (ROUTE_ACCESS[it.to] ? hasAny(ROUTE_ACCESS[it.to]) : (!it.requires || has(it.requires))) &&
            canViewSetting(it.to, has) &&
            // Same rule as the Tool Shed: company settings live on Connect
            // unless this workspace has asked for them here too.
            (cbiLearningAccess(it.to, has) !== undefined || showCompanySettings || !isCompanySetting(it.to)) &&
            (it.feature !== 'franchise' || franchise.enabled) &&
            (cbiLearningAccess(it.to, has) !== undefined ? isEnabledRoute(it.to) : isRouteVisible(it.to)),
        ),
      }))
      .filter((g) => g.items.length > 0),
  })).filter((cat) => cat.groups.length > 0)

  const panel = visibleCategories.find((c) => c.id === shown) ?? visibleCategories[0]

  // A category's dot means something under it wants attention, which is the
  // only way to see that from a collapsed rail.
  // A tech may be late: the category with Schedule in it flashes too, so a
  // collapsed rail still shows it.
  const categoryHasSchedule = (id: CategoryId): boolean =>
    (visibleCategories.find((c) => c.id === id)?.groups ?? []).some((g) => g.items.some((it) => it.to === '/schedule'))
  const categoryHasBadge = (id: CategoryId): boolean =>
    (visibleCategories.find((c) => c.id === id)?.groups ?? []).some((g) =>
      g.items.some((it) => badgeFor(it) > 0),
    )

  return (
    <div className="flex h-full shrink-0">
      {/* The rail */}
      <nav
        data-traditional-chrome
        data-tour="rail-categories"
        aria-label="Sections"
        className="flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-white/10 bg-[var(--chrome-bg,#0F1A2E)] py-3"
      >
        <Link to="/" data-tour="shell-brand" className="mb-2 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#E8902C]" aria-label="CrewBarn home">
          <svg viewBox="0 0 64 64" width={22} height={22} fill="none" aria-hidden="true">
            <path d="M51 27 L32 13 L13 27" stroke="#0F1A2E" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 27 V38 q0 8 8 8 h20" stroke="#0F1A2E" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        {visibleCategories.map((cat) => {
          const isActive = cat.id === activeCategory
          const isShown = cat.id === shown
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setShown(cat.id)
                setCollapsed(false)
              }}
              aria-current={isActive ? 'true' : undefined}
              aria-pressed={isShown}
              data-tour={`rail-${cat.id}`}
              className={`relative flex w-[56px] flex-col items-center gap-1 rounded-[10px] py-2 text-[10.5px] font-semibold transition-colors ${
                isShown ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
              } ${lateRisks.flashing && categoryHasSchedule(cat.id) ? 'cb-strobe' : ''}`}
            >
              <RailIcon id={cat.id} />
              {cat.label}
              {isActive && (
                <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-[#E8902C]" />
              )}
              {categoryHasBadge(cat.id) && (
                <span className="absolute right-2.5 top-1.5 h-[7px] w-[7px] rounded-full bg-[#E8902C]" />
              )}
            </button>
          )
        })}
      </nav>

      {/* The panel */}
      {!collapsed && panel && (
        <div data-tour="rail-panel" className="flex w-[212px] shrink-0 flex-col border-r border-slate-200 bg-white">
          <p className="px-4 pb-1 pt-4 text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-400">
            {panel.label}
          </p>
          <div className="flex-1 overflow-y-auto px-2.5 pb-3">
            {panel.groups.map((group, gi) => (
              <div key={group.title ?? gi} className={gi > 0 ? 'mt-3' : 'mt-1'}>
                {group.title && (
                  <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-300">
                    {group.title}
                  </p>
                )}
                {group.items.map((item) => {
                  const n = badgeFor(item)
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      data-tour={`rail-item-${item.to === '/' ? 'dashboard' : item.to.slice(1).replace(/\//g, '-')}`}
                      title={item.to === '/schedule' && lateRisks.flashing ? `${lateRisks.unseen.length} tech${lateRisks.unseen.length === 1 ? '' : 's'} may be late` : undefined}
                      className={({ isActive }) =>
                        `flex items-center justify-between gap-2 rounded-[8px] px-2.5 py-[7px] text-[13.5px] font-medium transition-colors ${
                          isActive
                            ? 'bg-[#FDF3E4] text-[#8a5a1f]'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        } ${item.to === '/schedule' && lateRisks.flashing ? 'cb-strobe cb-strobe--light' : ''}`
                      }
                    >
                      <span className="truncate">{item.label}</span>
                      {n > 0 && (
                        <span className="shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums text-slate-700">
                          {n > 99 ? '99+' : n}
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            data-tour="rail-collapse"
            className="flex items-center gap-1.5 border-t border-slate-200 px-4 py-2.5 text-[12px] font-semibold text-slate-500 hover:text-slate-800"
          >
            <svg viewBox="0 0 24 24" width={13} height={13} fill="none" aria-hidden="true">
              <path d="M14 6.5 8.5 12l5.5 5.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Collapse
          </button>
        </div>
      )}
    </div>
  )
}
