import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions, PERM } from '@/hooks/usePermissions'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { useModuleVisibility } from '@/hooks/useModuleVisibility'
import { useFranchiseFeature } from '@/hooks/useFranchiseFeature'
import { ToolShedMenu } from './ToolShedMenu'
import { MobileNavDrawer } from './MobileNavDrawer'
import { HeaderAiInput } from './HeaderAiInput'
import { GlobalSearch } from './GlobalSearch'
import { NewAssetWizardModal } from '@/components/NewAssetWizardModal'

import { useUnhandledIncomingCalls } from '@/hooks/useUnhandledIncomingCalls'
import { useIntakePendingCount } from '@/hooks/useIntakePendingCount'
import { useTheme } from '@/hooks/useTheme'

export interface PrimaryNavItem {
  to: string
  label: string
  end?: boolean
}

export const PRIMARY_NAV: PrimaryNavItem[] = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/jobs', label: 'Jobs' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/estimates', label: 'Estimates' },
  { to: '/customers', label: 'Customers' },
  // Assets demoted to Tool Shed -> Inventory section. Daily-use surface
  // is now the per-customer Assets tab on CustomerDetailPage.
  // Comms moved to the right-side area as "Messages" — sits next to
  // the AI pill since both are communication surfaces.
  { to: '/schedule', label: 'Schedule' },
  { to: '/dispatch', label: 'Dispatch' },
  // Reports folded into Accounting. Running a report is something you do
  // while working the books, not a separate department — top billing put it
  // on the same footing as running the business.
  { to: '/accounting', label: 'Accounting' },
]

