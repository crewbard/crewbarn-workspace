import type { PageTour } from '../types'

/**
 * Money → Pricing & discounts (/tool-shed/pricing).
 *
 * States: disc-list with discounts, or none yet (disc-list data-count="0");
 * settings-read-only; the discount form (disc-form data-editing = yes | no).
 */
const t = (id: string) => `[data-tour="${id}"]`
const FORM = t('disc-form')
const EMPTY = `${t('disc-list')}[data-count="0"]`

export const PAGE_TOUR: PageTour = {
  id: 'pricing-discounts',
  route: '^/tool-shed/pricing/?$',
  intro: {
    page: 'Pricing & discounts',
    purpose: 'Discounts you can put on estimates and invoices: a percentage off or a set dollar amount. Markups and minimum charges live on the Cost model.',
    covers: ['Your discounts', 'Adding one', 'Percent or dollars', 'Codes'],
  },
  steps: [
    { id: 'header', selector: t('disc-header'), title: 'Discounts', say: 'Set up the discounts your team gives, once, so everyone applies them the same way.' },
    { id: 'read-only', selector: t('settings-read-only'), title: 'View only', say: 'You can see the discounts but not change them.' },
    {
      id: 'list', selector: t('disc-list'), title: 'Your discounts',
      say: 'Each discount with its amount, its code, and whether it’s turned off. Edit and Delete sit on the right.',
      variants: [{ when: EMPTY, title: 'No discounts yet', say: 'No discounts yet. Common ones are seniors, veterans, or a seasonal deal.' }],
    },
    { id: 'add', selector: t('disc-add'), when: `!${FORM}`, title: 'Add a discount', say: 'Add discount opens a short form.' },
    {
      id: 'form', selector: FORM, when: FORM, title: 'New discount', say: 'A new discount. Nothing is made until you press Create.',
      variants: [{ when: `${FORM}[data-editing="yes"]`, title: 'Edit discount', say: 'A saved discount. Nothing changes until you press Save.' }],
    },
    { id: 'example', selector: t('disc-form-example'), title: 'See what it does', say: 'This shows what your discount does to a hundred-dollar job. It’s only an example.' },
    { id: 'name', selector: t('disc-form-name'), title: 'Name', say: 'Name it the way your team says it.' },
    { id: 'amount', selector: t('disc-form-amount'), title: 'Percent or dollars', say: 'Pick a percentage or a fixed amount, then how much comes off.' },
    { id: 'code', selector: t('disc-form-code'), title: 'Code', say: 'An optional code for a deal you advertise.' },
    { id: 'active', selector: t('disc-form-active'), title: 'Active', say: 'Untick Active to retire a discount and keep it on the list.' },
  ],
}
