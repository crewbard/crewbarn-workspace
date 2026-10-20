import type { PageTour } from '../types'

/** Daily work → Warranties (/warranties). Written for you when an invoice goes out. */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'warranties',
  route: '^/warranties/?$',
  intro: {
    page: 'Warranties',
    purpose: 'Every warranty you’ve given, written for you when an invoice goes out. Check what’s covered and when it runs out.',
    covers: ['Where they come from', 'Finding coverage', 'Reading a warranty', 'Claims'],
  },
  steps: [
    { id: 'header', selector: t('warranties-header'), title: 'Written for you', say: 'A warranty is written for you when an invoice with covered items goes out. How long each item is covered is set on the item.' },
    { id: 'cards', selector: t('warranties-action-cards'), title: 'Review coverage', say: 'All, active, expired or claimed coverage, one click each.' },
    { id: 'filters', selector: t('warranties-filters'), title: 'Find coverage', say: 'Search by customer, item, equipment or invoice number, or filter by status.' },
    {
      id: 'table', selector: t('warranties-table'), title: 'Your warranties', say: 'Manufacturer, company and labour cover can each run out on a different day. Anything within a week turns red. Active ones can be claimed or voided.',
      variants: [
        { when: (page) => page.text(t('warranties-table')).includes('No warranties match'), say: 'No warranties match these filters. Clear the search or pick another status.' },
      ],
    },
  ],
}
