import type { PageTour } from '../types'

/**
 * Accounting → Payments, voids and refunds (/accounting/cash-drawer/classic):
 * every payment, by status tab.
 *
 * States: the tab that's on (classic-tab-* aria-pressed); an empty tab shows
 * classic-drawer-empty data-tab; each payment-card has data-status
 * (pending_turnover | received | voided | …).
 */
const t = (id: string) => `[data-tour="${id}"]`
const EMPTY = t('classic-drawer-empty')
const emptyOn = (tab: string) => `${EMPTY}[data-tab="${tab}"]`

export const PAGE_TOUR: PageTour = {
  id: 'cash-drawer-classic',
  route: '^/accounting/cash-drawer/classic/?$',
  intro: {
    page: 'Payments, voids and refunds',
    purpose: 'Every payment your team has taken, by status. Confirm what came in, fix the payment method, or void and refund.',
    covers: ['Totals and charts', 'Who’s holding what', 'Payments by status', 'Changing or reversing one'],
  },
  steps: [
    { id: 'header', selector: t('classic-drawer-header'), title: 'Every payment', say: 'Every payment in one place. The Cash register is the quicker way to count money in.' },
    { id: 'count', selector: t('cash-count'), title: 'Count the cash', say: 'Count the cash you’re holding, note by note, and see if it matches.' },
    { id: 'summary', selector: t('classic-drawer-summary'), title: 'Totals', say: 'What’s waiting to be handed in, what’s been received, and by which method.' },
    { id: 'charts', selector: t('classic-drawer-charts'), title: 'Charts', say: 'Payments by method and over time.' },
    { id: 'register', selector: t('classic-drawer-register'), title: 'Tech cash register', say: 'What each person is holding, and what they’ve handed in.' },
    { id: 'tabs', selector: t('classic-drawer-tabs'), title: 'By status', say: 'Waiting to be handed in, received, voided, disputed, or everything.' },
    {
      id: 'list', title: 'The payments', say: '',
      variants: [
        { when: emptyOn('pending'), selector: EMPTY, say: 'Nothing waiting to be handed in. Payments techs collect show up here.' },
        { when: emptyOn('disputed'), selector: EMPTY, say: 'No disputed payments. A card dispute would show up here with an alert.' },
        { when: EMPTY, selector: EMPTY, say: 'Nothing in this view yet.' },
        { when: t('payment-card'), selector: t('classic-drawer-cards'), say: 'Each payment with its amount, method, who took it and the invoice it paid.' },
      ],
    },
    {
      id: 'card', selector: t('payment-card'), title: 'A payment', say: 'Each card shows what’s next for that payment.',
      variants: [
        { when: `${t('payment-card')}[data-status="pending_turnover"]`, say: 'Waiting to be handed in. Once you have the money, Verify received confirms it.' },
        { when: `${t('payment-card')}[data-status="received"]`, say: 'Received. If it has to be undone, Void or Refund reverses it on the invoice too.' },
      ],
    },
    { id: 'method', selector: t('payment-method-change'), title: 'Wrong method?', say: 'Recorded as cash but it was a check? Change the method here.' },
    { id: 'reverse', selector: t('payment-reverse'), title: 'Void or refund', say: 'Void or refund asks for a reason first, and puts the balance back on the invoice.' },
  ],
}
