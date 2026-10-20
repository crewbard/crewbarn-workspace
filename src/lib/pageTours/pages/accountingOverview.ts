import type { PageTour } from '../types'

/**
 * Accounting → Financial overview (/accounting/overview): charts and totals.
 *
 * States: accounting-attention data-count (0 = caught up).
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'accounting-overview',
  route: '^/accounting/overview/?$',
  intro: {
    page: 'Financial overview',
    purpose: 'Your money at a glance: what came in and went out, what you’re owed, and what needs attention, for the period you pick.',
    covers: ['The period', 'Headline numbers', 'Needs attention', 'Where to go next', 'Charts and grids'],
  },
  steps: [
    { id: 'root', selector: t('accounting-root'), title: 'Financial overview', say: 'The read-only view of your money. The day-to-day to-do list is the Money desk.' },
    { id: 'period', selector: t('accounting-period'), title: 'The period', say: 'Pick the stretch of time everything below covers.' },
    { id: 'metrics', selector: t('accounting-metrics'), title: 'Headline numbers', say: 'Money in, money out and net cash for the period, plus what customers owe you and how much of it is overdue.' },
    {
      id: 'attention', selector: t('accounting-attention'), title: 'Needs attention',
      say: 'Overdue invoices, cash to check in, drafts to send and missing tax forms, each with a button to go sort it.',
      variants: [{ when: `${t('accounting-attention')}[data-count="0"]`, say: 'Everything is caught up for this period. Nothing to chase.' }],
    },
    { id: 'workflows', selector: t('accounting-workflows'), title: 'What do you need to do?', say: 'Shortcuts grouped by job: collecting money, spending, team pay, and closing the books.' },
    { id: 'charts', selector: t('accounting-charts'), title: 'Charts', say: 'Cash flow and money owed over time. Each panel opens the full report behind it.' },
    { id: 'panels', selector: t('accounting-panels'), title: 'Panels', say: 'Your cash drawer, invoice ages, payment methods and invoice status, each linking to where you act on it.' },
    { id: 'panels-2', selector: t('accounting-panels-2'), title: 'More panels', say: 'Customer credits and other balances worth keeping an eye on.' },
    { id: 'grids', selector: t('accounting-grids'), title: 'The numbers in rows', say: 'The same figures as tables, for when you want the exact amounts.' },
  ],
}
