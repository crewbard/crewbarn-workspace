import type { PageTour } from '../types'

/**
 * Accounting → Payroll (/accounting/payroll): Payroll & tech profit.
 *
 * States the page marks:
 *   payroll-unbilled         finished jobs in the period that were never invoiced
 *   payroll-timeoff-warning  leave that needs a look before posting
 *   payroll-preview / -closeouts / -reimbursements  data-count
 */
const t = (id: string) => `[data-tour="${id}"]`
const none = (id: string) => `${t(id)}[data-count="0"]`

export const PAGE_TOUR: PageTour = {
  id: 'payroll',
  route: '^/accounting/payroll/?$',
  intro: {
    page: 'Payroll',
    purpose: 'What your team earned this period, checked before you post it, plus each tech’s profit, time off and reimbursements.',
    covers: ['The period and totals', 'Checking before posting', 'Time off', 'Tech profit', 'Reimbursements', 'Posted payroll'],
  },
  steps: [
    { id: 'header', selector: t('payroll-header'), title: 'Payroll', say: 'Work out pay for a period, check it, then post it to your books. Nothing is paid out from here.' },
    { id: 'actions', selector: t('payroll-actions'), title: 'Pay profiles and downloads', say: 'Pay profiles is where each person’s rate and commission are set. The rest download the worksheet and tech reports, or post the period.' },
    { id: 'jump', selector: t('payroll-jump'), title: 'Jump to a part', say: 'Jump straight to any part of the page.' },
    { id: 'timeoff', selector: t('payroll-timeoff-warning'), title: 'Check time off first', say: 'Some leave in this period needs a look before you post payroll.' },
    { id: 'metrics', selector: t('payroll-metrics'), title: 'The totals', say: 'Techs, jobs, revenue, what payroll costs, leave earned, expenses, and the margin left over.' },
    { id: 'filters', selector: t('payroll-filters'), title: 'Period and people', say: 'Pick the dates, and search for one tech if you like.' },
    {
      id: 'preview', selector: t('payroll-preview'), title: 'Check before posting',
      say: 'What this period would pay each person, worked out the same way the posted run will. Looking changes nothing.',
      variants: [{ when: none('payroll-preview'), say: 'Nobody has pay for this period yet. Check the dates, or the pay profiles.' }],
    },
    { id: 'unbilled', selector: t('payroll-unbilled'), title: 'Not billed yet', say: 'Jobs finished in this period that were never invoiced, so they aren’t in anyone’s pay. You can still post.' },
    { id: 'leave', selector: t('payroll-leave'), title: 'Time off', say: 'Each person’s paid time off for the period.' },
    {
      id: 'closeouts', selector: t('payroll-closeouts'), title: 'Posted payroll',
      say: 'Every posted period, locked, with its detail and downloads.',
      variants: [{ when: none('payroll-closeouts'), say: 'No payroll posted yet. Post payroll closeout locks a period once you’ve checked it.' }],
    },
    { id: 'profit', selector: t('payroll-profit'), title: 'Tech profit', say: 'Revenue, labor and margin for each tech, so you can see who’s making you money.' },
    {
      id: 'reimbursements', selector: t('payroll-reimbursements'), title: 'Reimbursements',
      say: 'Money owed back to your team for things they bought. Approve them, then close them out with payroll.',
      variants: [{ when: none('payroll-reimbursements'), say: 'No reimbursements for this period.' }],
    },
    { id: 'shortcuts', selector: t('payroll-shortcuts'), title: 'Shortcuts', say: 'Quick links to related pages.' },
  ],
}
