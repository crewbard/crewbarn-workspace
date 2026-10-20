import type { PageTour } from '../types'

/**
 * Purchase orders → New PO (/purchase-orders/new).
 *
 * States: po-new-vendor data-vendors = loading | yes | none.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'purchase-order-new',
  route: '^/purchase-orders/new/?$',
  intro: {
    page: 'New purchase order',
    purpose: 'Start an order to a supplier. Fill in the top here, then add what you’re ordering on the next screen.',
    covers: ['Vendor', 'Their order number', 'Dates', 'Tax, shipping and notes'],
  },
  steps: [
    { id: 'header', selector: t('po-new-header'), title: 'A new order', say: 'A new order starts as a draft. Nothing goes to the vendor from here.' },
    {
      id: 'vendor', selector: t('po-new-vendor'), title: 'Vendor',
      say: 'Pick who you’re ordering from. It’s the only thing you must fill in.',
      variants: [
        { when: `${t('po-new-vendor')}[data-vendors="none"]`, say: 'You don’t have any vendors yet. Add one on the Vendors page first.' },
      ],
    },
    { id: 'vendor-order', selector: t('po-new-vendor-order'), title: 'Their order number', say: 'Their order or confirmation number, if they gave you one. It’s printed on the labels.' },
    { id: 'dates', selector: t('po-new-dates'), title: 'Dates', say: 'The order date starts as today. Add when you expect it to arrive.' },
    { id: 'money', selector: t('po-new-money'), title: 'Tax and shipping', say: 'Tax and shipping are added on top of the lines.' },
    { id: 'notes', selector: t('po-new-notes'), title: 'Notes', say: 'Notes for your team about this order.' },
    { id: 'submit', selector: t('po-new-submit'), title: 'Create it', say: 'Create PO saves the draft and opens it, ready for its lines. Cancel goes back without making anything.' },
  ],
}
