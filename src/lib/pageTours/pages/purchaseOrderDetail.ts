import type { PageTour } from '../types'

/**
 * Purchase orders → one order (/purchase-orders/:id).
 *
 * States the page marks on po-detail-header:
 *   data-status   = draft | ordered | partially_received | received | completed | cancelled
 *   data-vendor   = set | none   (a draft can start with no vendor, e.g. from a catalog)
 *   data-auto     = yes | no     (a low-stock reorder CrewBarn started)
 *   data-for      = estimate | job | stock
 *   data-can-edit = yes | no
 * Lines: po-detail-lines, or po-lines-empty. Receiving shows only while there
 * is something left to receive (po-receive-fill and friends).
 */
const t = (id: string) => `[data-tour="${id}"]`
const H = t('po-detail-header')
const is = (attr: string, value: string) => `${H}[data-${attr}="${value}"]`

export const PAGE_TOUR: PageTour = {
  id: 'purchase-order',
  route: '^/purchase-orders/(?!new/?$|needs-ordered/?$)[^/]+/?$',
  intro: {
    page: 'Purchase order',
    purpose: 'One order to a supplier: who it’s going to, what’s on it, and receiving the delivery when it arrives.',
    covers: ['Where the order is', 'Vendor', 'Dates and totals', 'Line items', 'Receiving it'],
  },
  steps: [
    {
      id: 'header', selector: H, title: 'This order',
      say: 'The order number, where it’s at, and who it’s going to.',
      variants: [
        { when: is('auto', 'yes'), say: 'CrewBarn started this draft when these items ran low. Check the quantities, then mark it ordered.' },
        { when: is('for', 'estimate'), say: 'This order is tied to an estimate, linked here. The parts are for that customer’s job.' },
        { when: is('for', 'job'), say: 'This order is for a job, linked here.' },
      ],
    },
    {
      id: 'status-now', title: 'Where it’s at', selector: H, say: '',
      variants: [
        { when: is('status', 'draft'), title: 'A draft', say: 'It’s still a draft. Nothing has gone to the vendor. Change the status to Ordered once you’ve placed it.' },
        { when: is('status', 'ordered'), title: 'Ordered', say: 'It’s been ordered. When the delivery turns up, receive it below.' },
        { when: is('status', 'partially_received'), title: 'Part received', say: 'Some of it has arrived. Receive the rest below as it comes.' },
        { when: is('status', 'received'), title: 'Received', say: 'Everything has come in. Mark it Completed once the bill is sorted.' },
        { when: is('status', 'completed'), title: 'Completed', say: 'This order is done and closed.' },
        { when: is('status', 'cancelled'), title: 'Cancelled', say: 'This order was cancelled. It stays here for your records.' },
      ],
    },
    {
      id: 'vendor', selector: t('po-detail-vendor'), title: 'Vendor',
      say: 'Who the order is going to, and their order number if you have one.',
      variants: [
        { when: `${H}[data-vendor="none"][data-status="draft"]`, title: 'No vendor yet', say: 'No vendor yet. Pick one here before the order can be marked as ordered.' },
        { when: is('vendor', 'none'), title: 'No vendor yet', say: 'No vendor was chosen. It’s needed before this order can be ordered or received.' },
      ],
    },
    {
      id: 'status', selector: t('po-detail-status'), title: 'Status',
      say: 'Change the status as the order moves along. Picking one saves straight away. Delete asks for your password and a reason.',
    },
    { id: 'headercard', selector: t('po-detail-headercard'), title: 'Dates and totals', say: 'The dates, subtotal, tax, shipping, total and your notes. Edit changes them.' },
    {
      id: 'lines', title: 'Line items', say: '',
      variants: [
        { when: t('po-lines-empty'), selector: t('po-lines-empty'), title: 'No lines yet', say: 'Nothing on this order yet. Add line, or Low stock, puts things on it.' },
        { when: t('po-detail-lines'), selector: t('po-detail-lines'), say: 'What you’re ordering, how many were ordered and how many have come in.' },
      ],
    },
    { id: 'add-line', selector: t('po-add-line'), title: 'Add a line', say: 'Add line searches your catalog, so the cost fills in, or takes a one-off description.' },
    { id: 'low-stock', selector: t('po-low-stock-button'), title: 'Add from low stock', say: 'Low stock adds lines straight from what’s running low.' },
    { id: 'new-line', selector: t('po-new-line'), title: 'A new line', say: 'Search your catalog, or type a description for a one-off. Add line saves it.' },
    { id: 'lowstock-panel', selector: t('po-detail-lowstock'), title: 'Pick what’s low', say: 'Tick the items, adjust the quantities, and Add to PO puts them all on this order.' },
    {
      id: 'receive', selector: t('po-receive-lines'), title: 'Receive the delivery',
      say: 'When the delivery arrives, type how many came on each line. You can take part now and the rest later.',
      variants: [
        { when: is('vendor', 'none'), say: 'When the delivery arrives, receive it here. Pick a vendor first; receiving needs one.' },
      ],
    },
    { id: 'receive-into', selector: t('po-receive-into'), title: 'Receive into', say: 'Send the whole delivery to one place, or leave it and each item goes to its usual bin.' },
    { id: 'receive-fill', selector: t('po-receive-fill'), title: 'Fill remaining', say: 'When the whole order came, Fill remaining fills in every line for you.' },
    { id: 'receive-submit', selector: t('po-receive-submit'), title: 'Receive selected', say: 'Receive selected puts the stock on the shelves under your name, and gives tracked items their serial numbers.' },
  ],
}
