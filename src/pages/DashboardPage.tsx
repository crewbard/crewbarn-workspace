import { useState, lazy, Suspense, startTransition } from 'react'
import { Link } from 'react-router-dom'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { OpsTab } from '@/components/dashboard/OpsTab'
const CashFlowTab = lazy(() => import('@/components/dashboard/CashFlowTab').then((m) => ({ default: m.CashFlowTab })))
const CustomBoard = lazy(() => import('@/components/dashboard/CustomBoard').then((m) => ({ default: m.CustomBoard })))
const DispatchTab = lazy(() => import('@/components/dashboard/DispatchTab').then((m) => ({ default: m.DispatchTab })))
const TAB_LOADING = <div className="p-6 text-sm text-slate-500" role="status">Loading…</div>
import { useUnscheduledCount, useStaleSnapshot } from '@/hooks/useDashboard'
import { useDashboardRealtime } from '@/hooks/useDashboardRealtime'

/**
 * DashboardPage — the home screen. Four tabs:
 *   - Today's Ops : the daily driver (now/next, jobs, calls, needs attention)
 *   - Cash Flow   : live finance view (money in/out, A/R, avg job revenue)
 *   - Dispatch    : today's crew board (or "My day" for non-dispatch roles)
 *   - Custom      : the drag-drop widget board (per-employee widget access)
 *
 * Tab buttons carry role="tab" + aria-selected and a data-tour id
 * (dash-tab-ops / -cashflow / -dispatch / -custom) so the guided tour can open
 * a tab before pointing at what is inside it.
 *
 * Tab choice persists per browser. The Ops tab shows a red badge counting
 * actionable items (unscheduled + ready-to-invoice + past-their-time jobs).
 */
const TABS = [
  { key: 'ops', label: "Today's Ops", tour: 'ops' },
  { key: 'cash', label: 'Cash Flow', tour: 'cashflow' },
  { key: 'dispatch', label: 'Dispatch', tour: 'dispatch' },
  { key: 'custom', label: 'Custom', tour: 'custom' },
] as const
type TabKey = (typeof TABS)[number]['key']

function readTab(): TabKey {
  try {
    const v = localStorage.getItem('dashboard_tab')
    if (v === 'cash' || v === 'custom' || v === 'ops' || v === 'dispatch') return v
  } catch {
    /* ignore */
  }
  return 'ops'
}

