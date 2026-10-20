import type { PageTour } from '../types'

/**
 * Customers & sites, the area page (/connect/customers).
 *
 * Groups a person can't open are left off the page, and the filter box can
 * hide the rest; steps for a missing group are skipped.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'area-customers',
  route: '^/connect/customers/?$',
  intro: {
    page: 'Customers & sites',
    purpose: 'How you sort your customers, the places and areas you work, the equipment you look after, and your service agreements.',
    covers: ['Jumping and searching', 'Sorting customers', 'Where you work', 'Their equipment', 'Agreements'],
  },
  steps: [
    {
      id: 'header', selector: t('connect-area-header'),
      title: 'Customers & sites',
      say: 'This area is about the people you work for and the places you go. The number on the right is how many settings are in it.',
    },
    {
      id: 'filter', selector: t('connect-area-filter'), title: 'Jump or search',
      say: 'The chips jump to a group, and the box finds a setting in this area by name.',
      variants: [
        { when: t('connect-area-nomatch'), say: 'Nothing matches what’s in the search box. Press Clear search to see every setting again.' },
      ],
    },
    {
      id: 'customers', selector: t('connect-group-customers'),
      title: 'Customers',
      say: 'Customers is how you sort and label the people you work for: customer types like home or business, and the coloured tags you put on them.',
    },
    {
      id: 'where', selector: t('connect-group-where-you-work'),
      title: 'Where you work',
      say: 'Where you work covers your service locations, with gate codes and access notes, and the territories your crew covers.',
    },
    {
      id: 'equipment', selector: t('connect-group-their-equipment'),
      title: 'Their equipment',
      say: 'Their equipment is for the things you install and look after for customers: the kinds you track, and who’s asked to see a record.',
    },
    {
      id: 'agreements', selector: t('connect-group-agreements'),
      title: 'Agreements',
      say: 'Agreements is your recurring service: the agreement customers sign, and how its invoices are handled.',
    },
  ],
}
