import type { PageTour } from '../types'

/**
 * Daily work → Contracts (/maintenance-contracts): service agreements and
 * plan requests.
 *
 * States: the Agreements / Plan requests tabs carry aria-selected; each plan
 * request (contracts-request) has data-status = new | surveying | proposed |
 * declined | withdrawn and data-walkthrough = yes | no; its buttons
 * (contracts-request-actions) have data-step = book | finish | finished |
 * propose. contracts-empty shows when no agreements match.
 */
const t = (id: string) => `[data-tour="${id}"]`
const REQ = t('contracts-request')
const STEP = t('contracts-request-actions')

export const PAGE_TOUR: PageTour = {
  id: 'contracts',
  route: '^/maintenance-contracts/?$',
  intro: {
    page: 'Service agreements',
    purpose: 'Work you’ve agreed to do on a schedule, for a fee. Each agreement books its own visits and bills on its own rhythm.',
    covers: ['Your agreements', 'Finding one', 'Plan requests', 'Walkthroughs', 'Starting a proposal'],
  },
  steps: [
    { id: 'header', selector: t('contracts-header'), title: 'Service agreements', say: 'Work you’ve agreed to do on a schedule, like a set number of visits a year.' },
    { id: 'new', selector: t('contracts-new'), title: 'New service agreement', say: 'Write up a new agreement from scratch.' },
    { id: 'tabs', selector: t('contracts-tabs'), title: 'Agreements and requests', say: 'Your agreements, and plan requests from customers who asked for one.' },

    // ── Agreements tab ──
    { id: 'filters', selector: t('contracts-filters'), title: 'Find one', say: 'Search by customer or title, or show just one status.' },
    {
      id: 'list', title: 'Your agreements', say: '',
      variants: [
        { when: t('contracts-row'), selector: t('contracts-row'), say: 'Each card is one agreement: the customer, the dates, what’s covered, and the price. Click one to open it.' },
        { when: (page) => page.text(t('contracts-empty')).includes('match'), selector: t('contracts-empty'), say: 'No agreements match. Clear the search or pick another status.' },
        { when: t('contracts-empty'), selector: t('contracts-empty'), title: 'No agreements yet', say: 'No agreements yet. Make one here, or build one straight from an estimate or a piece of equipment.' },
      ],
    },

    // ── Plan requests tab ──
    { id: 'requests', click: t('contracts-requests'), selector: t('contracts-requests-panel'), title: 'Plan requests', say: 'Customers who asked for a service plan from their portal or the marketplace. Answer each one with a proposal, or decline it.' },
    {
      id: 'request', title: 'A request', say: '',
      variants: [
        { when: `${REQ}[data-walkthrough="yes"]`, selector: `${REQ}[data-walkthrough="yes"]`, say: 'This customer asked for a paid walkthrough first, so someone can see the place before you price the plan.' },
        { when: REQ, selector: REQ, say: 'What the customer asked for, and the equipment they told you about.' },
      ],
    },
    {
      id: 'request-step', title: 'Next step', say: '',
      variants: [
        { when: `${STEP}[data-step="book"]`, selector: `${STEP}[data-step="book"]`, title: 'Book the walkthrough', say: 'Book the walkthrough makes a job for the visit, so it can go on the schedule.' },
        { when: `${STEP}[data-step="finish"]`, selector: `${STEP}[data-step="finish"]`, title: 'Finish the walkthrough', say: 'When the visit is done, Finish walkthrough works out the time and puts it on the job at your hourly rate.' },
        { when: `${STEP}[data-step="finished"]`, selector: `${STEP}[data-step="finished"]`, title: 'Ready for a proposal', say: 'The walkthrough is done. Start proposal drafts a plan covering everything now on file at the property.' },
        { when: STEP, selector: STEP, title: 'Answer it', say: 'Start proposal drafts the plan for you to check. Decline lets the customer know why.' },
      ],
    },
    { id: 'proposed', selector: `${REQ}[data-status="proposed"]`, title: 'Proposed', say: 'You’ve sent this customer a proposal. Open the agreement to see where it’s at.' },
  ],
}
