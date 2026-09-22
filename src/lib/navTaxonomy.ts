import { PERM } from '@/hooks/usePermissions'

/**
 * The whole app, filed under five headings.
 *
 * The rail holds the headings; the flyout holds what's under one. That split
 * only works if the headings are things a person recognises before they know
 * the software — so they're named for what you're doing, not for which part of
 * the system owns the data. "Money" rather than "Accounting", "Comms" rather
 * than "Communications & Telephony".
 *
 * Everything the old navigation reached is reachable here. That was checked
 * rather than assumed: a reorganisation is the easiest possible way to lose a
 * feature, because nothing breaks and no test fails — the page simply stops
 * having a route to it. Anything genuinely without a home went to Setup rather
 * than being dropped.
 *
 * The groups inside a category are unlabelled when there's only one, so a short
 * list doesn't get ceremony it hasn't earned.
 */

export interface NavItem {
  to: string
  label: string
  /** Exact match only — for a root path that would otherwise match everything. */
  end?: boolean
  /** Permission required to see it. Omitted means everyone. */
  requires?: string
  /** Badge source, resolved by the rail against useNavBadges. */
  badge?: 'jobs' | 'dispatch' | 'subReviews' | 'inbound' | 'payments' | 'calls' | 'intake'
  /** Gated on a tenant feature as well as a permission. */
  feature?: 'franchise'
}

export interface NavGroup {
  /** Omitted for a category with a single undivided list. */
  title?: string
  items: NavItem[]
}

export type CategoryId = 'work' | 'comms' | 'money' | 'files' | 'setup'

export interface NavCategory {
  id: CategoryId
  label: string
  /** Icon name, drawn by the rail. */
  icon: CategoryId
  groups: NavGroup[]
}

