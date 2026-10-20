import type { PageTour } from '../types'

/**
 * Accounting → Customer credits (/accounting/customer-credits).
 *
 * States: credits-table data-count (0 = nothing in this filter).
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'customer-credits',
  route: '^/accounting/customer-credits/?$',
  intro: {
    page: 'Customer credits',
    purpose: 'Money you’re holding for customers: overpayments, deposits and refunds, and what’s still left to use.',
    covers: ['Finding a credit', 'The totals', 'The credit register', 'Downloads'],
  },
  steps: [
    { id: 'header', selector: t('credits-header'), title: 'Customer credits', say: 'Overpayments, down payments, credits used on invoices and refunds, all in one register.' },
    { id: 'filters', selector: t('credits-filters'), title: 'Find a credit', say: 'Search by customer, job or payment reference, pick the dates, and open, closed or all. Download a PDF or spreadsheet of what’s shown.' },
    { id: 'totals', selector: t('credits-totals'), title: 'The totals', say: 'How many credits, their original amount, what’s been used or refunded, and the balance still held.' },
    {
      id: 'table', selector: t('credits-table'), title: 'The register',
      say: 'Each credit with its customer, where it came from, and what’s left. An open credit should be used on an invoice, refunded, or kept on purpose as a deposit.',
      variants: [{ when: `${t('credits-table')}[data-count="0"]`, say: 'No customer credits in this filter. Try another date range, or All.' }],
    },
  ],
}
