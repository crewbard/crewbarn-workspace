import type { PageTour } from '../types'

/**
 * Accounting → Review bank matches (/accounting/bank-match/review).
 *
 * States the page marks:
 *   bank-review-row      data-status = unmatched | suggested | matched | ignored,
 *                        data-direction = in | out
 *   bank-review-empty    no bank rows in this filter
 *   bank-review-missing  data-count (payments not found in the bank)
 */
const t = (id: string) => `[data-tour="${id}"]`
const row = (s: string) => `${t('bank-review-row')}[data-status="${s}"]`

export const PAGE_TOUR: PageTour = {
  id: 'bank-match-review',
  route: '^/accounting/bank-match/review/?$',
  intro: {
    page: 'Review bank matches',
    purpose: 'Go through your bank rows one by one and say what each one was: a customer payment, a deposit, an expense, or something else.',
    covers: ['Statement reconciliation', 'Payments missing from the bank', 'Adding statement rows', 'Matching each row'],
  },
  steps: [
    { id: 'header', selector: t('bank-review-header'), title: 'Bank match', say: 'Every bank row needs an answer. Most are guessed for you; you confirm.' },
    { id: 'summary', selector: t('bank-review-summary'), title: 'Where you’re at', say: 'How many rows are matched, suggested and still open.' },
    { id: 'recon', selector: t('bank-review-recon'), title: 'Statement reconciliation', say: 'Close a statement period: its dates and ending balance, checked against what’s cleared.' },
    {
      id: 'missing', selector: t('bank-review-missing'), title: 'Not found in the bank',
      say: 'Payments CrewBarn recorded that haven’t turned up in the bank yet. Worth a look if they’re old.',
      variants: [{ when: `${t('bank-review-missing')}[data-count="0"]`, say: 'Every payment CrewBarn recorded has turned up in the bank.' }],
    },
    { id: 'add', selector: t('bank-review-add'), title: 'Add a statement row', say: 'No bank connection? Add a row from your statement by hand.' },
    { id: 'csv', selector: t('bank-review-csv'), title: 'Paste a statement', say: 'Or paste your bank’s CSV download, and every row comes in at once.' },
    { id: 'filters', selector: t('bank-review-filters'), title: 'Filter', say: 'Filter by status, dates or amount.' },
    { id: 'empty', selector: t('bank-review-empty'), title: 'Nothing here', say: 'No bank rows in this filter. Connect your bank, or paste a statement above.' },
    {
      id: 'row', selector: t('bank-review-row'), title: 'A bank row', say: 'Each row is one line from your bank: the date, the amount and the description.',
      variants: [
        { when: row('suggested'), selector: row('suggested'), say: 'This row has a suggested match. Check it on the right and accept it if it’s right.' },
        { when: row('unmatched'), selector: row('unmatched'), say: 'This row has no match yet. Pick from the suggestions on the right, or say what it was.' },
      ],
    },
    {
      id: 'suggestions', selector: t('bank-review-suggestions'), title: 'Suggestions',
      say: 'The payments it could be. Ignore skips a row, Mark other files it as something else, and money going out can become an expense or be split.',
    },
  ],
}
