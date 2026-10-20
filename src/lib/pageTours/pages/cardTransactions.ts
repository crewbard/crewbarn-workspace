import type { PageTour } from '../types'

/**
 * Accounting → Card transactions (/accounting/card-processor): every card
 * transaction on the GoDaddy Payments account.
 *
 * States: processor-sync data-connected = checking | yes | no; the state
 * strip (processor-state-* aria-pressed); an empty view shows
 * processor-empty data-state; processor-match while one row is open.
 */
const t = (id: string) => `[data-tour="${id}"]`
const NOT_CONNECTED = `${t('processor-sync')}[data-connected="no"]`

export const PAGE_TOUR: PageTour = {
  id: 'card-transactions',
  route: '^/accounting/card-processor/?$',
  intro: {
    page: 'Card transactions',
    purpose: 'Every card charge on your GoDaddy Payments account. Most match themselves; the rest went through without CrewBarn seeing them, and you say where they belong.',
    covers: ['Syncing', 'By state', 'Matching one to an invoice'],
  },
  steps: [
    { id: 'header', selector: t('processor-header'), title: 'Card transactions', say: 'Charges taken in the GoDaddy app or on a terminal land here, so none go missing from your books.' },
    {
      id: 'sync', selector: t('processor-sync'), title: 'Sync now', say: 'It checks every hour on its own. Sync now checks straight away.',
      variants: [{ when: NOT_CONNECTED, say: 'GoDaddy Payments isn’t connected, so there’s nothing to sync. Connect it on the Payments settings page.' }],
    },
    { id: 'states', selector: t('processor-states'), title: 'By state', say: 'Unmatched, matched, refunds and reversals, and ignored. The counts are the filter: press one to see those.' },
    {
      id: 'list', title: 'The transactions', say: '',
      variants: [
        { when: `${t('processor-empty')}[data-state="unmatched"]`, selector: t('processor-empty'), say: 'Nothing waiting. Every transaction is accounted for.' },
        { when: t('processor-empty'), selector: t('processor-empty'), say: 'No transactions in this view.' },
        { when: t('processor-table'), selector: t('processor-table'), say: 'Each charge with its date, amount, card and who took it.' },
      ],
    },
    { id: 'match-open', selector: t('processor-match-open'), when: `!${t('processor-match')}`, title: 'Match one', say: 'Press Match on an unmatched charge to attach it to an invoice.' },
    { id: 'match', selector: t('processor-match'), title: 'Attach it', say: 'Suggested invoices come first. Search by invoice number or customer, or ignore it if the charge isn’t yours.' },
  ],
}
