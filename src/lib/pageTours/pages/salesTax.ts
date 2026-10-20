import type { PageTour } from '../types'

/**
 * Accounting → Sales tax (/accounting/sales-tax).
 *
 * States: sales-tax-filing data-status = filed | unfiled | short | overpaid |
 * nothing_due (shown once a report has loaded).
 */
const t = (id: string) => `[data-tour="${id}"]`
const FILING = t('sales-tax-filing')
const filing = (s: string) => `${FILING}[data-status="${s}"]`

export const PAGE_TOUR: PageTour = {
  id: 'sales-tax',
  route: '^/accounting/sales-tax/?$',
  intro: {
    page: 'Sales tax',
    purpose: 'How much sales tax you collected for a filing period, who it’s owed to, and recording that you paid it.',
    covers: ['The period', 'Filed or not', 'Recording a payment', 'The report'],
  },
  steps: [
    { id: 'header', selector: t('sales-tax-header'), title: 'Sales tax', say: 'The tax your invoices collected, split the way you file it.' },
    { id: 'range', selector: t('sales-tax-range'), title: 'The period', say: 'Pick the filing period: a month, a quarter, or your own dates.' },
    {
      id: 'filing', selector: FILING, title: 'Filed or not', say: 'Whether this period is filed and paid.',
      variants: [
        { when: filing('nothing_due'), title: 'Nothing due', say: 'No tax was collected in this period, so there’s nothing to pay.' },
        { when: filing('unfiled'), title: 'Not filed yet', say: 'Nothing has been paid for this period yet. Once you’ve filed, record the payment below.' },
        { when: filing('short'), title: 'Partly paid', say: 'Some of this period’s tax has been paid, and some is still owed.' },
        { when: filing('filed'), title: 'Filed and paid', say: 'This period is filed and paid in full.' },
        { when: filing('overpaid'), title: 'Overpaid', say: 'More was paid than this period collected. Worth checking with whoever files for you.' },
      ],
    },
    { id: 'payment', selector: t('sales-tax-payment'), title: 'Record a payment', say: 'Record what you paid and when. It goes into your books against the tax you owe.' },
    { id: 'review', selector: t('sales-tax-review'), title: 'Review report', say: 'Every invoice behind the total, with the tax on each, plus a PDF and spreadsheet.' },
    { id: 'report', selector: t('sales-tax-report'), title: 'The report', say: 'Taxable and non-taxable sales, tax collected, and the split by each tax and who you pay it to.' },
  ],
}
