import type { PageTour } from '../types'

/**
 * Connections → Integrations (/tool-shed/integrations). One card per
 * outside service; each card marks data-configured = yes | no.
 */
const t = (id: string) => `[data-tour="${id}"]`
const card = (id: string) => t(`integrations-card-${id}`)
const ready = (id: string) => `${card(id)}[data-configured="yes"]`

const cardStep = (id: string, title: string, on: string, off: string) => ({
  id, selector: card(id), title, say: '',
  variants: [
    { when: ready(id), say: on },
    { when: card(id), say: off },
  ],
})

export const PAGE_TOUR: PageTour = {
  id: 'integrations',
  route: '^/tool-shed/integrations/?$',
  intro: {
    page: 'Integrations',
    purpose: 'Every outside service your company is plugged into, at a glance. Click any card to set it up or change it.',
    covers: ['Storage', 'Maps', 'AI', 'Email and texting', 'GPS', 'Brand'],
  },
  steps: [
    {
      id: 'header', selector: t('integrations-header'),
      title: 'Integrations',
      say: 'Green means set up, amber means not yet. No passwords or keys are shown here.',
    },
    cardStep('storage-ownership', 'Storage', 'Your photos, videos and files have somewhere to live.', 'Storage isn’t set up yet. Open it to choose where your files are kept.'),
    cardStep('google-maps', 'Google Maps', 'Maps are working: address search, map views and finding locations.', 'Maps aren’t set up, so address search and map views are off. Open it to add a key.'),
    cardStep('ai', 'AI', 'Your AI helper is set up. The card says whether it’s switched on.', 'No AI yet. Pick a company and add a key to switch on drafting and photo reading.'),
    cardStep('email', 'Email', 'Email is set up. The card says who it sends as.', 'Email isn’t set up yet, so emails to customers are off.'),
    cardStep('sms', 'Texting', 'Texting is set up. The card says which service and number it uses.', 'Texting isn’t set up yet. Open it to choose how texts are sent.'),
    cardStep('gps-tracking', 'GPS tracking', 'Trackers are reporting to your live map.', 'No trackers yet. Phones add themselves when techs clock in, or add a van tracker.'),
    cardStep('brand-logo', 'Brand & logo', 'Your logo and colour are on your quotes and invoices.', 'No logo or colour yet. Add them so your paperwork looks like yours.'),
  ],
}
