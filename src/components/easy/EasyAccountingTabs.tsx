import { NavLink, useLocation } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { useModuleVisibility } from '@/hooks/useModuleVisibility'

const tabs = [
  ['Money desk', '/accounting', 'invoices.view'],
  ['Invoices', '/accounting/invoices', 'invoices.view'],
  ['Bank match', '/accounting/bank-match', 'revenue.view'],
  ['Expenses', '/accounting/expenses', 'revenue.view'],
  ['Bills', '/accounting/expenses/bills', 'revenue.view'],
  ['Payroll', '/accounting/payroll', 'revenue.view'],
  ['Cash drawer', '/accounting/cash-drawer', 'invoices.view'],
  ['Cards', '/accounting/card-processor', 'invoices.view'],
  ['Credits', '/accounting/customer-credits', 'invoices.view'],
  ['Sales tax', '/accounting/sales-tax', 'revenue.view'],
  ['Ledger', '/accounting/ledger', 'revenue.view'],
  ['Reports', '/accounting/reports', 'revenue.view'],
  ['Sync mappings', '/accounting/sync-mappings', 'revenue.view'],
] as const

export function EasyAccountingTabs() {
  const { pathname } = useLocation()
  const { has } = usePermissions()
  const { isRouteVisible } = useModuleVisibility()
  if (!(pathname === '/accounting' || pathname.startsWith('/accounting/') || pathname.startsWith('/invoices/'))) return null
  return (
    <nav data-easy-section-tabs aria-label="Accounting sections" className="border-b border-slate-200 bg-white px-3 sm:px-6">
      <div className="flex flex-wrap gap-x-1">
        {tabs.filter(([, to, permission]) => has(permission) && isRouteVisible(to)).map(([label, to]) => (
          <NavLink key={to} to={to} end={to === '/accounting' || to === '/accounting/expenses'}
            className={({ isActive }) => `border-b-2 px-3 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 ${isActive ? 'border-amber-500 text-slate-950' : 'border-transparent text-slate-600 hover:border-amber-300 hover:text-slate-950'}`}>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
