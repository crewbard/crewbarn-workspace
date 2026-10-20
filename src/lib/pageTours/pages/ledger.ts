import type { PageTour } from '../types'

/**
 * Accounting → General ledger (/accounting/ledger).
 *
 * States: ledger-posting-audit data-missing = yes | no.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'ledger',
  route: '^/accounting/ledger/?$',
  intro: {
    page: 'General ledger',
    purpose: 'Your books: income statement, balance sheet, every journal entry, and the tools a bookkeeper uses to adjust and close them.',
    covers: ['Dates and totals', 'Posting check', 'Statements', 'Journal entries', 'Adjustments and closing', 'Chart of accounts'],
  },
  steps: [
    { id: 'header', selector: t('ledger-header'), title: 'General ledger', say: 'Everything CrewBarn records lands here as proper bookkeeping. Most of it posts itself.' },
    { id: 'filters', selector: t('ledger-filters'), title: 'Dates and accounts', say: 'Set the dates, and narrow to one account if you like. Everything below follows.' },
    { id: 'metrics', selector: t('ledger-metrics'), title: 'The totals', say: 'Revenue, expenses, profit, and what you own and owe, for the period.' },
    {
      id: 'audit', selector: t('ledger-posting-audit'), title: 'Posting check',
      say: 'It checks that every invoice, payment, expense, bill and payroll run made it into the books.',
      variants: [
        { when: `${t('ledger-posting-audit')}[data-missing="no"]`, say: 'Everything in this period has made it into the books. Nothing is missing.' },
        { when: `${t('ledger-posting-audit')}[data-missing="yes"]`, say: 'Some records in this period haven’t made it into the books. They’re listed here to fix.' },
      ],
    },
    { id: 'statements', selector: t('ledger-statements'), title: 'Statements', say: 'Your income statement and balance sheet for the period.' },
    { id: 'trial', selector: t('ledger-trial'), title: 'Trial balance', say: 'Every account’s balance. Press one to see its detail.' },
    { id: 'detail', selector: t('ledger-detail'), title: 'Account detail', say: 'Every line that hit an account, with where it came from.' },
    { id: 'journals', selector: t('ledger-journals'), title: 'Journal entries', say: 'Each entry, in date order.' },
    { id: 'cashflow', selector: t('ledger-cashflow'), title: 'Cash flow', say: 'Where cash came from and went.' },
    { id: 'manual', selector: t('ledger-manual-journal'), title: 'Manual entry', say: 'For opening balances, corrections and bookkeeper adjustments.' },
    { id: 'owner-draw', selector: t('ledger-owner-draw'), title: 'Owner draw', say: 'Record money paid out to an owner, without building the entry by hand.' },
    { id: 'sales-tax', selector: t('ledger-sales-tax'), title: 'Sales tax payment', say: 'Record a sales tax payment you sent in.' },
    { id: 'year-end', selector: t('ledger-year-end'), title: 'Year-end close', say: 'Moves the year’s income and expenses into retained earnings.' },
    { id: 'coa', selector: t('ledger-coa'), title: 'Chart of accounts', say: 'The accounts your books use.' },
    { id: 'periods', selector: t('ledger-periods'), title: 'Closing months', say: 'Close or lock a month you’ve reviewed, so nothing new can change it.' },
  ],
}
