import type { PageTour } from '../types'

/**
 * Accounting → Bank match overview (/accounting/bank-match).
 *
 * States: bank-ws-unmatched data-count (0 = nothing waiting).
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'bank-match',
  route: '^/accounting/bank-match/?$',
  intro: {
    page: 'Bank match',
    purpose: 'Line your bank statement up with what CrewBarn recorded, so every deposit has its payments and every statement balances.',
    covers: ['Which account', 'The totals', 'Rows to review', 'Closing a statement', 'Past reviews'],
  },
  steps: [
    { id: 'header', selector: t('bank-ws-header'), title: 'Bank match', say: 'The overview of your bank rows. Review bank matches is where you match them one by one.' },
    { id: 'open-review', selector: t('bank-ws-open-review'), title: 'Review matches', say: 'This opens the matching screen.' },
    { id: 'account', selector: t('bank-ws-account'), title: 'Which account', say: 'Narrow everything to one bank account before you close a statement period.' },
    { id: 'metrics', selector: t('bank-ws-metrics'), title: 'The totals', say: 'How many bank rows, how many are matched, and what’s still waiting.' },
    {
      id: 'unmatched', selector: t('bank-ws-unmatched'), title: 'Rows needing review',
      say: 'Bank rows with no match yet, or a guess waiting for you to confirm.',
      variants: [{ when: `${t('bank-ws-unmatched')}[data-count="0"]`, say: 'Nothing needs review. Every bank row is matched.' }],
    },
    { id: 'review', selector: t('bank-ws-review'), title: 'Close a statement', say: 'Type the statement’s dates and ending balance, and it saves the review with the difference, so you know it balances.' },
    { id: 'runs', selector: t('bank-ws-runs'), title: 'Match status and past reviews', say: 'Rows by status, and every statement review you’ve saved.' },
    { id: 'flows', selector: t('bank-ws-flows'), title: 'Money in and out', say: 'Deposits and withdrawals over the period.' },
    { id: 'shortcuts', selector: t('bank-ws-shortcuts'), title: 'Shortcuts', say: 'Quick links to related pages.' },
  ],
}
