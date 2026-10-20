import type { PageTour } from '../types'

/**
 * Daily work → Contracts → one agreement (/maintenance-contracts/:id).
 *
 * States: contract-status data-status = draft | pending_signature | active |
 * paused | expired | cancelled. contract-confirm-visits shows only when the
 * plan suggested visits for the office to confirm. Tabs (contract-tab-*)
 * carry aria-selected.
 */
const t = (id: string) => `[data-tour="${id}"]`
const S = t('contract-status')
const is = (s: string) => `${S}[data-status="${s}"]`

export const PAGE_TOUR: PageTour = {
  id: 'contract',
  route: '^/maintenance-contracts/(?!new/?$)[^/]+/?$',
  intro: {
    page: 'Service agreement',
    purpose: 'One agreement: where it’s at, the visits it books, the equipment it covers, and what it bills.',
    covers: ['Where it’s at', 'Visits to confirm', 'Coming up', 'What is covered', 'Billing and history'],
  },
  steps: [
    { id: 'header', selector: t('contract-header'), title: 'This agreement', say: 'The title, the dates it runs, and the price.' },
    {
      id: 'status', selector: S, title: 'Where it’s at', say: 'Where this agreement stands.',
      variants: [
        { when: is('draft'), title: 'Not started', say: 'Not started yet. It books no visits and bills nothing until you start it or it’s signed.' },
        { when: is('pending_signature'), title: 'Waiting to be signed', say: 'Waiting for the customer’s signature. Nothing is booked or billed until it’s signed.' },
        { when: is('active'), title: 'Running', say: 'Running. It books its own visits and bills on its own rhythm.' },
        { when: is('paused'), title: 'Paused', say: 'Paused. No visits are booked and nothing is billed until you pick it back up.' },
        { when: is('expired'), title: 'Ended', say: 'The term is over. It stays here for your records.' },
        { when: is('cancelled'), title: 'Cancelled', say: 'Cancelled. It stays here for your records.' },
      ],
    },
    { id: 'send', selector: t('contract-send'), title: 'Send to sign', say: 'Emails the customer a link to read and sign it.' },
    { id: 'paper', selector: t('contract-paper'), title: 'Signed on paper', say: 'Signed in person? Record it here.' },
    { id: 'start', selector: t('contract-start'), title: 'Start it', say: 'Starts the agreement, so it begins booking visits.' },
    { id: 'pause', selector: t('contract-pause'), title: 'Pause', say: 'Stops booking and billing for now, without ending it.' },
    { id: 'renewal', selector: t('contract-renewal'), title: 'Renewal', say: 'What it renews at, and how much that changes the price.' },
    {
      id: 'confirm', selector: t('contract-confirm-visits'), title: 'Confirm visits', say: 'Visits this plan suggested instead of booking. Nothing is booked until you confirm.',
      variants: [
        { when: (page) => page.text(t('contract-confirm-visits')).includes('Nothing waiting'), say: 'Visits this plan suggests wait here for you. Nothing is waiting right now.' },
        { when: t('contract-confirm-visits'), say: 'Visits this plan suggested, waiting for you. Tick the ones to keep and press Confirm, or Skip the rest. Book automatically lets it book its own from now on.' },
      ],
    },
    { id: 'tabs', selector: t('contract-tabs'), title: 'Tabs', say: 'Overview, the visits, the equipment covered, billing, and history.' },
    { id: 'coming', selector: t('contract-overview-coming'), title: 'Coming up', say: 'The next visits this agreement will book.' },
    { id: 'money', selector: t('contract-overview-money'), title: 'The money', say: 'What it bills and when.' },
    { id: 'visits', selector: t('contract-visits'), title: 'Visits', say: 'Every visit, booked or done.' },
    { id: 'equipment', selector: t('contract-equipment'), title: 'Equipment', say: 'The equipment this agreement covers.' },
    { id: 'billing', selector: t('contract-billing'), title: 'Billing', say: 'Each bill it has made.' },
    { id: 'history', selector: t('contract-history'), title: 'History', say: 'Everything that happened to this agreement, in order.' },
    { id: 'services', selector: t('contract-services'), title: 'What is covered', say: 'The services in this agreement, each with its own rhythm, like every spring and fall.' },
    { id: 'service-card', selector: t('contract-service-card'), title: 'A service', say: 'How often it happens, at which properties, and in which months.' },
    { id: 'add-service', selector: t('contract-add-service'), title: 'Add a service', say: 'Add another service to the agreement.' },
  ],
}
