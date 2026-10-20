import type { PageTour } from '../types'
import { FOCUS } from '../theme'

/**
 * Daily work → Schedule (/schedule).
 *
 * States: the view buttons (schedule-view-month / -week / -day) carry
 * aria-pressed; the To Schedule list has schedule-queue-row rows or none;
 * lanes (schedule-day-lane-tech / -unassigned / -sub) show only in Day view.
 * On a phone the calendar is schedule-mobile-agenda instead.
 *
 * Focus look: the filters (customer, tech, crew, subs, statuses and badges)
 * fold away behind a Filters button (schedule-filters-toggle, aria-expanded).
 * Their steps open it first.
 */
const t = (id: string) => `[data-tour="${id}"]`
const FILTERS = t('schedule-filters-toggle')
const view = (v: string) => `${t(`schedule-view-${v}`)}[aria-pressed="true"]`

export const PAGE_TOUR: PageTour = {
  id: 'schedule',
  route: '^/schedule/?$',
  intro: {
    page: 'Schedule',
    purpose: 'Give every job a date and a person. Work waiting for a date sits on the left; drag it onto the calendar on the right.',
    covers: ['Work waiting for a date', 'Month, week and day', 'Dragging a job on', 'Moving and handing over', 'Filters'],
  },
  steps: [
    { id: 'phone', selector: t('schedule-mobile-agenda'), title: 'On a phone', say: 'On a phone you get a simple list for one day, with arrows to move between days. Booking by dragging is done on a bigger screen.' },
    { id: 'page', selector: t('schedule-root'), title: 'The Schedule', say: 'Work that needs a date is on the left. The calendar is on the right. Booking a job is mostly dragging from left to right.' },
    { id: 'late', selector: t('schedule-late-risks'), title: 'A tech may be late', say: 'When a tech may be late, they hear it first: a red pop-up in the phone app with a Call customer button, and an automated call to their phone if you turned that on. A few minutes later the job is listed here and the Schedule button flashes, unless they already called the customer.' },
    { id: 'late-row', selector: t('schedule-late-risk'), title: 'One late job', say: 'Each row says why the tech may be late, whether they saw the warning, and how the automated calls went. Call customer rings the customer with your call script, where you allow it. Got it stops the flashing for everybody.' },

    // ── To Schedule ──
    {
      id: 'queue', selector: t('schedule-queue'), title: 'To Schedule', say: 'Every job and estimate visit that doesn’t have a date yet.',
      variants: [
        { when: t('schedule-queue-row'), say: 'Every job and estimate visit that doesn’t have a date yet. New work lands here when it’s made without a time.' },
        { when: `!${t('schedule-queue-row')}`, say: 'Nothing is waiting for a date right now. New work lands here when it’s made without a time.' },
      ],
    },
    { id: 'queue-search', selector: t('schedule-queue-search'), title: 'Search', say: 'Find waiting work by customer name or address.' },
    { id: 'queue-chips', selector: t('schedule-queue-chips'), title: 'Narrow it down', say: 'Show just emergencies, today’s work, estimates, jobs with no tech, or ones that need approval.' },
    { id: 'queue-sort', selector: t('schedule-queue-sort'), title: 'Sort and group', say: 'Sort and group the list, by priority, type or customer. The number is how many are waiting.' },
    { id: 'queue-row', selector: t('schedule-queue-row'), title: 'A job waiting', say: 'Click a row to take a quick look, or grab it and drag it onto the calendar to book it.' },
    { id: 'staff-off', selector: t('schedule-staff-off'), title: 'Staff off', say: 'Approved time off for the dates on screen, so you don’t book someone who’s away.' },
    { id: 'pending', selector: t('schedule-pending-estimates'), title: 'Pending approval', say: 'Estimates you’ve sent that the customer hasn’t answered yet. The date turns red when one is about to expire.' },

    // ── The calendar ──
    { id: 'views', selector: t('schedule-views'), title: 'Month, Week, Day', say: 'The same jobs at different sizes. It remembers the one you used last. M, W and D on the keyboard switch too.' },
    { id: 'nav', selector: t('schedule-nav'), title: 'Back, Today, forward', say: 'Step back or forward, or jump back to today.' },
    { id: 'zoom', selector: t('schedule-zoom'), title: 'Zoom', say: 'Make the calendar taller or shorter, so a busy day is easier to read.' },
    { id: 'density', selector: t('schedule-density'), title: 'How much each card shows', say: 'Compact, Standard or Detailed: how much each card shows.' },
    {
      id: 'calendar', selector: t('schedule-calendar'), title: 'The calendar', say: 'Your booked work.',
      variants: [
        { when: view('week'), title: 'Week view', say: 'Seven days side by side, with the hours down the left. This is where most booking happens.' },
        { when: view('day'), title: 'Day view', say: 'Every tech gets a column of their own, called a lane. It’s the best view for sharing out a day’s work.' },
        { when: view('month'), title: 'Month view', say: 'The whole month at once. A busy day just grows taller. Click a date to open that day.' },
      ],
    },
    { id: 'now', selector: t('schedule-now-line'), title: 'Now', say: 'The red line is the time right now.' },
    {
      id: 'event', selector: t('schedule-event'), title: 'A booked job', say: 'Each card is a booked job, coloured by its stage. A red border means it’s late. Estimate visits have a dashed border.',
    },
    {
      id: 'drag', selector: t('schedule-calendar'), title: 'Drag to book or move', say: 'Drag a waiting job onto a time to book it, or drag a card to move it. It checks for clashes, time off and tight drives before it books.',
    },
    { id: 'right-click', selector: t('schedule-event'), title: 'Right-click for more', say: 'Right-click a card to change the time, the status or the tech, or to cancel it.' },
    { id: 'unschedule', selector: t('schedule-queue'), title: 'Take it off', say: 'Plans changed? Drag a card back over To Schedule to take it off the calendar. Ctrl Z undoes the last move.' },
    { id: 'lane-tech', selector: t('schedule-day-lane-tech'), title: 'A tech’s lane', say: 'Each lane shows the tech, how many jobs and hours they have, and any time off. Drag a card into another lane to hand it over.' },
    { id: 'lane-unassigned', selector: t('schedule-day-lane-unassigned'), title: 'Unassigned', say: 'Jobs with no tech sit in the last lane, ready to hand out.' },
    { id: 'lane-sub', selector: t('schedule-day-lane-sub'), title: 'Sub company', say: 'Work you’ve sent to another company gets its own lane. Those jobs only move in time.' },

    // ── Filters ──
    { id: 'filters-toggle', when: FOCUS, selector: FILTERS, title: 'Filters', say: 'The filters fold away behind Filters, to keep the calendar roomy. The number on it says how many are on right now.' },
    { id: 'customer', click: FILTERS, selector: t('schedule-filters'), title: 'Find a customer', say: 'Type a name to show only that customer’s jobs.' },
    { id: 'tech', click: FILTERS, selector: t('schedule-tech-filter'), title: 'One tech', say: 'Narrow the calendar to one person’s jobs.' },
    { id: 'crew', click: FILTERS, selector: t('schedule-crew-filter'), title: 'One crew', say: 'Or to one crew.' },
    { id: 'subs', click: FILTERS, selector: t('schedule-sub-filter'), title: 'Yours or sent to subs', say: 'All jobs, just your own, or just the ones sent to other companies.' },
    { id: 'legends', click: FILTERS, selector: t('schedule-legends'), title: 'Statuses and badges', say: 'What each colour and badge means. Click a status to hide it for now.' },
    { id: 'refresh', selector: t('schedule-refresh'), title: 'Always up to date', say: 'The calendar refreshes itself, so a job someone else books just shows up.' },
  ],
}
