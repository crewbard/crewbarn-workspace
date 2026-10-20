import type { PageTour } from '../types'

/**
 * Order parts (/order-parts): the parts cart, reviewed by whoever orders
 * parts, and made into purchase orders.
 *
 * States: parts waiting (order-parts-list, order-parts-toolbar
 * data-ready = yes | no) or nothing waiting (order-parts-empty); low
 * stock not yet on the list (order-parts-low-stock); the orders just made
 * (order-parts-made); drafts made here (order-parts-drafts). Someone who
 * asks for parts but does not order them sees their own (order-parts-mine).
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'order-parts',
  route: '^/order-parts/?$',
  intro: {
    page: 'Order parts',
    purpose: 'The one place parts get ordered from. Everything your crew put in the parts cart, and what is low on the shelves, grouped by part, ready for you to pick suppliers.',
    covers: ['Who asked, and what for', 'Picking a supplier', 'Splitting a part', 'Making the orders', 'Taking one back'],
  },
  // The intro film, before the walk-through (see ../film.ts).
  film: [
    { id: 'name', say: 'This is Order parts, where everything in the parts cart gets ordered.', visual: { kind: 'title', title: 'Order parts', subtitle: 'The parts cart, ready to order' } },
    { id: 'cart', title: 'The parts cart', say: 'When someone needs a part for a job, they put it in the parts cart, from anywhere in the app.', visual: { kind: 'cart', order: 'Purchase order', supplier: 'Picked next' } },
    {
      id: 'grouped', title: 'Grouped by part', say: 'Here it’s grouped by part, with who asked and which job it’s for, plus anything running low on the shelves.',
      visual: { kind: 'list', heading: 'Parts waiting', rows: [
        { title: 'Sealant', meta: 'Three, for two jobs · Sam and Alex', chip: 'In the cart', tone: 'amber' },
        { title: 'Mounting bracket', meta: 'Two, for a repair visit · Sam', chip: 'In the cart', tone: 'amber' },
        { title: 'Wire connectors', meta: 'Down to four on the shelf', chip: 'Low stock', tone: 'red' },
      ] },
    },
    { id: 'order', title: 'Making the orders', say: 'Pick a supplier for each part, then create the purchase orders in one go. Receiving them later puts the parts on your shelves.', visual: { kind: 'pipeline', stages: ['In the cart', 'Supplier picked', 'Order made', 'Received'], card: 'Sealant × 3' } },
    { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
  ],
  steps: [
    {
      id: 'header', selector: t('order-parts-header'), title: 'Order parts',
      say: 'Parts your crew asked for from catalogs, reference cards, items, estimates and jobs all land here. Nobody had to pick a supplier to ask.',
    },
    {
      id: 'mine', selector: t('order-parts-mine'), when: t('order-parts-mine'), title: 'What you asked for',
      say: 'The parts you asked for and where they are. Change how many or take one out until it is on an order.',
    },
    {
      id: 'made', selector: t('order-parts-made'), when: t('order-parts-made'), title: 'Orders made',
      say: 'The purchase orders you just made, one for each supplier. They start as drafts: check them, then mark each one ordered.',
    },
    {
      id: 'low', selector: t('order-parts-low-stock'), title: 'Low on the shelves',
      say: 'Items that dropped to their reorder point can join the list too, so stock and job parts go out on the same orders.',
    },
    {
      id: 'list', title: 'Parts waiting', say: '',
      variants: [
        { when: t('order-parts-empty'), selector: t('order-parts-empty'), title: 'Nothing waiting', say: 'Nothing is waiting to be ordered right now. Parts show up here as soon as someone adds them to the cart.' },
        { when: t('order-parts-list'), selector: t('order-parts-list'), say: 'Each part once, even when several people asked for it. The soonest needed come first.' },
      ],
    },
    {
      id: 'asks', selector: t('order-parts-asks'), title: 'Who asked, and what for',
      say: 'Every ask for this part: how many, whether it is for stock, a job or an estimate, who asked, and when it is needed. A part for an estimate waits for the customer to say yes.',
    },
    {
      id: 'supplier', selector: t('order-parts-supplier'), title: 'Pick the supplier',
      say: 'Pick who this comes from. Suppliers who have sold it before are listed first, with what it cost and how long it took. The starred one is already picked.',
    },
    {
      id: 'split', selector: t('order-parts-split'), title: 'Split it',
      say: 'When one supplier can’t cover it all, split it with another and say how many from each. Ordering more than was asked puts the extra on the shelves.',
    },
    {
      id: 'preferred', selector: t('order-parts-preferred'), title: 'Use preferred for all',
      say: 'Use preferred for all sends every part to its starred supplier in one press. You can still change any of them.',
    },
    {
      id: 'create', selector: t('order-parts-create'), title: 'Create purchase orders',
      say: 'Create purchase orders makes one order for each supplier. Every line remembers its job or estimate, so parts are set aside for the right job when they arrive.',
      variants: [
        { when: `${t('order-parts-toolbar')}[data-ready="no"]`, say: 'Pick a supplier for at least one part, then Create purchase orders makes one order for each supplier.' },
      ],
    },
    {
      id: 'on-po', selector: t('order-parts-on-po'), title: 'Already on an order',
      say: 'A part already on an order shows which one. Undo puts it back in the cart, as long as the order hasn’t been marked ordered.',
    },
    {
      id: 'drafts', selector: t('order-parts-drafts'), title: 'Drafts made here',
      say: 'Orders made here that haven’t gone out yet. Put one back in the cart to choose again, or open it to mark it ordered.',
    },
  ],
}
