import { lazy, Suspense, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { RequirePermission } from '@/components/RequirePermission'

const OrderPartsPage = lazy(() => import('@/pages/OrderPartsPage').then((m) => ({ default: m.OrderPartsPage })))
const PurchaseOrderDetailPage = lazy(() => import('@/pages/PurchaseOrderDetailPage').then((m) => ({ default: m.PurchaseOrderDetailPage })))
const PayrollWorkspacePage = lazy(() => import('@/pages/AccountingWorkspacePages').then((m) => ({ default: m.PayrollWorkspacePage })))
const CashRegisterPage = lazy(() => import('@/pages/CashRegisterPage').then((m) => ({ default: m.CashRegisterPage })))
const GeneralLedgerPage = lazy(() => import('@/pages/GeneralLedgerPage').then((m) => ({ default: m.GeneralLedgerPage })))
const VendorBillsPage = lazy(() => import('@/pages/VendorBillsPage').then((m) => ({ default: m.VendorBillsPage })))
const ProcessorTransactionsPage = lazy(() => import('@/pages/ProcessorTransactionsPage').then((m) => ({ default: m.ProcessorTransactionsPage })))
const BankMatchPage = lazy(() => import('@/pages/BankMatchPage').then((m) => ({ default: m.BankMatchPage })))
const TimeOffPage = lazy(() => import('@/pages/TimeOffPage').then((m) => ({ default: m.TimeOffPage })))

/**
 * The pages tasks send people to (the daily duties), shown inside the task
 * overlay, each behind the same permission check as its own route. Matched
 * by address here rather than by the router: the overlay sits on whatever
 * page the list is on (Tasks, a job), and the address bar stays there.
 *
 * Only pages that keep nothing in the address bar are here. One that does
 * (Dispatch, Staff, the website builder) would lose its tabs and filters, so
 * it opens as a full page, with a back button to return.
 */
const PAGES: { path: RegExp; page: (match: RegExpMatchArray) => ReactNode }[] = [
  { path: /^\/order-parts$/, page: () => <RequirePermission permissions={['inventory.order', 'inventory.edit', 'jobs.edit']}><OrderPartsPage /></RequirePermission> },
  { path: /^\/purchase-orders\/([^/]+)$/, page: (m) => <RequirePermission permission="inventory.view"><PurchaseOrderDetailPage recordId={decodeURIComponent(m[1])} /></RequirePermission> },
  { path: /^\/accounting\/payroll$/, page: () => <RequirePermission permission="revenue.view"><PayrollWorkspacePage /></RequirePermission> },
  { path: /^\/accounting\/cash-drawer$/, page: () => <RequirePermission permission="invoices.view"><CashRegisterPage /></RequirePermission> },
  { path: /^\/accounting\/ledger$/, page: () => <RequirePermission permission="revenue.view"><GeneralLedgerPage /></RequirePermission> },
  { path: /^\/accounting\/expenses\/bills$/, page: () => <RequirePermission permission="revenue.view"><VendorBillsPage /></RequirePermission> },
  { path: /^\/accounting\/card-processor$/, page: () => <RequirePermission permission="invoices.view"><ProcessorTransactionsPage /></RequirePermission> },
  { path: /^\/accounting\/bank-match\/review$/, page: () => <RequirePermission permission="revenue.view"><BankMatchPage /></RequirePermission> },
  { path: /^\/tool-shed\/time-off$/, page: () => <RequirePermission permission="staff.view"><TimeOffPage /></RequirePermission> },
]

export function TaskWorkArea({ path, onLeave }: { path: string; onLeave: () => void }) {
  const url = new URL(path, window.location.origin)
  for (const { path: pattern, page } of PAGES) {
    const match = url.search ? null : url.pathname.match(pattern)
    if (match) {
      return <Suspense fallback={<div className="p-6 text-sm text-slate-500" role="status">Loading…</div>}>{page(match)}</Suspense>
    }
  }

  return <FullPage path={path} onLeave={onLeave} />
}

/** A page that needs the whole screen: open it, and its back button returns here. */
function FullPage({ path, onLeave }: { path: string; onLeave: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="font-bold text-slate-900">Continue this task</h3>
      <p className="mt-2 text-sm text-slate-600">
        This task uses a full page. It has a back button to bring you back to your tasks.
      </p>
      <Link to={path} onClick={onLeave} className="mt-4 inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600">
        Open the page →
      </Link>
    </div>
  )
}
