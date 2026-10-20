import type { PageTour } from '../types'
import { FOCUS } from '../theme'

/**
 * Daily work → Estimates → New estimate (/estimates/new).
 * The job form, set to an estimate. Markers come from the shared form.
 *
 * Focus look: a note about the PDF order book (estimate-order-book), a
 * Step by step / Full page switch (estimate-entry-mode, buttons
 * estimate-entry-guided / -full with aria-pressed; Step by step is the
 * default there), and on Full page a Jump to row (form-jump-to). The tour
 * walks Full page, so every part is on screen.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'estimate-new',
  route: '^/estimates/new/?$',
  intro: {
    page: 'New estimate',
    purpose: 'Write up a quote: who it’s for, the work, and the price. Skip the schedule for a phone quote, or book a walkthrough.',
    covers: ['The customer', 'The work', 'A walkthrough visit', 'Lines and options', 'Saving it'],
  },
  steps: [
    { id: 'header', selector: t('estimate-new-header'), title: 'New estimate', say: 'The same form you use for jobs, set up for an estimate.' },
    { id: 'order-book', when: FOCUS, selector: t('estimate-order-book'), title: 'Your order book', say: 'Open PDF order book puts your price book beside the form for reference. Search catalog, under the lines, adds priced items, and you can offer good, better and best options.' },
    { id: 'mode', when: FOCUS, click: t('estimate-entry-full'), selector: t('estimate-entry-mode'), title: 'Step by step or Full page', say: 'Step by step takes the form one part at a time. Full page shows it all at once, which is how we’ll walk it. Switch whenever you like.' },
    { id: 'jump-to', when: FOCUS, selector: t('form-jump-to'), title: 'Jump to', say: 'On Full page, Jump to takes you straight to the customer, the scope, the price and options, the schedule or the notes.' },
    { id: 'drafts', selector: t('job-drafts'), title: 'Saved drafts', say: 'What you type is kept on this device, so a dropped call doesn’t lose it. Pick one up again here.' },
    { id: 'customer', selector: t('estimate-customer'), title: 'Customer', say: 'Pick the customer. Their main service address fills in by itself. Brand new caller? Add them right here.' },
    { id: 'tools', selector: t('job-setup-tools'), title: 'Extras', say: 'Attach a document to sign, a work order or PO from the customer, photos, or a checklist.' },
    { id: 'custom', selector: t('job-custom-required'), title: 'Your own fields', say: 'Fields your company asks for show up here.' },
    { id: 'basics', selector: t('job-basics'), title: 'The work', say: 'A title the customer will understand, the type of work, how urgent it is, and a description.' },
    { id: 'schedule', selector: `${t('job-schedule')}, ${t('job-dispatch')}`, title: 'Walkthrough or phone quote', say: 'Need to see it first? Book a visit here. For a phone quote, leave it unscheduled.' },
    { id: 'assets', selector: t('job-assets'), title: 'Equipment', say: 'If the work is on equipment you track for this customer, tick it here.' },
    { id: 'lines', selector: t('estimate-lineitems'), title: 'Lines and price', say: 'Add services and products from your catalog, fees and discounts. New tier offers options, like good, better and best.' },
    { id: 'notes', selector: t('job-notes'), title: 'Notes', say: 'Internal notes stay with your team. Public notes can show on the customer’s copy.' },
    { id: 'save', selector: t('estimate-save'), title: 'Create estimate', say: 'Saves it as a draft and opens it. Nothing is sent to the customer yet.' },
  ],
}
