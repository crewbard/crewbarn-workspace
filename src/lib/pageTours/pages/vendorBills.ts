import type { PageTour } from '../types'

/**
 * Accounting → Vendor bills (/accounting/expenses/bills).
 *
 * States: bills-empty, or bills-card with data-status (open | partial | paid | void);
 * bills-pay only on a bill with something left to pay.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'vendor-bills',
  route: '^/accounting/expenses/bills/?$',
  intro: {
    page: 'Vendor bills',
    purpose: 'Bills from your suppliers: what you owe, when it’s due, and recording what you’ve paid.',
    covers: ['What you owe', 'Adding a bill', 'Your bills', 'Recording a payment'],
  },
  steps: [
    { id: 'header', selector: t('bills-header'), title: 'Vendor bills', say: 'Track bills from suppliers here, so you always know what you owe.' },
    { id: 'summary', selector: t('bills-summary'), title: 'What you owe', say: 'Open bills, what’s overdue, and what you’ve paid.' },
    { id: 'add', selector: t('bills-add'), title: 'Add a bill', say: 'The vendor, bill number, dates and amount. Link it to a purchase order if it was for one.' },
    { id: 'filters', selector: t('bills-filters'), title: 'Filter', say: 'Filter by vendor, status or dates.' },
    {
      id: 'list', title: 'Your bills', say: '',
      variants: [
        { when: t('bills-empty'), selector: t('bills-empty'), say: 'No vendor bills in this filter.' },
        { when: t('bills-card'), selector: t('bills-card'), say: 'Each bill with its total, what’s been paid, and the balance.' },
      ],
    },
    { id: 'pay', selector: t('bills-pay'), title: 'Record a payment', say: 'Type what you paid and record it. Part payments are fine; the balance updates.' },
  ],
}
