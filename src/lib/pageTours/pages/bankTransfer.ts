import type { PageTour } from '../types'

/**
 * Money → Let customers pay by bank transfer (/tool-shed/payments/bank-transfer).
 *
 * States: bank-transfer-toggle data-enabled = yes | no, data-ready = yes | no
 * (the account numbers are in); settings-read-only for people who can't
 * change it.
 */
const t = (id: string) => `[data-tour="${id}"]`
const TOGGLE = t('bank-transfer-toggle')

export const PAGE_TOUR: PageTour = {
  id: 'bank-transfer',
  route: '^/tool-shed/payments/bank-transfer/?$',
  intro: {
    page: 'Pay by bank transfer',
    purpose: 'Let customers pay straight into your bank account from the portal. Nobody takes a cut, but it’s slower than a card.',
    covers: ['On or off', 'Your bank details', 'On invoices', 'What happens next'],
  },
  steps: [
    { id: 'header', selector: t('bank-transfer-header'), title: 'Bank transfer', say: 'Customers pick bank transfer in the portal and see your bank details. The money goes bank to bank.' },
    { id: 'read-only', selector: t('settings-read-only'), title: 'View only', say: 'You can see this page but not change it. An owner or admin can.' },
    {
      id: 'toggle', selector: TOGGLE, title: 'On or off', say: '',
      variants: [
        { when: `${TOGGLE}[data-enabled="yes"][data-ready="yes"]`, title: 'Offered', say: 'It’s on. Customers see bank transfer as a way to pay in the portal.' },
        { when: `${TOGGLE}[data-enabled="yes"]`, title: 'Almost on', say: 'It’s switched on, but it won’t show to customers until the routing and account numbers are filled in.' },
        { when: `${TOGGLE}[data-enabled="no"]`, title: 'Not offered', say: 'It’s off, so customers pay by card. Flip the switch to offer bank transfer too.' },
      ],
    },
    { id: 'details', selector: t('bank-transfer-details'), title: 'Your bank details', say: 'Your bank, the name on the account, and the routing and account numbers customers send to.' },
    { id: 'instructions', selector: t('bank-transfer-instructions'), title: 'Anything else', say: 'Optional notes for the customer, like how long a transfer usually takes.' },
    { id: 'invoice', selector: t('bank-transfer-invoice'), title: 'On invoices too', say: 'Turn this on to print your bank details on emailed and printed invoices as well.' },
    { id: 'consequences', selector: t('bank-transfer-consequences'), title: 'What happens', say: 'When a customer says they’ve sent it, the invoice stays unpaid until the money actually lands.' },
    { id: 'save', selector: t('bank-transfer-save'), title: 'Save', say: 'Save lights up once you’ve changed something.' },
    { id: 'encrypted', selector: t('bank-transfer-encrypted'), title: 'Kept safe', say: 'The numbers are stored encrypted. Only the last four are ever shown back, even to you.' },
  ],
}
