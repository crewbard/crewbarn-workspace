import type { PageTour } from '../types'

/**
 * Accounting → Sync mappings (/accounting/sync-mappings).
 *
 * States: sync-form data-editing = yes | no; sync-empty when nothing
 * matches the filter.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'sync-mappings',
  route: '^/accounting/sync-mappings/?$',
  intro: {
    page: 'Sync mappings',
    purpose: 'Tell your accounting software, or your accountant’s export, which of their accounts, tax codes and items match yours.',
    covers: ['Adding a mapping', 'Exporting journals', 'Your mappings'],
  },
  steps: [
    { id: 'header', selector: t('sync-header'), title: 'Sync mappings', say: 'Each mapping pairs something in CrewBarn with its name in another system, so exports land in the right place.' },
    {
      id: 'form', selector: t('sync-form'), title: 'Add a mapping', say: 'Pick the system, what you’re mapping, and its name or code over there.',
      variants: [{ when: `${t('sync-form')}[data-editing="yes"]`, title: 'Edit mapping', say: 'You’re changing a mapping. Save it, or cancel to leave it as it was.' }],
    },
    { id: 'provider', selector: t('sync-provider'), title: 'Which system', say: 'The accounting app or export this mapping is for.' },
    { id: 'key', selector: t('sync-key'), title: 'In CrewBarn', say: 'The account, tax code, payment method or item on your side.' },
    { id: 'external', selector: t('sync-external'), title: 'Over there', say: 'Its name or code in the other system.' },
    { id: 'xero', selector: t('sync-xero'), title: 'Journal export', say: 'Download your journal entries for a date range, ready to import.' },
    { id: 'filters', selector: t('sync-filters'), title: 'Find a mapping', say: 'Filter by system or type.' },
    {
      id: 'list', selector: t('sync-list'), title: 'Your mappings', say: 'Every mapping, with Edit to change one.',
      variants: [{ when: t('sync-empty'), say: 'No mappings in this filter yet. Add the accounts you use most first.' }],
    },
  ],
}
