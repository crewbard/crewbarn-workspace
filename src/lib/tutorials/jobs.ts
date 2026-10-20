import type { TutorialData } from './types'

/**
 * Jobs, start to finish: the Jobs board, a new job (and a sub job), the job
 * page and its tabs, getting it scheduled and dispatched, closing it out and
 * getting paid, and where jobs show up elsewhere.
 *
 * Kept import-free (types aside) so the voice exporter can load it on its own.
 * Nothing here saves: the walk stops before Create, Save, Send, Delete and
 * Pay, and the job page steps only look.
 */

const Q = '"'
const t = (id: string) => `[data-tour=${Q}${id}${Q}]`

const LIST = '^/jobs/?$'
const NEW = '^/jobs/new/?$'
const JOB = '^/jobs/(?!new/?$)[^/]+/?$'
const SCHEDULE = '^/schedule/?$'
const DISPATCH = '^/dispatch/?$'
/** The Jobs page (marked in every look), for its date and sort boxes, which have no marker of their own. */
const JOBS_PAGE = '[data-focus-page="jobs"]'
/** The Focus look (<html data-theme="focus">), for words that differ there. */
const FOCUS = 'html[data-theme="focus"]'
/** Overview, then Edit job: the Focus look keeps a job's Quick edit fields folded until it's pressed. */
const EDITOR = [t('job-tab-overview'), t('job-edit-toggle')]
// The Focus look shows one list at a time beside the Dispatch map: these press its Crew / To assign button first.
const RAIL = (key: string) => t(`dispatch-rail-${key}`)
const MONEY = '^/accounting/?$'
const STATUSES = '^/tool-shed/job-statuses/?$'
const TYPES = '^/tool-shed/job-types/?$'

