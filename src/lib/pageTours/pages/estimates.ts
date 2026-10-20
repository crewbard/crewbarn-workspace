import type { PageTour } from '../types'

/**
 * Daily work → Estimates (/estimates).
 *
 * States: each estimate (estimates-row) has data-estimate-status = draft |
 * sent | approved | rejected | expired | superseded; the Easy layouts add a
 * board (estimates-board) and action cards; Files view shows estimates-files.
 * The view buttons (estimates-view-rows / -cards / -files) carry
 * aria-pressed. The Created from / To dates, the Sort box and the Quick Peek
 * buttons have no marker of their own yet, so they're found by their labels.
 */
const t = (id: string) => `[data-tour="${id}"]`
const ROW = t('estimates-row')
const pressed = (id: string) => `${t(id)}[aria-pressed="true"]`
const row = (s: string) => `${ROW}[data-estimate-status="${s}"]`

export const PAGE_TOUR: PageTour = {
  id: 'estimates',
  route: '^/estimates/?$',
  intro: {
    page: 'Estimates',
    purpose: 'Every estimate from first draft to approved. See what to send, who to follow up with, and what’s ready to become a job.',
    covers: ['Orders from customers', 'By status', 'Finding one', 'Rows, cards or files', 'Reading an estimate', 'The next step'],
  },
  steps: [
    { id: 'header', selector: `${t('estimates-header')}, ${t('estimates-action-cards')}`, title: 'Estimates', say: 'Every estimate lives here, from first draft to approved.' },
    { id: 'new', selector: t('estimates-new'), title: 'New estimate', say: 'Start a fresh estimate.' },
    { id: 'orders', selector: t('estimates-customer-orders'), title: 'Orders from customers', say: 'Customers picked parts from your catalogs in their portal. Create estimate turns an order into a draft at your prices.' },
    { id: 'cards', selector: t('estimates-action-cards'), title: 'Shortcuts', say: 'Drafts to finish, ones waiting on the customer, approved ones, and ones that expired.' },
    { id: 'tabs', selector: t('estimates-tabs'), title: 'By status', say: 'Draft, Sent, Approved, Declined and Expired, each with its count.' },
    { id: 'filters', selector: t('estimates-filters'), title: 'Search', say: 'Find an estimate by its number or notes, or filter by status.' },
    { id: 'dates', selector: '[aria-label="Estimates created from"]', title: 'Created dates', say: 'Created from and To narrow this page to estimates made between two dates.' },
    { id: 'sort', selector: '[aria-label="Sort estimates on current page"]', title: 'Sort', say: 'Sort this page by newest, oldest, or customer name.' },
    {
      id: 'view', selector: `${t('estimates-view')}, [aria-label="Estimate view"]:has(${t('estimates-view-files')})`, title: 'How to look at them', say: 'A board in lanes, or a list.',
      variants: [
        { when: pressed('estimates-view-files'), say: 'You’re in Files: estimates in folders by year and month. Rows is a plain list, and Cards shows one card per estimate.' },
        { when: pressed('estimates-view-cards'), say: 'You’re in Cards: one card per estimate. Rows is a plain list, and Files puts them in folders by year and month.' },
        { when: t('estimates-view-rows'), say: 'Rows, Cards, or Files, which puts estimates in folders by year and month. Your pick stays put.' },
      ],
    },
    { id: 'board', selector: t('estimates-board'), title: 'The board', say: 'Lanes for drafts, waiting on the customer, approved, and closed. Open one to work on it.' },
    {
      id: 'list', title: 'Your estimates', say: '',
      variants: [
        { when: row('approved'), selector: row('approved'), title: 'Approved', say: 'A green stripe means approved. The customer said yes, so it’s ready to become a job.' },
        { when: row('sent'), selector: row('sent'), title: 'Waiting on the customer', say: 'A blue stripe means sent and waiting for an answer. These are the ones to follow up on.' },
        { when: row('draft'), selector: row('draft'), title: 'A draft', say: 'A grey stripe is a draft the customer hasn’t seen yet.' },
        { when: ROW, selector: ROW, say: 'Each estimate shows its number, customer, status and total. Click one to open it.' },
        { when: (page) => page.text(t('estimates-list')).includes('No estimates match'), selector: t('estimates-list'), say: 'No estimates match this tab or search. Try All, or clear the search.' },
        { when: (page) => page.text(t('estimates-list')).includes('No estimates yet'), selector: t('estimates-list'), title: 'No estimates yet', say: 'No estimates yet. Press New to make your first one.' },
      ],
    },
    { id: 'peek', selector: '[aria-label^="Quick Peek at"]', title: 'Quick Peek', say: 'Quick Peek shows an estimate in a window without leaving the list. Open estimate takes you all the way in.' },
    { id: 'next', selector: t('estimates-next-step'), title: 'Next step', say: 'This chip says what to do next: send a draft, follow up on one that’s out, or convert an approved one into a job.' },
    { id: 'tiles', selector: t('estimates-folder-tiles'), title: 'Won and lost', say: 'Everything quoted, won, lost, and gone quiet in this month. Click a tile to filter.' },
    { id: 'files', selector: t('estimates-files'), title: 'Files by year', say: 'Every estimate filed by year and month, like a cabinet.' },
    { id: 'pager', selector: t('estimates-pager'), title: 'More pages', say: 'Move between pages of estimates.' },
  ],
}
