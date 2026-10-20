import type { PageTour } from '../types'

/**
 * Catalog & inventory → Service catalog (/catalog/services).
 *
 * States the steps follow:
 *   - list with rows (svc-table) or empty (svc-empty), and whether a search
 *     is typed in;
 *   - New Service and Edit only show for people who can change the catalog;
 *   - the service form, when it's open: a new one (no Delete) or a saved one
 *     (svc-delete). The form steps only play while it is open.
 */
const t = (id: string) => `[data-tour="${id}"]`
const searching = (page: { find: (s: string) => HTMLElement | null }) =>
  !!((page.find(`${t('svc-search')} input`) as HTMLInputElement | null)?.value ?? '').trim()
const FORM = t('svc-form')
const EDITING = t('svc-delete')

export const PAGE_TOUR: PageTour = {
  id: 'service-catalog',
  route: '^/catalog/services/?$',
  intro: {
    page: 'Service catalog',
    purpose: 'The work you charge for, like labor, trip charges and inspections. Pick these onto estimates, jobs and invoices and the price fills itself in.',
    covers: ['Finding a service', 'Your list', 'Adding one', 'Price, cost and tax', 'Warranty and picture'],
  },
  steps: [
    {
      id: 'header', selector: t('svc-header'),
      title: 'Service catalog',
      say: 'This is your service catalog: the work you charge for. Parts and materials live in the product catalog.',
    },
    {
      id: 'search', selector: t('svc-search'),
      title: 'Search',
      say: 'Search finds a service by name, description or part number. Press the slash key anywhere on the page to jump here.',
    },
    {
      id: 'list', title: 'Your services', say: '',
      variants: [
        {
          when: (page) => !!page.find(t('svc-empty')) && searching(page), selector: t('svc-empty'),
          say: 'Nothing matches that search. Clear the search box to see every service again.',
        },
        {
          when: t('svc-empty'), selector: t('svc-empty'),
          title: 'No services yet',
          say: 'You don’t have any services yet. Add the jobs you do most first, so they’re one tap away on an estimate.',
        },
        {
          when: t('svc-table'), selector: t('svc-table'),
          say: 'Each row shows the price, the tax it carries, the unit it’s sold by, and whether it’s active.',
        },
      ],
    },
    {
      id: 'count', selector: t('svc-count'), when: t('svc-table'),
      title: 'How many',
      say: 'This line counts how many services you have, or how many match your search.',
    },
    {
      id: 'edit', selector: t('svc-row-edit'), when: `!${FORM}`,
      title: 'Change one',
      say: 'Edit opens a service to change it. A new price is used on new lines. Lines already on estimates and invoices keep theirs.',
    },
    {
      id: 'new', when: `!${FORM}`, title: 'Add a service', selector: t('svc-new'),
      say: 'New Service opens a short form. Only the name is required. Then a price, what it costs you, and the tax it carries.',
      variants: [
        {
          when: `!${t('svc-new')}`,
          say: 'Your role can look at the catalog but not change it. Ask an owner or manager to add or change a service.',
        },
      ],
    },

    // ── The form, while it's open ──
    {
      id: 'form', selector: FORM, when: FORM,
      title: 'New service', say: 'This is a new service. Only the name is required. Nothing is saved until you press Create service.',
      variants: [
        { when: EDITING, title: 'A saved service', say: 'This is a saved service, filled in with what you have. Nothing changes until you press Save changes.' },
      ],
    },
    { id: 'name', selector: t('svc-f-name'), title: 'Name', say: 'The name is what your team searches for, and what shows on the line.' },
    { id: 'category', selector: t('svc-f-category'), title: 'Category', say: 'Category groups your services, like Repairs or Maintenance. Add new makes one right here.' },
    { id: 'description', selector: t('svc-f-description'), title: 'Customer description', say: 'The customer description is what your customer reads on invoices.' },
    { id: 'aliases', selector: t('svc-f-aliases'), title: 'Other names', say: 'Search aliases are other names people use for the same thing. Only your team sees them.' },
    { id: 'unit', selector: t('svc-f-unit'), title: 'Unit and quantity', say: 'The unit says how it’s sold, like hour, visit or mile. Untick Active to retire a service and keep its history.' },
    { id: 'pricing', selector: t('svc-f-pricing'), title: 'Price, cost and tax', say: 'What the customer pays, what it costs you, and how it’s taxed. Customers never see your cost; it’s how your margin is worked out.' },
    { id: 'warranty', selector: t('svc-f-warranty'), title: 'Labor warranty', say: 'Give this service its own labor warranty, or leave it blank to follow your company rule.' },
    {
      id: 'image', selector: t('svc-f-image'), title: 'Picture',
      say: 'A picture can be added once the service is saved.',
      variants: [{ when: EDITING, say: 'Add or change this service’s picture here.' }],
    },
    {
      id: 'delete', selector: t('svc-delete'),
      title: 'Delete',
      say: 'Delete removes the service after you confirm. To stop using one but keep its history, untick Active instead.',
    },
    {
      id: 'save', selector: t('svc-save'), when: FORM,
      title: 'Create service', say: 'Create service saves it, ready to pick on estimates, jobs and invoices. Cancel leaves without making anything.',
      variants: [
        { when: EDITING, title: 'Save changes', say: 'Save changes lights up once you’ve changed something. Cancel closes it untouched.' },
      ],
    },
  ],
}
