import type { PageTour } from '../types'

/**
 * Accounting → Expenses overview (/accounting/expenses): bills, expenses
 * and receipts.
 *
 * States: expenses-recent data-count (0 = none in the period).
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'expenses',
  route: '^/accounting/expenses/?$',
  intro: {
    page: 'Expenses',
    purpose: 'Where your money goes: spending by category, bills you owe, receipts waiting to be paid back, and 1099 readiness.',
    covers: ['The totals', 'Spend by category', 'Bills you owe', 'Recent expenses', 'Reimbursements and 1099s'],
  },
  steps: [
    { id: 'header', selector: t('expenses-header'), title: 'Expenses', say: 'Pick the dates for everything below. Open register is where you add and edit expenses.' },
    { id: 'register', selector: t('expenses-open-register'), title: 'Open register', say: 'Open register lists every expense, and is where you add one.' },
    { id: 'metrics', selector: t('expenses-metrics'), title: 'The totals', say: 'Money out, what you can bill back to customers, receipts waiting to be paid back, and bills still open.' },
    { id: 'categories', selector: t('expenses-categories'), title: 'Spend by category', say: 'Your biggest kinds of spending, biggest first.' },
    { id: 'ap', selector: t('expenses-ap'), title: 'Bills you owe', say: 'Open vendor bills grouped by how old they are.' },
    {
      id: 'recent', selector: t('expenses-recent'), title: 'Recent expenses', say: 'The latest expenses for the period.',
      variants: [{ when: `${t('expenses-recent')}[data-count="0"]`, say: 'No expenses in this period yet. Add them in the register, or your techs send receipts from their phones.' }],
    },
    { id: 'reimb', selector: t('expenses-reimb'), title: 'Reimbursements', say: 'Receipts your team paid for themselves, by where they’re at: waiting, approved or paid back.' },
    { id: '1099', selector: t('expenses-1099'), title: '1099 readiness', say: 'Which contractors you’ve paid enough to need a 1099, and who’s missing a W-9.' },
    { id: 'shortcuts', selector: t('expenses-shortcuts'), title: 'Shortcuts', say: 'Quick links to the register, vendor bills and more.' },
  ],
}
