import type { PageTour } from '../types'

/**
 * Purchase orders → Needs ordered (/purchase-orders/needs-ordered).
 *
 * States: the low-stock list (needs-table) or all clear (needs-empty);
 * needs-create data-selected = yes | no, data-can-create = yes | no; the
 * Create draft PO box (needs-create-modal data-vendors = yes | none).
 * On the first row: needs-picture (photo, card picture or empty box),
 * needs-part-numbers (only when it has any), needs-where, needs-more.
 */
const t = (id: string) => `[data-tour="${id}"]`
const MODAL = t('needs-create-modal')

export const PAGE_TOUR: PageTour = {
  id: 'needs-ordered',
  route: '^/purchase-orders/needs-ordered/?$',
  intro: {
    page: 'Needs ordered',
    purpose: 'Everything you stock that has dropped to its reorder point, ready to send to Order parts with everything else, or to one draft order.',
    covers: ['What’s running low', 'Pictures, part numbers and where it is', 'Picking quantities', 'Sending to Order parts', 'Making a draft order'],
  },
  steps: [
    { id: 'header', selector: t('needs-header'), title: 'Running low', say: 'This lists every stocked item at or below its reorder point.' },
    {
      id: 'list', title: 'What’s low', say: '',
      variants: [
        { when: t('needs-empty'), selector: t('needs-empty'), title: 'All clear', say: 'Nothing to reorder right now. Every stocked item is above its reorder point.' },
        { when: t('needs-table'), selector: t('needs-table'), say: 'Each item with its supplier, what’s on hand, its reorder point and a suggested quantity. Tick what you want and change any quantity. Ticking doesn’t order anything.' },
      ],
    },
    {
      id: 'picture', selector: t('needs-picture'), title: 'The picture',
      say: 'Each item shows its picture, or its reference card’s picture if it has none, so you can see exactly which one it is. Tap it to see it large.',
    },
    {
      id: 'part-numbers', selector: t('needs-part-numbers'), title: 'Part numbers',
      say: 'Under the name are the numbers it goes by: your SKU, the part number, and your supplier’s own number for it, so you can order the right one.',
    },
    {
      id: 'where', selector: t('needs-where'), title: 'Where it is',
      say: 'This line shows how many are in the shop and on each truck, with the bin when there is one. Below it: what it last cost, who you bought it from, and any jobs waiting on it.',
    },
    {
      id: 'more', selector: t('needs-more'), title: 'More about it',
      say: 'Open More about it for the full description, everyone who sells it, the jobs waiting on it, and links to the item and its reference card.',
    },
    {
      id: 'to-order-parts', selector: t('needs-to-order-parts'), when: `!${MODAL}`, title: 'Add to Order parts',
      say: 'Add to Order parts puts what you ticked on the same list as the parts your crew asked for, so you pick suppliers and order it all in one place.',
      variants: [
        { when: `${t('needs-create')}[data-can-create="no"]`, say: 'Sending items to Order parts needs permission to edit inventory. You can still see what’s low.' },
      ],
    },
    {
      id: 'create', selector: t('needs-create'), when: `!${MODAL}`, title: 'Or one order now',
      say: 'To order straight from one vendor instead, tick a few items and Create PO from selected makes one draft order with all of them on it.',
      variants: [
        { when: `${t('needs-create')}[data-can-create="no"]`, say: 'Making a purchase order needs permission to edit inventory. You can still see what’s low.' },
        { when: `${t('needs-create')}[data-selected="yes"]`, say: 'Create PO from selected makes one draft order with everything you ticked.' },
      ],
    },
    {
      id: 'modal', selector: MODAL, title: 'Pick the vendor',
      say: 'Pick who you’re ordering from. If every ticked item names the same supplier, it’s picked for you. The order starts as a draft.',
      variants: [
        { when: `${MODAL}[data-vendors="none"]`, say: 'You don’t have any vendors yet. Add one on the Vendors page, then come back.' },
      ],
    },
  ],
}
