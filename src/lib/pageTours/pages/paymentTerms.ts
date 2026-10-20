import type { PageTour } from '../types'

/**
 * Money → Payment terms (/tool-shed/payment-terms).
 *
 * States: none yet (payment-terms-seed) or a table (payment-terms-table);
 * payment-terms-summary data-default = yes | no; payment-terms-readonly for
 * a role that can only look; the term form open (payment-term-form-*).
 */
const t = (id: string) => `[data-tour="${id}"]`
const FORM = t('payment-term-form-name')

export const PAGE_TOUR: PageTour = {
  id: 'payment-terms',
  route: '^/tool-shed/payment-terms/?$',
  intro: {
    page: 'Payment terms',
    purpose: 'When an invoice is due: on receipt, in 15 days, in 30. Pick the one new customers start with.',
    covers: ['The default', 'Your terms', 'Adding a term'],
  },
  steps: [
    { id: 'header', selector: t('payment-terms-header'), title: 'Payment terms', say: 'Payment terms set when an invoice is due. Each invoice works out its due date from its term.' },
    { id: 'readonly', selector: t('payment-terms-readonly'), title: 'View only', say: 'Your role can see the terms but not change them.' },
    {
      id: 'summary', selector: t('payment-terms-summary'), title: 'The default',
      say: 'New customers start on this term. A customer can have their own on their record.',
      variants: [
        { when: `${t('payment-terms-summary')}[data-default="no"]`, title: 'No default yet', say: 'No default is picked, so new customers start without a term. Star one below to set it.' },
      ],
    },
    {
      id: 'seed', selector: t('payment-terms-seed'), title: 'No terms yet',
      say: 'No terms yet. Add common terms puts in the usual ones in one go: due on receipt, and fourteen, thirty and sixty days.',
    },
    { id: 'table', selector: t('payment-terms-table'), title: 'Your terms', say: 'Each term with how many days until it’s due. Zero means due on receipt.' },
    { id: 'star', selector: t('payment-term-star'), title: 'The star', say: 'The filled star is the default. Pressing a star changes it straight away.' },
    { id: 'edit', selector: t('payment-term-edit'), when: `!${FORM}`, title: 'Change one', say: 'Edit renames a term or changes its days. Delete removes it.' },
    { id: 'new', selector: t('payment-terms-new'), when: `!${FORM}`, title: 'New term', say: 'New term adds one of your own, like fifteen days for a trusted account.' },
    { id: 'form-name', selector: FORM, title: 'Name', say: 'A short name your team and customers will recognise, like NET 15.' },
    { id: 'form-days', selector: t('payment-term-form-days'), title: 'Days until due', say: 'How many days the customer has. Zero means due on receipt.' },
    { id: 'form-active', selector: t('payment-term-form-active'), title: 'Active', say: 'Untick Active to stop offering a term without deleting it.' },
    { id: 'form-save', selector: t('payment-term-form-save'), title: 'Save', say: 'Save keeps it. Cancel closes without changing anything.' },
  ],
}
