import type { PageTour } from '../types'

/**
 * Money (/connect/money): the area page.
 *
 * A card per group (Getting paid, Invoices & tax, Pricing, Cash rules), each
 * linking to its settings. Groups the person can't open are left off the
 * page, and the steps for them are skipped.
 */
const t = (id: string) => `[data-tour="${id}"]`
const group = (slug: string) => t(`connect-group-${slug}`)

export const PAGE_TOUR: PageTour = {
  id: 'connect-money',
  route: '^/connect/money/?$',
  intro: {
    page: 'Money',
    purpose: 'How you get paid and what you charge: card and bank payments, terms, tax, pricing, and the rules for cash from the field.',
    covers: ['Getting paid', 'Invoices and tax', 'Pricing', 'Cash rules', 'Finding a setting'],
  },
  steps: [
    {
      id: 'header', selector: t('connect-area-header'),
      title: 'Money',
      say: 'This area sets up how money comes in. The number on the right is how many settings live here.',
    },
    {
      id: 'filter', selector: t('connect-area-filter'),
      title: 'Jump or search',
      say: 'Each chip jumps to a group. Or type in the box to find a setting by name.',
      variants: [
        { when: t('connect-area-nomatch'), say: 'Nothing matches what’s typed in the search box right now. Clear search brings every group back.' },
      ],
    },
    {
      id: 'paid', selector: group('getting-paid'),
      title: 'Getting paid',
      say: 'Connect a card processor, let customers pay by bank transfer, and choose the ways your team can record a payment.',
    },
    {
      id: 'tax', selector: group('invoices-tax'),
      title: 'Invoices and tax',
      say: 'Payment terms say when an invoice is due. Tax classes are the rates your lines carry.',
    },
    {
      id: 'pricing', selector: group('pricing'),
      title: 'Pricing',
      say: 'Discounts you offer, and your cost model, which works out the hourly rate you need to charge.',
    },
    {
      id: 'cash', selector: group('cash-rules'),
      title: 'Cash rules',
      say: 'Decide whether a tech has to hand in cash they collected before starting the next job.',
    },
    {
      id: 'open', selector: t('connect-area-groups'),
      title: 'Open any setting',
      say: 'Press any line to open that setting. Every page has its own walk-through, from the same button at the top.',
    },
  ],
}
