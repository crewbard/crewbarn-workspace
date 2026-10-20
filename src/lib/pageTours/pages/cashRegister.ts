import type { PageTour } from '../types'

/**
 * Accounting → Cash register (/accounting/cash-drawer). Three views, one at
 * a time: Tech tills, Office drawer, Uncollected. The tour presses each view
 * button in turn (it only switches what's shown).
 *
 * States the page marks:
 *   register-tills        data-holding = loading | yes | none
 *   drawer-waiting        data-count
 *   register-uncollected  data-state = loading | blocking | some | none
 */
const t = (id: string) => `[data-tour="${id}"]`
const TILLS = t('register-tills')
const UNC = t('register-uncollected')

export const PAGE_TOUR: PageTour = {
  id: 'cash-register',
  route: '^/accounting/cash-drawer/?$',
  intro: {
    page: 'Cash register',
    purpose: 'Follow cash and checks from the field to the bank: what each tech is holding, what’s in the office drawer, and finished jobs nobody collected on.',
    covers: ['What techs are holding', 'Counting it in', 'The office drawer', 'Deposits', 'Never collected'],
  },
  steps: [
    { id: 'header', selector: t('register-header'), title: 'Cash register', say: 'Cash and checks only. Cards and bank transfers settle straight to the bank and never pass through here.' },
    { id: 'total', selector: t('register-total'), title: 'The total', say: 'The money collected but not yet checked in, or on the Uncollected view, what was never collected.' },
    { id: 'classic', selector: t('register-classic'), title: 'Every payment', say: 'Need to change, void or refund a payment? That’s on the Payments, voids and refunds page, linked here.' },
    { id: 'views', selector: t('register-views'), title: 'Three views', say: 'Tech tills, the office drawer, and uncollected jobs. The numbers show how many are waiting.' },

    // ── Tech tills ──
    {
      id: 'tills', selector: TILLS, click: t('register-view-tills'), title: 'Tech tills', say: '',
      variants: [
        { when: `${TILLS}[data-holding="none"]`, say: 'Nobody is holding money right now. Every till is counted in.' },
        { when: `${TILLS}[data-holding="yes"]`, say: 'A card for each person holding cash or checks, with what it was for. Count the money, type what you counted, and take it in.' },
        { when: TILLS, say: 'Each person holding cash or checks gets a card here.' },
      ],
    },

    // ── Office drawer ──
    { id: 'drawer', selector: t('drawer-total'), click: t('register-view-drawer'), waitMs: 1200, title: 'In the drawer', say: 'What’s physically in the office right now, split into cash and checks, and how long the oldest has sat there.' },
    { id: 'drawer-add', selector: t('drawer-add'), title: 'Add money', say: 'A check in the mail or a customer paying at the counter: take the payment on their invoice and it lands here.' },
    {
      id: 'drawer-waiting', selector: t('drawer-waiting'), title: 'Waiting to be deposited',
      say: 'Tick what you’re walking to the bank, and it becomes one deposit.',
      variants: [{ when: `${t('drawer-waiting')}[data-count="0"]`, say: 'Nothing is waiting to go to the bank.' }],
    },
    { id: 'drawer-deposits', selector: t('drawer-deposits'), title: 'Deposits', say: 'Each deposit is one line on your bank statement, which is what makes matching it up easy.' },

    // ── Uncollected ──
    {
      id: 'uncollected', selector: UNC, click: t('register-view-uncollected'), title: 'Never collected', say: '',
      variants: [
        { when: `${UNC}[data-state="none"]`, say: 'Every finished cash job has been collected on.' },
        { when: `${UNC}[data-state="blocking"]`, say: 'Finished jobs where nothing was collected. Some are stopping a tech from starting their next job; settle them from Dispatch.' },
        { when: `${UNC}[data-state="some"]`, say: 'Finished cash jobs where nothing was collected, oldest highlighted. Chase these before they’re forgotten.' },
        { when: UNC, say: 'Finished cash jobs where nothing was collected show up here.' },
      ],
    },
  ],
}
