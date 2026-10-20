import type { PageTour } from '../types'

/**
 * Purchase orders (/purchase-orders): every order to your suppliers.
 *
 * States: rows or cards (po-row, data-vendor = set | none), none yet or no
 * match (po-empty data-filtered = yes | no); + New PO only for people who
 * can edit inventory.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'purchase-orders',
  route: '^/purchase-orders/?$',
  intro: {
    page: 'Purchase orders',
    purpose: 'Every order to your suppliers, from draft to delivered. Receiving an order is what puts the stock on your shelves.',
    covers: ['Order parts', 'What needs ordering', 'Starting an order', 'Finding an order', 'Your orders'],
  },
  steps: [
    { id: 'header', selector: t('po-header'), title: 'Purchase orders', say: 'Every order to your suppliers lives here, from the first draft to the last part received.' },
    { id: 'order-parts', selector: t('po-order-parts-link'), title: 'Order parts', say: 'Order parts is where the parts your crew asked for wait. Pick suppliers there and it makes these orders for you, one for each supplier.' },
    { id: 'needs', selector: t('po-needs-link'), title: 'Needs ordering', say: 'Needs ordering lists everything at or below its reorder point. It’s the quickest way to start an order.' },
    { id: 'new', selector: t('po-new-link'), title: 'New PO', say: 'New PO starts an order from scratch: pick the vendor, then add the lines.' },
    { id: 'filters', selector: t('po-filters'), title: 'Search and filter', say: 'Search by order number or vendor, pick a status, or tick Show archived for older ones.' },
    {
      id: 'list', title: 'Your orders', say: '',
      variants: [
        { when: `${t('po-empty')}[data-filtered="yes"]`, selector: t('po-empty'), say: 'No orders match those filters. Clear them to see everything.' },
        { when: t('po-empty'), selector: t('po-empty'), title: 'No orders yet', say: 'No purchase orders yet. Make them from Order parts or Needs ordering, or press New PO.' },
        { when: t('po-cards'), selector: t('po-cards'), say: 'Each order with its status, vendor, dates and total. Press one to open it.' },
        { when: t('po-table'), selector: t('po-table'), say: 'Each order with its status, vendor, order date, expected delivery and total. Press a row to open it.' },
      ],
    },
    {
      id: 'no-vendor', selector: `${t('po-row')}[data-vendor="none"]`,
      title: 'No vendor yet',
      say: 'This draft doesn’t have a vendor yet. Open it and pick one before it’s ordered. Parts your crew asks for wait on Order parts instead.',
    },
  ],
}
