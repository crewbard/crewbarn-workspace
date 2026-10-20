import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { PLAN_UPGRADE_EVENT, type PlanUpgradeDetail } from '@/lib/api'
import { useInvitedByCustomer } from '@/hooks/useInvitedByCustomer'

/**
 * The free Sub plan, on the web. A sub company that has not subscribed works
 * the jobs it is sent, its calendar, its techs and its team; the server
 * refuses the rest (402 plan_upgrade_required, App\Services\SubNetwork\SubPlan).
 * Here, pages it doesn't cover show the upgrade instead of failing, and
 * anything the person does that needs a paid plan opens the upgrade sheet.
 */

/** Pages a free sub company can use. Keep in step with SubPlan::FREE. */
const FREE_PAGES: RegExp[] = [
  /^\/jobs$/,
  /^\/jobs\/(?!new$)[^/]+$/,
  /^\/inbound-sub-jobs$/,
  /^\/tasks$/,
  /^\/schedule$/,
  /^\/dispatch$/,
  /^\/dispatch\/field-review$/,
  /^\/my-time-off$/,
  /^\/companies-i-work-for$/,
  /^\/tool-shed$/,
  // Billing the company that sent a job, on its copy (the server allows
  // only invoices on those jobs).
  /^\/invoices\/[^/]+$/,
  /^\/tool-shed\/(subscription|company-info|brand|staff|roles|encryption|company-files|appearance|time-off)$/,
]

/** What a walled page would unlock, by where it starts; the first match wins. */
const PAGE_FEATURES: Array<[RegExp, string]> = [
  [/^\/jobs\/new/, 'creating your own jobs'],
  [/^\/(sub-jobs|sub-reviews|sub-payouts|tool-shed\/subcontractors)/, 'sending work to subs'],
  [/^\/estimates/, 'estimates'],
  [/^\/(invoices|accounting\/invoices)/, 'invoices'],
  [/^\/(money|tool-shed\/payments)/, 'payments'],
  [/^\/customers/, 'your own customers'],
  [/^\/(inventory|purchase-orders|vendors)/, 'inventory and purchasing'],
  [/^\/catalog/, 'the catalog'],
  [/^\/(communications|calls|intake|tool-shed\/communication)/, 'calls and texting'],
  [/^\/(reports|accounting\/reports)/, 'reports'],
  [/^\/accounting/, 'accounting'],
  [/^\/maintenance-contracts/, 'maintenance contracts'],
  [/^\/tool-shed\/automations/, 'automations'],
  [/^\/tool-shed\/ai/, 'the AI assistant'],
  [/^\/tool-shed\/(website|google-reviews)/, 'your website and reviews'],
]

export function useOnFreeSubPlan(): boolean {
  const { account } = useAuth()
  return !!account && !account.is_platform_admin && !!account.tenant?.on_free_sub_plan
}

export function isFreeSubPlanPage(path: string): boolean {
  return FREE_PAGES.some((page) => page.test(path))
}

function pageFeature(path: string): string {
  return PAGE_FEATURES.find(([start]) => start.test(path))?.[1] ?? 'this page'
}

/**
 * Around the page body (inside the app's nav): a page the free plan doesn't
 * cover shows what upgrading unlocks. The home page, a dashboard of the
 * company's own business, becomes the jobs it was sent.
 */
export function SubPlanWall({ children }: { children: ReactNode }) {
  const free = useOnFreeSubPlan()
  const invitedBy = useInvitedByCustomer()
  const { pathname } = useLocation()

  // A trade a customer brought in looks around everywhere; what it can't
  // change opens the sheet below when it tries.
  if (!free || invitedBy || isFreeSubPlanPage(pathname)) return <>{children}</>
  if (pathname === '/') return <Navigate to="/jobs" replace />

  return <UpgradePanel feature={pageFeature(pathname)} />
}

function UpgradePanel({ feature }: { feature: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Free sub account</p>
        <h1 className="mt-2 text-xl font-bold text-navy-900">Upgrade to use {feature}</h1>
        <IncludedCopy />
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/tool-shed/subscription" className="rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600">See plans</Link>
          <Link to="/jobs" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Back to jobs</Link>
        </div>
      </div>
    </div>
  )
}

function IncludedCopy() {
  const invitedBy = useInvitedByCustomer()
  if (invitedBy) {
    return (
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Your free CrewBarn is for the jobs {invitedBy} sends you: work them, add photos and videos, and send your invoice. You can look
        around everything else. Start using CrewBarn to run all your jobs and customers here.
      </p>
    )
  }
  return (
    <p className="mt-2 text-sm leading-6 text-slate-600">
      Your free CrewBarn covers the work companies send you: their jobs, your calendar, your techs in the field and your team, with as
      many employees as you like. A paid plan opens everything else, to run your own customers and jobs.
    </p>
  )
}

/**
 * The sheet for something the person did that needs a paid plan (the server
 * answered 402 plan_upgrade_required). One at a time; pages loading in the
 * background never open it.
 */
export function PlanUpgradeSheet() {
  const navigate = useNavigate()
  const invitedBy = useInvitedByCustomer()
  const [shown, setShown] = useState<PlanUpgradeDetail | null>(null)

  useEffect(() => {
    const open = (e: Event) => setShown((e as CustomEvent<PlanUpgradeDetail>).detail)
    window.addEventListener(PLAN_UPGRADE_EVENT, open)
    return () => window.removeEventListener(PLAN_UPGRADE_EVENT, open)
  }, [])

  if (!shown) return null
  const close = () => setShown(null)

  return (
    <div className="fixed inset-0 z-[60] flex overflow-y-auto bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="plan-upgrade-title" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <div className="m-auto w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="plan-upgrade-title" className="text-lg font-semibold text-navy-900">
          {invitedBy
            ? shown.feature === 'this' ? 'This is locked on your free account' : `Start using CrewBarn to use ${shown.feature}`
            : shown.feature === 'this' ? 'This needs a paid plan' : `Upgrade to use ${shown.feature}`}
        </h2>
        <IncludedCopy />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:text-navy-900">Not now</button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              close()
              navigate('/tool-shed/subscription')
            }}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600"
          >
            {invitedBy ? 'Start using CrewBarn' : 'See plans'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * On every page of a free company (a sub, or a trade a customer brought in):
 * what the free account covers, and the way to start using CrewBarn for
 * everything. Quiet on purpose: a tint, not an alarm.
 */
export function StartUsingCrewBarnBanner() {
  const free = useOnFreeSubPlan()
  const invitedBy = useInvitedByCustomer()
  if (!free) return null

  return (
    <div data-tour="start-using-crewbarn" className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[13px] text-amber-950">
      <span className="min-w-0">
        {invitedBy ? (
          <>Free CrewBarn from <strong>{invitedBy}</strong>: work and invoice the jobs they send you.</>
        ) : (
          <>Free CrewBarn for the work companies send you.</>
        )}
      </span>
      <Link to="/tool-shed/subscription" className="shrink-0 rounded-md px-2 py-0.5 text-[13px] font-bold text-amber-800 underline-offset-2 hover:bg-amber-100 hover:underline">
        Start using CrewBarn →
      </Link>
    </div>
  )
}
