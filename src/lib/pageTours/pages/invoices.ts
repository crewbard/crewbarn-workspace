import type { PageTour } from '../types'

/**
 * Accounting → Invoices (/accounting/invoices).
 *
 * States: invoices-empty data-filtered = yes | no; each invoice-card has
 * data-open="true" while something is owed; invoice-card-next data-next =
 * payment | open; Cards or Files view (invoices-view-* aria-pressed).
 */
const t = (id: string) => `[data-tour="${id}"]`
const EMPTY = t('invoices-empty')
const OPEN_CARD = `${t('invoice-card')}[data-open="true"]`

export const PAGE_TOUR: PageTour = {
  id: 'invoices',
  route: '^/accounting/invoices/?$',
  intro: {
    page: 'Invoices',
    purpose: 'Every invoice from draft to paid. See what’s owed, take a payment right from the list, or open one for its full story.',
    covers: ['By status', 'Finding an invoice', 'Reading a card', 'Taking a payment', 'Files by year'],
  },
  steps: [
    { id: 'header', selector: t('invoices-header'), title: 'Invoices', say: 'Every invoice you’ve sent or are about to. Most start themselves when a job is finished.' },
    { id: 'action-cards', selector: t('invoices-action-cards'), title: 'What do you need?', say: 'Jump straight to drafts, invoices out with customers, or paid ones.' },
    { id: 'tabs', selector: t('invoices-tabs'), title: 'By status', say: 'Drafts, sent, overdue, paid and more, each with its count.' },
    { id: 'search', selector: t('invoices-search'), title: 'Search', say: 'Find an invoice by number, customer or job.' },
    { id: 'view', selector: t('invoices-view'), title: 'Cards or files', say: 'Cards for working through them; files for finding one by year and month.' },
    {
      id: 'list', title: 'Your invoices', say: '',
      variants: [
        { when: `${EMPTY}[data-filtered="yes"]`, selector: EMPTY, say: 'No invoices match this tab or search. Try All, or clear the search.' },
        { when: EMPTY, selector: EMPTY, title: 'No invoices yet', say: 'No invoices yet. Finish a job and its invoice starts itself, or make one from a job.' },
        { when: OPEN_CARD, selector: OPEN_CARD, say: 'Each card is one invoice: who it’s for, where it’s at, what it’s for and what’s still owed. Press it to open the full invoice.' },
        { when: t('invoice-card'), selector: t('invoice-card'), say: 'Each card is one invoice. Press it to open the full invoice.' },
      ],
    },
    { id: 'state', selector: t('invoice-card-state'), title: 'Where it’s at', say: 'Draft, sent, overdue or paid, at a glance. The coloured strip along the top says the same.' },
    { id: 'money', selector: t('invoice-card-money'), title: 'The money', say: 'The total, and the balance still owed.' },
    { id: 'meta', selector: t('invoice-card-meta'), title: 'The details', say: 'The job it came from, and when it was sent and is due.' },
    {
      id: 'next', selector: t('invoice-card-next'), title: 'Next step', say: 'The next thing to do with this invoice.',
      variants: [
        { when: `${t('invoice-card-next')}[data-next="payment"]`, say: 'Record payment takes the money right here, without opening the invoice.' },
        { when: `${t('invoice-card-next')}[data-next="open"]`, say: 'This opens the invoice to send it or finish it off.' },
      ],
    },
    { id: 'files', selector: t('invoices-files'), title: 'Files by year', say: 'Every invoice filed by year and month, like a cabinet.' },
  ],
}
