import type { PageTour } from '../types'

/**
 * Accounting → Inventory & PO cost (/accounting/inventory-cost).
 *
 * States: inv-cost-pos data-count (0 = no purchase orders in the period).
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'inventory-cost',
  route: '^/accounting/inventory-cost/?$',
  intro: {
    page: 'Inventory cost',
    purpose: 'What your stock is worth and what you spent on purchase orders, for the dates you pick.',
    covers: ['Headline numbers', 'Purchase order spend', 'Value by location', 'Recent orders'],
  },
  steps: [
    { id: 'header', selector: t('inv-cost-header'), title: 'Inventory and PO cost', say: 'Stock value and purchasing, side by side. Pick the dates at the top.' },
    { id: 'metrics', selector: t('inv-cost-metrics'), title: 'Headline numbers', say: 'Your stock’s value at cost, how much is free to use, how many on hand, and what you spent on orders.' },
    { id: 'spend', selector: t('inv-cost-spend'), title: 'PO spend', say: 'What you bought, broken down by item, vendor, category or order.' },
    { id: 'locations', selector: t('inv-cost-locations'), title: 'Value by location', say: 'What’s sitting in each warehouse and truck.' },
    {
      id: 'pos', selector: t('inv-cost-pos'), title: 'Recent purchase orders', say: 'The latest orders and their totals. Press one to open it.',
      variants: [{ when: `${t('inv-cost-pos')}[data-count="0"]`, say: 'No purchase orders in this period.' }],
    },
    { id: 'status', selector: t('inv-cost-status'), title: 'PO status', say: 'How many orders are drafts, ordered, or received.' },
    { id: 'shortcuts', selector: t('inv-cost-shortcuts'), title: 'Shortcuts', say: 'Quick links to Inventory, purchase orders and vendors.' },
  ],
}
