import type { PageTour } from '../types'

/**
 * Accounting → Expense register (/accounting/expenses/register).
 *
 * States: register-exp-empty when nothing matches the filter.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'expense-register',
  route: '^/accounting/expenses/register/?$',
  intro: {
    page: 'Expense register',
    purpose: 'Every expense, one line each. Add what you spent, who spent it, and whether they need paying back.',
    covers: ['The totals', 'Adding an expense', 'Paying someone back', 'Finding an expense'],
  },
  steps: [
    { id: 'header', selector: t('register-exp-header'), title: 'Expense register', say: 'The full list of what your business spent.' },
    { id: 'summary', selector: t('register-exp-summary'), title: 'The totals', say: 'What’s been spent, what can be billed to customers, and what’s owed back to your team.' },
    { id: 'add', selector: t('register-exp-add'), title: 'Add an expense', say: 'The date, amount, vendor and what it was for. Adding one records it straight away.' },
    { id: 'category', selector: t('register-exp-category'), title: 'Category', say: 'The kind of spending, so it lands in the right place on your reports.' },
    { id: 'staff', selector: t('register-exp-staff'), title: 'Who spent it', say: 'The person who paid, if it was one of your team.' },
    { id: 'reimburse', selector: t('register-exp-reimburse'), title: 'Pay them back', say: 'Tick this if they paid with their own money. It goes to payroll to be paid back.' },
    { id: 'filters', selector: t('register-exp-filters'), title: 'Find an expense', say: 'Filter by dates, category, person or status, and download what’s shown.' },
    {
      id: 'rows', selector: t('register-exp-rows'), title: 'Every expense', say: 'Each expense with its receipt, category and status.',
      variants: [{ when: t('register-exp-empty'), say: 'No expenses in this filter. Try other dates, or add one above.' }],
    },
  ],
}