export const TUTORIAL: TutorialData = {
  id: 'jobs',
  kicker: 'Jobs · tutorial',
  title: 'Jobs, start to finish',
  film: [
    {
      id: 'flow',
      label: 'The journey',
      title: 'One job, from the first call to the last payment',
      narration:
        'Welcome to Jobs. A job is one piece of work for one customer, from the first call to the last payment. Along the way it’s created, scheduled, worked on site, finished, invoiced and paid.',
    },
    {
      id: 'board',
      label: 'The board',
      title: 'Every job, on one board',
      narration:
        'Every job lives on the Jobs board. The tabs are your stages, each with a count. And every card shows the customer, the date, the tech and the total, plus a little chip that says what it needs next.',
    },
    {
      id: 'create',
      label: 'A new job',
      title: 'A new job is one form',
      narration:
        'A new job is one form. Pick the customer and their address, give it a title and a job type, and CrewBarn picks the starting status for you. It starts scheduled for right now, so it lands on the calendar. Change it, or leave it unscheduled.',
    },
    {
      id: 'extras',
      label: 'What rides along',
      title: 'More than the basics',
      narration:
        'A job can carry more than the basics: what you’ll charge, a document the customer signs, an inspection checklist, or the customer’s own work order. Field rules come from the customer’s account, like a signature or photos before it’s done.',
    },
    {
      id: 'dispatch',
      label: 'Scheduled and out',
      title: 'On the calendar, then out the door',
      narration:
        'Next it gets a day and a tech. Drag it from To Schedule onto the calendar, or set both right on the job. Out in the field, the tech’s phone moves it along: on the way, on site, and done.',
    },
    {
      id: 'page',
      label: 'The job page',
      title: 'Everything about one job, in one place',
      narration:
        'Everything about one job sits on its page. The status and the billing up top, the main buttons beside them, and tabs for the field work, costs, messages, notes and the log.',
    },
    {
      id: 'closeout',
      label: 'Close it out',
      title: 'Finish it, bill it, get paid',
      narration:
        'When the work is done, mark it Complete, and the invoice is made from the job’s line items. Take the payment, and the badge goes from Not invoiced, to Invoiced, to Paid.',
    },
    {
      id: 'yourturn',
      label: 'Your turn',
      title: 'Now let’s do it for real',
      narration:
        'That’s the idea. Now let’s do it for real. I’ll step back into the corner and point at each part of the page. When it’s your turn, you click. If you’d rather watch, press Do it for me.',
    },
  ],
  chapters: [
    { key: 'board', label: 'The Jobs board' },
    { key: 'create', label: 'Start a new job' },
    { key: 'sub', label: 'A sub job' },
    { key: 'page', label: 'The job page' },
    { key: 'dispatch', label: 'Scheduled and dispatched' },
    { key: 'field', label: 'The field work' },
    { key: 'records', label: 'Costs, messages, notes, log' },
    { key: 'close', label: 'Close out and get paid' },
    { key: 'used', label: 'Where jobs show up' },
  ],
  steps: [
    // ---------- The Jobs board ----------
    {
      id: 'board-header', chapter: 'board', route: LIST, open: 'goto:/jobs', selector: t('jobs-header'),
      title: 'The Jobs board',
      say: 'This is the Jobs board. Every job your company has, from the first call to the last payment, lives here.',
    },
    {
      id: 'board-new', chapter: 'board', route: LIST, selector: t('jobs-new'),
      title: 'New Job',
      say: 'New Job starts a new one. We’ll make one together in a minute.',
    },
    {
      id: 'board-new-sub', chapter: 'board', route: LIST, selector: t('jobs-new-sub'),
      title: 'Sub Job',
      say: 'Sub Job hands a job to a partner company to do for you. We’ll look at it right after the regular form.',
    },
    {
      id: 'board-new-agreement', chapter: 'board', route: LIST, selector: t('jobs-new-agreement'),
      title: 'Service Agreement',
      say: 'Service Agreement is for work agreed on a schedule, like a quarterly HVAC tune-up or weekly lawn service. The visits it makes land right here on this board.',
    },
    {
      id: 'board-partners', chapter: 'board', route: LIST, selector: t('jobs-partner-links'),
      title: 'Partner work',
      say: 'Inbound, Sub payouts and Sub reviews are for work you share with partners: jobs they send you, what you owe your subs, and the price increases and invoices they ask you to approve.',
    },
    {
      id: 'board-partner-tools', chapter: 'board', route: LIST, selector: '[data-focus-jobs-partner-tools]',
      title: 'Partner work & service agreements',
      say: 'Here, Sub Job, Service Agreement and the partner pages fold into one place. Partner work & service agreements opens them: inbound jobs, sub payouts, sub reviews, a new sub job and a new service agreement.',
    },
    {
      id: 'board-queues', chapter: 'board', route: LIST, selector: '[data-focus-jobs-queues]',
      title: 'Jobs that need a nudge',
      say: 'Past due, Ready to bill, Needs parts and Parts ordered narrow the list to jobs that need a nudge. Click one again to clear it.',
    },
    {
      id: 'board-attention', chapter: 'board', route: LIST, selector: t('jobs-attention'),
      title: 'Jobs that need a nudge',
      say: 'These cards narrow the list to jobs that need a nudge: past their date, ready to bill, waiting on parts, or parts ordered. Click one again to clear it.',
    },
    {
      id: 'board-tabs', chapter: 'board', route: LIST, selector: t('jobs-tabs'),
      title: 'Your stages',
      say: 'The tabs are the stages of the work, named the way you set them up, like Needs scheduling, Scheduled, On site and Complete. The number is how many jobs sit there right now.',
    },
    {
      id: 'board-stage', chapter: 'board', route: LIST, selector: t('jobs-tabs'),
      wait: { click: true }, doIt: `${t('jobs-tabs')} button:nth-child(2)`,
      yourTurn: 'Click any stage.',
      title: 'One stage at a time',
      say: 'Click any stage, and the list shows just the jobs sitting there.',
    },
    {
      id: 'board-all', chapter: 'board', route: LIST, click: `${t('jobs-tabs')} button:first-child`, selector: t('jobs-tabs'),
      title: 'All',
      say: 'All, the first tab, brings every job back. I’ve switched it back for you.',
    },
    {
      id: 'board-search', chapter: 'board', route: LIST, selector: t('jobs-search'),
      title: 'Search',
      say: 'Search finds a job by its title, the customer, or the address.',
    },
    {
      id: 'board-week', chapter: 'board', route: LIST, selector: t('jobs-this-week'),
      title: 'This week',
      say: 'This week shows only the jobs scheduled this week. Click it again to turn it off.',
    },
    {
      id: 'board-filters', chapter: 'board', route: LIST, selector: t('jobs-filters'),
      wait: { appear: t('jobs-filters-panel') }, doIt: t('jobs-filters'),
      yourTurn: 'Click Filters.',
      title: 'Filters',
      say: 'Filters holds the rest. Click it.',
    },
    {
      id: 'board-filters-panel', chapter: 'board', route: LIST, selector: t('jobs-filters-panel'),
      title: 'Status and sub-contracting',
      say: 'Status picks any one of your statuses, even the ones without a tab. Sub-contracting shows every job, just your own, or just the ones handed to a sub. Once anything is set, Clear all filters shows at the bottom.',
    },
    {
      id: 'board-filters-close', chapter: 'board', route: LIST, selector: t('jobs-filters'),
      wait: { gone: t('jobs-filters-panel') }, doIt: t('jobs-filters'),
      yourTurn: 'Click Filters again to close it.',
      title: 'Close it',
      say: 'Click Filters again to close the panel.',
    },
    {
      id: 'board-scheduled', chapter: 'board', route: LIST, selector: `${JOBS_PAGE} input[aria-label="Scheduled date"]`,
      title: 'Scheduled',
      say: 'Pick a date to see only the jobs booked that day. It shows up as a chip, so it’s easy to clear.',
    },
    {
      id: 'board-sort', chapter: 'board', route: LIST, selector: `${JOBS_PAGE} select[aria-label="Sort jobs on this page"]`,
      title: 'Sort',
      say: 'Sort puts the jobs on this page in order by title, scheduled date, or the biggest amount first.',
    },
    {
      id: 'board-chips', chapter: 'board', route: LIST, selector: t('jobs-active-filters'),
      title: 'Filtered by',
      say: 'Anything narrowing the list shows here as a chip. Click a chip to drop just that one, or Clear all.',
    },
    {
      id: 'board-views', chapter: 'board', route: LIST, selector: t('jobs-views'),
      title: 'Rows, Cards or Files',
      say: 'Rows is a plain list, and Cards shows one card per job. Files sorts them into folders, and File group picks Status, Year or Tech. Each folder shows its money: collected, still unpaid, and not invoiced yet.',
    },
    {
      id: 'board-list', chapter: 'board', route: LIST, selector: t('jobs-list'),
      title: 'The jobs themselves',
      say: 'Here are the jobs. Each card has the job number, its status, the customer and address, when it’s scheduled, the lead tech and the total. Small badges flag a not-to-exceed cap, a required signature, or required photos.',
    },
    {
      id: 'board-stamp', chapter: 'board', route: LIST, selector: t('jobs-pay-stamp'),
      title: 'Paid or not',
      say: 'The stamp says whether it’s paid. PAID means the invoice is paid in full. UNPAID means there’s a balance, or no invoice yet.',
    },
    {
      id: 'board-next', chapter: 'board', route: LIST, selector: t('jobs-next-step'),
      title: 'What it needs next',
      say: 'This chip is the next step: Schedule, Assign tech, Overdue, Complete, Invoice or Unblock. Click it to jump straight to the job.',
    },
    {
      id: 'board-peek', chapter: 'board', route: LIST, selector: t('jobs-peek'),
      title: 'Quick Peek',
      say: 'Quick Peek opens a look from the side without leaving the list: the customer, date, amount, tech, a map and the next step. The arrow keys move between jobs, and Escape closes it.',
    },

    // ---------- Start a new job ----------
    {
      id: 'create-open', chapter: 'create', route: LIST, open: 'goto:/jobs', selector: t('jobs-new'),
      wait: { route: NEW }, doIt: t('jobs-new'),
      yourTurn: 'Click New Job.',
      title: 'New Job',
      say: 'Let’s start a job. Click New Job.',
    },
    {
      id: 'create-header', chapter: 'create', route: NEW, open: 'goto:/jobs/new', selector: t('job-create-header'),
      title: 'The New Job form',
      say: 'This is the New Job form. As you fill it in, CrewBarn keeps a draft in this browser, so nothing is lost if you get pulled away. Back to Jobs leaves it.',
    },
    {
      id: 'create-mode', chapter: 'create', route: NEW, selector: t('job-entry-mode'),
      title: 'Step-by-step or Full page',
      say: 'Step-by-step takes it one step at a time: Customer, Job basics, Assets, then Notes. Full page shows the whole form at once.',
    },
    {
      id: 'create-full', chapter: 'create', route: NEW, selector: t('job-entry-full'),
      wait: { appear: t('job-schedule') }, doIt: t('job-entry-full'),
      yourTurn: 'Click Full page.',
      title: 'Full page',
      say: 'Let’s use Full page, so you can see every part. Click Full page.',
    },
    {
      id: 'create-jump-to', chapter: 'create', route: NEW, when: FOCUS, selector: t('form-jump-to'),
      title: 'Jump to',
      say: 'In the Focus look, Full page adds Jump to: one click takes you to the customer, the scope, the schedule and crew, line items, equipment or notes.',
    },
    {
      id: 'create-drafts', chapter: 'create', route: NEW, selector: t('job-drafts'),
      title: 'Saved drafts',
      say: 'Saved drafts lists forms you started and didn’t finish. Open one to look it over, then continue it or discard it.',
    },
    {
      id: 'create-type', chapter: 'create', route: NEW, selector: t('job-record-type'),
      title: 'Job, Estimate or Sub',
      say: 'Record type. Job is picked, and a job goes on the schedule. Estimate turns this same form into a quote the customer approves first. Sub hands the work to a partner, and we’ll try that next.',
    },
    {
      id: 'create-customer', chapter: 'create', route: NEW, selector: t('job-customer'),
      title: 'Customer and location',
      say: 'Start with who it’s for. Type a name or account number in Service Customer. Their main service location fills in, and Change picks another. New to you? New customer adds them right here, and they’re saved when you create the job.',
    },
    {
      id: 'create-bill', chapter: 'create', route: NEW, selector: t('job-bill-other'),
      title: 'Someone else pays',
      say: 'Tick Bill a different customer when someone else pays, like a property manager or a warranty company. You can add their work order and PO numbers too.',
    },
    {
      id: 'create-tools', chapter: 'create', route: NEW, selector: t('job-setup-tools'),
      title: 'Extras',
      say: 'These four tiles add extras to the job. Each one opens in its own window.',
    },
    {
      id: 'create-signable', chapter: 'create', route: NEW, selector: t('job-setup-signable'),
      wait: { appear: t('job-signable-section') }, doIt: t('job-setup-signable'),
      yourTurn: 'Click Signable document.',
      title: 'Something to sign',
      say: 'Signable document adds paperwork the customer signs. Click it.',
    },
    {
      id: 'create-signable-pick', chapter: 'create', selector: t('job-signable-section'),
      title: 'Pick a document',
      say: 'Pick one of your signable templates, like a contract or a work order. On a job, the customer signs it on the tech’s phone before check-in. Generate with AI writes a new one from this job and saves it to Templates and Forms, so we’ll leave that.',
    },
    {
      id: 'create-signable-done', chapter: 'create', selector: t('job-signable-done'),
      wait: { gone: t('job-signable-section') }, doIt: t('job-signable-done'),
      yourTurn: 'Click Done.',
      title: 'Done',
      say: 'Done closes the window. Nothing is saved until the job is created.',
    },
    {
      id: 'create-pdf', chapter: 'create', route: NEW, selector: t('job-setup-customer-pdf'),
      title: 'Their work order',
      say: 'Customer’s WO / PO takes the customer’s own work order or purchase order PDF. CBI reads it and fills in the customer, scope, priority, dates and reference numbers, and you check it all before creating.',
    },
    {
      id: 'create-files', chapter: 'create', route: NEW, selector: t('job-setup-attachments'),
      title: 'Photos and documents',
      say: 'Photos & Documents adds pictures and files, and you choose whether the customer can see each one in their portal.',
    },
    {
      id: 'create-inspection', chapter: 'create', route: NEW, selector: t('job-setup-inspection'),
      title: 'Inspection checklist',
      say: 'Inspection Scope attaches one of your inspection checklists. The tech works through it on the job.',
    },
    {
      id: 'create-required', chapter: 'create', route: NEW, selector: t('job-custom-required'),
      title: 'Your own fields',
      say: 'If your company added its own fields for jobs, the required ones show here.',
    },
    {
      id: 'create-title', chapter: 'create', route: NEW, selector: t('job-title'),
      title: 'Title',
      say: 'Now the basics. The title is a short name for the work, like Water heater check or Front door repair. It’s required.',
    },
    {
      id: 'create-jobtype', chapter: 'create', route: NEW, selector: t('job-type'), hold: true,
      yourTurn: 'Pick a job type, then press Next.',
      title: 'Job type',
      say: 'Job type is required too. Your most-used type is picked for you, and it has a star. A type can bring its own starting status and how long it usually takes. Go ahead and pick one.',
    },
    {
      id: 'create-status', chapter: 'create', route: NEW, selector: t('job-status'),
      title: 'Status picks itself',
      say: 'Status picks itself: Scheduled when the job has a date, Needs Scheduling when it doesn’t, or the job type’s own starting status. Change it if you need to.',
    },
    {
      id: 'create-priority', chapter: 'create', route: NEW, selector: t('job-priority'),
      title: 'Priority',
      say: 'Priority is Low, Normal, Urgent or Emergency. Urgent and Emergency jobs get a badge on the board.',
    },
    {
      id: 'create-description', chapter: 'create', route: NEW, selector: t('job-description'),
      title: 'Description',
      say: 'Description is what needs doing, in your own words. It shows on the job page.',
    },
    {
      id: 'create-schedule', chapter: 'create', route: NEW, selector: t('job-schedule'),
      title: 'Job schedule',
      say: 'A new job starts scheduled for today, right now, so it lands on the calendar. Change the date, the start and end times, or the duration. Multi-day job is for work that runs over several days.',
    },
    {
      id: 'create-unscheduled', chapter: 'create', route: NEW, selector: t('job-schedule-unscheduled'),
      wait: { click: true }, doIt: t('job-schedule-unscheduled'),
      yourTurn: 'Click Unscheduled.',
      title: 'Not sure of the day?',
      say: 'Don’t know the day yet? Click Unscheduled. The job then waits in To Schedule, on the Schedule page, until someone gives it a date.',
    },
    {
      id: 'create-scheduled', chapter: 'create', route: NEW, click: t('job-schedule-scheduled'), selector: t('job-schedule-mode'),
      title: 'Back to Scheduled',
      say: 'And Scheduled puts a date back. I’ve switched it back for you.',
    },
    {
      id: 'create-assign', chapter: 'create', route: NEW, selector: t('job-assignment'),
      title: 'Who’s doing it',
      say: 'Lead tech is the person responsible. Project manager is optional, for whoever answers for it going right. Crew helpers are extra hands. If the lead tech has approved time off then, CrewBarn asks before saving.',
    },
    {
      id: 'create-lines', chapter: 'create', route: NEW, selector: t('job-lineitems'),
      title: 'Line items',
      say: 'Line items are what you’ll charge. Add a blank line, search your catalog, scan a part, or add a fee or a discount. Each line has a quantity, a rate, your cost and tax. Add them now, or later on the job.',
    },
    {
      id: 'create-assets', chapter: 'create', route: NEW, selector: t('job-assets'),
      title: 'Covered assets',
      say: 'Covered assets ties the job to equipment the customer has, like their furnace or their gate opener, so the work follows that equipment. Pick the customer first, then Pick assets.',
    },
    {
      id: 'create-notes', chapter: 'create', route: NEW, selector: t('job-notes'),
      title: 'Notes',
      say: 'Internal notes stay with your team. Public notes may show on paperwork the customer sees. Any optional fields of your own sit just above.',
    },
    {
      id: 'create-rules', chapter: 'create', route: NEW,
      title: 'Field rules ride along',
      say: 'Field rules come along on their own. Each customer’s account has Field Requirements, like GPS check-in and check-out, a signature, or a number of photos. A new job copies them, and you’ll see them on the job later.',
    },
    {
      id: 'create-save', chapter: 'create', route: NEW, selector: t('job-save'),
      title: 'Create Job',
      say: 'Create Job saves the job, its line items and files, and opens the job page. We’ll leave it this time. Cancel, beside it, leaves without making anything.',
    },
    {
      id: 'create-to-sub', chapter: 'create', route: NEW, selector: t('job-kind-sub'),
      wait: { appear: t('sub-record-type') }, doIt: t('job-kind-sub'),
      yourTurn: 'Click Sub.',
      title: 'Now a sub job',
      say: 'Now a sub job. Click Sub, up in Record type.',
    },

    // ---------- A sub job ----------
    {
      id: 'sub-header', chapter: 'sub', route: NEW, open: 'goto:/jobs/new?kind=sub', click: t('job-entry-full'), selector: t('sub-create-header'),
      title: 'New Sub Job',
      say: 'This is New Sub Job, for work a partner does for you. You set the most they can spend, and they ask before going over.',
    },
    {
      id: 'sub-type', chapter: 'sub', route: NEW, selector: t('sub-record-type'),
      title: 'Sub is picked',
      say: 'Sub is lit up. Job or Estimate takes you back to the regular form.',
    },
    {
      id: 'sub-customer', chapter: 'sub', route: NEW, selector: t('sub-customer'),
      title: 'Customer and location',
      say: 'Pick the customer and the service location, the same as on a job.',
    },
    {
      id: 'sub-files', chapter: 'sub', route: NEW, selector: t('sub-files'),
      title: 'Their paperwork',
      say: 'Attach the customer’s work order or PO, so the sub has the paperwork.',
    },
    {
      id: 'sub-picker', chapter: 'sub', route: NEW, selector: t('sub-picker'),
      title: 'Who does it',
      say: 'Sub doing the work is the partner company. Your partners are set up under Subcontractors in the Tool Shed.',
    },
    {
      id: 'sub-basics', chapter: 'sub', route: NEW, selector: t('sub-basics'),
      title: 'Title and scope',
      say: 'A short title, and the scope of work: exactly what you’re authorizing them to do.',
    },
    {
      id: 'sub-auth', chapter: 'sub', route: NEW, selector: t('sub-authorization'),
      title: 'Date and not-to-exceed',
      say: 'The service date, and the not-to-exceed: the most you’ll pay, with labor, materials and tax. If they need more, they ask from their portal and you approve it. Special instructions covers things like site access.',
    },
    {
      id: 'sub-save', chapter: 'sub', route: NEW, selector: t('sub-save'),
      title: 'Create sub job',
      say: 'Create sub job makes the job with your most-used job type and a starting status, then sends it to the sub. We’ll leave it this time.',
    },
    {
      id: 'sub-later', chapter: 'sub', route: NEW,
      title: 'Later on',
      say: 'You can also hand off a job you already have, with Sub this out on its page. Price increases and the sub’s invoice wait for you in Sub reviews, and Sub payouts shows what’s paid and what’s still owed.',
    },

    // ---------- The job page ----------
    {
      id: 'page-pick', chapter: 'page', route: LIST, open: 'goto:/jobs', selector: t('jobs-list'),
      wait: { route: JOB }, doIt: 'job:open',
      yourTurn: 'Click any job.',
      title: 'Open a job',
      say: 'Now the job page. Open any job. We’re only looking, so nothing will change.',
    },
    {
      id: 'page-covered', chapter: 'page', route: JOB, selector: t('job-covered'),
      title: 'Covered by an agreement',
      say: 'This visit is already paid for by a service agreement, so nobody collects for it. Extra work found on the visit is quoted and billed on its own.',
    },
    {
      id: 'page-header', chapter: 'page', route: JOB, selector: t('job-header'),
      title: 'The job at a glance',
      say: 'Up top: the job number, its status, and where the billing stands.',
    },
    {
      id: 'page-automation', chapter: 'page', route: JOB, selector: t('job-automation'),
      title: 'Automations',
      say: 'Next to the job type and priority is Automations. On means status messages, reminders and automation rules run for this job. Off means nothing automatic goes out. An owner or admin can flip it, and it asks first.',
    },
    {
      id: 'page-actions', chapter: 'page', route: JOB, selector: t('job-actions'),
      title: 'The main buttons',
      say: 'These are the main buttons. You only see the ones your role allows.',
    },
    {
      id: 'page-messages', chapter: 'page', route: JOB, selector: t('job-action-messages'),
      title: 'Messages',
      say: 'Messages opens this job’s texts and emails in a side panel, so you can reply without leaving.',
    },
    {
      id: 'page-subout', chapter: 'page', route: JOB, selector: t('job-action-subout'),
      title: 'Sub this out',
      say: 'Sub this out hands this job to a partner: pick the sub, set the not-to-exceed, and add instructions.',
    },
    {
      id: 'page-delete', chapter: 'page', route: JOB, selector: t('job-action-delete'),
      title: 'Delete',
      say: 'Delete asks for your password and a reason first. A job that’s been invoiced can’t be deleted.',
    },
    {
      id: 'page-summary', chapter: 'page', route: JOB, selector: t('job-summary'),
      title: 'Quick summary',
      say: 'This row has the customer, the location, the schedule, the lead tech and the total. Click the customer to open their account.',
    },
    {
      id: 'page-sub-banner', chapter: 'page', route: JOB, selector: t('job-sub-banner'),
      title: 'Partner work',
      say: 'When a partner is doing the work, this box shows who, the approved amount and any instructions. Edit changes it, and Un-sub brings the job back in-house.',
    },
    {
      id: 'page-portal', chapter: 'page', route: JOB, selector: t('job-portal-request'),
      title: 'From your customer portal',
      say: 'This one came in through your customer portal. Accept job puts it in the queue. Decline lets you add a reason the customer sees.',
    },
    {
      id: 'page-attention', chapter: 'page', route: JOB, selector: t('job-attention'),
      title: 'Needs attention',
      say: 'Needs attention gathers what’s worth a look: billing to someone else, finished but not invoiced, subbed out, unread messages, or notes.',
    },
    {
      id: 'page-tabs', chapter: 'page', route: JOB, selector: t('job-tabs'),
      title: 'The tabs',
      say: 'Everything else is in these tabs: Overview, Field, Expense, Messages, Notes and Log. Field, Expense and Log open a second row of tools.',
    },
    {
      id: 'page-glance', chapter: 'page', route: JOB, click: t('job-tab-overview'), when: FOCUS, selector: t('job-glance'),
      title: 'At a glance',
      say: 'In the Focus look, Overview opens with the job at a glance: the customer, the visit, the lead tech, and where the billing stands.',
    },
    {
      id: 'page-edit-toggle', chapter: 'page', route: JOB, click: t('job-tab-overview'), when: FOCUS, selector: t('job-edit-toggle'),
      title: 'Edit job',
      say: 'Job details stay folded so the page is easy to read. Edit job opens them, and Close details folds them away again. I’ll open them for you now.',
    },
    {
      id: 'page-quick', chapter: 'page', route: JOB, click: EDITOR, selector: t('job-quick-edit'),
      title: 'Quick edit',
      say: 'Overview starts with Quick edit, for the things you change most, without leaving the page.',
    },
    {
      id: 'page-billto', click: EDITOR, chapter: 'page', route: JOB, selector: t('job-qe-billto'),
      title: 'Bill to',
      say: 'Bill to sends the invoice to someone else, like a dealer or a property manager. Leave it empty to bill the customer.',
    },
    {
      id: 'page-status', click: EDITOR, chapter: 'page', route: JOB, selector: t('job-qe-status'),
      title: 'Status saves right away',
      say: 'Status saves the moment you pick one, so leave it alone for now. We’ll come back to it when we close the job out.',
    },
    {
      id: 'page-tech', click: EDITOR, chapter: 'page', route: JOB, selector: t('job-qe-tech'),
      title: 'Lead tech and crew',
      say: 'Lead tech, and Saved crew next to it, say who’s doing the work. A saved crew is a team you set up under Staff.',
    },
    {
      id: 'page-date', click: EDITOR, chapter: 'page', route: JOB, selector: t('job-qe-date'),
      title: 'When',
      say: 'Schedule date, Start, End and Estimated duration set when it happens.',
    },
    {
      id: 'page-cards', chapter: 'page', route: JOB, selector: t('job-overview-cards'),
      title: 'Customer and scope',
      say: 'Below are the customer and location, any work order or PO numbers, the description, and the inspection checklist if there is one.',
    },
    {
      id: 'page-side', chapter: 'page', route: JOB, selector: t('job-overview-side'),
      title: 'Assignment, schedule, totals',
      say: 'On the side: who’s assigned, the schedule, and the totals with tax. Status history lists every change, with where it happened, and when the tech arrived and left.',
    },
    {
      id: 'page-save', chapter: 'page', route: JOB, selector: t('job-save-bar'),
      title: 'Save changes',
      say: 'Quick edit changes wait down here. Save changes keeps them, and Discard throws them out. Leave the page without saving, and they aren’t kept.',
    },

    // ---------- Scheduled and dispatched ----------
    {
      id: 'dispatch-quick', chapter: 'dispatch', route: JOB, open: 'job:open', click: EDITOR, selector: t('job-qe-tech'),
      title: 'Right on the job',
      say: 'Getting a job on the calendar can start right here: set the lead tech and the date in Quick edit, then Save changes.',
    },
    {
      id: 'dispatch-queue', chapter: 'dispatch', route: SCHEDULE, open: 'goto:/schedule', selector: t('schedule-queue'),
      title: 'To Schedule',
      say: 'Or use the Schedule. To Schedule lists jobs with no date yet. Drag one onto the calendar to give it a day and time. Drag a card back onto To Schedule to take its date off.',
    },
    {
      id: 'dispatch-calendar', chapter: 'dispatch', route: SCHEDULE, selector: t('schedule-calendar'),
      title: 'Move it around',
      say: 'Drag a job across the calendar to move it. In Day view, drop it in a tech’s column to give it to them.',
    },
    {
      id: 'dispatch-roster', click: RAIL('crew'), chapter: 'dispatch', route: DISPATCH, open: 'goto:/dispatch', selector: t('dispatch-roster'),
      title: 'Dispatch',
      say: 'Dispatch is today’s board: your technicians, and how each one is doing with today’s work.',
    },
    {
      id: 'dispatch-unassigned', click: RAIL('queue'), chapter: 'dispatch', route: DISPATCH, selector: t('dispatch-unassigned'),
      title: 'Nobody on it yet',
      say: 'Unassigned today lists today’s jobs with nobody on them. Each one has Suggest a tech, to find who fits.',
    },
    {
      id: 'dispatch-needs', click: RAIL('queue'), chapter: 'dispatch', route: DISPATCH, selector: t('dispatch-needs-scheduling'),
      title: 'Needs scheduling',
      say: 'Needs scheduling lists jobs that came in without a date, so none of them get lost.',
    },
    {
      id: 'dispatch-map', chapter: 'dispatch', route: DISPATCH, selector: t('dispatch-map'),
      title: 'The map',
      say: 'The map shows your techs and today’s jobs, so you can see who’s closest.',
    },
    {
      id: 'dispatch-field', chapter: 'dispatch', route: DISPATCH,
      title: 'The tech’s phone takes over',
      say: 'Once the tech heads out, their phone moves the job along: Start travel, Check in on arrival, and Check out, either complete or needing a return. Each can move the job to the status you tied to it in Job statuses, and the customer can hear about it.',
    },

    // ---------- The field work ----------
    {
      id: 'field-open', chapter: 'field', route: JOB, open: 'job:open', selector: t('job-tab-field'),
      wait: { appear: t('job-lineitems-panel') }, doIt: t('job-tab-field'),
      yourTurn: 'Click Field.',
      title: 'Field',
      say: 'Back on a job. Field is where the work itself lives. In the simpler layout it’s called The work. Click it.',
    },
    {
      id: 'field-lines', chapter: 'field', route: JOB, click: t('job-tab-line-items'), selector: t('job-lineitems-panel'),
      title: 'Line items',
      say: 'Line items are what you’re charging. Add a blank line, search the catalog, scan a part, or add a fee or a discount. Changes here save as you go, so let’s just look.',
    },
    {
      id: 'field-tasks', chapter: 'field', route: JOB, click: t('job-tab-tasks'), selector: t('job-tasks-panel'),
      title: 'Tasks',
      say: 'Tasks are to-dos tied to this job, like order the part, or call the customer back.',
    },
    {
      id: 'field-assets', chapter: 'field', route: JOB, click: t('job-tab-customer-assets'), selector: t('job-assets-panel'),
      title: 'Customer assets',
      say: 'Customer assets is the equipment this job covers. Add customer asset links one from the customer’s account. Removing one here only unlinks it.',
    },
    {
      id: 'field-inspection', chapter: 'field', route: JOB, click: t('job-tab-inspection'), selector: t('job-inspection-panel'),
      title: 'Inspection',
      say: 'When the job has a checklist, Inspection is where it gets filled in.',
    },
    {
      id: 'field-agreements', chapter: 'field', route: JOB, click: t('job-tab-agreements'), selector: t('job-agreements'),
      title: 'Agreements',
      say: 'Agreements are documents the customer signs for this job. They sign from an email link, and you counter-sign here. Open one to send it or get its PDF.',
    },
    {
      id: 'field-agreement-add', chapter: 'field', route: JOB, selector: t('job-agreement-add'),
      title: 'Add agreement',
      say: 'Add agreement starts one from your signable templates in Templates and Forms. We’ll leave it.',
    },
    {
      id: 'field-doc', chapter: 'field', route: JOB, click: t('job-tab-doc'), selector: t('job-doc-panel'),
      title: 'Work order documents',
      say: 'Work order documents holds the customer’s own work order and the signed completion PDF, which is made for you when the tech checks out as completed.',
    },
    {
      id: 'field-template', chapter: 'field', route: JOB, selector: t('job-template-upload'),
      title: 'Their work order',
      say: 'Upload the customer’s work order or PO PDF here. On completion, the signed copy is drawn right onto it.',
    },
    {
      id: 'field-rules', chapter: 'field', route: JOB, selector: t('job-field-requirements'),
      title: 'Field requirements',
      say: 'Field requirements are the rules this job copied from the customer: check in and out, the geofence, a signature, minimum photos and a not-to-exceed cap, with counts of visits and signatures so far.',
    },
    {
      id: 'field-visits', chapter: 'field', route: JOB, selector: t('job-visit-log'),
      title: 'Visit log',
      say: 'The visit log has every trip: when the tech checked in and out, how long, how far from the site, and the outcome, Completed or Needs return. Requests to go over the not-to-exceed show up above it, for you to approve or deny.',
    },
    {
      id: 'field-photos', chapter: 'field', route: JOB, click: t('job-tab-photos'), selector: t('job-photos-panel'),
      title: 'BarnCam',
      say: 'BarnCam holds the job’s photos and video. Capture adds more, and a Shared badge means the customer can see it.',
    },
    {
      id: 'field-docs', chapter: 'field', route: JOB, click: t('job-tab-documents'), selector: t('job-documents-panel'),
      title: 'Documents',
      say: 'Documents holds the files attached to the job, like PDFs, permits and receipts.',
    },

    // ---------- Costs, messages, notes, log ----------
    {
      id: 'records-cost', chapter: 'records', route: JOB, open: 'job:open', click: t('job-tab-money'), selector: t('job-cost-panel'),
      title: 'Cost and profit',
      say: 'Expense opens on Cost and profit: revenue before tax, total cost, profit and margin. The cost adds up part costs, imported receipts and the lead tech’s percentage. Sales tax stays out of it.',
    },
    {
      id: 'records-reimburse', chapter: 'records', route: JOB, click: t('job-tab-reimbursements'), selector: t('job-reimbursements-panel'),
      title: 'Reimbursements',
      say: 'Reimbursements is for receipts a tech paid for. Upload one, and it becomes a job document and an expense to pay back. The history below is grouped by tech in Accounting.',
    },
    {
      id: 'records-sub-invoice', chapter: 'records', route: JOB, click: t('job-tab-sub-invoice'), selector: t('job-sub-invoice-panel'),
      title: 'The sub’s invoice',
      say: 'On a subbed job, Invoice shows the sub’s invoice, and Signed doc shows the signatures they captured.',
    },
    {
      id: 'records-messages', chapter: 'records', route: JOB, click: t('job-tab-messages'), selector: t('job-messages-panel'),
      title: 'Messages',
      say: 'Messages keeps the texts, emails, calls and voicemails tied to this job, all together, plus every automated call: who was called, whether they answered, and what they pressed. When CBI is on, it reads a call about the job and writes what was agreed as a note.',
    },
    {
      id: 'records-notes', chapter: 'records', route: JOB, click: t('job-tab-notes'), selector: t('job-notes-panel'),
      title: 'Notes',
      say: 'Notes are the job’s paper trail. Each one is internal, for staff only, or public, for the customer to see.',
    },
    {
      id: 'records-notes-add', chapter: 'records', route: JOB, selector: t('job-notes-add'),
      title: 'Add note',
      say: 'Add note writes one. Once saved, a note is permanent, so we’ll leave it.',
    },
    {
      id: 'records-drives', chapter: 'records', route: JOB, click: t('job-tab-log'), selector: t('job-drives-panel'),
      title: 'Drives',
      say: 'Log opens on Drives: the GPS drive to this job on each visit. Drives are added overnight, so they show up the morning after.',
    },
    {
      id: 'records-history', chapter: 'records', route: JOB, click: t('job-tab-history'), selector: t('job-history-panel'),
      title: 'History',
      say: 'History is a timeline of the job: visits, signatures, not-to-exceed requests, files, automated calls and key dates.',
    },
    {
      id: 'records-activity', chapter: 'records', route: JOB, click: t('job-tab-activity'), selector: t('job-activity-panel'),
      title: 'Activity',
      say: 'Activity lists each change to the job, who made it, and whether it came from the web or a phone. Tick Include views to see who opened it.',
    },

    // ---------- Close out and get paid ----------
    {
      id: 'close-status', chapter: 'close', route: JOB, open: 'job:open', click: EDITOR, selector: t('job-qe-status'),
      title: 'Mark it Complete',
      say: 'Closing out starts with the status. Pick a Complete status here, and CrewBarn makes the invoice from the job’s line items on the spot. Rules in Job statuses can hold it back until there’s a signature or photos. We won’t change it now.',
    },
    {
      id: 'close-invoice', chapter: 'close', route: JOB, selector: `${t('job-action-invoice')}, ${t('job-action-view-invoice')}`,
      title: 'The invoice',
      say: 'A finished job with no invoice yet has Invoice Job, which makes one from the line items. Once there is one, the button reads View invoice, and opens it right on top of the job, ready to send.',
    },
    {
      id: 'close-badge', chapter: 'close', route: JOB, selector: t('job-billing'),
      title: 'Billing badge',
      say: 'This badge follows the invoice: Not invoiced, then Invoiced with the balance due, then Paid.',
    },
    {
      id: 'close-payment', chapter: 'close', route: JOB, selector: t('job-action-payment'),
      title: 'Take the payment',
      say: 'Before there’s an invoice, Take down payment records a deposit, and it’s applied once the job is invoiced. After that, the button reads Receive payment, for paying the invoice. We’ll leave it.',
    },
    {
      id: 'close-money-desk', chapter: 'close', route: MONEY, open: 'goto:/accounting', selector: t('money-desk-header'),
      title: 'Money desk',
      say: 'On the Money desk, Finished but not billed lists jobs that are done, but whose invoice never went out. Send sends them.',
    },
    {
      id: 'close-unbilled', chapter: 'close', route: LIST, open: 'goto:/jobs?stale=unbilled_completed', selector: t('jobs-active-filters'),
      title: 'Completed but unbilled',
      say: 'And the Jobs board can show the same thing: Completed but unbilled. The dashboard’s Ready for billing opens it just like this. Click the chip to see everything again.',
    },

    // ---------- Where jobs show up ----------
    // Card-only steps: where else jobs turn up, and where to go.
    {
      id: 'used-intro', chapter: 'used', route: LIST, open: 'goto:/jobs',
      title: 'Where jobs show up',
      say: 'Jobs don’t only live on this board. Here’s where else they turn up, so you know where to look.',
    },
    {
      id: 'used-customer', chapter: 'used', route: LIST,
      title: 'On the customer’s account',
      say: 'On a customer’s account, the Jobs tab lists their jobs, and New job starts this form with them already picked. Their Field Requirements set the rules each new job copies.',
    },
    {
      id: 'used-intake', chapter: 'used', route: LIST,
      title: 'From calls and texts',
      say: 'Calls and texts become drafts in the Intake Queue. Opening one starts New Job filled in from what was said. Nothing is made until you press Create Job, and the call thread then moves onto the job.',
    },
    {
      id: 'used-estimates', chapter: 'used', route: LIST,
      title: 'From estimates and agreements',
      say: 'An approved estimate becomes a job with Convert to job. And service agreements make their own visits, which land on this board as jobs, marked Covered by the agreement.',
    },
    {
      id: 'used-dashboard', chapter: 'used', route: LIST,
      title: 'From the dashboard',
      say: 'On the dashboard, Needs attention links like Waiting on parts and Ready for billing open this board already filtered.',
    },
    {
      id: 'used-partners', chapter: 'used', route: LIST,
      title: 'Partner work',
      say: 'Inbound sub jobs lists work partners send you to accept or decline. Sub reviews holds their price increases and invoices, and Sub payouts shows what’s paid and still owed.',
    },
    {
      id: 'used-statuses', chapter: 'used', route: STATUSES, open: 'goto:/tool-shed/job-statuses', selector: t('job-statuses-header'),
      title: 'Job statuses',
      say: 'Job statuses, in the Tool Shed, are the stages themselves. Their names become the tabs on the board. Each one can text or email the customer, and have rules a job must meet first.',
    },
    {
      id: 'used-types', chapter: 'used', route: TYPES, open: 'goto:/tool-shed/job-types', selector: t('job-types-header'),
      title: 'Job types',
      say: 'Job types are the kinds of work you do. Each has a color and icon for the schedule, and can bring a starting status and a usual duration into New Job.',
    },
    {
      id: 'used-done', chapter: 'used',
      title: 'That’s the lot',
      say: 'That’s a job from start to finish: the board, a new job, a sub job, the job page, scheduling, the field work, costs and notes, and getting paid. You can take this tutorial again any time from the button at the top of the Jobs page.',
    },
  ],
}
