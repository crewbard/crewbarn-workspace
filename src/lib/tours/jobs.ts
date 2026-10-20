import type { GuidedTour } from '@/lib/guidedTours'

/**
 * Jobs area tours (owner 03): Jobs list, New Job, New Sub Job, Job page,
 * Job Types, Job Statuses. Steps target data-tour attributes in the page
 * components; the engine skips any step whose target isn't on screen
 * (e.g. Easy-theme-only cards, banners that only show in some cases).
 *
 * Note: /jobs/new and /jobs/new?kind=sub share a pathname and route regexes
 * only see the pathname. So 'job-create' owns /^\/jobs\/new\/?$/, and the sub
 * job tour ('job-sub-create') is started by id from the "Help: show me how"
 * button on the sub job form. Its route is the old /sub-jobs/new shortcut
 * (which redirects), so it never claims the normal New Job page.
 */
export const JOB_TOURS: GuidedTour[] = [
  {
    id: 'jobs-list',
    title: 'Your Jobs board',
    description: 'Find any job, see what it needs next, and open it without losing your place.',
    route: /^\/jobs\/?$/,
    roadmap: [
      { title: 'Work comes in', detail: 'A phone call, a portal request, an AI intake draft, or a service agreement visit.' },
      { title: 'A job is created', detail: 'On New Job, or sent to a partner as a sub job.' },
      { title: 'Watch it move', detail: 'Tabs and filters show each stage, from needs scheduling to complete.' },
      { title: 'See what it needs', detail: 'The next-step chip on each job says what it is waiting on.' },
      { title: 'Open the job', detail: 'Schedule, assign, field log, invoice and payment all live on the job page.' },
    ],
    use: {
      say: 'Jobs with no date yet get placed on the Schedule, and the Dispatch board shows where your techs are with today’s work. Finished jobs that were never billed wait on the Money desk under Accounting.',
      go: [{ label: 'Go to Schedule', to: '/schedule' }, { label: 'Go to Dispatch', to: '/dispatch' }, { label: 'Open Money desk', to: '/accounting' }],
    },
    steps: [
      {
        selector: '[data-tour="jobs-header"]',
        title: 'Every job in one place',
        say: 'This is your Jobs board. Every job your company has, from the first call to the invoice, shows up here.',
      },
      {
        selector: '[data-tour="jobs-new"]',
        title: 'Start a new job',
        say: 'New Job opens the intake form. You only see it if you are allowed to create jobs.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="jobs-attention"]',
        title: 'Jobs that need a nudge',
        say: 'These cards are quick filters for jobs that need attention. Tap one to narrow the list, tap it again to clear it.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="jobs-tabs"]',
        title: 'Stages of the work',
        say: 'Each tab is a stage of the job. The number is how many jobs are sitting there right now.',
      },
      {
        selector: '[data-tour="jobs-toolbar"]',
        title: 'Search and filter',
        say: 'Search by title, customer or address, narrow to this week, or open Filters for status and subcontracted work. On a computer you can also switch between Cards and Files.',
      },
      {
        selector: '[data-tour="jobs-active-filters"]',
        title: 'What is narrowing the list',
        say: 'Anything narrowing the list shows here. Tap a chip to remove just that one, or Clear all.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="jobs-list"]',
        title: 'The jobs themselves',
        say: 'Each job shows its number, status, customer, schedule, tech and total. Click a job to open it, or use Peek to look without leaving the list.',
      },
    ],
  },
  {
    id: 'job-create',
    title: 'Creating a job',
    description: 'Capture the customer, scope, schedule and crew in one form, then create the job.',
    route: /^\/jobs\/new\/?$/,
    roadmap: [
      { title: 'Where it starts', detail: 'The Jobs board, a customer page, a call or text thread, an AI intake draft, or a customer’s own work order PDF.' },
      { title: 'Customer and location', detail: 'Pick or quick-add the customer; their main service location fills in.' },
      { title: 'Job, estimate or sub', detail: 'A job goes on the schedule, an estimate is a quote first, a sub job goes to a partner.' },
      { title: 'Scope', detail: 'Title, job type, priority, description, covered assets and line items.' },
      { title: 'Schedule and crew', detail: 'The starting status is picked for you; schedule now or leave it unscheduled.' },
      { title: 'Create', detail: 'The job opens, ready for dispatch.' },
    ],
    use: {
      say: 'Once it’s scheduled, the job shows on the Schedule and the Dispatch board for your techs. The starting status and duration filled in here come from Job types in the Tool Shed.',
      go: [{ label: 'Go to Schedule', to: '/schedule' }, { label: 'Go to Dispatch', to: '/dispatch' }, { label: 'Open Job types', to: '/tool-shed/job-types' }],
    },
    steps: [
      {
        selector: '[data-tour="job-create-header"]',
        title: 'Your intake workspace',
        say: 'This is where a new job starts. You can fill it in one step at a time, or see the whole form on one page.',
      },
      {
        selector: '[data-tour="job-drafts"]',
        title: 'Saved drafts',
        say: 'What you type is saved as you go, in this browser. If you get pulled away, your draft is waiting here. Opening one loads it back into the form.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-ai-draft"]',
        title: 'Filled in from a call or text',
        say: 'This form was pre-filled from a call or text. Check it against the transcript. Nothing has been created yet.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-record-type"]',
        title: 'Job, estimate or sub',
        say: 'Pick what you are making. A job goes straight to the schedule. An estimate is a quote the customer approves first. Sub sends the work to a partner.',
      },
      {
        selector: '[data-tour="job-customer"]',
        title: 'Who the work is for',
        say: 'Start with the customer. Type a name or account number. Their main service location fills in for you.',
      },
      {
        selector: '[data-tour="job-setup-tools"]',
        title: 'Optional extras',
        say: 'Attach a document to sign, the customer’s own work order PDF, photos and files, or an inspection checklist. Each opens in its own window.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-basics"]',
        title: 'The basics',
        say: 'Give the job a short title and pick the job type. The status picks itself, and the type’s default duration fills in if it has one.',
      },
      {
        selector: '[data-tour="job-schedule"], [data-tour="job-dispatch"]',
        title: 'Schedule and crew',
        say: 'New jobs start scheduled for right now so they land on the calendar. Change the date and time, or switch to Unscheduled. Pick a lead tech and any helpers.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-lineitems"]',
        title: 'What you will charge',
        say: 'Add what you will charge now, or later on the job. They are saved together with the job.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-assets"]',
        title: 'Equipment this covers',
        say: 'If this work is on a piece of equipment you track, pick it here so the history follows the asset.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-notes"]',
        title: 'Notes',
        say: 'Internal notes stay with your team. Public notes can appear on customer documents.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-save"]',
        title: 'Create it',
        say: 'When it looks right, create the job. You will land on the job page.',
      },
    ],
  },
  {
    id: 'job-sub-create',
    title: 'Sending a job to a sub',
    description: 'Send work to a partner with an approved not-to-exceed amount and clear instructions.',
    route: /^\/sub-jobs\/new\/?$/,
    roadmap: [
      { title: 'A partner will do it', detail: 'A job comes in that a subcontractor will handle.' },
      { title: 'Customer and location', detail: 'Pick who the work is for and where.' },
      { title: 'Pick the sub', detail: 'Choose the partner doing the work.' },
      { title: 'Scope, date and NTE', detail: 'Describe the work and set the most you will pay.' },
      { title: 'Create', detail: 'The job is created and marked as subbed; the sub is emailed.' },
      { title: 'Later', detail: 'Approve increases and the sub’s invoice on the job or in Sub reviews, then pay it.' },
    ],
    use: {
      say: 'The partners you can pick are set up under Subcontractors in the Tool Shed. When a sub asks to go over the not-to-exceed or sends their invoice, it waits for you in Sub reviews, and Sub payouts shows what’s paid and what’s still owed.',
      go: [{ label: 'Open Sub reviews', to: '/sub-reviews' }, { label: 'Open Sub payouts', to: '/sub-payouts' }, { label: 'Open Subcontractors', to: '/tool-shed/subcontractors' }],
    },
    steps: [
      {
        selector: '[data-tour="sub-create-header"]',
        title: 'Work a partner does for you',
        say: 'This is for work a partner does for you. You set the most they can spend, and they ask you before going over.',
      },
      {
        selector: '[data-tour="sub-record-type"]',
        title: 'Job, estimate or sub',
        say: 'Sub is selected. Switch to Job or Estimate any time if you change your mind.',
      },
      {
        selector: '[data-tour="sub-customer"]',
        title: 'Customer and location',
        say: 'Pick the customer being serviced. Their main location fills in.',
      },
      {
        selector: '[data-tour="sub-files"]',
        title: 'Their paperwork',
        say: 'Attach the customer’s work order or PO, plus any photos or documents the sub should see.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="sub-picker"]',
        title: 'Who does the work',
        say: 'Choose the partner doing the work.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="sub-basics"]',
        title: 'Scope',
        say: 'Give it a short title and describe exactly what you are authorizing the sub to do.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="sub-authorization"]',
        title: 'Date and not-to-exceed',
        say: 'Set the date and the not-to-exceed amount. That is the most you will pay, including labor, materials and tax. If they need more, they request it from their portal.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="sub-save"]',
        title: 'Create the sub job',
        say: 'Create the sub job. It uses your most-used job type and a starting status, then sends the work to the sub.',
      },
    ],
  },
  {
    id: 'job-detail',
    title: 'The job page',
    description: 'Plan the visit, follow the field work, and close it out with an invoice and payment.',
    route: /^\/jobs\/(?!new\/?$)[^/]+\/?$/,
    roadmap: [
      { title: 'Ready to dispatch', detail: 'The job has a customer, location, status and usually a schedule and lead tech.' },
      { title: 'Plan it', detail: 'Change status, tech, crew, schedule and bill-to with Quick edit on Overview.' },
      { title: 'Field work', detail: 'The tech checks in, works and captures photos and signatures in the field app; you follow it here.' },
      { title: 'Changed scope', detail: 'Add line items, create a repair from failed inspection items, or get an agreement signed.' },
      { title: 'Close out', detail: 'Mark it Complete and the invoice is created for you. Then take payment.' },
    ],
    use: {
      say: 'Date and tech changes show up on the Schedule and the Dispatch board. A finished job whose invoice was never sent waits on the Money desk under Finished but not billed. For partner work, spending requests and the sub’s invoice come to Sub reviews.',
      go: [{ label: 'Go to Schedule', to: '/schedule' }, { label: 'Open Money desk', to: '/accounting' }, { label: 'Open Sub reviews', to: '/sub-reviews' }],
    },
    steps: [
      {
        selector: '[data-tour="job-covered"]',
        title: 'Covered by an agreement',
        say: 'This visit is already paid for by a service agreement. Don’t collect for it; quote any extra work separately.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-header"]',
        title: 'The job at a glance',
        say: 'Up top you see the job number, its status, and where the billing stands.',
      },
      {
        selector: '[data-tour="job-actions"]',
        title: 'Main actions',
        say: 'Messages, sub it out, invoice, take payment or delete. You only see the actions your role allows.',
      },
      {
        selector: '[data-tour="job-summary"]',
        title: 'Quick summary',
        say: 'Customer, location, schedule, lead tech and total, all in one row.',
      },
      {
        selector: '[data-tour="job-sub-banner"]',
        title: 'Partner work',
        say: 'When a partner is doing the work, this box shows who, the approved amount, and a link you can send to their tech.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-portal-request"]',
        title: 'Request from your portal',
        say: 'This came in through your customer portal. Accept it to put it in the queue, or decline it with a reason.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-attention"]',
        title: 'Needs attention',
        say: 'Anything worth a look, like unread messages, notes or billing to someone else, is gathered here.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-tabs"]',
        title: 'Everything about the job',
        say: 'The plan, the field work, costs, messages, notes and the log are grouped in these tabs.',
      },
      {
        selector: '[data-tour="job-quick-edit"]',
        click: '[data-tour="job-edit-toggle"]',
        title: 'Quick edit',
        say: 'Change the common things right here. Status saves the moment you pick it. Everything else waits for Save changes at the bottom.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-overview-cards"]',
        title: 'Customer, description and scope',
        say: 'Who the job is for, where, and what needs doing. Assignment, schedule, totals and status history sit alongside.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-save-bar"]',
        title: 'Save your changes',
        say: 'Quick edit changes wait here until you press Save changes, or Discard to undo them.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-agreements"]',
        click: '[data-tour="job-tab-agreements"]',
        title: 'Agreements to sign',
        say: 'Agreements adds a document for the customer to sign, made from one of your signable templates in Templates and Forms. They sign from an email link, and you counter-sign here. If this customer has their own contract template on their account, pick that one.',
        optional: 'Skip',
      },
    ],
  },
  {
    id: 'job-types',
    title: 'Job types',
    description: 'The kinds of work you do, with a color, icon, starting status and default duration.',
    route: /^\/tool-shed\/job-types\/?$/,
    roadmap: [
      { title: 'Set them up once', detail: 'Add the kinds of work your company does.' },
      { title: 'Make them stand out', detail: 'A color and icon show on the schedule and dispatch cards.' },
      { title: 'Give jobs a head start', detail: 'Pick a starting status and a default duration for each type.' },
      { title: 'Used on New Job', detail: 'The type is required there, and your most-used type is picked for you.' },
    ],
    use: {
      say: 'You pick a type on every New Job, and it fills in the starting status and duration you set here. The type’s icon shows on job cards on the Schedule and the Dispatch board, and each service on a service agreement uses a type too.',
      go: [{ label: 'Start a New Job', to: '/jobs/new' }, { label: 'Go to Schedule', to: '/schedule' }, { label: 'Go to Dispatch', to: '/dispatch' }],
    },
    steps: [
      {
        selector: '[data-tour="job-types-header"]',
        title: 'Kinds of work',
        say: 'These are the kinds of jobs you do. Keep the list short and clear, so picking one is quick.',
      },
      {
        selector: '[data-tour="job-types-summary"]',
        title: 'A head start for every job',
        say: 'See how many types are active and how many already carry a duration or a starting status.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-types-add"]',
        title: 'Add a type',
        say: 'Name it, pick a color and icon, and choose where new jobs of this type start and how long they usually take.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-types-list"]',
        title: 'Your types',
        say: 'Each card shows the color, icon, category and defaults. Switch a type off to hide it from new jobs without losing old ones. Edit changes it, and Remove deletes it after you confirm.',
        optional: 'Skip',
      },
      { selector: '[data-tour="job-type-form-name"]', title: 'Name', say: 'What the type is called, like Service call or Install. It’s required.', optional: 'Only for people who can edit', click: '[data-tour="job-types-add"]' },
      { selector: '[data-tour="job-type-form-category"]', title: 'Category', say: 'Service, inspection, install, repair, estimate or project. It groups the type in reports and filters.', optional: 'Only for people who can edit', click: '[data-tour="job-types-add"]' },
      { selector: '[data-tour="job-type-form-color"]', title: 'Color', say: 'The color jobs of this type show on the schedule and dispatch board.', optional: 'Only for people who can edit', click: '[data-tour="job-types-add"]' },
      { selector: '[data-tour="job-type-form-icon"]', title: 'Icon', say: 'A small picture that makes the type easy to spot. Optional.', optional: 'Only for people who can edit', click: '[data-tour="job-types-add"]' },
      { selector: '[data-tour="job-type-form-status"]', title: 'Default status', say: 'New jobs of this type start in this status. Leave it on No default to use your usual starting status.', optional: 'Only for people who can edit', click: '[data-tour="job-types-add"]' },
      { selector: '[data-tour="job-type-form-duration"]', title: 'Default duration', say: 'How many minutes this kind of job usually takes. It fills in Duration on New Job.', optional: 'Only for people who can edit', click: '[data-tour="job-types-add"]' },
      { selector: '[data-tour="job-type-form-sort"]', title: 'Sort order', say: 'Lower numbers show first in the pickers.', optional: 'Only for people who can edit', click: '[data-tour="job-types-add"]' },
      { selector: '[data-tour="job-type-form-active"]', title: 'Active', say: 'Off hides the type from new-job pickers. Press Add to save it, or Cancel to close without saving.', optional: 'Only for people who can edit', click: '[data-tour="job-types-add"]' },
    ],
  },
  {
    id: 'job-statuses',
    title: 'Job statuses',
    description: 'The stages a job moves through, what the customer hears at each one, and the rules between them.',
    route: /^\/tool-shed\/job-statuses\/?$/,
    roadmap: [
      { title: 'Name your stages', detail: 'Names and colors drive the Jobs tabs, calendar and cards.' },
      { title: 'Tie them to the field app', detail: 'Start travel, arrived, needs return, complete or cancel.' },
      { title: 'Tell the customer', detail: 'Decide what the customer hears at each stage: email, text, or nothing.' },
      { title: 'Add rules', detail: 'Stop a job reaching a stage before it is ready.' },
      { title: 'Jobs move', detail: 'Automatically from the field app, or by hand on the job page.' },
    ],
    use: {
      say: 'Your status names become the tabs on the Jobs board, and you change a job’s status by hand on the job page. The email and text wording for each stage lives in Templates & Forms, and Automations shows the other things that fire.',
      go: [{ label: 'Go to Jobs', to: '/jobs' }, { label: 'Open Templates & Forms', to: '/custom-documents' }, { label: 'Open Automations', to: '/tool-shed/automations' }],
    },
    steps: [
      {
        selector: '[data-tour="job-statuses-learn"]',
        title: 'Watch how stages work',
        say: 'New to stages? How stages work plays a short walk-through that explains them with examples: where a new job starts, what moves it along, flow rules, and what the customer hears.',
      },
      {
        selector: '[data-tour="job-statuses-header"]',
        title: 'Stages of a job',
        say: 'These are the stages of a job. You decide what they are called, what color they are, and what happens at each one.',
      },
      {
        selector: '[data-tour="job-statuses-setup"]',
        title: 'Customer updates, carefully',
        say: 'Before any customer gets a message, walk through these four steps. The guide itself doesn’t change anything.',
      },
      {
        selector: '[data-tour="job-statuses-views"]',
        title: 'Three views',
        say: 'Stages shows the board, Rules shows what a job needs before it can move, and Customer updates shows what each stage sends.',
      },
      {
        selector: '[data-tour="job-statuses-board"]',
        click: '[data-tour="job-statuses-view-stages"]',
        title: 'The stages board',
        say: 'Statuses are grouped into Not started, Working, Waiting and Done. Open Triggers to see what fires at each one.',
        optional: 'Skip',
      },
      {
        selector: '[data-tour="job-statuses-rules"]',
        title: 'Status flow rules',
        say: 'Rules guard changes made by hand. For example, a rule from Any status to Complete with Signature and Photos turned on means nobody can pick Complete until the customer has signed and photos are attached. Once a stage has an active rule, a job can only reach it from the allowed stages.',
        optional: 'Skip',
        click: '[data-tour="job-statuses-view-rules"]',
      },
      {
        selector: '[data-tour="job-status-rules-add"]',
        title: 'Add a rule',
        say: 'Pick where the job comes from and where it goes, then press Add rule. From Any status means the rule applies wherever the job is coming from, like Any status to Canceled.',
        optional: 'Only for people who can edit',
        click: '[data-tour="job-statuses-view-rules"]',
      },
      {
        selector: '[data-tour="job-status-rules-list"]',
        title: 'Tech',
        say: 'Each rule has six requirement chips; tap one to turn it on. Tech means a lead technician must be assigned. For example, a lawn service job can’t go to On the Way with nobody on it.',
        optional: 'Skip',
        click: '[data-tour="job-statuses-view-rules"]',
      },
      {
        selector: '[data-tour="job-status-rules-list"]',
        title: 'Scheduled',
        say: 'Scheduled means the job must have a scheduled start time. For example, an HVAC tune-up can’t move to On the Way until it has a start time.',
        optional: 'Skip',
        click: '[data-tour="job-statuses-view-rules"]',
      },
      {
        selector: '[data-tour="job-status-rules-list"]',
        title: 'Signature',
        say: 'Signature means at least one signature is captured on the job. For example, the homeowner signs off a panel upgrade before it can be marked Complete.',
        optional: 'Skip',
        click: '[data-tour="job-statuses-view-rules"]',
      },
      {
        selector: '[data-tour="job-status-rules-list"]',
        title: 'Photos',
        say: 'Photos means the required job photos are attached, or at least one photo when no minimum is set. For example, before and after shots of a door repair.',
        optional: 'Skip',
        click: '[data-tour="job-statuses-view-rules"]',
      },
      {
        selector: '[data-tour="job-status-rules-list"]',
        title: 'Visit',
        say: 'Visit means at least one visit has a Completed outcome. For example, the water heater install visit was finished before the job moves on.',
        optional: 'Skip',
        click: '[data-tour="job-statuses-view-rules"]',
      },
      {
        selector: '[data-tour="job-status-rules-list"]',
        title: 'Closed',
        say: 'Closed means no visit is still open, so the tech has to check out first. For example, a job can’t be marked Complete while the tech is still checked in on site.',
        optional: 'Skip',
        click: '[data-tour="job-statuses-view-rules"]',
      },
      {
        selector: '[data-tour="job-status-rules-list"]',
        title: 'Active and remove',
        say: 'Untick Active to keep a rule saved but stop enforcing it, or press the X to remove it. Field check-ins and check-outs still move jobs on their own; rules only guard changes made by hand.',
        optional: 'Skip',
        click: '[data-tour="job-statuses-view-rules"]',
      },
      { selector: '[data-tour="job-statuses-review"]', title: 'Customer updates', say: 'Every status with the email and text it sends. Press Review on a status to check the wording and switch each one on or off. The wording itself lives in Templates and Forms.', click: '[data-tour="job-statuses-view-review"]' },
      { selector: '[data-tour="job-statuses-new"]', title: 'Add a status', say: 'New status opens the editor. Clicking a status on the board opens the same editor to change it.', optional: 'Only for people who can edit' },
      { selector: '[data-tour="job-status-form-name"]', title: 'Name', say: 'What the stage is called, like Scheduled, On site or Complete.', optional: 'Only for people who can edit', click: '[data-tour="job-statuses-new"]' },
      { selector: '[data-tour="job-status-form-icon"]', title: 'Icon', say: 'A small marker shown next to the status on the board, calendar and dropdowns. None is fine too.', optional: 'Only for people who can edit', click: '[data-tour="job-statuses-new"]' },
      { selector: '[data-tour="job-status-form-color"]', title: 'Color', say: 'Pick a preset, a recent colour or your own. Tick Gradient to blend in a second colour on calendar events and cards.', optional: 'Only for people who can edit', click: '[data-tour="job-statuses-new"]' },
      { selector: '[data-tour="job-status-form-category"]', title: 'Category', say: 'Open, In progress, Blocked, Complete or Canceled. It decides which lane the status sits in and how reports count it.', optional: 'Only for people who can edit', click: '[data-tour="job-statuses-new"]' },
      { selector: '[data-tour="job-status-form-field-action"]', title: 'Mobile field action', say: 'Which field app button moves a job here: Start travel, Check in, Check out needing a return, Check out complete, or Cancel. Leave it on No automatic field action to move jobs here by hand.', optional: 'Only for people who can edit', click: '[data-tour="job-statuses-new"]' },
      { selector: '[data-tour="job-status-form-flags"]', title: 'Initial, Terminal and invoicing', say: 'Initial makes this the starting status when nothing else decides. Terminal means the job is finished here. The office still has to invoice this adds an invoice to-do when a job lands here.', optional: 'Only for people who can edit', click: '[data-tour="job-statuses-new"]' },
      { selector: '[data-tour="job-status-form-sort"]', title: 'Sort order', say: 'Lower numbers show first in lists.', optional: 'Only for people who can edit', click: '[data-tour="job-statuses-new"]' },
      { selector: '[data-tour="job-status-form-active"]', title: 'Active', say: 'Untick it to retire a status without losing the jobs that used it.', optional: 'Only for people who can edit', click: '[data-tour="job-statuses-new"]' },
      { selector: '[data-tour="job-status-form-customer"]', title: 'Customer message', say: 'Choose the email and text a customer gets when a job reaches this status, or have AI write both. Tick each one on, then save. Off keeps the wording but sends nothing.', optional: 'Only for people who can edit', click: '[data-tour="job-status-edit-tab-customer"]' },
      { selector: '[data-tour="job-status-edit-tab-automations"]', title: 'Automations and rules', say: 'Once a status is saved, Automations lists everything else that fires when a job reaches it, and Rules sets where a job can come from. Changes there save straight away.', optional: 'Open a saved status to see this' },
    ],
  },
]
