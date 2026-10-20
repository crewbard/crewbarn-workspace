import type { PageTour } from '../types'

/**
 * Team → Time off (/tool-shed/time-off).
 *
 *   time-off-header  data-view = team | mine (people without staff access see only their own)
 *   time-off-row     data-status = pending | approved | denied | cancelled
 *   time-off-empty   no requests (or none match)
 *
 * The request form opens from + New request and is closed with its own
 * Cancel; nothing is sent.
 */
const t = (id: string) => `[data-tour="${id}"]`
const TEAM = `${t('time-off-header')}[data-view="team"]`
const FORM = t('time-off-form-for')

export const PAGE_TOUR: PageTour = {
  id: 'time-off',
  route: '^/tool-shed/time-off/?$',
  intro: {
    page: 'Time off',
    purpose: 'Vacation, sick days and personal time, asked for and answered in one place. Approved time off blocks the schedule, so nobody gets booked while they’re away.',
    covers: ['Asking for time off', 'Counts and filters', 'Approving or denying', 'The request form'],
  },
  steps: [
    {
      id: 'header', selector: t('time-off-header'), title: 'Time off',
      say: 'This is your own time off. Ask for days here, and your office approves or denies them.',
      variants: [
        { when: TEAM, say: 'Your whole team’s time off. Staff ask for days, and the office approves or denies them before they block the schedule.' },
      ],
    },
    {
      id: 'counts', selector: t('time-off-counts'),
      title: 'At a glance',
      say: 'How many requests are waiting, approved, denied or cancelled. Tap one to show just those.',
    },
    {
      id: 'filters', selector: t('time-off-filters'),
      title: 'Filter and search',
      say: 'Filter by status, or search names, reasons and notes.',
    },
    {
      id: 'list', selector: t('time-off-list'), title: 'Requests', say: '',
      variants: [
        { when: t('time-off-empty'), selector: t('time-off-empty'), title: 'Nothing here yet', say: 'No requests to show. Press New request when someone needs time away.' },
        { when: `${t('time-off-row')}[data-status="pending"]`, selector: `${t('time-off-row')}[data-status="pending"]`, title: 'Waiting for an answer', say: 'This one is still waiting. It shows who, what kind of time, the dates and the reason.' },
        { when: t('time-off-row'), selector: t('time-off-row'), say: 'Each request shows who, what kind of time, the dates, and who answered it.' },
      ],
    },
    {
      id: 'actions', selector: t('time-off-row-actions'), title: 'Approve or deny', say: '',
      variants: [
        { when: TEAM, say: 'Approve or deny a waiting request, with a note if you like. A decided one can be reopened if plans change.' },
        { when: t('time-off-row'), say: 'While your request is still waiting, you can cancel it here.' },
      ],
    },
    {
      id: 'new', selector: t('time-off-new'),
      title: 'New request',
      say: 'New request asks for time off. Let’s look at the form.',
    },
    {
      id: 'form-for', selector: FORM, open: `click:${t('time-off-new')}`, waitMs: 1200,
      title: 'Who it’s for',
      say: 'Pick the person. If you’re asking for yourself, it’s already filled in.',
    },
    {
      id: 'form-type', selector: t('time-off-form-type'), when: FORM,
      title: 'What kind',
      say: 'Vacation, sick, personal or unpaid.',
    },
    {
      id: 'form-allday', selector: t('time-off-form-allday'), when: FORM,
      title: 'All day',
      say: 'Untick All day to ask for just a few hours.',
    },
    {
      id: 'form-dates', selector: t('time-off-form-start'), when: FORM,
      title: 'Dates',
      say: 'The first and last day away.',
    },
    {
      id: 'form-reason', selector: t('time-off-form-reason'), when: FORM,
      title: 'Reason',
      say: 'A short reason helps the office decide quickly.',
    },
    {
      id: 'form-submit', selector: t('time-off-form-submit'), when: FORM,
      title: 'Send it',
      say: 'Submit sends the request. We’ll close this with Cancel, so nothing is sent.',
    },
    {
      id: 'done', click: t('time-off-form-cancel'), selector: t('time-off-counts'),
      title: 'That’s time off',
      say: 'Approved time off shows on the schedule, so nobody gets a job while they’re away.',
    },
  ],
}
