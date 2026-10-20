import type { MenuPage } from './build'

/**
 * The daily-work app's pages (the ones under the top bar: customers, jobs,
 * schedule, dispatch, estimates and so on), the way the Connect menu lists
 * Connect's. A page tour takes a page's name and one-line description from
 * here when its own tour doesn't give them, and the work app's tour button
 * shows on every page listed here. A new work-app page tour whose page has
 * no area tutorial needs a row here for the button to show.
 *
 * Kept import-free (types aside) so the voice exporter can load it.
 */

export interface WorkPage extends MenuPage {
  /** The page's path, as a RegExp source. */
  route: string
  /** A path that opens it, for building its intro outside the app. */
  sample: string
}

export const WORK_PAGES: WorkPage[] = [
  { route: '^/$', sample: '/', to: '/', label: 'Dashboard', area: 'Dashboard', blurb: 'Your day at a glance: what’s on today, what needs you, and how the week is going.' },
  { route: '^/customers(/search)?/?$', sample: '/customers', to: '/customers', label: 'Customers', area: 'Customers', blurb: 'Everyone you work for, with their places, people, jobs and money in one account each.' },
  { route: '^/customers/new/?$', sample: '/customers/new', to: '/customers/new', label: 'New customer', area: 'Customers', blurb: 'Add a customer: who they are, who to reach, and where the work happens.' },
  { route: '^/customers/(?!new/?$|search/?$)[^/]+/?$', sample: '/customers/:id', to: '/customers', label: 'Customer', area: 'Customers', blurb: 'One customer’s whole account: places, people, work, money and files.' },
  { route: '^/jobs/?$', sample: '/jobs', to: '/jobs', label: 'Jobs', area: 'Jobs', blurb: 'Every job, from the first call to the last payment.' },
  { route: '^/jobs/new/?$', sample: '/jobs/new', to: '/jobs/new', label: 'New job', area: 'Jobs', blurb: 'Write up a job: the customer, the work, when it happens and who does it.' },
  { route: '^/jobs/(?!new/?$)[^/]+/?$', sample: '/jobs/:id', to: '/jobs', label: 'Job', area: 'Jobs', blurb: 'Everything about one job, from planning the visit to getting paid.' },
  { route: '^/schedule/?$', sample: '/schedule', to: '/schedule', label: 'Schedule', area: 'Schedule & dispatch', blurb: 'Your calendar of visits, by day, week or person.' },
  { route: '^/dispatch/field-review/?$', sample: '/dispatch/field-review', to: '/dispatch/field-review', label: 'Field review', area: 'Schedule & dispatch', blurb: 'What came in from the field today, to check before it’s billed.' },
  { route: '^/dispatch/route-history/?$', sample: '/dispatch/route-history', to: '/dispatch/route-history', label: 'Route history', area: 'Schedule & dispatch', blurb: 'Where your crew drove, day by day.' },
  { route: '^/dispatch(/.*)?$', sample: '/dispatch', to: '/dispatch', label: 'Dispatch', area: 'Schedule & dispatch', blurb: 'Where your crew is and what each person does next.' },
  { route: '^/estimates/?$', sample: '/estimates', to: '/estimates', label: 'Estimates', area: 'Estimates', blurb: 'Quotes you’ve sent and where each one stands.' },
  { route: '^/estimates/new/?$', sample: '/estimates/new', to: '/estimates/new', label: 'New estimate', area: 'Estimates', blurb: 'Write up a quote for a customer.' },
  { route: '^/estimates/(?!new/?$)[^/]+/?$', sample: '/estimates/:id', to: '/estimates', label: 'Estimate', area: 'Estimates', blurb: 'One quote: what’s in it, sending it, and turning it into work.' },
  { route: '^/accounting/invoices/?$', sample: '/accounting/invoices', to: '/accounting/invoices', label: 'Invoices', area: 'Getting paid', blurb: 'Every bill you’ve sent, and what’s still owed.' },
  { route: '^/invoices/[^/]+/?$', sample: '/invoices/:id', to: '/accounting/invoices', label: 'Invoice', area: 'Getting paid', blurb: 'One bill: what’s on it, sending it, and taking payment.' },
  { route: '^/maintenance-contracts/?$', sample: '/maintenance-contracts', to: '/maintenance-contracts', label: 'Service agreements', area: 'Service agreements', blurb: 'Work agreed on a schedule, and the visits it brings.' },
  { route: '^/maintenance-contracts/new/?$', sample: '/maintenance-contracts/new', to: '/maintenance-contracts/new', label: 'New service agreement', area: 'Service agreements', blurb: 'Set up work that repeats on a schedule.' },
  { route: '^/maintenance-contracts/(?!new/?$)[^/]+/?$', sample: '/maintenance-contracts/:id', to: '/maintenance-contracts', label: 'Service agreement', area: 'Service agreements', blurb: 'One agreement: what it covers, its visits and its billing.' },
  { route: '^/assets(/.*)?$', sample: '/assets', to: '/assets', label: 'Assets', area: 'Assets', blurb: 'The equipment you look after, where it is, and its history.' },
  { route: '^/tasks/?$', sample: '/tasks', to: '/tasks', label: 'Tasks', area: 'Tasks', blurb: 'To-dos for your team, on jobs, customers or nothing in particular.' },
  { route: '^/warranties/?$', sample: '/warranties', to: '/warranties', label: 'Warranties', area: 'Jobs', blurb: 'Work still under warranty, and when each one runs out.' },
  { route: '^/inbound-sub-jobs/?$', sample: '/inbound-sub-jobs', to: '/inbound-sub-jobs', label: 'Inbound sub jobs', area: 'Jobs', blurb: 'Jobs partner companies sent you to do.' },
  { route: '^/sub-reviews/?$', sample: '/sub-reviews', to: '/sub-reviews', label: 'Sub reviews', area: 'Jobs', blurb: 'Your subs’ invoices and requests to go over the cap, waiting for you.' },
  { route: '^/sub-payouts/?$', sample: '/sub-payouts', to: '/sub-payouts', label: 'Sub payouts', area: 'Jobs', blurb: 'What you owe your subs, and what you’ve paid them.' },
  { route: '^/me/keyboard-shortcuts/?$', sample: '/me/keyboard-shortcuts', to: '/me/keyboard-shortcuts', label: 'Keyboard shortcuts', area: 'Your account', blurb: 'Get around without the mouse, and set the keys up your way.' },
]

/** The work-app page at this address, as WORK_PAGES names it. */
export function workMenuPage(path: string): MenuPage | undefined {
  const page = WORK_PAGES.find((p) => new RegExp(p.route).test(path))
  return page ? { label: page.label, to: page.to, blurb: page.blurb, area: page.area } : undefined
}
