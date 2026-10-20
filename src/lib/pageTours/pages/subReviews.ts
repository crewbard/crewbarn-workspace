import type { PageTour } from '../types'

/** Daily work → Sub reviews (/sub-reviews). Decisions your subcontractors are waiting on. */
const t = (id: string) => `[data-tour="${id}"]`
const says = (id: string, words: string) => (page: { text: (s: string) => string }) => page.text(t(id)).includes(words)

export const PAGE_TOUR: PageTour = {
  id: 'sub-reviews',
  route: '^/sub-reviews/?$',
  intro: {
    page: 'Sub reviews',
    purpose: 'Decisions your subcontractors are waiting on: requests to spend more, and invoices to approve and pay.',
    covers: ['Requests to spend more', 'Sub invoices', 'Approve, pay or decline'],
  },
  steps: [
    { id: 'header', selector: t('sub-reviews-header'), title: 'Waiting on you', say: 'Anything your subs need you to decide lands here. It refreshes itself every minute.' },
    {
      id: 'nte', selector: t('sub-reviews-nte'), title: 'Requests to spend more', say: 'A sub wants to go over the limit you set. Read why, then approve or deny.',
      variants: [{ when: says('sub-reviews-nte', 'No pending'), say: 'When a sub asks to go over the limit you set, it shows here. Nothing waiting right now.' }],
    },
    {
      id: 'invoices', selector: t('sub-reviews-invoices'), title: 'Sub invoices', say: 'Invoices from your subs. Check the PDF, approve it, then mark it paid once you’ve paid them.',
      variants: [{ when: says('sub-reviews-invoices', 'No sub invoices'), say: 'Invoices from your subs wait here for you. None right now.' }],
    },
    { id: 'actions', selector: t('sub-reviews-invoice-actions'), title: 'Approve, pay or decline', say: 'Approve comes first, then Mark paid records how you paid. Decline needs a reason, so the sub can fix it and send it again.' },
  ],
}
