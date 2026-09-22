import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
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
  const unscheduled = useUnscheduledCount().data ?? 0
  const stale = useStaleSnapshot().data
  const opsBadge =
    unscheduled +
    (stale?.unbilled_completed.count ?? 0) +
    (stale?.past_scheduled_open.count ?? 0)

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6">
        <h1 className="text-xl font-bold text-navy-900 pt-4">Welcome back, {displayName}.</h1>
        <div data-tour="dash-tabs" className="flex gap-6 mt-3">
          {TABS.map((t) => {
            const active = tab === t.key
            const badge = t.key === 'ops' && opsBadge > 0 ? opsBadge : null
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => selectTab(t.key)}
                className={[
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