export const NAV_CATEGORIES: NavCategory[] = [
  {
    id: 'work',
    label: 'Work',
    icon: 'work',
    groups: [
      {
        title: 'Today',
        items: [
          { to: '/', label: 'Dashboard', end: true },
          { to: '/schedule', label: 'Schedule' },
          { to: '/dispatch', label: 'Dispatch', badge: 'dispatch' },
        ],
      },
      {
        title: 'The work',
        items: [
          { to: '/jobs', label: 'Jobs', requires: PERM.JOBS_VIEW, badge: 'jobs' },
          { to: '/estimates', label: 'Estimates', requires: PERM.JOBS_VIEW },
          { to: '/tasks', label: 'Tasks', requires: PERM.TASKS_VIEW },
          { to: '/sub-reviews', label: 'Sub reviews', badge: 'subReviews' },
          { to: '/inbound-sub-jobs', label: 'Inbound sub jobs', badge: 'inbound' },
        ],
      },
      {
        title: 'Records',
        items: [
          { to: '/customers', label: 'Customers', requires: PERM.CUSTOMERS_VIEW },
          { to: '/assets', label: 'Assets', requires: PERM.ASSETS_VIEW },
          { to: '/warranties', label: 'Warranties', requires: PERM.WARRANTIES_VIEW },
          { to: '/inventory', label: 'Inventory', requires: PERM.INVENTORY_VIEW },
          { to: '/company-assets', label: 'Company assets' },
          // Was a conditional top-level tab. It only appears for a franchisor
          // tenant, which is exactly why it would have been easy to drop here
          // without anyone noticing on a tenant that never had it.
          { to: '/franchises', label: 'Franchises', requires: 'franchises.view', feature: 'franchise' },
        ],
      },
    ],
  },
  {
    id: 'comms',
    label: 'Comms',
    icon: 'comms',
    groups: [
      {
        items: [
          { to: '/communications', label: 'Messages' },
          { to: '/calls', label: 'Calls', requires: PERM.CALLS_VIEW, badge: 'calls' },
          { to: '/intake', label: 'Intake', badge: 'intake' },
          { to: '/email-templates', label: 'Email templates', requires: PERM.TEMPLATES_VIEW },
          { to: '/feedback', label: 'Feedback' },
        ],
      },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    icon: 'money',
    groups: [
      {
        title: 'Every day',
        items: [
          { to: '/accounting', label: 'Money desk', end: true, requires: PERM.INVOICES_VIEW, badge: 'payments' },
          { to: '/accounting/cash-drawer', label: 'Cash register', requires: PERM.INVOICES_VIEW },
          { to: '/accounting/invoices', label: 'Invoices', requires: PERM.INVOICES_VIEW },
        ],
      },
      {
        title: 'Paying out',
        items: [
          { to: '/purchase-orders', label: 'Purchase orders', requires: PERM.INVENTORY_VIEW },
          { to: '/vendors', label: 'Vendors', requires: PERM.REVENUE_VIEW },
          { to: '/accounting/expenses', label: 'Expenses', requires: PERM.REVENUE_VIEW },
          { to: '/accounting/payroll', label: 'Payroll', requires: PERM.REVENUE_VIEW },
          { to: '/sub-payouts', label: 'Sub payouts' },
        ],
      },
      {
        title: 'Closing the books',
        items: [
          { to: '/accounting/sales-tax', label: 'Sales tax', requires: PERM.INVOICES_VIEW },
          { to: '/accounting/reports', label: 'Reports', requires: PERM.REVENUE_VIEW },
          { to: '/accounting/bank-match', label: 'Bank match', requires: PERM.REVENUE_VIEW },
          { to: '/accounting/card-processor', label: 'Card processor', requires: PERM.INVOICES_VIEW },
          { to: '/accounting/ledger', label: 'Ledger', requires: PERM.REVENUE_VIEW },
        ],
      },
    ],
  },
  {
    id: 'files',
    label: 'Files',
    icon: 'files',
    groups: [
      {
        items: [
          { to: '/tool-shed/company-files', label: 'Company files' },
          { to: '/custom-documents', label: 'Custom documents', requires: PERM.TEMPLATES_VIEW },
          { to: '/tool-shed/import', label: 'Import', requires: PERM.SETTINGS_VIEW },
          { to: '/tool-shed/data-export', label: 'Data export', requires: PERM.SETTINGS_VIEW },
        ],
      },
    ],
  },
  {
    id: 'setup',
    label: 'Setup',
    icon: 'setup',
    groups: [
      {
        title: 'What you sell',
        items: [
          { to: '/catalog/services', label: 'Services', requires: PERM.CATALOG_VIEW },
          { to: '/catalog/products', label: 'Products', requires: PERM.CATALOG_VIEW },
          { to: '/tool-shed/pricing', label: 'Pricing', requires: PERM.SETTINGS_VIEW },
          { to: '/catalog/tax-classes', label: 'Tax classes', requires: PERM.CATALOG_VIEW },
        ],
      },
      {
        title: 'Your people',
        items: [
          { to: '/tool-shed/staff', label: 'Staff', requires: PERM.STAFF_VIEW },
          { to: '/tool-shed/hiring', label: 'Hiring', requires: PERM.STAFF_VIEW },
          { to: '/tool-shed/roles', label: 'Roles', requires: PERM.SETTINGS_VIEW },
          { to: '/tool-shed/subcontractors', label: 'Subcontractors', requires: PERM.STAFF_VIEW },
          { to: '/tool-shed/time-off', label: 'Time off', requires: PERM.STAFF_VIEW },
        ],
      },
      {
        title: 'Everything else',
        items: [
          // The Tool Shed keeps its own index — forty-odd settings pages do not
          // belong flattened into a flyout, and it is already organised.
          { to: '/tool-shed', label: 'All settings', end: true, requires: PERM.SETTINGS_VIEW },
          { to: '/tool-shed/company-info', label: 'Company info', requires: PERM.SETTINGS_VIEW },
          { to: '/tool-shed/integrations', label: 'Integrations', requires: PERM.SETTINGS_VIEW },
          { to: '/me/account', label: 'My account' },
        ],
      },
    ],
  },
]

/** Which category owns a path — longest prefix wins, so /accounting/reports
 *  lands on Money rather than whichever category listed a shorter match. */
export function categoryForPath(pathname: string): CategoryId {
  let best: { id: CategoryId; len: number } | null = null
  for (const cat of NAV_CATEGORIES) {
    for (const group of cat.groups) {
      for (const item of group.items) {
        const hit = item.end
          ? pathname === item.to
          : pathname === item.to || pathname.startsWith(item.to.replace(/\/$/, '') + '/')
        if (hit && (!best || item.to.length > best.len)) {
          best = { id: cat.id, len: item.to.length }
        }
      }
    }
  }
  return best?.id ?? 'work'
}
