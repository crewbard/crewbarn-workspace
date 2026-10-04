export type EasySectionLink = { label: string; to: string; permission: string }
export type EasySection = { label: string; prefixes: string[]; links: EasySectionLink[] }

// Existing destinations only. These links never perform a record mutation.
export const easySections: EasySection[] = [
  {
    label: 'Jobs', prefixes: ['/jobs', '/sub-jobs', '/inbound-sub-jobs', '/sub-payouts', '/sub-reviews', '/warranties', '/maintenance-contracts'],
    links: [
      { label: 'All jobs', to: '/jobs', permission: 'jobs.view' },
      { label: 'New job', to: '/jobs/new', permission: 'jobs.edit' },
      // Work agreed on a schedule is still work, and the visits it
      // generates land on this same board. The prefix above is what gives
      // the contracts pages a nav at all in Easy mode.
      { label: 'Service agreements', to: '/maintenance-contracts', permission: 'contracts.view' },
      { label: 'New service agreement', to: '/maintenance-contracts/new', permission: 'contracts.edit' },
      { label: 'Incoming sub jobs', to: '/inbound-sub-jobs', permission: 'jobs.view' },
      { label: 'Sub payouts', to: '/sub-payouts', permission: 'jobs.view' },
      { label: 'Partner reviews', to: '/sub-reviews', permission: 'jobs.view' },
      { label: 'Warranties', to: '/warranties', permission: 'warranties.view' },
    ],
  },
  {
    label: 'Customers', prefixes: ['/customers', '/assets', '/company-assets', '/asset-access-requests', '/asset-types', '/custom-documents'],
    links: [
      { label: 'Customers', to: '/customers', permission: 'customers.view' },
      { label: 'New customer', to: '/customers/new', permission: 'customers.edit' },
      { label: 'Equipment & assets', to: '/assets', permission: 'assets.view' },
      { label: 'Company tools', to: '/company-assets', permission: 'assets.view' },
      { label: 'Asset access', to: '/asset-access-requests', permission: 'assets.view' },
      { label: 'Asset types', to: '/asset-types', permission: 'assets.view' },
      { label: 'Forms & documents', to: '/custom-documents', permission: 'templates.view' },
    ],
  },
  {
    label: 'Parts', prefixes: ['/inventory', '/purchase-orders', '/vendors'],
    links: [
      { label: 'Parts', to: '/inventory', permission: 'inventory.view' },
      { label: 'Purchase orders', to: '/purchase-orders', permission: 'inventory.view' },
      { label: 'Needs ordering', to: '/purchase-orders/needs-ordered', permission: 'inventory.view' },
      { label: 'Count stock', to: '/inventory/reconciliations', permission: 'inventory.view' },
      { label: 'Stock movements', to: '/inventory/movements', permission: 'inventory.view' },
      { label: 'Stock units', to: '/inventory/units', permission: 'inventory.view' },
      { label: 'Vendors', to: '/vendors', permission: 'inventory.view' },
    ],
  },
  {
    label: 'Dispatch', prefixes: ['/dispatch'],
    links: [
      { label: 'Live map', to: '/dispatch', permission: 'jobs.view' },
      { label: 'Field review', to: '/dispatch/field-review', permission: 'jobs.view' },
      { label: 'Route history', to: '/dispatch/route-history', permission: 'jobs.view' },
    ],
  },
  {
    label: 'Inbox', prefixes: ['/communications', '/calls', '/intake'],
    links: [
      { label: 'Messages', to: '/communications', permission: 'customers.view' },
      { label: 'Calls', to: '/calls', permission: 'calls.view' },
      { label: 'Intake queue', to: '/intake', permission: 'customers.view' },
    ],
  },
  {
    label: 'Estimates', prefixes: ['/estimates'],
    links: [
      { label: 'All estimates', to: '/estimates', permission: 'jobs.view' },
      { label: 'New estimate', to: '/estimates/new', permission: 'jobs.edit' },
      { label: 'New service agreement', to: '/maintenance-contracts/new', permission: 'contracts.edit' },
    ],
  },
]

export function matchesSectionPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

export function findEasySection(pathname: string) {
  return easySections.find(section => section.prefixes.some(prefix => matchesSectionPath(pathname, prefix)))
}

export function activeEasyLink(pathname: string, links: EasySectionLink[]) {
  return links.filter(link => matchesSectionPath(pathname, link.to))
    .sort((a, b) => b.to.length - a.to.length)[0]?.to
}
