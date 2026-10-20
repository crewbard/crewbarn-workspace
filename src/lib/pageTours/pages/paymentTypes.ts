import type { PageTour } from '../types'

/**
 * Money → Payment types (/tool-shed/payment-types).
 *
 * States: payment-types-preview data-draft = yes | no (unsaved changes);
 * payment-types-custom data-count; payment-types-discard only with unsaved
 * changes; settings-read-only for people who can't change them.
 */
const t = (id: string) => `[data-tour="${id}"]`
const DRAFT = `${t('payment-types-preview')}[data-draft="yes"]`

export const PAGE_TOUR: PageTour = {
  id: 'payment-types',
  route: '^/tool-shed/payment-types/?$',
  intro: {
    page: 'Payment types',
    purpose: 'The ways your team can record a payment by hand, like cash, check or Zelle, on the web and in the crew app.',
    covers: ['What your team sees', 'Built-in types', 'Your own types', 'Saving'],
  },
  steps: [
    { id: 'header', selector: t('payment-types-header'), title: 'Payment types', say: 'These are for recording a payment by hand. Card processors and bank transfers are set up on the Payments page.' },
    { id: 'read-only', selector: t('settings-read-only'), title: 'View only', say: 'You can see these but not change them. An owner or admin can.' },
    {
      id: 'preview', selector: t('payment-types-preview'), title: 'What your team sees',
      say: 'This is the list your team picks from when they record a payment.',
      variants: [{ when: DRAFT, say: 'This preview shows your unsaved changes: the list your team will pick from once you save.' }],
    },
    { id: 'builtin', selector: t('payment-types-builtin'), title: 'Built-in types', say: 'Switch off the ones you never take, so nobody records them by mistake. Other is always on.' },
    {
      id: 'custom', selector: t('payment-types-custom'), title: 'Your own types',
      say: 'Your own payment types, like Venmo or a house account.',
      variants: [{ when: `${t('payment-types-custom')}[data-count="0"]`, say: 'No types of your own yet. Add the ways your customers actually pay, like Zelle or a house account.' }],
    },
    { id: 'add', selector: t('payment-types-add'), title: 'Add one', say: 'Type a name and press Add.' },
    {
      id: 'save', selector: t('payment-types-save'), title: 'Save changes',
      say: 'Changes wait until you press Save changes.',
      variants: [{ when: DRAFT, say: 'You have unsaved changes. Save changes keeps them; Discard puts everything back.' }],
    },
  ],
}
