import type { PageTour } from '../types'
import { FOCUS } from '../theme'

/**
 * Accounting → one invoice (/invoices/:id).
 *
 * States: invoice-header data-status = draft | sent | paid | cancelled,
 * data-overdue = yes | no, data-transfer = promised | none. The action
 * buttons show only for people who can change invoices, and only those that
 * fit the status (Mark as sent on a draft, Mark paid while unpaid, Delete
 * on a draft).
 *
 * Focus look: the invoice splits into two sections (invoice-sections:
 * invoice-section-overview "Account & actions" and invoice-section-charges
 * "Charges", aria-pressed), with the actions beside who it's to. Each step
 * presses its section first, which does nothing in the other looks.
 */
const t = (id: string) => `[data-tour="${id}"]`
const H = t('invoice-header')
const CHARGES = t('invoice-section-charges')
const ACCOUNT = t('invoice-section-overview')
const is = (s: string) => `${H}[data-status="${s}"]`

export const PAGE_TOUR: PageTour = {
  id: 'invoice',
  route: '^/invoices/[^/]+/?$',
  intro: {
    page: 'Invoice',
    purpose: 'One invoice in full: what it’s for, who it’s to, what’s been paid, and getting it sent and paid.',
    covers: ['Where it’s at', 'Lines and totals', 'Who it’s to', 'Sending it', 'Getting paid'],
  },
  steps: [
    {
      id: 'header', selector: H, title: 'This invoice', say: 'The invoice number, what it’s for, and where it’s at.',
      variants: [
        { when: `${H}[data-overdue="yes"]`, title: 'Overdue', say: 'This invoice is past its due date and still unpaid. A reminder with a pay link usually does it.' },
        { when: `${H}[data-transfer="promised"]`, title: 'Transfer on the way', say: 'The customer says they’ve sent a bank transfer. It stays unpaid until the money lands.' },
        { when: is('draft'), title: 'A draft', say: 'This is a draft: the customer hasn’t seen it yet. Check it, then send it.' },
        { when: is('sent'), title: 'Sent', say: 'This invoice is with the customer and waiting to be paid.' },
        { when: is('paid'), title: 'Paid', say: 'Paid in full. Nothing more to do.' },
        { when: is('cancelled'), title: 'Cancelled', say: 'This invoice was cancelled. It stays for your records.' },
      ],
    },
    { id: 'glance', selector: t('invoice-glance'), title: 'At a glance', say: 'The total, what’s been paid and what’s left.' },
    { id: 'sections', when: FOCUS, selector: t('invoice-sections'), title: 'Two sections', say: 'Account & actions has who it’s to, the dates, payments and the buttons. Charges has the lines and totals, with how many lines in brackets.' },
    { id: 'lines', click: CHARGES, selector: t('invoice-lines'), title: 'Line items', say: 'What the customer is paying for, line by line.' },
    { id: 'totals', click: CHARGES, selector: t('invoice-totals'), title: 'Totals', say: 'Subtotal, any discount, tax, and the balance due.' },
    { id: 'notes', click: CHARGES, selector: t('invoice-notes'), title: 'Notes and terms', say: 'Notes for the customer, and your payment terms.' },
    { id: 'bill-to', click: ACCOUNT, selector: t('invoice-bill-to'), title: 'Bill to', say: 'Who the invoice is addressed to, and the job it came from.' },
    { id: 'dates', click: ACCOUNT, selector: t('invoice-dates'), title: 'Dates', say: 'When it was made, sent and is due.' },
    { id: 'payment', click: ACCOUNT, selector: t('invoice-payment'), title: 'Payment', say: 'How it was paid, with any reference number.' },
    { id: 'actions', click: ACCOUNT, selector: t('invoice-actions'), title: 'Actions', say: 'Everything you can do with this invoice.' },
    { id: 'print', click: ACCOUNT, selector: t('invoice-print'), title: 'View, print or send', say: 'View / Print invoice opens it as the customer sees it, with buttons to email it, text it, or take a payment.' },
    { id: 'mark-sent', click: ACCOUNT, selector: t('invoice-mark-sent'), title: 'Mark as sent', say: 'Only changes the status, for one you’ve handed over yourself. It doesn’t email anything.' },
    { id: 'mark-paid', click: ACCOUNT, selector: t('invoice-mark-paid'), title: 'Mark paid', say: 'Record a payment by hand: how much, how they paid, and when. Part payments are fine.' },
    { id: 'terminal', click: ACCOUNT, selector: t('invoice-terminal'), title: 'Card terminal', say: 'Send the balance to your card terminal for the customer to tap.' },
    { id: 'cancel', click: ACCOUNT, selector: t('invoice-cancel'), title: 'Cancel invoice', say: 'Cancel invoice voids it after you confirm. It can’t be undone.' },
    { id: 'delete', click: ACCOUNT, selector: t('invoice-delete'), title: 'Delete draft', say: 'A draft nobody has seen can be deleted outright.' },
  ],
}
