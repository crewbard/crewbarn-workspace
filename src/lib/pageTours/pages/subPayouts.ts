import type { PageTour } from '../types'

/**
 * Accounting → Subcontractor payouts (/sub-payouts).
 *
 * States: sub-payouts-tiles data-outstanding = yes | no;
 * sub-payouts-invoices data-count (0 = no sub invoices yet).
 */
const t = (id: string) => `[data-tour="${id}"]`
const NONE = `${t('sub-payouts-invoices')}[data-count="0"]`

export const PAGE_TOUR: PageTour = {
  id: 'sub-payouts',
  route: '^/sub-payouts/?$',
  intro: {
    page: 'Subcontractor payouts',
    purpose: 'What you’ve paid outside techs you send work to, and what you still owe them.',
    covers: ['Paid and owed', 'By subcontractor', 'By month', 'Every invoice'],
  },
  steps: [
    { id: 'header', selector: t('sub-payouts-header'), title: 'Sub payouts', say: 'A read of what’s been paid. Approving a sub’s invoice and marking it paid happens on Sub reviews, linked here.' },
    {
      id: 'tiles', selector: t('sub-payouts-tiles'), title: 'Paid and owed', say: 'Paid all time, paid this month, and approved invoices still waiting to be paid.',
      variants: [
        { when: NONE, say: 'Nothing paid to subcontractors yet. Once you send work out and approve their invoices, the totals show here.' },
        { when: `${t('sub-payouts-tiles')}[data-outstanding="yes"]`, say: 'Paid all time, paid this month, and on the right, approved invoices you still owe. Pay those from Sub reviews.' },
      ],
    },
    { id: 'by-sub', selector: t('sub-payouts-by-sub'), title: 'By subcontractor', say: 'What each subcontractor has been paid and is owed.' },
    { id: 'by-month', selector: t('sub-payouts-by-month'), title: 'By month', say: 'Payouts month by month.' },
    {
      id: 'invoices', selector: t('sub-payouts-invoices'), title: 'Every invoice', say: 'Each sub invoice with its job, their invoice number, total and status.',
      variants: [{ when: NONE, say: 'No sub invoices yet.' }],
    },
  ],
}
