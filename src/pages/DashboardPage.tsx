import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { OpsTab } from '@/components/dashboard/OpsTab'
import { CashFlowTab } from '@/components/dashboard/CashFlowTab'
import { CustomBoard } from '@/components/dashboard/CustomBoard'
import { DispatchTab } from '@/components/dashboard/DispatchTab'
import { useUnscheduledCount, useStaleSnapshot } from '@/hooks/useDashboard'
import { useDashboardRealtime } from '@/hooks/useDashboardRealtime'

/**
 * DashboardPage — the home screen. Three tabs:
 *   - Today's Ops : the daily driver (now/next, jobs, calls, needs attention)
 *   - Cash Flow   : live finance view (money in/out, A/R, avg job revenue)
 *   - Custom      : the drag-drop widget board (per-employee widget access)
 *
 * Tab choice persists per browser. The Ops tab shows a red badge counting
 * actionable items (unscheduled + ready-to-invoice + past-their-time jobs).
 */
const TABS = [
  { key: 'ops', label: "Today's Ops" },
  { key: 'cash', label: 'Cash Flow' },
  { key: 'dispatch', label: 'Dispatch' },
  { key: 'custom', label: 'Custom' },
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

  const [tab, setTab] = useState<TabKey>(readTab)
  const selectTab = (k: TabKey) => {
    setTab(k)
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
    <div data-easy-dashboard className="min-h-[calc(100vh-4rem)] w-full min-w-0 bg-slate-50 p-3 sm:p-4 lg:p-6">
      <div className="w-full min-w-0 max-w-none space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-[var(--chrome-bg,#0F1A2E)] p-6 text-white sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Your workday · CrewBarn</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back, {displayName}.</h1>
            <p className="mt-3 max-w-xl text-sm text-white/90">A clear place to start. Review what needs you, then get back to the work.</p>
          </div>
          {!permissions.isLoading && permissions.has(PERM.JOBS_EDIT) && <Link to="/jobs/new" className="rounded-xl bg-amber-400 px-5 py-3 font-semibold text-slate-950 hover:bg-amber-300">+ New job</Link>}
        </header>

        <nav data-tour="dash-tabs" aria-label="Dashboard views" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TABS.map(item => <button key={item.key} type="button" onClick={() => selectTab(item.key)} aria-pressed={tab === item.key}
            className={`rounded-xl border p-4 text-left transition-colors ${tab === item.key ? 'border-emerald-800 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-800' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-700'}`}>
            <span className="block font-semibold">{item.key === 'ops' ? 'Your day' : item.key === 'cash' ? 'Money overview' : item.key === 'custom' ? 'Your custom board' : 'Dispatch'}</span>
            <span className="mt-1 block text-xs opacity-80">{item.key === 'ops' ? 'Jobs, calls, and what needs attention' : item.key === 'cash' ? 'Cash flow and outstanding balances' : item.key === 'custom' ? 'The widgets you chose to keep close' : 'Crew locations and scheduling tools'}</span>
          </button>)}
        </nav>

        {tab === 'ops' && !permissions.isLoading && permissions.has(PERM.JOBS_VIEW) && <section aria-labelledby="easy-needs-heading" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><h2 id="easy-needs-heading" className="text-xl font-semibold text-slate-900">Needs you</h2><span className="text-xs text-slate-500">Review a queue—opening it does not complete the work.</span></div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { title: 'Choose a date', detail: 'Jobs waiting to be scheduled', value: unscheduledQuery.data, ready: unscheduledQuery.isSuccess, failed: unscheduledQuery.isError, to: '/dispatch' },
              { title: 'Check overdue work', detail: 'Past-scheduled jobs still open', value: stale?.past_scheduled_open.count, ready: staleQuery.isSuccess, failed: staleQuery.isError, to: '/jobs?stale=past_scheduled_open' },
              { title: 'Review billing', detail: 'Completed jobs without an invoice', value: stale?.unbilled_completed.count, ready: staleQuery.isSuccess, failed: staleQuery.isError, to: '/jobs?stale=unbilled_completed' },
            ].map(item => <Link key={item.title} to={item.to} className="rounded-xl border border-slate-200 p-4 hover:border-amber-500 hover:bg-amber-50">
              <span className="block text-3xl font-semibold tabular-nums text-slate-900">{item.failed ? 'Unavailable' : item.ready ? item.value ?? '—' : '…'}</span>
              <span className="mt-3 block font-semibold text-slate-900">{item.title} <span aria-hidden="true">→</span></span>
              <span className="mt-1 block text-sm text-slate-500">{item.detail}</span>
            </Link>)}
          </div>
        </section>}
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white">
          {tab === 'ops' && <OpsTab />}
          {tab === 'cash' && <CashFlowTab />}
          {tab === 'dispatch' && <div className="h-[70vh] min-h-[420px] overflow-hidden rounded-2xl"><DispatchTab /></div>}
          {tab === 'custom' && <CustomBoard />}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6">
        <h1 className="text-xl font-bold text-navy-900 pt-4">Welcome back, {displayName}.</h1>
        {easy && <p className="mt-2 max-w-2xl text-sm text-slate-600">Start with today's work, then review the items that need your attention. Your financial view, dispatch tools and custom board are still here.</p>}
        <div data-tour="dash-tabs" className={easy ? 'mt-4 flex flex-wrap gap-2 pb-3' : 'flex gap-6 mt-3'}>
          {TABS.map((t) => {
            const active = tab === t.key
            const badge = t.key === 'ops' && unscheduledQuery.isSuccess && staleQuery.isSuccess && opsBadge > 0 ? opsBadge : null
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => selectTab(t.key)}
                aria-pressed={active}
                className={easy ? `rounded-full border px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}` : [
                  'relative pb-2.5 text-sm transition-colors border-b-2 -mb-px flex items-center gap-1.5',
                  active
                    ? 'border-amber-500 text-navy-900 font-medium'
                    : 'border-transparent text-slate-500 hover:text-slate-800',
                ].join(' ')}
              >
                {t.label}
                {badge !== null && (
                  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold">
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'ops' && <OpsTab />}
      {tab === 'cash' && <CashFlowTab />}
      {tab === 'dispatch' && (
        <div className="overflow-hidden" style={{ height: 'calc(100vh - 10rem)' }}>
          <DispatchTab />
        </div>
      )}
      {tab === 'custom' && <CustomBoard />}
    </div>
  )
}
