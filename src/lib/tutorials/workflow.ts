import type { TutorialData } from './types'

/**
 * Jobs & workflow: how a job moves through its stages, the kinds of work,
 * and everything CrewBarn does on its own along the way (automations,
 * reminders, and the settings that watch over them).
 *
 * Kept import-free (types aside) so the voice exporter can load it on its own.
 * The walk-through only points at switches that save on the spot; it never
 * flips them, and it leaves every form through its own Cancel or Close.
 */

const t = (id: string) => `[data-tour=${JSON.stringify(id)}]`

const STATUSES = '^/tool-shed/job-statuses/?$'
const TYPES = '^/tool-shed/job-types/?$'
const LIST = '^/tool-shed/automations/?$'
const BUILD = '^/tool-shed/automations/build/?$'
const REMINDERS = '^/tool-shed/automations/reminders/?$'
const REMINDER_SETTING = '^/tool-shed/preferences/reminders/?$'
const STALLED_SETTING = '^/tool-shed/preferences/stalled-jobs/?$'

export const TUTORIAL: TutorialData = {
  id: 'workflow',
  kicker: 'Jobs & workflow · tutorial',
  title: 'How work flows, start to finish',
  film: [
    {
      id: 'stages',
      label: 'Stages',
      title: 'Every job moves through your stages',
      narration:
        'Welcome. This is how work flows through CrewBarn. Every job moves through your stages: not started, working, waiting, and done. The field app moves it along when the tech starts travel, checks in, and checks out.',
    },
    {
      id: 'types',
      label: 'Job types',
      title: 'Kinds of work give a head start',
      narration:
        'Job types are the kinds of work you do, like a tune-up, a repair or an install. Pick one on a new job, and it fills in where the job starts and how long it usually takes.',
    },
    {
      id: 'sentences',
      label: 'Automations',
      title: 'Things CrewBarn does on its own',
      narration:
        'Then there’s everything CrewBarn does by itself. Each automation reads like a sentence, with a switch beside it. Flip it on, and it just happens, so nobody has to remember.',
    },
    {
      id: 'groups',
      label: 'When they happen',
      title: 'Grouped by the life of a job',
      narration:
        'They’re grouped by when they happen: before the job, when its status changes, on site with GPS, after the work and getting paid, and bringing customers back. Pick any one to see the exact message it sends.',
    },
    {
      id: 'build',
      label: 'Build your own',
      title: 'Fill in the blanks',
      narration:
        'Want one that isn’t there? Build your own by filling in the blanks: when it happens, how long to wait, text or email, who hears about it, and which words go out. The preview shows the message as you go.',
    },
    {
      id: 'reminders',
      label: 'Reminders',
      title: 'A job day, drawn',
      narration:
        'Reminders sit on a timeline of the job day. Customers on top, techs underneath, and the job start in the middle. A reminder the day before, a heads-up when the tech is on the way, a nudge if nobody has started.',
    },
    {
      id: 'watch',
      label: 'Watching over it',
      title: 'Two settings keep watch',
      narration:
        'Two settings watch over it all. One switch turns every appointment reminder on or off. And when a job sits untouched for too long, CrewBarn flags it as stalled, so it doesn’t get forgotten.',
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
    { key: 'stages', label: 'Job stages' },
    { key: 'types', label: 'Job types' },
    { key: 'list', label: 'Automations' },
    { key: 'panel', label: 'What each one does' },
    { key: 'build', label: 'Build your own' },
    { key: 'reminders', label: 'Reminders' },
    { key: 'settings', label: 'Reminder and stalled settings' },
    { key: 'used', label: 'Where it shows up' },
  ],
  steps: [
    // ---------- Job stages ----------
    {
      id: 'stages-header', chapter: 'stages', route: STATUSES, open: 'goto:/tool-shed/job-statuses',
      selector: t('job-statuses-header'),
      title: 'Job statuses',
      say: 'We start where every job starts: its stages. You name them, color them, and decide what happens at each one.',
    },
    {
      id: 'stages-learn', chapter: 'stages', route: STATUSES, selector: t('job-statuses-learn'),
      title: 'How stages work',
      say: 'How stages work plays a short film all about stages, if you ever want the long version. Today we’ll keep stages quick and go hands-on with the rest.',
    },
    {
      id: 'stages-setup', chapter: 'stages', route: STATUSES, selector: t('job-statuses-setup'),
      title: 'Customer updates, carefully',
      say: 'This box walks you through turning on customer updates safely: choose them, check your email and texting, preview, then turn on only what you want. The red switch pauses every automatic customer message and webhook at once.',
    },
    {
      id: 'stages-views', chapter: 'stages', route: STATUSES, selector: t('job-statuses-views'),
      title: 'Three views',
      say: 'Three views of the same stages. Stages is the board, Rules is what a job needs before it can move, and Customer updates is what each stage sends.',
    },
    {
      id: 'stages-board', chapter: 'stages', route: STATUSES, click: t('job-statuses-view-stages'), selector: t('job-statuses-board'),
      title: 'The stages board',
      say: 'Your statuses sit in four lanes: Not started, Working, Waiting and Done. Badges show the starting status, the end status, and which field app button moves a job there. Triggers lists what fires when a job lands on it.',
    },
    {
      id: 'stages-rules', chapter: 'stages', route: STATUSES, click: t('job-statuses-view-rules'), selector: t('job-statuses-rules'),
      title: 'Rules between stages',
      say: 'Rules guard changes made by hand. For example, nobody can pick Complete until the customer has signed and the photos are in. Field check-ins and check-outs still move jobs on their own.',
    },
    {
      id: 'stages-review', chapter: 'stages', route: STATUSES, click: t('job-statuses-view-review'), selector: t('job-statuses-review'),
      title: 'Customer updates',
      say: 'Customer updates lists every status with the email and text it sends. Review opens a status to check the wording and turn each one on or off.',
    },
    {
      id: 'stages-new', chapter: 'stages', route: STATUSES, selector: t('job-statuses-new'),
      wait: { appear: t('job-status-form-name') }, doIt: t('job-statuses-new'),
      yourTurn: 'Click + New status.',
      title: 'Look inside a status',
      say: 'Let’s look inside a status. Click New status. We’re only looking, and nothing is made until you save.',
    },
    {
      id: 'stages-name', chapter: 'stages', route: STATUSES, selector: t('job-status-form-name'),
      title: 'Basics',
      say: 'Basics is the name, icon and color. The color shows everywhere the status does: the calendar, job cards and the board.',
    },
    {
      id: 'stages-category', chapter: 'stages', route: STATUSES, selector: t('job-status-form-category'),
      title: 'Category',
      say: 'Category decides which lane it sits in, and how reports count it.',
    },
    {
      id: 'stages-field', chapter: 'stages', route: STATUSES, selector: t('job-status-form-field-action'),
      title: 'Moved by the field app',
      say: 'This is the field app button that moves a job here on its own, like Start travel or Check in. Leave it on No automatic field action, and jobs only move here by hand.',
    },
    {
      id: 'stages-flags', chapter: 'stages', route: STATUSES, selector: t('job-status-form-flags'),
      title: 'Start, finish, invoice',
      say: 'Initial is where a new job starts when nothing else decides. Terminal means the job is finished here. And the invoicing box adds an invoice to-do when a job lands here.',
    },
    {
      id: 'stages-customer', chapter: 'stages', route: STATUSES, click: t('job-status-edit-tab-customer'), selector: t('job-status-form-customer'),
      title: 'Tell the customer',
      say: 'Tell the customer picks the email and text that go out when a job reaches this status. Each one has its own on switch, so the wording can wait, ready, until you want it.',
    },
    {
      id: 'stages-automations', chapter: 'stages', route: STATUSES, selector: t('job-status-edit-tab-automations'),
      title: 'Automations and Rules',
      say: 'On a saved status, Automations lists everything else that fires when a job lands here, and Rules sets where a job can come from.',
    },
    {
      id: 'stages-close', chapter: 'stages', route: STATUSES, selector: '[aria-label="Close status editor"]',
      wait: { gone: t('job-status-edit-tab-basics') }, doIt: '[aria-label="Close status editor"]',
      yourTurn: 'Close the status editor.',
      title: 'Close it',
      say: 'Close it without saving. Nothing gets made.',
    },

    // ---------- Job types ----------
    {
      id: 'types-header', chapter: 'types', route: TYPES, open: 'goto:/tool-shed/job-types',
      selector: t('job-types-header'),
      title: 'Job types',
      say: 'Job types are the kinds of work you do. Keep the list short and clear, so picking one is quick.',
    },
    {
      id: 'types-summary', chapter: 'types', route: TYPES, selector: t('job-types-summary'),
      title: 'A head start for every job',
      say: 'This counts your active types, and how many already carry a duration or a starting status.',
    },
    {
      id: 'types-list', chapter: 'types', route: TYPES, selector: t('job-types-list'),
      title: 'Your types',
      say: 'Each card shows the color, icon, category and defaults. Most used marks the one you pick most. Switch a type off to hide it from new jobs without touching old ones.',
    },
    {
      id: 'types-add', chapter: 'types', route: TYPES, selector: t('job-types-add'),
      wait: { appear: t('job-type-form-name') }, doIt: t('job-types-add'),
      yourTurn: 'Click + Add job type.',
      title: 'Look inside a type',
      say: 'Click Add job type to see what one holds. Again, we’re only looking.',
    },
    {
      id: 'types-name', chapter: 'types', route: TYPES, selector: t('job-type-form-name'),
      title: 'Name',
      say: 'What the work is called, like Service call, Water heater install or Lawn service.',
    },
    {
      id: 'types-color', chapter: 'types', route: TYPES, selector: t('job-type-form-color'),
      title: 'Color and icon',
      say: 'The color and icon show on job cards on the schedule and the dispatch board, so you can tell the work apart at a glance.',
    },
    {
      id: 'types-status', chapter: 'types', route: TYPES, selector: t('job-type-form-status'),
      title: 'Where it starts',
      say: 'Default status is the stage a new job of this type starts in. This is where types and stages meet. Leave it on No default to use your usual starting status.',
    },
    {
      id: 'types-duration', chapter: 'types', route: TYPES, selector: t('job-type-form-duration'),
      title: 'How long it takes',
      say: 'Default duration is how many minutes this work usually takes. It fills in Duration on a new job.',
    },
    {
      id: 'types-active', chapter: 'types', route: TYPES, selector: t('job-type-form-active'),
      title: 'Active',
      say: 'Off hides the type from new-job pickers. Add would save it, so we’ll leave that.',
    },
    {
      id: 'types-close', chapter: 'types', route: TYPES, selector: '[role="dialog"] [aria-label="Close"]',
      wait: { gone: t('job-type-form-name') }, doIt: '[role="dialog"] [aria-label="Close"]',
      yourTurn: 'Close the window.',
      title: 'Close it',
      say: 'Close the window. Nothing is added.',
    },

    // ---------- Automations ----------
    {
      id: 'list-header', chapter: 'list', route: LIST, open: 'goto:/tool-shed/automations',
      selector: t('auto-header'),
      title: 'Automations',
      say: 'Now the part that runs by itself. These are the things CrewBarn does for you, each one written as a sentence.',
    },
    {
      id: 'list-autopilot', chapter: 'list', route: LIST, selector: t('auto-autopilot'),
      title: 'Autopilot',
      say: 'Autopilot sums it up: whether anything is on, and how many messages CrewBarn sent for you this week.',
    },
    {
      id: 'list-tiles', chapter: 'list', route: LIST, selector: t('auto-tiles'),
      title: 'On, waiting, didn’t send',
      say: 'How many are turned on, how many messages are waiting to send, and how many didn’t send. If any didn’t, clicking that number jumps to the recent history.',
    },
    {
      id: 'list-ready', chapter: 'list', route: LIST, selector: t('auto-ready'),
      title: 'Ready to send',
      say: 'Ready to send checks the basics: texting, a verified email, message templates, and GPS. Anything in amber needs setting up, and clicking it takes you there.',
    },
    {
      id: 'list-reminders-chip', chapter: 'list', route: LIST, selector: t('auto-reminders-chip'),
      title: 'All reminders at once',
      say: 'This one turns every appointment reminder on or off in one go. It saves the moment you press it, so we’ll just look.',
    },
    {
      id: 'list-actions', chapter: 'list', route: LIST, selector: t('auto-actions'),
      title: 'See what ran, or build your own',
      say: 'See what ran jumps to the history of what was sent. Build your own starts a new one, and we’ll do that together soon.',
    },
    {
      id: 'list-search', chapter: 'list', route: LIST, selector: t('auto-search'),
      title: 'Search',
      say: 'Search finds an automation by any word in its sentence, like review, invoice or late.',
    },
    {
      id: 'list-who', chapter: 'list', route: LIST, selector: t('auto-who-customer'),
      wait: { click: true }, doIt: t('auto-who-customer'),
      yourTurn: 'Click Customers.',
      title: 'Who gets it',
      say: 'These narrow the list by who hears about it: customers, techs, the office, or your other apps. Click Customers to see only what your customers get.',
    },
    {
      id: 'list-groups', chapter: 'list', route: LIST, click: t('auto-who-all'), selector: t('auto-groups'),
      title: 'In job order',
      say: 'I’ve put it back on Everyone. The list reads in the order a job happens, one group for each part of its life. Each group says how many are on.',
    },
    {
      id: 'list-before', chapter: 'list', route: LIST, selector: t('auto-group-before'),
      title: 'Before the job',
      say: 'Before the job holds your reminders, so nobody forgets or wonders where you are. Add a reminder at the bottom opens the timeline.',
    },
    {
      id: 'list-status', chapter: 'list', route: LIST, selector: t('auto-group-status'),
      title: 'When a status changes',
      say: 'These fire every time a job moves to a stage: an email, a text, a PDF for the job, a line in the job history, or a note to another app. They’re set once per status, back in Job statuses.',
    },
    {
      id: 'list-gps', chapter: 'list', route: LIST, selector: t('auto-group-gps'),
      title: 'On the job, with GPS',
      say: 'These use your techs’ phones or GPS devices: check them in when they stay on site, clock them in and out, remind them if they leave with the visit open, and tell dispatch when someone’s running late.',
    },
    {
      id: 'list-after', chapter: 'list', route: LIST, selector: t('auto-group-after'),
      title: 'After the job and getting paid',
      say: 'Say thanks, ask for a review, nudge an unpaid invoice, or tell the office when money comes in.',
    },
    {
      id: 'list-back', chapter: 'list', route: LIST, selector: t('auto-group-back'),
      title: 'Bring customers back',
      say: 'Warranty and contract reminders, and a note to customers who’ve gone quiet. This is marketing, so it only goes to customers who opted in.',
    },
    {
      id: 'list-mine', chapter: 'list', route: LIST, selector: t('auto-group-mine'),
      title: 'Your own',
      say: 'Ones you built yourself, that don’t match a suggestion above, land here.',
    },
    {
      id: 'list-apps', chapter: 'list', route: LIST, selector: t('auto-group-apps'),
      title: 'Your other apps',
      say: 'If you send events to other software, it shows here as one line, with a link to manage those connections.',
    },
    {
      id: 'list-row', chapter: 'list', route: LIST, selector: t('auto-row'),
      title: 'One row, one automation',
      say: 'Each row is one automation. The tile says who it’s for, the highlighted words are the parts you can change, and the line underneath says how it’s going, or which template it uses.',
    },
    {
      id: 'list-switch', chapter: 'list', route: LIST, selector: t('auto-row-switch'),
      title: 'The switch',
      say: 'The switch turns it on or off, and it saves right away. When you turn one on, an Undo shows up just in case.',
    },
    {
      id: 'list-turnon', chapter: 'list', route: LIST, selector: t('auto-row-turnon'),
      title: 'Suggestions',
      say: 'Striped rows are suggestions that aren’t on yet. Turn on makes it real, straight away. The Showing ideas button up top hides them if you’d rather not see them.',
    },
    {
      id: 'list-timing', chapter: 'list', route: LIST, selector: t('auto-row-timing'),
      title: 'Edit timing',
      say: 'Edit timing changes when it fires. We’ll open one in a moment.',
    },

    // ---------- What each one does ----------
    {
      id: 'panel-pick', chapter: 'panel', route: LIST, open: 'goto:/tool-shed/automations',
      selector: t('auto-row-pick'),
      wait: { click: true }, doIt: t('auto-row-pick'),
      yourTurn: 'Click the first sentence in the list.',
      title: 'Pick one',
      say: 'Every row has a panel that shows exactly what it does. Click the first sentence in the list.',
    },
    {
      id: 'panel-what', chapter: 'panel', route: LIST, selector: t('auto-panel-what'),
      title: 'What happens',
      say: 'Here’s the sentence again, then the trip it takes: the moment, how long it waits, and who gets it at the end. Lives in tells you where the rule is kept.',
    },
    {
      id: 'panel-body', chapter: 'panel', route: LIST, selector: t('auto-panel-body'),
      title: 'The message itself',
      say: 'This is what the person actually gets, filled in with a sample job. Nothing is sent from here.',
    },
    {
      id: 'panel-lately', chapter: 'panel', route: LIST, selector: t('auto-panel-lately'),
      title: 'Lately',
      say: 'Lately lists the last few sends, waits and failures for the rules you build here. Reminders and status triggers write to the job’s history instead.',
    },
    {
      id: 'panel-actions', chapter: 'panel', route: LIST, selector: t('auto-panel-actions'),
      title: 'Change it',
      say: 'Down here is how to change it. Most rows have Edit timing. A status row has Edit this status response, which opens the same editor as Job statuses.',
    },
    {
      id: 'panel-idea', chapter: 'panel', route: LIST,
      selector: `${t('auto-row')}[data-state="idea"] ${t('auto-row-pick')}`,
      wait: { click: true }, doIt: `${t('auto-row')}[data-state="idea"] ${t('auto-row-pick')}`,
      yourTurn: 'Click a striped suggestion.',
      title: 'Look at a suggestion',
      say: 'Now click one of the striped suggestions.',
    },
    {
      id: 'panel-idea-preview', chapter: 'panel', route: LIST, selector: t('auto-panel-body'),
      title: 'Read it before it’s on',
      say: 'Even a suggestion shows the real message it would send, so you can read it before Turn on makes it live.',
    },
    {
      id: 'panel-status', chapter: 'panel', route: LIST,
      selector: `${t('auto-group-status')} ${t('auto-row-pick')}`,
      wait: { click: true }, doIt: `${t('auto-group-status')} ${t('auto-row-pick')}`,
      yourTurn: 'Click a status sentence.',
      title: 'A status trigger',
      say: 'Try one from When a job’s status changes.',
    },
    {
      id: 'panel-status-body', chapter: 'panel', route: LIST, selector: t('auto-panel-body'),
      title: 'Wording lives in templates',
      say: 'Status emails and texts use your templates, filled in with the job, customer and tech when they send. Edit this status response is where you change who gets it and which template.',
    },
    {
      id: 'panel-test', chapter: 'panel', route: LIST, selector: t('auto-test'),
      title: 'Send me a test',
      say: 'On one you built, Send me a test asks for your phone or email, then sends one real message to you. We’ll skip it today.',
    },
    {
      id: 'panel-timing-open', chapter: 'panel', route: LIST, selector: t('auto-row-timing'),
      wait: { appear: t('auto-timing') }, doIt: t('auto-row-timing'),
      yourTurn: 'Click Edit timing.',
      title: 'Edit timing',
      say: 'Now click Edit timing on a row.',
    },
    {
      id: 'panel-timing', chapter: 'panel', route: LIST, selector: t('auto-timing'),
      title: 'Change when it fires',
      say: 'For a reminder or a rule, type the minutes here. Zero means right after it happens. GPS rows show their own settings instead, like how long a tech stays on site before they’re checked in.',
    },
    {
      id: 'panel-timing-save', chapter: 'panel', route: LIST, selector: t('auto-timing-save'),
      title: 'Save timing',
      say: 'Save timing keeps it on or off, just as it was. On a suggestion, it saves an off rule you can switch on later. We’ll leave it.',
    },
    {
      id: 'panel-timing-close', chapter: 'panel', route: LIST, selector: t('auto-timing-close'),
      wait: { gone: t('auto-timing') }, doIt: t('auto-timing-close'),
      yourTurn: 'Click Close.',
      title: 'Close it',
      say: 'Close it, and nothing changes.',
    },

    // ---------- Build your own ----------
    {
      id: 'build-open', chapter: 'build', route: LIST, open: 'goto:/tool-shed/automations',
      selector: t('auto-build'),
      wait: { route: BUILD }, doIt: t('auto-build'),
      yourTurn: 'Click Build your own.',
      title: 'Build your own',
      say: 'Let’s build one. Click Build your own. Nothing turns on unless you press the last button, and we won’t.',
    },
    {
      id: 'build-header', chapter: 'build', route: BUILD, open: 'goto:/tool-shed/automations/build', selector: t('build-header'),
      title: 'Fill in the blanks',
      say: 'The whole automation is one sentence with blanks. Tap any highlighted part to change it, and the message on the right keeps up.',
    },
    {
      id: 'build-ideas', chapter: 'build', route: BUILD, selector: t('build-ideas'),
      title: 'Start from an idea',
      say: 'Ideas fill in the whole sentence for you: a review ask, a thank-you, an invoice follow-up and more. You can change any part afterwards.',
    },
    {
      id: 'build-idea', chapter: 'build', route: BUILD, selector: t('build-idea-review-after-job'),
      wait: { click: true }, doIt: t('build-idea-review-after-job'),
      yourTurn: 'Click Ask for a review after a job.',
      title: 'Pick an idea',
      say: 'Click Ask for a review after a job.',
    },
    {
      id: 'build-sentence', chapter: 'build', route: BUILD, selector: t('build-sentence'),
      title: 'Your sentence',
      say: 'There it is: when you finish a job, wait an hour, then text the customer. Let’s walk through each blank.',
    },
    {
      id: 'build-when', chapter: 'build', route: BUILD, selector: t('build-blank-when'),
      wait: { appear: t('build-pick-when') }, doIt: t('build-blank-when'),
      yourTurn: 'Click the first highlighted part.',
      title: 'When',
      say: 'Click the first highlighted part, the moment it happens.',
    },
    {
      id: 'build-when-list', chapter: 'build', route: BUILD, selector: t('build-pick-when'),
      title: 'Moments CrewBarn can act on',
      say: 'Only moments CrewBarn can act on are listed, so whatever you build always runs. Finishing a job, sending an invoice and getting paid happen in the moment. Warranties, quiet customers and contracts are checked once a day.',
    },
    {
      id: 'build-when-pick', chapter: 'build', route: BUILD, selector: `${t('build-pick-when')} [aria-pressed="true"]`,
      wait: { appear: t('build-pick-wait') }, doIt: `${t('build-pick-when')} [aria-pressed="true"]`,
      yourTurn: 'Pick You finish a job.',
      title: 'Pick a moment',
      say: 'Keep You finish a job. Picking one moves you on to the next blank.',
    },
    {
      id: 'build-wait-list', chapter: 'build', route: BUILD, selector: t('build-pick-wait'),
      title: 'How long after',
      say: 'Then how long to wait. Waiting a little often works better. Nobody wants a text the second they hand over a card.',
    },
    {
      id: 'build-wait-stepper', chapter: 'build', route: BUILD, selector: t('build-wait-stepper'),
      title: 'Something else',
      say: 'For any other wait, use minus and plus, or type it, in minutes, hours or days. Thirty days is the longest.',
    },
    {
      id: 'build-wait-pick', chapter: 'build', route: BUILD, selector: t('build-wait-60'),
      wait: { appear: t('build-pick-how') }, doIt: t('build-wait-60'),
      yourTurn: 'Pick 1 hour.',
      title: 'Pick a wait',
      say: 'Pick 1 hour.',
    },
    {
      id: 'build-how', chapter: 'build', route: BUILD, selector: t('build-how-sms'),
      wait: { appear: t('build-pick-who') }, doIt: t('build-how-sms'),
      yourTurn: 'Pick Text message.',
      title: 'Text or email',
      say: 'How should it reach them? Texts get read, and emails hold more. Pick Text message.',
    },
    {
      id: 'build-who', chapter: 'build', route: BUILD, selector: t('build-who-customer'),
      wait: { appear: t('build-pick-message') }, doIt: t('build-who-customer'),
      yourTurn: 'Pick The customer.',
      title: 'Who hears about it',
      say: 'The customer, or the office. Office alerts go to your company inbox, not to one person. Pick The customer.',
    },
    {
      id: 'build-message', chapter: 'build', route: BUILD, selector: t('build-pick-message'),
      title: 'Which words go out',
      say: 'Last, the words. The friendly default already fills in names, amounts and job details. Your own templates are listed too, and the link at the bottom takes you to Templates and Forms to write a new one.',
    },
    {
      id: 'build-message-pick', chapter: 'build', route: BUILD, selector: t('build-msg-default'),
      wait: { gone: t('build-pick-message') }, doIt: t('build-msg-default'),
      yourTurn: 'Pick The friendly default.',
      title: 'Pick the wording',
      say: 'Pick The friendly default.',
    },
    {
      id: 'build-panel', chapter: 'build', route: BUILD, selector: t('build-panel-what'),
      title: 'What happens',
      say: 'The panel reads it back: the moment, and when it sends.',
    },
    {
      id: 'build-preview', chapter: 'build', route: BUILD, selector: t('build-preview'),
      title: 'The preview',
      say: 'This is the message that would go out. On a text, it counts the characters, and warns you if it would go out as more than one text.',
    },
    {
      id: 'build-history', chapter: 'build', route: BUILD, selector: t('build-history'),
      title: 'History',
      say: 'Once it’s on, every send, skip and failure is kept here. And when you open a saved one, Try it on yourself sends you one real message to check it.',
    },
    {
      id: 'build-readback', chapter: 'build', route: BUILD, selector: t('build-readback'),
      title: 'Read it once more',
      say: 'The bar at the bottom reads your whole sentence back, so you know exactly what you’re turning on.',
    },
    {
      id: 'build-turn-on', chapter: 'build', route: BUILD, selector: t('build-turn-on'),
      title: 'Turn it on',
      say: 'Turn it on saves it and switches it on, and CrewBarn takes it from there. On a saved one, this says Save changes, with Pause and Delete beside it. We’ll leave it this time.',
    },
    {
      id: 'build-cancel', chapter: 'build', route: BUILD, selector: t('build-cancel'),
      wait: { route: LIST }, doIt: t('build-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Cancel takes you back without making anything.',
    },

    // ---------- Reminders ----------
    {
      id: 'rem-header', chapter: 'reminders', route: REMINDERS, open: 'goto:/tool-shed/automations/reminders',
      selector: t('rem-header'),
      title: 'Reminders',
      say: 'Reminders get a page of their own: a job day, drawn as a timeline.',
    },
    {
      id: 'rem-switch', chapter: 'reminders', route: REMINDERS, selector: t('rem-switch'),
      title: 'All reminders',
      say: 'This switch turns every reminder on or off. Off keeps your pins saved, and they start again when you turn it back on. It saves the moment you flip it, so we’ll leave it.',
    },
    {
      id: 'rem-timeline', chapter: 'reminders', route: REMINDERS, selector: t('rem-timeline'),
      title: 'The job day',
      say: 'Each pin is one reminder, placed at the time it goes out. A dimmed pin is switched off.',
    },
    {
      id: 'rem-customer', chapter: 'reminders', route: REMINDERS, selector: t('rem-lane-customer'),
      title: 'Customers on top',
      say: 'The top row is what your customers hear, like a text two hours before the visit.',
    },
    {
      id: 'rem-axis', chapter: 'reminders', route: REMINDERS, selector: t('rem-axis'),
      title: 'The job start in the middle',
      say: 'The dark line is the job start. The last two hours before it get the most room, because that’s where most reminders land. The pink stretch after it is when a job is running late.',
    },
    {
      id: 'rem-tech', chapter: 'reminders', route: REMINDERS, selector: t('rem-lane-tech'),
      title: 'Techs underneath',
      say: 'The bottom row is what your techs hear, like a phone app alert an hour before, or a heads-up when GPS says they may be late.',
    },
    {
      id: 'rem-add', chapter: 'reminders', route: REMINDERS, selector: t('rem-add'),
      title: 'Add a pin',
      say: 'Add puts a new reminder on that row straight away, two hours before for customers and one hour for techs. We won’t add one today.',
    },
    {
      id: 'rem-open', chapter: 'reminders', route: REMINDERS, selector: t('rem-pin'),
      wait: { appear: t('rem-editor') }, doIt: t('rem-pin'),
      yourTurn: 'Click a pin.',
      title: 'Open a pin',
      say: 'Click any pin to open it underneath. Every change in there saves straight away, so today we’ll only look.',
    },
    {
      id: 'rem-editor', chapter: 'reminders', route: REMINDERS, selector: t('rem-editor'),
      title: 'This reminder',
      say: 'The top line reads back what this reminder does, in plain words.',
    },
    {
      id: 'rem-active', chapter: 'reminders', route: REMINDERS, selector: t('rem-active'),
      title: 'On or off',
      say: 'This switches just this one reminder off, without deleting it.',
    },
    {
      id: 'rem-who', chapter: 'reminders', route: REMINDERS, selector: t('rem-who'),
      title: 'Who hears about it',
      say: 'The customer, or the tech.',
    },
    {
      id: 'rem-when', chapter: 'reminders', route: REMINDERS, selector: t('rem-when'),
      title: 'When it goes out',
      say: 'Before start, or if it hasn’t started. Customers can also get On the way, and techs get May be late. Those two use GPS.',
    },
    {
      id: 'rem-offset', chapter: 'reminders', route: REMINDERS, selector: t('rem-offset'),
      title: 'How far out',
      say: 'The minutes, with minus and plus, or typed in. The GPS ones need the tech’s phone or a GPS device, and the arrival time is a guide rather than a promise.',
    },
    {
      id: 'rem-channels', chapter: 'reminders', route: REMINDERS, selector: t('rem-channels'),
      title: 'How it reaches them',
      say: 'Text, email, or a phone app alert. Pick more than one if you like. App alerts only go to techs.',
    },
    {
      id: 'rem-sms-words', chapter: 'reminders', route: REMINDERS, selector: t('rem-sms-words'),
      title: 'The text wording',
      say: 'Which text template goes out. The friendly default works with nothing to set up, and your own templates come from Templates and Forms.',
    },
    {
      id: 'rem-email-words', chapter: 'reminders', route: REMINDERS, selector: t('rem-email-words'),
      title: 'The email wording',
      say: 'The same for email: the friendly default, or one of your own.',
    },
    {
      id: 'rem-preview', chapter: 'reminders', route: REMINDERS, selector: t('rem-preview'),
      title: 'What they get',
      say: 'Here’s what they get, on a sample job, and the line underneath says exactly when, like two hours before a ten o’clock visit.',
    },
    {
      id: 'rem-delete', chapter: 'reminders', route: REMINDERS, selector: t('rem-delete'),
      title: 'Delete',
      say: 'Delete this reminder asks once more before it removes the pin. We’ll keep it.',
    },

    // ---------- Reminder and stalled settings ----------
    {
      id: 'set-reminders', chapter: 'settings', route: REMINDER_SETTING, open: 'goto:/tool-shed/preferences/reminders',
      selector: t('setting-title'),
      title: 'Reminders before an appointment',
      say: 'Two settings watch over all this. The first is the company switch for appointment reminders.',
    },
    {
      id: 'set-reminders-control', chapter: 'settings', route: REMINDER_SETTING, selector: t('setting-control'),
      title: 'On or off',
      say: 'On, and customers hear from you before the visit without anybody remembering. Off, and nothing goes out on its own. Picking one brings up a Save change bar, so nothing changes by surprise.',
    },
    {
      id: 'set-reminders-what', chapter: 'settings', route: REMINDER_SETTING, selector: t('setting-consequences'),
      title: 'With this choice',
      say: 'This spells out what your choice does. With it on, only jobs that have a scheduled time and an assigned tech get reminders.',
    },
    {
      id: 'set-reminders-scope', chapter: 'settings', route: REMINDER_SETTING, selector: t('setting-scope'),
      title: 'Your rules stay put',
      say: 'Turning it off leaves your reminder pins saved. It only stops them going out.',
    },
    {
      id: 'set-reminders-link', chapter: 'settings', route: REMINDER_SETTING, selector: t('setting-aside'),
      title: 'Back to the timeline',
      say: 'And this link goes back to the timeline, where you choose who gets a reminder and when.',
    },
    {
      id: 'set-stalled', chapter: 'settings', route: STALLED_SETTING, open: 'goto:/tool-shed/preferences/stalled-jobs',
      selector: t('setting-title'),
      title: 'When a job counts as stalled',
      say: 'The second one catches jobs that slip through the cracks. A job nobody has touched for a while gets flagged.',
    },
    {
      id: 'set-stalled-control', chapter: 'settings', route: STALLED_SETTING, selector: t('setting-control'),
      title: 'Days untouched',
      say: 'Choose how long a while is for your shop, from one day up to a year. CrewBarn starts you at seven.',
    },
    {
      id: 'set-stalled-what', chapter: 'settings', route: STALLED_SETTING, selector: t('setting-consequences'),
      title: 'What happens',
      say: 'A stalled job shows up for the office to chase. Nothing is sent to the customer.',
    },
    {
      id: 'set-stalled-scope', chapter: 'settings', route: STALLED_SETTING, selector: t('setting-scope'),
      title: 'Only a flag',
      say: 'It only changes what gets flagged. No job is closed, canceled or reassigned.',
    },

    // ---------- Where it shows up ----------
    // Nothing on this page to point at: the cards say where to look.
    {
      id: 'used-intro', chapter: 'used', route: STALLED_SETTING, open: 'goto:/tool-shed/preferences/stalled-jobs',
      title: 'Where it all shows up',
      say: 'All of this works quietly in the background. Here’s where you’ll see it.',
    },
    {
      id: 'used-customers', chapter: 'used', route: STALLED_SETTING,
      title: 'Your customers’ phones and inboxes',
      say: 'Customers get the texts and emails: appointment reminders, on-the-way texts, stage updates, review asks, thank-yous and invoice nudges. The wording comes from Templates and Forms, or the friendly default.',
    },
    {
      id: 'used-team', chapter: 'used', route: STALLED_SETTING,
      title: 'Your techs and the office',
      say: 'Techs get phone app alerts and reminders, and GPS checks them in and out. Dispatch gets a heads-up when someone may be late, and office alerts land in your company inbox.',
    },
    {
      id: 'used-jobs', chapter: 'used', route: STALLED_SETTING,
      title: 'On jobs',
      say: 'Your stage names are the tabs on the Jobs page, and you change a job’s stage by hand on the job itself. The job type you pick on a new job fills in its starting stage and duration. And status triggers can write a line in the job’s history.',
    },
    {
      id: 'used-dashboard', chapter: 'used', route: STALLED_SETTING,
      title: 'On the dashboard',
      say: 'On the dashboard, the Needs attention card counts your dormant jobs, which are the stalled ones, and clicking the number lists them. On the schedule, a stalled job gets a Dormant badge.',
    },
    {
      id: 'used-find', chapter: 'used', route: STALLED_SETTING,
      title: 'Finding your way back',
      say: 'In the Tool Shed, Automations sits under Create and Send, and Job types and Job statuses under Customers and Workflow. The two settings live in Jobs and workflow. You can take this tutorial again any time from the button at the top of these pages.',
    },
  ],
}
