import type { PageTour } from '../types'

/**
 * Catalog & inventory (/connect/catalog): the area page.
 *
 * A card per group (What you sell, Reference, Stock, Labels), each linking to
 * its settings. Groups the person can't open are left off the page, and the
 * steps for them are skipped. While a search finds nothing, the "No settings
 * match" note shows instead of the groups.
 */
const t = (id: string) => `[data-tour="${id}"]`
const group = (slug: string) => t(`connect-group-${slug}`)

export const PAGE_TOUR: PageTour = {
  id: 'connect-catalog',
  route: '^/connect/catalog/?$',
  intro: {
    page: 'Catalog & inventory',
    purpose: 'Everything about what you sell and the stock you keep: your services and products, reference cards, stock rules, vendors and labels.',
    covers: ['What you sell', 'Reference cards', 'Stock and vendors', 'Labels', 'Finding a setting'],
  },
  steps: [
    {
      id: 'header', selector: t('connect-area-header'),
      title: 'Catalog & inventory',
      say: 'This area holds what you sell and the stock behind it. The number on the right is how many settings live here.',
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
      id: 'sell', selector: group('what-you-sell'),
      title: 'What you sell',
      say: 'Your service and product catalogs, and the categories that group them. These are the lines that go on estimates and invoices.',
    },
    {
      id: 'reference', selector: group('reference'),
      title: 'Reference',
      say: 'Reference cards hold what your shop knows, plus manuals and price books as PDFs your team can flip through.',
    },
    {
      id: 'stock', selector: group('stock'),
      title: 'Stock',
      say: 'Inventory settings set your low-stock levels and counting rules. Vendors is who you buy from.',
    },
    {
      id: 'labels', selector: group('labels'),
      title: 'Labels',
      say: 'Set up the printer that makes your shelf, bin and part labels.',
    },
    {
      id: 'open', selector: t('connect-area-groups'),
      title: 'Open any setting',
      say: 'Press any line to open that setting. Every page has its own walk-through, from the same button at the top.',
    },
  ],
}
