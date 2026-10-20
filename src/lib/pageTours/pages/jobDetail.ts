import type { PageTour, PageTourStep } from '../types'
import { FOCUS } from '../theme'

/**
 * Daily work → Jobs → one job (/jobs/:id).
 *
 * The job top to bottom, then each tab: Overview (status, schedule, crew),
 * Field (line items and parts, BarnCam, documents), Notes, Messages, and
 * where the billing stands. What it says follows where the job is:
 * unscheduled, scheduled, under way, on hold, complete, invoiced or paid.
 * Opening a tab only changes what's on screen; the tour never saves.
 *
 * The page marks:
 *   job-header              data-job-state = unscheduled | scheduled | in_progress
 *                           | blocked | complete | invoiced | paid | cancelled
 *   wo-reschedule-request   data-request-state = pending | answered
 *   barncam                 data-media-count = how many photos and videos
 *
 * Focus look: Overview opens with a row at a glance (job-glance: customer,
 * visit, lead tech, billing), and the Quick edit fields stay folded under
 * Job details until Edit job (job-edit-toggle, aria-expanded) opens them.
 * The Quick edit steps press it after the Overview tab.
 */
const t = (id: string) => `[data-tour="${id}"]`
const state = (...states: string[]) => states.map((s) => `${t('job-header')}[data-job-state="${s}"]`).join(', ')
/** A tool under Field: press it, opening Field first when it isn't showing. */
const field = (key: string): Pick<PageTourStep, 'click' | 'open'> => ({ click: t(`job-tab-${key}`), open: `click:${t('job-tab-field')}` })
const overview: Pick<PageTourStep, 'click'> = { click: t('job-tab-overview') }
/** Overview, then Edit job when Focus has the Quick edit fields folded away. */
const editor: Pick<PageTourStep, 'click'> = { click: [t('job-tab-overview'), t('job-edit-toggle')] }
const LINES = t('job-lineitems-panel')

