import type { PageTour } from '../types'

/**
 * Money → Where card payments go (/tool-shed/payments/card-processor).
 * Drawn by the shared focused-setting page.
 *
 * States: setting-control data-setting-value = stripe | godaddy; each choice
 * [role=radio] carries data-option and data-available = yes | no (a processor
 * that isn't connected can't be picked); settings-read-only for people who
 * can't change it; setting-savebar only while a change is unsaved.
 */
const t = (id: string) => `[data-tour="${id}"]`
const opt = (o: string, available: 'yes' | 'no') => `${t('setting-control')} [data-option="${o}"][data-available="${available}"]`
const value = (v: string) => `${t('setting-control')}[data-setting-value="${v}"]`

export const PAGE_TOUR: PageTour = {
  id: 'card-processor',
  route: '^/tool-shed/payments/card-processor/?$',
  intro: {
    page: 'Where card payments go',
    purpose: 'If you have more than one way to take a card, pick the one that charges your customers. The money goes to you; CrewBarn never holds it.',
    covers: ['The choice', 'What happens with it', 'Saving'],
  },
  steps: [
    { id: 'title', selector: t('setting-title'), title: 'Where card payments go', say: 'One question: which card processor charges your customers.' },
    { id: 'read-only', selector: t('settings-read-only'), title: 'View only', say: 'You can see this setting but not change it. An owner or admin can.' },
    {
      id: 'control', selector: t('setting-control'), title: 'The choice',
      say: 'Pick Stripe or GoDaddy Payments.',
      variants: [
        {
          when: (page) => !!page.find(opt('stripe', 'no')) && !!page.find(opt('godaddy', 'no')),
          title: 'Nothing connected yet',
          say: 'Neither processor is connected yet, so there’s nothing to pick. Connect one on the Payments page first.',
        },
        { when: opt('godaddy', 'no'), say: 'Stripe is the one in use. GoDaddy Payments can be picked once it’s connected.' },
        { when: opt('stripe', 'no'), say: 'GoDaddy Payments is the one in use. Stripe can be picked once it’s connected.' },
        { when: value('stripe'), say: 'Both are connected. Stripe is charging your customers now; you can switch to GoDaddy Payments.' },
        { when: value('godaddy'), say: 'Both are connected. GoDaddy Payments is charging your customers now; you can switch to Stripe.' },
      ],
    },
    {
      id: 'consequences', selector: t('setting-consequences'), title: 'With this choice',
      say: 'This box spells out what your choice means for the portal, the office and your techs’ card readers.',
      variants: [
        { when: value('stripe'), say: 'With Stripe, the portal and the office charge through Stripe, and techs can take Tap to Pay on their phone.' },
        { when: value('godaddy'), say: 'With GoDaddy, the portal and the office charge through GoDaddy, and techs use the GoDaddy Smart Terminal.' },
      ],
    },
    { id: 'scope', selector: t('setting-scope'), title: 'Only new charges', say: 'Switching only changes new charges. Payments already taken keep their records and refunds.' },
    { id: 'next', selector: t('setting-next'), title: 'Connect a processor', say: 'This link takes you to the Payments page to connect a processor.' },
    { id: 'save', selector: t('setting-savebar'), title: 'Save it', say: 'Nothing is saved yet. Save change keeps it; Cancel puts it back.' },
  ],
}
