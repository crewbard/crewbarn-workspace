import type { PageTour } from '../types'

/**
 * Daily work → Customers (/customers).
 *
 * Follows what is on the page: rows or cards or A–Z files, a list with
 * customers in it or an empty one (nothing yet, or nothing matches the
 * search), and more than one page of customers.
 *
 * The page marks:
 *   customers-empty   data-empty-reason = none | filtered
 *   customers-view-switch buttons carry aria-pressed for the view in use
 *
 * The Last contact and Sort boxes and the Quick Peek links have no marker of
 * their own yet, so they're found by their choices and labels.
 */
const t = (id: string) => `[data-tour="${id}"]`
const TOOLBAR = t('customers-search')
const VIEW = (label: string) => (page: { find: (s: string) => HTMLElement | null }) =>
  Array.from(page.find(t('customers-view-switch'))?.querySelectorAll('button[aria-pressed="true"]') ?? [])
    .some((b) => b.textContent?.trim() === label)

export const PAGE_TOUR: PageTour = {
  id: 'customers',
  route: '^/customers(/search)?/?$',
  intro: {
    page: 'Customers',
    purpose: 'Everyone you work for, in one list. Open a customer to see their places, people, jobs and money in one account.',
    covers: ['Adding a customer', 'Residential, commercial and government', 'Search, last contact and sorting', 'Rows, cards or files', 'Quick Peek', 'Opening an account'],
  },
  // The intro film, before the walk-through (see ../film.ts).
  film: [
    { id: 'name', say: 'This is Customers, everyone you work for, in one list.', visual: { kind: 'title', title: 'Customers' } },
    {
      id: 'list', title: 'Your customers', say: 'Homes, businesses and government buildings sit side by side, each marked so you can tell them apart.',
      visual: { kind: 'list', heading: 'Customers', rows: [
        { title: 'Rivera family', meta: '12 Oak Street', chip: 'Residential', tone: 'blue' },
        { title: 'Oakwood Dental', meta: 'Two places', chip: 'Commercial', tone: 'purple' },
        { title: 'City Library', meta: 'One place', chip: 'Government', tone: 'green' },
        { title: 'Harbor View Apartments', meta: 'Three places', chip: 'Commercial', tone: 'purple' },
      ] },
    },
    {
      id: 'search', title: 'Search', say: 'Type a name, a phone number or an address to find someone fast.',
      visual: { kind: 'list', search: 'Rivera', rows: [{ title: 'Rivera family', meta: '(555) 014-7730 · 12 Oak Street', chip: 'Residential', tone: 'blue' }] },
    },
    { id: 'account', title: 'One account each', say: 'Open a customer to see their whole account: places, people, jobs and money.', visual: { kind: 'account' } },
    { id: 'go', say: 'Let’s walk through the list.', visual: { kind: 'go' } },
  ],
  steps: [
    {
      id: 'header', selector: t('customers-header'),
      title: 'Your customers',
      say: 'This is everyone you work for. The count under the name is how many customers you have.',
    },
    {
      id: 'new', selector: t('customers-new'),
      title: 'New customer',
      say: 'New customer adds someone: who they are, who to call, and where the work happens.',
    },
    {
      id: 'types', selector: t('customers-type-tabs'),
      title: 'Customer types',
      say: 'These tabs sort your list into residential, commercial and government, with a count on each. All shows everyone.',
    },
    {
      id: 'search', selector: t('customers-search'),
      title: 'Search',
      say: 'Search by name, email or phone. The list narrows as you type.',
    },
    {
      id: 'last-contact', selector: `${TOOLBAR} select:has(option[value="never"])`,
      title: 'Last contact',
      say: 'Last contact shows the customers on this page you’ve talked to in the past 30 days, or the ones you’ve never contacted.',
    },
    {
      id: 'sort', selector: `${TOOLBAR} select:has(option[value="last-contact"])`,
      title: 'Sort',
      say: 'Sort the customers on this page by name, A to Z or Z to A, or by who you talked to most recently.',
    },
    {
      id: 'views', selector: t('customers-view-switch'), title: 'Rows, cards or files', say: '',
      variants: [
        {
          when: VIEW('Files'),
          title: 'Files view',
          say: 'You’re in Files: customers sit in A to Z folders, like a filing cabinet. Rows and Cards are here too.',
        },
        {
          when: VIEW('Cards'),
          title: 'Cards view',
          say: 'You’re looking at cards, one per customer. Switch to Files for A to Z folders, or Rows for a tight list.',
        },
        {
          when: () => true,
          title: 'Rows, cards or files',
          say: 'Pick how the list looks: rows, cards, or A to Z folders. CrewBarn remembers your pick.',
        },
      ],
    },
    {
      id: 'folder-layout', selector: t('customers-folder-layout'),
      title: 'Folder layout',
      say: 'Cabinet, Tree or Accordion: how the folders look in Files.',
    },
    {
      id: 'empty', selector: t('customers-empty'), title: 'Nothing here yet', say: '',
      variants: [
        {
          when: `${t('customers-empty')}[data-empty-reason="filtered"]`,
          title: 'Nothing matches',
          say: 'No customer matches that search or tab. Clear the search, or pick All, to see everyone again.',
        },
        {
          when: `${t('customers-empty')}[data-empty-reason="none"]`,
          title: 'No customers yet',
          say: 'No customers yet. Add your first one with New customer, or bring a list in from Connect.',
        },
      ],
    },
    {
      id: 'list', selector: t('customers-list'), when: t('customers-row'),
      title: 'The list',
      say: 'Each customer shows how to reach them and when you last talked. The colored strip is the quickest read: red is a warning, amber is a VIP, teal is a service agreement or a regular.',
    },
    {
      id: 'row', selector: t('customers-row'),
      title: 'Open an account',
      say: 'Click a customer to open their account: places, people, jobs, estimates, invoices and files, all in one spot.',
    },
    {
      id: 'peek', selector: '[aria-label^="Quick Peek at"]',
      title: 'Quick Peek',
      say: 'Quick Peek shows a customer’s details in a window, without leaving the list. Open account takes you all the way in.',
    },
    {
      id: 'pager', selector: t('customers-pager'),
      title: 'More pages',
      say: 'Long lists come in pages. Move between them down here.',
    },
  ],
}
