import type { PageTour } from '../types'

/**
 * Jobs & workflow → Warranty settings (/tool-shed/warranty-settings).
 *
 *   warranty-claim-policy  data-policy = unlimited | one_per_warranty
 *   settings-read-only     shown to people who can look but not change it
 */
const t = (id: string) => `[data-tour="${id}"]`
const policy = (p: string) => `${t('warranty-claim-policy')}[data-policy="${p}"]`

export const PAGE_TOUR: PageTour = {
  id: 'warranty-settings',
  route: '^/tool-shed/warranty-settings/?$',
  intro: {
    page: 'Warranty settings',
    purpose: 'Decide what happens after a customer makes a warranty claim, and how early you hear that a warranty is running out.',
    covers: ['Your policy at a glance', 'Claim policy', 'Expiring soon', 'Saving'],
  },
  steps: [
    {
      id: 'header', selector: t('warranty-rules-header'),
      title: 'Warranty rules',
      say: 'These are your company’s warranty rules. How long each warranty lasts is set on each item in your catalog.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see these rules, but not change them. Ask an owner or admin if something needs updating.',
    },
    {
      id: 'preview', selector: t('warranty-rules-preview'),
      title: 'Your policy at a glance',
      say: 'This sums up your choices below in plain words. It updates as you pick, but nothing applies until you save.',
    },
    {
      id: 'policy', selector: t('warranty-claim-policy'), title: 'Claim policy',
      say: 'What happens after a customer makes a claim.',
      variants: [
        { when: policy('unlimited'), say: 'Right now customers can claim as many times as they need until the warranty ends. Pick One claim per warranty if a claim should end the cover.' },
        { when: policy('one_per_warranty'), say: 'Right now one claim ends the cover on that warranty. Pick Unlimited claims to keep it going until it expires.' },
      ],
    },
    {
      id: 'expiring', selector: t('warranty-expiring-days'),
      title: 'Expiring soon',
      say: 'How many days ahead a warranty is flagged as expiring soon, so you can offer the work while it’s covered. To email the customer too, turn on the warranty reminder in Automations.',
    },
    {
      id: 'save', selector: t('warranty-rules-save'),
      title: 'Save',
      say: 'Press Save warranty settings to apply your choices.',
    },
  ],
}