export function DashboardPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const focus = theme === 'focus'
  const permissions = usePermissions()
  const { account } = useAuth()
  // One Reverb connection feeds every dashboard tab — invalidates the polling
  // widgets live off the channels we already broadcast (jobs/comms/positions).
  useDashboardRealtime(account)
  const firstName =
    account?.extension?.first_name ??
    account?.email?.split('@')[0]?.split('.')[0] ??
    'there'
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1)
  const localNow = new Date()
  const focusGreeting = localNow.getHours() < 12 ? 'Good morning' : localNow.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const focusDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(localNow)

  const [tab, setTab] = useState<TabKey>(readTab)
  const selectTab = (k: TabKey) => {
    startTransition(() => setTab(k))
    try {
      localStorage.setItem('dashboard_tab', k)
    } catch {
      /* ignore */
    }
  }

  // Shared (deduped) queries — same keys the Ops tab uses, so this badge is
  // free; react-query serves both from one fetch.
  const unscheduledQuery = useUnscheduledCount()
  const staleQuery = useStaleSnapshot()
  const unscheduled = unscheduledQuery.data ?? 0
  const stale = staleQuery.data
  const opsBadge =
    unscheduled +
    (stale?.unbilled_completed.count ?? 0) +
    (stale?.past_scheduled_open.count ?? 0)

  if (easy) return (
    <div data-easy-dashboard className="w-full min-w-0">
      <div className="w-full min-w-0 max-w-none space-y-6">
        <header data-tour="dash-welcome" className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-[var(--chrome-bg,#0F1A2E)] p-6 text-white sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Your workday · CrewBarn</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back, {displayName}.</h1>
            <p className="mt-3 max-w-xl text-sm text-white/90">A clear place to start. Review what needs you, then get back to the work.</p>
          </div>
          <div className="flex flex-wrap gap-2">{!permissions.isLoading && permissions.has(PERM.JOBS_EDIT) && <Link to="/jobs/new" data-tour="dash-new-job" className="rounded-xl bg-amber-400 px-5 py-3 font-semibold text-slate-950 hover:bg-amber-300">+ New job</Link>}</div>
        </header>

        <nav data-tour="dash-tabs" role="tablist" aria-label="Dashboard views" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TABS.map(item => <button key={item.key} type="button" role="tab" data-tour={`dash-tab-${item.tour}`} onClick={() => selectTab(item.key)} aria-selected={tab === item.key}
            className={`rounded-xl border p-4 text-left transition-colors ${tab === item.key ? 'border-emerald-800 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-800' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-700'}`}>
            <span className="block font-semibold">{item.key === 'ops' ? 'Your day' : item.key === 'cash' ? 'Money overview' : item.key === 'custom' ? 'Your custom board' : 'Dispatch'}</span>
            <span className="mt-1 block text-xs opacity-80">{item.key === 'ops' ? 'Jobs, calls, and what needs attention' : item.key === 'cash' ? 'Cash flow and outstanding balances' : item.key === 'custom' ? 'The widgets you chose to keep close' : 'Crew locations and scheduling tools'}</span>
          </button>)}
        </nav>

        {tab === 'ops' && !permissions.isLoading && permissions.has(PERM.JOBS_VIEW) && <section data-tour="dash-needs-you" aria-labelledby="easy-needs-heading" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><h2 id="easy-needs-heading" className="text-xl font-semibold text-slate-900">Needs you</h2><span className="text-xs text-slate-500">Review a queue—opening it does not complete the work.</span></div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { title: 'Choose a date', tour: 'schedule', detail: 'Jobs waiting to be scheduled', value: unscheduledQuery.data, ready: unscheduledQuery.isSuccess, failed: unscheduledQuery.isError, to: '/schedule' },
              { title: 'Check overdue work', tour: 'overdue', detail: 'Past-scheduled jobs still open', value: stale?.past_scheduled_open.count, ready: staleQuery.isSuccess, failed: staleQuery.isError, to: '/jobs?stale=past_scheduled_open' },
              { title: 'Review billing', tour: 'billing', detail: 'Completed jobs without an invoice', value: stale?.unbilled_completed.count, ready: staleQuery.isSuccess, failed: staleQuery.isError, to: '/jobs?stale=unbilled_completed' },
            ].map(item => <Link key={item.title} data-tour={`dash-needs-you-${item.tour}`} to={item.to} className="rounded-xl border border-slate-200 p-4 hover:border-amber-500 hover:bg-amber-50">
              <span className="block text-3xl font-semibold tabular-nums text-slate-900">{item.failed ? 'Unavailable' : item.ready ? item.value ?? '—' : '…'}</span>
              <span className="mt-3 block font-semibold text-slate-900">{item.title} <span aria-hidden="true">→</span></span>
              <span className="mt-1 block text-sm text-slate-500">{item.detail}</span>
            </Link>)}
          </div>
        </section>}
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white">
          {tab === 'ops' && <OpsTab />}
          <Suspense fallback={TAB_LOADING}>
            {tab === 'cash' && <CashFlowTab />}
            {tab === 'dispatch' && <div className="h-[70vh] min-h-[420px] overflow-hidden rounded-2xl"><DispatchTab /></div>}
            {tab === 'custom' && <CustomBoard />}
          </Suspense>
        </div>
      </div>
    </div>
  )

  return (
    <div data-focus-page="dashboard" className="min-h-[calc(100vh-4rem)] bg-slate-100">
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6">
        <div data-tour="dash-welcome" className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div>
            <h1 className="text-xl font-bold text-navy-900">{focus ? `${focusGreeting}, ${displayName}` : `Welcome back, ${displayName}.`}</h1>
            {focus && <p className="mt-0.5 text-sm text-slate-600">{focusDate} · Your shop at a glance, with the next action in reach.</p>}
          </div>
          {focus && <div className="flex flex-wrap items-center gap-2">
            <Link to="/schedule" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Schedule</Link>
            {!permissions.isLoading && permissions.has(PERM.JOBS_EDIT) && <Link to="/jobs/new" data-tour="dash-new-job" className="rounded-lg bg-[var(--accent-500,#e8902c)] px-3 py-2 text-sm font-semibold text-white hover:brightness-95">+ New job</Link>}
          </div>}
        </div>
        <div data-tour="dash-tabs" role="tablist" aria-label="Dashboard views" className="flex gap-6 mt-3">
          {TABS.map((t) => {
            const active = tab === t.key
            const badge = t.key === 'ops' && unscheduledQuery.isSuccess && staleQuery.isSuccess && opsBadge > 0 ? opsBadge : null
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                data-tour={`dash-tab-${t.tour}`}
                onClick={() => selectTab(t.key)}
                aria-selected={active}
                className={[
                  'relative pb-2.5 text-sm transition-colors border-b-2 -mb-px flex items-center gap-1.5',
                  active
                    ? 'border-amber-500 text-navy-900 font-medium'
                    : 'border-transparent text-slate-500 hover:text-slate-800',
                ].join(' ')}
              >
                {t.label}
                {badge !== null && (
                  <span data-tour="dash-ops-badge" className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold">
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'ops' && <OpsTab />}
      <Suspense fallback={TAB_LOADING}>
        {tab === 'cash' && <CashFlowTab />}
        {tab === 'dispatch' && (
          <div className="overflow-hidden" style={{ height: 'calc(100vh - 10rem)' }}>
            <DispatchTab />
          </div>
        )}
        {tab === 'custom' && <CustomBoard />}
      </Suspense>
    </div>
  )
}