export const PAGE_TOUR: PageTour = {
  id: 'job-detail',
  route: '^/jobs/(?!new/?$)[^/]+/?$',
  intro: {
    page: 'Job',
    purpose: 'Everything about one job in one place: when it happens and who’s on it, the work and parts, photos and notes, and getting paid for it.',
    covers: ['Where the job stands', 'Status, schedule and crew', 'Line items and parts', 'Photos and video', 'Notes and messages', 'Invoicing'],
  },
  // The intro film, before the walk-through (see ../film.ts).
  film: [
    { id: 'name', say: 'This is a job’s own page. Everything about one job is in one place.', visual: { kind: 'title', title: 'Job', subtitle: 'One job, start to finish' } },
    {
      id: 'glance', title: 'At a glance', say: 'Up top, you see where it stands, when it’s booked, and who’s on it.',
      visual: { kind: 'form', fields: [
        { label: 'Status', value: 'In progress' },
        { label: 'When', value: 'Thursday, 10:00' },
        { label: 'Who', value: 'Sam' },
        { label: 'Where', value: '12 Oak Street' },
      ], button: 'Update status' },
    },
    {
      id: 'work', title: 'The work', say: 'Add the work and parts as line items, and keep photos, notes and messages right with the job.',
      visual: { kind: 'list', heading: 'On this job', rows: [
        { title: 'Labor', meta: 'Two hours', chip: '$240.00', tone: 'gray' },
        { title: 'Replacement part', meta: 'From the shelf', chip: '$86.50', tone: 'gray' },
        { title: 'Photos', meta: 'Four before, three after', chip: '7 photos', tone: 'blue' },
        { title: 'Note from Sam', meta: 'Call the customer before arriving', chip: 'Note', tone: 'amber' },
      ] },
    },
    { id: 'paid', title: 'Getting paid', say: 'When the work is done, turn it into an invoice and take the payment right from here.', visual: { kind: 'money' } },
    { id: 'go', say: 'Let’s walk through it.', visual: { kind: 'go' } },
  ],
  steps: [
    // ── Up top ──
    {
      id: 'covered', selector: t('job-covered'),
      title: 'Covered by an agreement',
      say: 'This visit is already paid for by a service agreement, so nobody collects for it. Extra work found on the visit is quoted and billed on its own.',
    },
    {
      id: 'state', selector: t('job-header'), title: 'The job at a glance', say: 'Up top: the job number, its status, and where the billing stands.',
      variants: [
        { when: state('unscheduled'), title: 'Not booked yet', say: 'This job has no date yet. Up top are its number and status.' },
        { when: state('scheduled'), title: 'Booked', say: 'This job is booked. Up top are its number and status, and the day is in the row below.' },
        { when: state('in_progress'), title: 'Under way', say: 'This job is under way. Up top are its number and status. Your crew’s phones move it along as they go.' },
        { when: state('blocked'), title: 'On hold', say: 'This job is on hold, waiting on something like parts or an answer from the customer.' },
        { when: state('complete'), title: 'Done, not billed', say: 'The work is done, and the amber pill says it hasn’t been invoiced yet.' },
        { when: state('invoiced'), title: 'Invoiced', say: 'This job is invoiced. The blue pill shows what’s still due.' },
        { when: state('paid'), title: 'Paid', say: 'This job is done and paid in full. The green pill says so.' },
        { when: state('cancelled'), title: 'Cancelled', say: 'This job was cancelled. It stays here for the record.' },
      ],
    },
    {
      id: 'automation', selector: t('job-automation'),
      title: 'Automations',
      say: 'Automations on means reminders and status messages go out for this job. Off means nothing automatic is sent.',
    },
    {
      id: 'actions', selector: t('job-actions'),
      title: 'The main buttons',
      say: 'These are the main buttons. You see the ones your role allows.',
    },
    {
      id: 'messages-btn', selector: t('job-action-messages'),
      title: 'Messages',
      say: 'Messages opens this job’s texts and emails in a side panel, so you can reply without leaving.',
    },
    {
      id: 'subout', selector: t('job-action-subout'),
      title: 'Sub this out',
      say: 'Sub this out hands the job to a partner company, with a spending cap and your instructions.',
    },
    {
      id: 'payment', selector: t('job-action-payment'), title: 'Take a payment', say: '',
      variants: [
        { when: state('invoiced', 'paid'), title: 'Receive payment', say: 'Receive payment records money against this job’s invoice.' },
        { when: () => true, title: 'Take down payment', say: 'Take down payment collects a deposit before the work. It comes off the invoice later by itself.' },
      ],
    },
    {
      id: 'summary', selector: t('job-summary'),
      title: 'Who, where, when',
      say: 'This row has the customer, the place, the schedule, the lead tech and the total. Click the customer to open their account.',
      variants: [
        { when: state('unscheduled'), title: 'Who, where, when', say: 'This row has the customer, the place, the lead tech and the total. Schedule says Unscheduled until it gets a day.' },
      ],
    },
    {
      id: 'sub-banner', selector: t('job-sub-banner'),
      title: 'A partner is on it',
      say: 'A partner company is doing this work. This box shows who, the approved amount and any instructions.',
    },
    {
      id: 'portal-request', selector: t('job-portal-request'),
      title: 'Asked for in the portal',
      say: 'The customer asked for this job from their portal. Accept it to put it in line, or decline with a reason they’ll see.',
    },
    {
      id: 'attention', selector: t('job-attention'),
      title: 'Needs attention',
      say: 'Needs attention gathers what’s worth a look on this job, like work not billed yet, unread messages or new notes.',
    },
    {
      id: 'reschedule', selector: t('wo-reschedule-request'), title: 'Asked to move', say: '',
      variants: [
        {
          when: `${t('wo-reschedule-request')}[data-request-state="pending"]`,
          title: 'Asked to move',
          say: 'The customer asked to move this visit. Approve and move the job books the time they picked. Decline keeps it, and you can tell them why.',
        },
        {
          when: `${t('wo-reschedule-request')}[data-request-state="answered"]`,
          title: 'A move was answered',
          say: 'The customer asked to move this visit, and here’s how it was answered.',
        },
      ],
    },
    {
      id: 'tabs', selector: t('job-tabs'),
      title: 'Tabs',
      say: 'Everything else is in these tabs. Some open a second row of tools underneath.',
    },

    // ── Overview: status, schedule, crew ──
    {
      id: 'glance', ...overview, when: FOCUS, selector: t('job-glance'),
      title: 'At a glance',
      say: 'Overview opens with the job at a glance: the customer, the visit, the lead tech, and where the billing stands. Click the customer to open their account.',
    },
    {
      id: 'edit-toggle', ...overview, when: FOCUS, selector: t('job-edit-toggle'),
      title: 'Edit job',
      say: 'Job details stay folded so the page is easy to read. Edit job opens status, schedule and crew, and Close details folds them away again.',
    },
    {
      id: 'quick-edit', ...editor, selector: t('job-quick-edit'),
      title: 'Quick edit',
      say: 'Overview starts with Quick edit, for the things you change most.',
    },
    {
      id: 'status', ...editor, selector: t('job-qe-status'), title: 'Status',
      say: 'Status moves the job along. It saves the moment you pick one.',
      variants: [
        { when: state('unscheduled', 'scheduled'), title: 'Status', say: 'Status moves the job along. It saves the moment you pick one, and your crew’s phones move it too as they head out and arrive.' },
        { when: state('in_progress', 'blocked'), title: 'Status', say: 'When the work is done, pick a Complete status here. The invoice is made from the line items on the spot.' },
        { when: state('complete', 'invoiced', 'paid'), title: 'Status', say: 'The status says the work is done. Change it only if the job needs to reopen.' },
      ],
    },
    {
      id: 'crew', ...editor, selector: t('job-qe-tech'),
      title: 'Who’s on it',
      say: 'Lead tech, and Saved crew next to it, say who’s doing the work.',
    },
    {
      id: 'date', ...editor, selector: t('job-qe-date'), title: 'When',
      say: 'Schedule date, start, end and how long set when it happens.',
      variants: [
        { when: state('unscheduled'), title: 'Give it a day', say: 'No date yet. Pick one here, or drag the job onto the Schedule from To Schedule.' },
        { when: state('scheduled'), title: 'When', say: 'The day and time it’s booked. Change them here, or drag it on the Schedule.' },
      ],
    },
    {
      id: 'customer-card', ...overview, selector: t('job-customer-card'),
      title: 'Customer and place',
      say: 'Who it’s for, who pays, and the address, with their work order or PO number if they gave one.',
    },
    {
      id: 'assignment-card', ...overview, selector: t('job-assignment-card'),
      title: 'Crew',
      say: 'The lead tech, the saved crew and any helpers on this job.',
    },
    {
      id: 'schedule-card', ...overview, selector: t('job-schedule-card'),
      title: 'Schedule',
      say: 'When it’s booked, and how long it should take.',
    },
    {
      id: 'totals-card', ...overview, selector: t('job-totals-card'),
      title: 'Totals',
      say: 'The job’s total, with tax.',
    },
    {
      id: 'call-settings', ...overview, selector: t('call-settings-job'),
      title: 'Late techs and calls',
      say: 'For this job only: whether to watch for a late tech, and whether the customer may get an automated call. Leave it on the customer’s setting unless this job is different.',
    },
    {
      id: 'status-history', ...overview, selector: t('job-status-history'),
      title: 'Status history',
      say: 'Every status change, with when the crew arrived and left.',
    },
    {
      id: 'save-bar', ...editor, selector: t('job-save-bar'),
      title: 'Save changes',
      say: 'Quick edit changes wait down here until you press Save changes. Discard throws them out.',
    },

    // ── Field: line items, parts, photos, documents ──
    {
      id: 'lines', ...field('line-items'), selector: LINES,
      title: 'Line items',
      say: 'Line items are what you’re charging for: labor, parts and fees. Search your catalog or add a line. Changes here save as you go.',
    },
    {
      id: 'parts', ...field('line-items'), selector: `${LINES} ${t('estimate-parts')}`,
      title: 'Parts for this job',
      say: 'Parts held for this job, so nobody else uses them.',
    },
    {
      id: 'parts-needed', ...field('line-items'), selector: `${LINES} ${t('parts-needed')}`,
      title: 'Parts needed',
      say: 'Parts needed puts a part in the parts cart for whoever orders, marked for this job.',
    },
    {
      id: 'parts-waiting', ...field('line-items'), selector: `${LINES} ${t('parts-waiting')}`,
      title: 'Waiting to be ordered',
      say: 'These parts are in the parts cart, waiting to be ordered.',
    },
    {
      id: 'parts-cart', selector: t('topbar-parts-cart'),
      title: 'The parts cart',
      say: 'The parts cart up top gathers everything your crew asked for, ready to order.',
    },
    {
      id: 'barncam', ...field('photos'), selector: t('barncam'), title: 'BarnCam', say: '',
      variants: [
        { when: `${t('barncam')}[data-media-count="0"]`, title: 'BarnCam', say: 'BarnCam is the job’s photos and video, stamped with the time and place. Nothing’s been taken yet.' },
        { when: () => true, title: 'BarnCam', say: 'BarnCam is the job’s photos and video, stamped with the time and place.' },
      ],
    },
    {
      id: 'capture', ...field('photos'), selector: t('barncam-capture'),
      title: 'Capture',
      say: 'Capture takes a photo or video, or adds one you already have.',
    },
    {
      id: 'share', ...field('photos'), selector: t('barncam-share'),
      title: 'Share with the customer',
      say: 'Tick Share new with customer, and new photos show in their portal too.',
    },
    {
      id: 'gallery', ...field('photos'), selector: t('barncam-gallery'),
      title: 'The photos',
      say: 'Click a photo to see it full size.',
    },
    {
      id: 'doc', ...field('doc'), selector: t('job-doc-panel'),
      title: 'Work order documents',
      say: 'The customer’s own work order, if they sent one, and the signed copy made when the job is checked out.',
    },
    {
      id: 'documents', ...field('documents'), selector: t('job-documents-panel'),
      title: 'Documents',
      say: 'Documents holds files for this job, like permits, PDFs and receipts.',
    },

    // ── Notes and messages ──
    {
      id: 'notes', click: t('job-tab-notes'), selector: t('job-notes-panel'),
      title: 'Notes',
      say: 'Notes are the job’s paper trail. Each is internal, for your team, or public, for the customer.',
    },
    {
      id: 'notes-add', click: t('job-tab-notes'), selector: t('job-notes-add'),
      title: 'Add note',
      say: 'Add note writes one. Once saved, a note stays for good.',
    },
    {
      id: 'flash', click: t('job-tab-notes'), selector: `${t('job-notes-panel')} [data-flash-word]`,
      title: 'Flash words',
      say: 'A part or item named in a note lights up. Click it to see its card, and add it to this job in one go.',
    },
    {
      id: 'messages', click: t('job-tab-messages'), selector: t('job-messages-panel'),
      title: 'Messages',
      say: 'Messages keeps this job’s texts, emails and calls together. A call made from the job stays with it, and when CBI is on, it reads the call and writes what was agreed as a note.',
    },
    {
      id: 'automated-calls', click: t('job-tab-messages'), selector: t('wo-automated-calls'),
      title: 'CBI calls',
      say: 'Every call CBI made about this job: who it called, whether they answered and for how long, and what they pressed.',
    },
    {
      id: 'history', click: t('job-tab-history'), selector: t('job-history-panel'),
      title: 'History',
      say: 'History is the job’s timeline: visits, signatures, files, and every call CBI made.',
    },

    // ── Getting paid ──
    {
      id: 'invoice', title: 'Getting paid', say: '',
      variants: [
        { when: t('job-action-invoice'), selector: t('job-action-invoice'), title: 'Invoice Job', say: 'The work is done but not billed. Invoice Job makes the invoice from the line items, ready to send.' },
        { when: state('invoiced'), selector: t('job-action-view-invoice'), title: 'View invoice', say: 'View invoice opens the bill right on top of the job, to send it or take payment.' },
        { when: state('paid'), selector: t('job-billing'), title: 'Paid in full', say: 'This one’s paid in full. Nothing left to collect.' },
        { when: state('unscheduled', 'scheduled', 'in_progress', 'blocked'), title: 'Getting paid', say: 'When the work is done, set a Complete status. The invoice is made from the line items, and the button up top turns into View invoice.' },
      ],
    },
  ],
}