export function TopBar({
  onOpenHelp,
  variant = 'classic',
}: {
  onOpenHelp?: () => void
  /** 'classic' = full top nav (brand + primary nav + Tool Shed). Sidebar variants =
   *  slim action bar; the dark Sidebar carries the brand + nav, so we hide
   *  those here and keep only the right-side cluster (AI, create, help,
   *  account). The mobile hamburger/drawer stays in both modes. */
  variant?: 'classic' | 'pro'
} = {}) {
  const isPro = variant === 'pro'
  const { density } = useTheme()
  const compactHeader = !isPro && density !== 'comfortable'
  const navigate = useNavigate()
  const { account, logout } = useAuth()
  const { isRouteVisible } = useModuleVisibility()
  const { has, hasAny } = usePermissions()
  const callAlerts = useUnhandledIncomingCalls()
  const intakeCount = useIntakePendingCount()
  const visibleNav = PRIMARY_NAV.filter((item) => isRouteVisible(item.to))
  // Franchise Dashboard tab — only for a franchisor tenant + franchises.view.
  // Appended here so both the desktop nav and the mobile drawer pick it up.
  const franchiseFeature = useFranchiseFeature()
  const navWithFranchise =
    franchiseFeature.enabled && has('franchises.view')
      ? [...visibleNav, { to: '/franchises', label: 'Franchise' }]
      : visibleNav
  const [isToolShedOpen, setIsToolShedOpen] = useState(false)
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false)
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const [isNewAssetOpen, setIsNewAssetOpen] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  // Combined pending-request count surfaced on the Dispatch nav link.
  // Sums portal WO requests + RFQ invitations awaiting vendor action.
  // Polls every 60s; silently 0 if the account lacks jobs.view.
  const incomingReqs = useQuery({
    queryKey: ['topbar-incoming-work-requests'],
    queryFn: () =>
      apiRequest<{ data: unknown[] }>('/v1/work-orders/incoming-requests').catch(() => ({ data: [] })),
    refetchInterval: 60000,
  })
  const incomingRfqs = useQuery({
    queryKey: ['topbar-incoming-rfqs'],
    queryFn: () =>
      apiRequest<{ data: Array<{ status: string }> }>('/v1/estimate-requests/incoming').catch(() => ({ data: [] })),
    refetchInterval: 60000,
  })
  const dispatchPendingCount =
    (incomingReqs.data?.data.length ?? 0) +
    (incomingRfqs.data?.data.filter((r) =>
      ['pending', 'viewed'].includes(r.status),
    ).length ?? 0)

  // Sub-review queue size — NTE extension requests + submitted
  // invoices awaiting tenant action. Surfaces a badge on the Jobs
  // nav link so dispatch sees pending sub work from anywhere.
  const subReviews = useQuery({
    queryKey: ['topbar-sub-reviews-pending'],
    queryFn: () =>
      apiRequest<{ data: { nte_extensions: unknown[]; invoices: unknown[] } }>(
        '/v1/sub-reviews/pending',
      ).catch(() => ({ data: { nte_extensions: [], invoices: [] } })),
    refetchInterval: 60000,
  })
  const subReviewPendingCount =
    (subReviews.data?.data.nte_extensions.length ?? 0) +
    (subReviews.data?.data.invoices.length ?? 0)

  // Inbound mirror jobs — cross-tenant sub work waiting for this
  // tenant to accept. Lights up the Jobs nav so dispatch notices
  // incoming work from partner tenants without polling /inbound-sub-jobs.
  const inboundMirror = useQuery({
    queryKey: ['topbar-inbound-sub-jobs-pending'],
    queryFn: () =>
      apiRequest<{ data: { count: number } }>('/v1/inbound-sub-jobs/pending-count')
        .catch(() => ({ data: { count: 0 } })),
    refetchInterval: 60000,
  })
  const inboundMirrorPendingCount = inboundMirror.data?.data.count ?? 0

  // Pending-turnover payments — tech-collected money waiting for a
  // cash-flow manager to confirm. Shows on Accounting nav so anyone
  // who handles cash spots the queue immediately.
  const pendingPayments = useQuery({
    queryKey: ['topbar-pending-payments'],
    queryFn: () =>
      apiRequest<{ data: { count: number } }>('/v1/payments/pending-count')
        .catch(() => ({ data: { count: 0 } })),
    refetchInterval: 60000,
  })
  const pendingPaymentsCount = pendingPayments.data?.data.count ?? 0

  const toolShedTriggerRef = useRef<HTMLButtonElement>(null)
  const avatarMenuRef = useRef<HTMLDivElement>(null)
  const quickCreateRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  // Hover-intent for the Tool Shed mega-menu. Opening on mouseEnter +
  // closing on mouseLeave flickers: the cursor crosses a 1px dead zone
  // (header border / the menu mounting under the pointer) and the menu
  // snaps shut. A short close delay bridges those transient leaves —
  // re-entering the button OR the menu within the window cancels it.
  const toolShedCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openToolShed = () => {
    if (toolShedCloseTimer.current) {
      clearTimeout(toolShedCloseTimer.current)
      toolShedCloseTimer.current = null
    }
    setIsToolShedOpen(true)
  }
  const scheduleCloseToolShed = () => {
    if (toolShedCloseTimer.current) clearTimeout(toolShedCloseTimer.current)
    toolShedCloseTimer.current = setTimeout(() => {
      setIsToolShedOpen(false)
      toolShedCloseTimer.current = null
    }, 180)
  }
  // Clear any pending timer on unmount.
  useEffect(() => {
    return () => {
      if (toolShedCloseTimer.current) clearTimeout(toolShedCloseTimer.current)
    }
  }, [])

  // Close avatar dropdown on outside click
  useEffect(() => {
    if (!isAvatarMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setIsAvatarMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isAvatarMenuOpen])

  // Close quick-create dropdown on outside click
  useEffect(() => {
    if (!isQuickCreateOpen) return
    function handleClick(e: MouseEvent) {
      if (quickCreateRef.current && !quickCreateRef.current.contains(e.target as Node)) {
        setIsQuickCreateOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isQuickCreateOpen])

  // Close compact "More" dropdown on outside click
  useEffect(() => {
    if (!isMoreMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isMoreMenuOpen])

  const handleSignOut = async () => {
    setIsAvatarMenuOpen(false)
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  const userInitials = (() => {
    const first = account?.extension?.first_name
    const last = account?.extension?.last_name
    if (first && last) return (first[0] + last[0]).toUpperCase()
    if (first) return first.slice(0, 2).toUpperCase()
    if (account?.email) return account.email.split('@')[0].slice(0, 2).toUpperCase()
    return 'U'
  })()

  return (
    <>
      <header className="sticky top-0 z-30 bg-[var(--chrome-bg)] border-b border-white/10">
        <div
          className={[
            'flex items-center px-3',
            compactHeader
              ? 'h-11 md:px-4 gap-2 md:gap-3'
              : 'h-14 md:px-6 gap-3 md:gap-6',
          ].join(' ')}
        >
          {/* Navigation fallback. Opens the drawer before the top bar gets cramped. */}
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            className={`${isPro ? 'md:hidden' : 'xl:hidden'} ${compactHeader ? 'w-8 h-8' : 'w-10 h-10'} flex items-center justify-center rounded-md -ml-1 text-white/80 hover:bg-white/10`}
            aria-label="Open navigation"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* Brand + tenant — in pro mode the Sidebar owns the brand on
              desktop, so hide it here (md+) and keep it only for mobile
              (where the sidebar is collapsed behind the hamburger). */}
          <Link
            to="/"
            className={[
              'flex items-center gap-2 shrink-0 group',
              isPro ? 'md:hidden' : '',
            ].join(' ')}
          >
            <span className={compactHeader ? 'text-base font-bold text-white' : 'text-lg font-bold text-white'}>
              Crew<span className="text-amber-400">Barn</span>
            </span>
            {account?.tenant?.name && (
              <>
                <span className="text-white/40 hidden sm:inline">·</span>
                <span className="text-sm text-white/70 group-hover:text-white hidden sm:inline">
                  {account.tenant.name}
                </span>
              </>
            )}
          </Link>

          {/* Primary nav — desktop only; mobile drawer mirrors below.
              Hidden entirely in pro mode (the Sidebar carries it). */}
          {!isPro && (
          <nav className={`hidden xl:flex items-center ${compactHeader ? 'gap-0.5' : 'gap-1'}`}>
            {navWithFranchise.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-tour={`nav-${item.to === '/' ? 'dashboard' : item.to.slice(1)}`}
                className={({ isActive }) =>
                  [
                  `relative ${compactHeader ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} font-medium transition-colors`,
                    isActive
                      ? 'text-white'
                      : 'text-white/70 hover:text-white',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      {item.label}
                      {item.to === '/dispatch' && dispatchPendingCount > 0 && (
                        <span
                          className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-amber-500 text-white"
                          title={`${dispatchPendingCount} pending request${dispatchPendingCount === 1 ? '' : 's'}`}
                        >
                          {dispatchPendingCount > 99 ? '99+' : dispatchPendingCount}
                        </span>
                      )}
                      {item.to === '/jobs' && subReviewPendingCount > 0 && (
                        <span
                          className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-emerald-600 text-white"
                          title={`${subReviewPendingCount} sub review${subReviewPendingCount === 1 ? '' : 's'} awaiting approval`}
                        >
                          {subReviewPendingCount > 99 ? '99+' : subReviewPendingCount}
                        </span>
                      )}
                      {item.to === '/accounting' && pendingPaymentsCount > 0 && (
                        <span
                          className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-amber-500 text-white"
                          title={`${pendingPaymentsCount} tech-collected payment${pendingPaymentsCount === 1 ? '' : 's'} awaiting turnover`}
                        >
                          {pendingPaymentsCount > 99 ? '99+' : pendingPaymentsCount}
                        </span>
                      )}
                      {item.to === '/jobs' && inboundMirrorPendingCount > 0 && (
                        <span
                          className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-sky-600 text-white"
                          title={`${inboundMirrorPendingCount} inbound sub job${inboundMirrorPendingCount === 1 ? '' : 's'} awaiting accept`}
                        >
                          {inboundMirrorPendingCount > 99 ? '99+' : inboundMirrorPendingCount}
                        </span>
                      )}
                    </span>
                    {isActive && (
                      <span className="absolute left-3 right-3 -bottom-px h-[3px] bg-amber-400" />
                    )}
                  </>
                )}
              </NavLink>
            ))}

            {/* Tool Shed trigger */}
            <div
              className="relative"
              onMouseEnter={openToolShed}
              onMouseLeave={scheduleCloseToolShed}
            >
              <button
                ref={toolShedTriggerRef}
                type="button"
                data-tour="nav-tool-shed"
                onClick={() => setIsToolShedOpen((v) => !v)}
                className={[
                  `relative flex items-center gap-1 ${compactHeader ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} font-medium transition-colors`,
                  isToolShedOpen
                    ? 'text-white'
                    : 'text-white/70 hover:text-white',
                ].join(' ')}
                aria-haspopup="true"
                aria-expanded={isToolShedOpen}
              >
                Tool Shed
                <svg
                  className={[
                    'w-3.5 h-3.5 transition-transform',
                    isToolShedOpen ? 'rotate-180' : '',
                  ].join(' ')}
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {isToolShedOpen && (
                  <span className="absolute left-3 right-6 -bottom-px h-[3px] bg-amber-400" />
                )}
              </button>

              {isToolShedOpen && (
                <ToolShedMenu
                  onClose={() => setIsToolShedOpen(false)}
                  triggerRef={toolShedTriggerRef}
                />
              )}
            </div>
          </nav>
          )}

          <div className="flex-1" />

          {/* Messages — formerly "Comms" in the primary nav. Lives next
              to the AI pill on the right because both are communication
              surfaces (and to free up space in the left-side primary nav).
              Hidden on mobile (drawer covers it). In pro mode the Sidebar
              carries Messages, so hide it here. */}
          {!isPro && (
          <>
            <NavLink
              to="/communications"
              // Anchor for the new-message toast — see AnchoredToastLayer.
              data-toast-anchor="messages"
              className={({ isActive }) =>
                [
                  `relative hidden xl:inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors`,
                  isActive
                    ? 'text-white'
                    : 'text-white/70 hover:text-white',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
                    <path
                      d="M3 6.5C3 5.67 3.67 5 4.5 5h11c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5h-7L5 17.5V15H4.5A1.5 1.5 0 013 13.5v-7z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className={compactHeader ? 'hidden 2xl:inline' : ''}>Messages</span>
                  {isActive && (
                    <span className="absolute left-3 right-3 -bottom-px h-[3px] bg-amber-400" />
                  )}
                </>
              )}
            </NavLink>
            {callAlerts.canViewCalls && (
              <NavLink
                to="/calls"
                data-toast-anchor="calls"
                className={({ isActive }) =>
                 [
                    `relative hidden xl:inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors`,
                    isActive
                      ? 'text-white'
                      : 'text-white/70 hover:text-white',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                      <path
                        d="M6.8 3.6l1.3 3.1-1.5 1.1c.9 1.8 2.1 3 3.8 3.8l1.1-1.5 3.1 1.3-.4 2.8c-.1.7-.7 1.2-1.4 1.2C8.2 15.4 4.6 11.8 4.6 7.2c0-.7.5-1.3 1.2-1.4l1-.2z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className={compactHeader ? 'hidden 2xl:inline' : ''}>Calls</span>
                    {callAlerts.count > 0 && (
                      <span className="absolute -top-1 right-0 w-7 text-center rounded-full bg-amber-500 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
                        {callAlerts.count > 99 ? '99+' : callAlerts.count}
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute left-3 right-3 -bottom-px h-[3px] bg-amber-400" />
                    )}
                  </>
                )}
              </NavLink>
            )}
            <NavLink
              to="/intake"
              data-toast-anchor="intake"
              className={({ isActive }) =>
                [
                  `relative hidden xl:inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors`,
                  isActive
                    ? 'text-white'
                    : 'text-white/70 hover:text-white',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
                    <path
                      d="M4 4.5h12v11H4z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M7 8h6M7 11h4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className={compactHeader ? 'hidden 2xl:inline' : ''}>Intake</span>
                  {intakeCount > 0 && (
                    <span className="absolute -top-1 right-0 w-7 text-center rounded-full bg-amber-500 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
                      {intakeCount > 99 ? '99+' : intakeCount}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute left-3 right-3 -bottom-px h-[3px] bg-amber-400" />
                  )}
                </>
              )}
            </NavLink>
          </>
          )}

          {/* AI ask box — hidden entirely when AI is off / unconfigured.
              Also hidden on mobile (drawer-only nav). */}
          <div className="hidden xl:block">
            <HeaderAiInput />
          </div>

          {/* Right-side actions — search + quick-create + help + account.
              (Notifications / settings placeholders were removed until they
              actually do something.) */}
          <div className={`flex items-center ${compactHeader ? 'gap-0.5' : 'gap-1'}`}>
            {compactHeader && !isPro && (
              <div ref={moreMenuRef} className="relative hidden md:block xl:hidden">
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen((v) => !v)}
                  className="h-9 px-2.5 text-sm flex items-center gap-1.5 rounded-md font-medium text-white/75 hover:bg-white/10 hover:text-white"
                  aria-haspopup="true"
                  aria-expanded={isMoreMenuOpen}
                  title="More tools"
                >
                  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                    <path
                      d="M4 10h.01M10 10h.01M16 10h.01"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>More</span>
                  {(callAlerts.count + intakeCount > 0) && (
                    <span className="absolute -top-1 right-0 w-7 text-center rounded-full bg-amber-500 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
                      {callAlerts.count + intakeCount > 99 ? '99+' : callAlerts.count + intakeCount}
                    </span>
                  )}
                </button>

                {isMoreMenuOpen && (
                  <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Communication
                    </div>
                    <CompactMoreLink
                      to="/communications"
                      icon="messages"
                      onClick={() => setIsMoreMenuOpen(false)}
                    >
                      Messages
                    </CompactMoreLink>
                    {callAlerts.canViewCalls && (
                      <CompactMoreLink
                        to="/calls"
                        icon="calls"
                        badge={callAlerts.count}
                        onClick={() => setIsMoreMenuOpen(false)}
                      >
                        Calls
                      </CompactMoreLink>
                    )}
                    <CompactMoreLink
                      to="/intake"
                      icon="intake"
                      badge={intakeCount}
                      onClick={() => setIsMoreMenuOpen(false)}
                    >
                      Intake
                    </CompactMoreLink>
                    <div className="border-t border-slate-100 my-1" />
                    <div className="px-3 py-2 text-xs text-slate-500">
                      Dialer and full AI bar stay tucked away in compact mode.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Global search — the non-AI way to jump to a record. Both themes. */}
            <GlobalSearch />

            {/* Quick create button - "+" with dropdown of create actions */}
            <div ref={quickCreateRef} className={`relative ml-1 ${compactHeader ? 'md:ml-1' : 'md:ml-2'}`}>
              <button
                type="button"
                onClick={() => setIsQuickCreateOpen((v) => !v)}
                className={`${compactHeader ? 'w-8 h-8' : 'w-9 h-9'} flex items-center justify-center rounded-full bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm`}
                aria-haspopup="true"
                aria-expanded={isQuickCreateOpen}
                title="Create new..."
              >
                <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
                  <path
                    d="M10 4v12M4 10h12"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              {isQuickCreateOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-40">
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Create
                  </div>
                  <QuickCreateLink
                    to="/jobs/new"
                    onClick={() => setIsQuickCreateOpen(false)}
                    icon="briefcase"
                  >
                    New Job
                  </QuickCreateLink>
                  <QuickCreateLink
                    to="/tasks?new=1"
                    onClick={() => setIsQuickCreateOpen(false)}
                    icon="task"
                  >
                    New Task
                  </QuickCreateLink>
                  <QuickCreateLink
                    to="/estimates/new"
                    onClick={() => setIsQuickCreateOpen(false)}
                    icon="document"
                  >
                    New Estimate
                  </QuickCreateLink>
                  <QuickCreateLink
                    to="/customers/new"
                    onClick={() => setIsQuickCreateOpen(false)}
                    icon="user"
                  >
                    New Customer
                  </QuickCreateLink>
                  <QuickCreateButton
                    onClick={() => {
                      setIsQuickCreateOpen(false)
                      setIsNewAssetOpen(true)
                    }}
                    icon="wrench"
                  >
                    New Asset
                  </QuickCreateButton>
                </div>
              )}
            </div>

            {/* Office notification bell — disputes, external refunds, etc.
                Gated on invoices (view or edit) since every producer is a
                money event; mirrors the route's method-based permission. */}
            {hasAny([PERM.INVOICES_VIEW, PERM.INVOICES_EDIT]) && <NotificationBell compact={compactHeader} />}

            {/* Help button — opens HelpPanel slide-over (or press ?) */}
            {onOpenHelp && (
              <button
                type="button"
                onClick={onOpenHelp}
                className={`${compactHeader ? 'ml-1 w-8 h-8' : 'ml-2 w-9 h-9'} flex items-center justify-center rounded-full text-white/80 hover:bg-white/10 transition-colors text-base font-semibold`}
                title="Help (press ?)"
                aria-label="Open help"
              >
                ?
              </button>
            )}

            {/* Avatar / user menu */}
            <div ref={avatarMenuRef} className={`relative ${compactHeader ? 'ml-1' : 'ml-2'}`}>
              <button
                type="button"
                data-tour="user-menu"
                onClick={() => setIsAvatarMenuOpen((v) => !v)}
                className={`${compactHeader ? 'w-8 h-8' : 'w-9 h-9'} flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 ring-1 ring-white/15 text-white text-xs font-semibold transition-colors overflow-hidden`}
                aria-haspopup="true"
                aria-expanded={isAvatarMenuOpen}
              >
                {account?.avatar_url ? (
                  <img src={account.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  userInitials
                )}
              </button>

              {isAvatarMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-40">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="text-sm font-medium text-navy-900 truncate">
                      {account?.email ?? 'Signed in'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {account?.is_platform_admin
                        ? 'Platform admin'
                        : account?.extension?.role ?? account?.account_type ?? 'Member'}
                    </div>
                  </div>
                  {account?.is_platform_admin && (
                    <>
                      <MenuItemLink
                        to="/admin/tenants"
                        onClick={() => setIsAvatarMenuOpen(false)}
                      >
                        <span className="flex items-center justify-between">
                          <span>Tenants</span>
                          <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                            Staff
                          </span>
                        </span>
                      </MenuItemLink>
                      <MenuItemLink
                        to="/admin/testers"
                        onClick={() => setIsAvatarMenuOpen(false)}
                      >
                        Testers
                      </MenuItemLink>
                      <MenuItemLink
                        to="/admin/inbox"
                        onClick={() => setIsAvatarMenuOpen(false)}
                      >
                        Inbox
                      </MenuItemLink>
                      <MenuItemLink
                        to="/admin/platform-integrations"
                        onClick={() => setIsAvatarMenuOpen(false)}
                      >
                        Platform integrations
                      </MenuItemLink>
                      <MenuItemLink
                        to="/admin/platform-users"
                        onClick={() => setIsAvatarMenuOpen(false)}
                      >
                        Platform Users
                      </MenuItemLink>
                      {/* Platform admin's OWN login 2FA — in the account menu,
                          NOT the Tool Shed, so acting-as-a-tenant never shows
                          "your" 2FA under that tenant. Tenant users get theirs
                          from the Tool Shed instead (hideForPlatformAdmin). */}
                      <MenuItemLink
                        to="/me/security"
                        onClick={() => setIsAvatarMenuOpen(false)}
                      >
                        My Security (2FA)
                      </MenuItemLink>
                      <div className="border-t border-slate-100 my-1" />
                    </>
                  )}
                  <MenuItemLink to="/feedback" onClick={() => setIsAvatarMenuOpen(false)}>
                    <span className="flex items-center justify-between">
                      <span>Bugs &amp; Ideas</span>
                      <span className="text-base leading-none">💡</span>
                    </span>
                  </MenuItemLink>
                  <MenuItemLink to="/my-time-off" onClick={() => setIsAvatarMenuOpen(false)}>
                    My time off
                  </MenuItemLink>
                  <MenuItemLink to="/me/account" onClick={() => setIsAvatarMenuOpen(false)}>
                    My account
                  </MenuItemLink>
                  {has(PERM.SETTINGS_EDIT) && (
                    <MenuItemLink to="/me/ai-connectors" onClick={() => setIsAvatarMenuOpen(false)}>
                      AI connectors
                    </MenuItemLink>
                  )}
                  <MenuItem onClick={() => setIsAvatarMenuOpen(false)} disabled>
                    Help
                  </MenuItem>
                  <div className="border-t border-slate-100 my-1" />
                  <MenuItem onClick={handleSignOut}>Sign out</MenuItem>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Slice 13c: New Asset wizard, mounted at TopBar so the quick-create
          dropdown can open it from anywhere in the app. The Modal portals
          over everything via fixed inset-0 z-50. */}
      <NewAssetWizardModal
        isOpen={isNewAssetOpen}
        onClose={() => setIsNewAssetOpen(false)}
      />

      {/* Mobile nav drawer — only renders content when open. Mirrors the
          desktop PRIMARY_NAV + Tool Shed sections. Badges are forwarded
          so the queue counts are visible from phones too. */}
      <MobileNavDrawer
        open={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        primaryNav={navWithFranchise}
        badges={{
          '/dispatch':
            dispatchPendingCount > 0
              ? [{ count: dispatchPendingCount, color: 'amber' }]
              : [],
          '/jobs': [
            ...(subReviewPendingCount > 0
              ? [{ count: subReviewPendingCount, color: 'emerald' as const }]
              : []),
            ...(inboundMirrorPendingCount > 0
              ? [{ count: inboundMirrorPendingCount, color: 'sky' as const }]
              : []),
          ],
          '/accounting':
            pendingPaymentsCount > 0
              ? [{ count: pendingPaymentsCount, color: 'amber' }]
              : [],
        }}
        accountEmail={account?.email ?? null}
        onSignOut={handleSignOut}
        wide={!isPro}
      />
    </>
  )
}

function MenuItem({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-navy-900 disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

function MenuItemLink({
  children,
  to,
  onClick,
}: {
  children: React.ReactNode
  to: string
  onClick: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-navy-900"
    >
      {children}
    </Link>
  )
}

function CompactMoreLink({
  children,
  to,
  icon,
  badge,
  onClick,
}: {
  children: React.ReactNode
  to: string
  icon: 'messages' | 'calls' | 'intake'
  badge?: number
  onClick: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-navy-900"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
        <MoreIcon name={icon} />
      </span>
      <span className="flex-1 font-medium">{children}</span>
      {badge ? (
        <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </Link>
  )
}

function MoreIcon({ name }: { name: 'messages' | 'calls' | 'intake' }) {
  if (name === 'calls') {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path
          d="M6.8 3.6l1.3 3.1-1.5 1.1c.9 1.8 2.1 3 3.8 3.8l1.1-1.5 3.1 1.3-.4 2.8c-.1.7-.7 1.2-1.4 1.2C8.2 15.4 4.6 11.8 4.6 7.2c0-.7.5-1.3 1.2-1.4l1-.2z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (name === 'intake') {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path d="M4 4.5h12v11H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path
        d="M3 6.5C3 5.67 3.67 5 4.5 5h11c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5h-7L5 17.5V15H4.5A1.5 1.5 0 013 13.5v-7z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type QuickCreateIconName = 'briefcase' | 'document' | 'user' | 'wrench' | 'task'

// Quick-create dropdown items - icon + label, navigate via React Router
function QuickCreateLink({
  to,
  onClick,
  icon,
  children,
}: {
  to: string
  onClick: () => void
  icon: QuickCreateIconName
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-navy-900"
    >
      <span className="w-7 h-7 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
        <QuickCreateIcon name={icon} />
      </span>
      <span className="font-medium">{children}</span>
    </Link>
  )
}

// Same shape as QuickCreateLink but fires an onClick instead of navigating.
// Used for entries that open a modal (e.g., New Asset wizard) rather than
// going to a /new page.
function QuickCreateButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void
  icon: QuickCreateIconName
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-navy-900 w-full text-left"
    >
      <span className="w-7 h-7 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
        <QuickCreateIcon name={icon} />
      </span>
      <span className="font-medium">{children}</span>
    </button>
  )
}

function QuickCreateIcon({ name }: { name: QuickCreateIconName }) {
  if (name === 'briefcase') {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
        <rect x="3" y="6" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
        <path d="M7 6V4.5A1.5 1.5 0 018.5 3h3A1.5 1.5 0 0113 4.5V6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'document') {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
        <path d="M5 3h7l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        <path d="M12 3v4h4" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        <path d="M7 11h6M7 14h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'user') {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
        <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.75" />
        <path d="M4 17a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'task') {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
        <path d="M6.5 10l2.4 2.4 4.6-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  // wrench - asset create
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
      <path
        d="M14.5 3a3.5 3.5 0 00-3.4 4.4L4 14.5 5.5 16l7.1-7.1A3.5 3.5 0 1014.5 3z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}
