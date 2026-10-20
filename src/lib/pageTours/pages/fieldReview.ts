import type { PageTour } from '../types'

/**
 * Daily work → Dispatch → Field review (/dispatch/field-review).
 * Visits with a loose end, and booked jobs nobody checked into.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'field-review',
  route: '^/dispatch/field-review/?$',
  intro: {
    page: 'Field review',
    purpose: 'The office’s to-do list from the field: visits with a loose end, and booked jobs nobody checked into.',
    covers: ['What to review', 'Visits that need you', 'Missed check-ins', 'Dates'],
  },
  steps: [
    { id: 'header', selector: t('field-review-header'), title: 'Field review', say: 'Loose ends from the field, in one list. Nothing here approves work or makes an invoice.' },
    { id: 'cards', selector: t('field-review-cards'), title: 'What to review', say: 'Look at everything, just open visits, or just missed arrivals.' },
    {
      id: 'visits', selector: t('field-review-visits'), title: 'Needs review', say: 'Open visits that need you, like a tech who left without checking out. Click a row to sort it out on the job.',
      variants: [
        { when: (page) => page.text(t('field-review-visits')).includes('Nothing open needs review'), say: 'Nothing open needs review. The field is all tidy.' },
      ],
    },
    { id: 'missed', selector: t('field-review-missed'), title: 'Missed check-ins', say: 'Booked jobs where nobody ever checked in, with the time they were booked for.' },
    { id: 'dates', selector: t('field-review-dates'), title: 'Dates', say: 'The dates change the missed check-ins. Left blank, it shows the last seven days.' },
  ],
}
