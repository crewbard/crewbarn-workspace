import { Link } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'

const groups = [
  { title: 'Collect money', links: [
    { label: 'Invoices', to: '/accounting/invoices', permission: 'invoices.view' },
    { label: 'Cash drawer', to: '/accounting/cash-drawer', permission: 'invoices.view' },
    { label: 'Customer credits', to: '/accounting/customer-credits', permission: 'invoices.view' },
    { label: 'Card transactions', to: '/accounting/card-processor', permission: 'invoices.view' },
  ] },
  { title: 'Spending & payroll', links: [
    { label: 'Expenses overview', to: '/accounting/expenses', permission: 'revenue.view' },
    { label: 'Expense register', to: '/accounting/expenses/register', permission: 'revenue.view' },
    { label: 'Vendor bills', to: '/accounting/expenses/bills', permission: 'revenue.view' },
    { label: 'Payroll', to: '/accounting/payroll', permission: 'revenue.view' },
    { label: 'Payroll profiles', to: '/accounting/payroll/profiles', permission: 'staff.view' },
    { label: 'Inventory cost', to: '/accounting/inventory-cost', permission: 'inventory.view' },
    { label: 'Purchase orders', to: '/purchase-orders', permission: 'inventory.view' },
    { label: 'Vendors', to: '/vendors', permission: 'inventory.view' },
    { label: 'Subcontractor payouts', to: '/sub-payouts', permission: 'jobs.view' },
  ] },
  { title: 'Reconcile & report', links: [
    { label: 'Financial overview', to: '/accounting/overview', permission: 'invoices.view' },
    { label: 'Bank match overview', to: '/accounting/bank-match', permission: 'revenue.view' },
    { label: 'Review bank matches', to: '/accounting/bank-match/review', permission: 'revenue.view' },
    { label: 'General ledger', to: '/accounting/ledger', permission: 'revenue.view' },
    { label: 'Sales tax', to: '/accounting/sales-tax', permission: 'revenue.view' },
    { label: 'Accounting sync mappings', to: '/accounting/sync-mappings', permission: 'revenue.view' },
    { label: 'Reports', to: '/accounting/reports', permission: 'revenue.view' },
    { label: 'Browse all reports', to: '/accounting/reports/browse', permission: 'revenue.view' },
  ] },
]

/** Navigation stays available regardless of the money desk's queue state. */
export function AccountingTools() {
  const { has } = usePermissions()
  return (
    <nav aria-label="Accounting tools" className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-slate-900">Accounting tools</h2>
      <p className="mt-1 text-sm text-slate-500">Open your books, manage payments, or review reports. Your money desk is below.</p>
      <div className="mt-4 grid gap-5 md:grid-cols-3">
        {groups.map(group => {
          const links = group.links.filter(link => has(link.permission))
          if (!links.length) return null
          return (
            <section key={group.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.title}</h3>
              <div className="flex flex-wrap gap-2">
                {links.map(link => (
                  <Link key={link.to} to={link.to} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-emerald-900 hover:border-emerald-600 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </nav>
  )
}
