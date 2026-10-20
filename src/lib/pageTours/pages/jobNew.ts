import type { PageTour } from '../types'
import { FOCUS } from '../theme'

/**
 * Daily work → Jobs → New job (/jobs/new, also ?kind=estimate and ?kind=sub).
 *
 * The form top to bottom. It walks the Full page layout, so every part is
 * on screen (pressing Full page only changes how the form is shown, and
 * Step-by-step is one click away). Steps follow the kind of record being
 * made (job, estimate or sub job) and whether the job has a date yet. The
 * tour fills in nothing and saves nothing; Create Job is in the bar at the
 * bottom.
 *
 * Focus look: Step-by-step is the default there, Full page adds a Jump to
 * row (form-jump-to), and an estimate made here gets a note about the PDF
 * order book (job-order-book).
 */
const t = (id: string) => `[data-tour="${id}"]`
const any = (...ids: string[]) => ids.map(t).join(', ')
const pressed = (id: string) => `${t(id)}[aria-pressed="true"]`

export const PAGE_TOUR: PageTour = {
  id: 'job-new',
  route: '^/jobs/new/?$',
  intro: {
    page: 'New job',
    purpose: 'Write up a job on one form: who it’s for, what the work is, when it happens and who does it. Only a few things are required.',
    covers: ['Step-by-step or full page', 'Customer and place', 'The work', 'When and who', 'Line items', 'Saving it'],
  },
  // The intro film, before the walk-through (see ../film.ts).
  film: [
    { id: 'name', say: 'Here’s where a new job starts. It’s one form, and only a few things are required.', visual: { kind: 'title', title: 'New job' } },
    {
      id: 'who', title: 'Who and what', say: 'Pick the customer and the place, then say what the work is.',
      visual: { kind: 'form', fields: [
        { label: 'Customer', value: 'Rivera family' },
        { label: 'Place', value: '12 Oak Street' },
        { label: 'The work', value: 'Repair visit' },
      ], button: 'Next' },
    },
    {
      id: 'when', title: 'When and who', say: 'Choose when it happens and who’s going, or leave the date open and schedule it later.',
      visual: { kind: 'calendar', visits: [
        { day: 0, slot: 0, label: 'Service call', tone: 'blue' },
        { day: 1, slot: 1, span: 2, label: 'New install', tone: 'blue' },
        { day: 2, slot: 0, label: 'Inspection', tone: 'green' },
        { day: 4, slot: 2, label: 'Maintenance', tone: 'green' },
        { day: 3, slot: 1, span: 2, label: 'Rivera family · Sam', tone: 'amber' },
      ] },
    },
    {
      id: 'items', title: 'Line items', say: 'Add the work and parts as line items now, or later from the job itself.',
      visual: { kind: 'list', heading: 'Line items', rows: [
        { title: 'Labor', meta: 'Two hours', chip: '$240.00', tone: 'gray' },
        { title: 'Replacement part', meta: 'One', chip: '$86.50', tone: 'gray' },
        { title: 'Trip charge', chip: '$45.00', tone: 'gray' },
      ] },
    },
    { id: 'go', say: 'Let’s walk through the form.', visual: { kind: 'go' } },
  ],
  steps: [
    {
      id: 'header', selector: any('job-create-header', 'sub-create-header'),
      title: 'A new job is one form',
      say: 'A new job is one form. Fill in what you know now; you can add the rest later from the job.',
    },
    {
      id: 'mode', click: t('job-entry-full'), selector: t('job-entry-mode'),
      title: 'Step-by-step or Full page',
      say: 'Step-by-step takes the form one part at a time. Full page shows it all at once, which is how we’ll walk it. Switch whenever you like.',
    },
    {
      id: 'jump-to', when: FOCUS, selector: t('form-jump-to'),
      title: 'Jump to',
      say: 'Jump to takes you straight to any part of the form: the customer, the scope, the schedule and crew, line items, equipment or notes.',
    },
    {
      id: 'order-book', when: FOCUS, selector: t('job-order-book'),
      title: 'Your order book',
      say: 'For an estimate, Open PDF order book puts your price book beside the form. Search catalog, under the lines, adds priced items.',
    },
    {
      id: 'ai-draft', selector: t('job-ai-draft'),
      title: 'Filled in from a call',
      say: 'This job was started from a call or message, so what was heard is already filled in. Check it before you save.',
    },
    {
      id: 'drafts', selector: any('job-drafts', 'sub-drafts'),
      title: 'Saved drafts',
      say: 'Jobs you started and didn’t finish wait here. Pick one to carry on.',
    },
    {
      id: 'kind', selector: any('job-record-type', 'sub-record-type'),
      title: 'Job, estimate or sub job',
      say: 'Choose what you’re making: a job, an estimate to quote first, or a sub job for a partner to do.',
    },

    // ── Who it's for ──
    {
      id: 'customer', selector: any('job-customer', 'estimate-customer', 'sub-customer'),
      title: 'Customer and place',
      say: 'Start with the customer, then the place. Their main address is picked for you.',
    },
    {
      id: 'new-customer', selector: t('job-new-customer'),
      title: 'Someone new',
      say: 'New to you? Add the customer right here without leaving the form.',
    },
    {
      id: 'bill-other', selector: t('job-bill-other'),
      title: 'Someone else pays',
      say: 'When someone else pays, like a property manager, send the bill to them here.',
    },
    {
      id: 'setup', selector: t('job-setup-tools'),
      title: 'Extras',
      say: 'Extras ride along with the job: a document to sign, the customer’s own work order, photos and files, or an inspection checklist.',
    },
    {
      id: 'required', selector: t('job-custom-required'),
      title: 'Your own fields',
      say: 'Your company’s own job fields. The ones marked required need an answer before you save.',
    },

    // ── The work ──
    {
      id: 'title', selector: t('job-title'),
      title: 'Title',
      say: 'A short title your crew will see first, like what needs doing.',
    },
    {
      id: 'type', selector: t('job-type'),
      title: 'Job type',
      say: 'The kind of work. Picking one fills in its starting status and how long it usually takes.',
    },
    {
      id: 'status', selector: t('job-status'),
      title: 'Status',
      say: 'Status picks itself: Scheduled when the job has a date, Needs Scheduling when it doesn’t. Change it if you need to.',
    },
    {
      id: 'priority', selector: t('job-priority'),
      title: 'Priority',
      say: 'Priority flags the urgent ones on the board.',
    },
    {
      id: 'description', selector: t('job-description'),
      title: 'Description',
      say: 'What the work is, in plain words. Your crew reads this on the way.',
    },

    // ── Sub job ──
    {
      id: 'sub-files', selector: t('sub-files'),
      title: 'Their paperwork',
      say: 'Attach the customer’s work order or any files the partner needs.',
    },
    {
      id: 'sub-picker', selector: t('sub-picker'),
      title: 'Who does it',
      say: 'Pick the partner company doing the work.',
    },
    {
      id: 'sub-basics', selector: t('sub-basics'),
      title: 'Title and scope',
      say: 'What the partner is doing, in plain words.',
    },
    {
      id: 'sub-authorization', selector: t('sub-authorization'),
      title: 'Date and spending cap',
      say: 'When it’s due, and the most they can spend without asking you first.',
    },

    // ── When and who ──
    {
      id: 'schedule', selector: t('job-schedule'), title: 'When',
      say: 'When it happens: the day, the start and end, and how long it should take.',
      variants: [
        {
          when: pressed('job-schedule-unscheduled'),
          title: 'No date yet',
          say: 'Not sure of the day? Leave it Unscheduled. It waits in To Schedule on the Schedule page until you give it one.',
        },
      ],
    },
    {
      id: 'crew', selector: any('job-assignment', 'job-dispatch'),
      title: 'Who’s doing it',
      say: 'The lead tech, and anyone helping. Leave it empty and assign someone later.',
    },
    {
      id: 'lines', selector: any('job-lineitems', 'estimate-lineitems'),
      title: 'Line items',
      say: 'Line items are what you’ll charge: labor, parts and fees. Search your catalog or add a line.',
    },
    {
      id: 'assets', selector: t('job-assets'),
      title: 'Equipment',
      say: 'Link the equipment this job is for, so its history stays together.',
    },
    {
      id: 'notes', selector: t('job-notes'),
      title: 'Notes',
      say: 'Notes for your team, and notes the customer can see.',
    },

    // ── Save ──
    {
      id: 'save', selector: any('job-save', 'estimate-save', 'sub-save'),
      title: 'Create Job',
      say: 'When it’s ready, Create Job, in the bar at the bottom, saves it. Cancel leaves without saving.',
    },
  ],
}
