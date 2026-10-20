import type { TutorialData } from './types'

/**
 * The dashboard, start to finish: the welcome header and the four views,
 * what needs you today, the lists and the crew, the money, dispatch, your
 * own board, where every number leads, and the top bar for getting around.
 *
 * Kept import-free (types aside) so the voice exporter can load it on its own.
 * Nothing here saves: the sticky note form is closed with Cancel, Customize
 * is opened and closed with Done without adding or removing a block, and
 * buttons that change records (clear done, Quote the parts, Pin to board,
 * Reset to default) are only pointed at.
 */

const t = (id: string) => `[data-tour=${JSON.stringify(id)}]`

const HOME = '^/$'
const SCHEDULE = '^/schedule/?$'
const JOBS = '^/jobs/?$'
const ROLES = '^/tool-shed/roles/?$'

const OPS = t('dash-tab-ops')
const CASH = t('dash-tab-cashflow')
const DISPATCH = t('dash-tab-dispatch')
const CUSTOM = t('dash-tab-custom')
/** Today's schedule header: "full view" is its last button, "clear done" the one before. */
const SCHEDULE_LINK = `${t('dash-schedule')} h2 + div > button:last-child`
const WORKDAY = (n: number) => `${t('dash-easy-workday')} [data-easy-action-card]:nth-child(${n})`
/** The Focus look (<html data-theme="focus">), for words that differ there. */
const FOCUS = 'html[data-theme="focus"]'
/** In the Focus look the four lists at the bottom show one at a time: open the right one first. */
const QUEUE = (key: string) => `click:${t(`dash-queue-${key}`)}`

export const TUTORIAL: TutorialData = {
  id: 'dashboard',
  kicker: 'Dashboard · tutorial',
  title: 'Your dashboard, start to finish',
  film: [
    {
      id: 'home',
      label: 'Home base',
      title: 'The first page you see every day',
      narration:
        'Welcome to your dashboard, the page CrewBarn opens to after you sign in. It has four views: your day, the money, dispatch, and a board you build yourself. The one you used last opens next time.',
    },
    {
      id: 'numbers',
      label: 'Numbers that lead',
      title: 'Every number is a door',
      narration:
        'Up top are a few big numbers: jobs today, jobs with no date, calls to return, work ready to bill, and new leads. Each one opens the page where you deal with it. Opening it never finishes anything for you.',
    },
    {
      id: 'lists',
      label: 'Today’s lists',
      title: 'What’s happening, and what’s stuck',
      narration:
        'Below the numbers are today’s lists: notes for the team, where your crew is right now, today’s schedule, late jobs, and a cleanup list. A line only shows up when something needs it.',
    },
    {
      id: 'money',
      label: 'The money',
      title: 'The money, at a glance',
      narration:
        'The money view reads live from your invoices and payments. What you billed and what came in, money in against money out, and what customers still owe, sorted by how late it is.',
    },
    {
      id: 'dispatch',
      label: 'Dispatch',
      title: 'The crew’s day on one line each',
      narration:
        'Dispatch shows today on a timeline, one row per tech, with jobs still needing a date down the side. If you’re out in the field yourself, you see just your own day instead.',
    },
    {
      id: 'custom',
      label: 'Your own board',
      title: 'A board you arrange yourself',
      narration:
        'Your custom board is yours to arrange. Add the blocks you care about, drag them into order, and take off the ones you don’t. It’s remembered on this computer.',
    },
    {
      id: 'topbar',
      label: 'Getting around',
      title: 'The bar across the top',
      narration:
        'The bar across the top follows you everywhere: messages, calls, intake, search, the plus button for something new, and Help. And on any page with a tutorial, there’s a Tutorial button: the graduation cap with a gold dot.',
    },
    {
      id: 'yourturn',
      label: 'Your turn',
      title: 'Now let’s look at yours',
      narration:
        'That’s the idea. Now let’s look at your real dashboard. I’ll step back into the corner and point at each part. When it’s your turn, you click. If you’d rather watch, press Do it for me.',
    },
  ],
  chapters: [
    { key: 'start', label: 'Welcome and the four views' },
    { key: 'today', label: 'Your day: what needs you' },
    { key: 'lists', label: 'Your day: notes, crew and lists' },
    { key: 'money', label: 'Money overview' },
    { key: 'dispatch', label: 'Dispatch' },
    { key: 'custom', label: 'Your custom board' },
    { key: 'leads', label: 'Where each number leads' },
    { key: 'topbar', label: 'Getting around: the top bar' },
  ],
  steps: [
    // ---------- Welcome and the four views ----------
    {
      id: 'start-welcome', chapter: 'start', route: HOME, open: 'goto:/', selector: t('dash-welcome'),
      title: 'Your home base',
      say: 'This is your dashboard, the page CrewBarn opens to after you sign in. It shows what’s on today, what’s stuck, how the money looks and where your crew is.',
    },
    {
      id: 'start-new-job', chapter: 'start', route: HOME, selector: t('dash-new-job'),
      title: '+ New job',
      say: 'In the Easy layouts, + New job sits right in the welcome banner and opens the New Job form. You only see it if you’re allowed to make jobs.',
      variants: [{ when: FOCUS, say: 'In the Focus look, + New job sits at the top right, next to Schedule, and opens the New Job form. You only see it if you’re allowed to make jobs.' }],
    },
    {
      id: 'start-tabs', chapter: 'start', route: HOME, selector: t('dash-tabs'),
      title: 'Four views',
      say: 'These are the four views. Today’s Ops is your day, Cash Flow is the money, Dispatch is the crew, and Custom is a board you build. In the Easy layouts they’re big cards named Your day, Money overview, Dispatch and Your custom board.',
    },
    {
      id: 'start-remembered', chapter: 'start', route: HOME, selector: t('dash-tabs'),
      title: 'It remembers',
      say: 'The view you used last opens next time on this computer, so if you live in the money, it’ll be waiting for you.',
    },
    {
      id: 'start-badge', chapter: 'start', route: HOME, selector: t('dash-ops-badge'),
      title: 'The red number',
      say: 'This red number adds up jobs with no date, finished jobs not yet invoiced, and jobs past their time. When it’s gone, your day is in good shape.',
    },
    {
      id: 'start-try', chapter: 'start', route: HOME, selector: t('dash-tabs'),
      wait: { click: true }, doIt: CASH,
      yourTurn: 'Click any view.',
      title: 'Try one',
      say: 'Click any of the views to flip to it. Nothing changes but what you’re looking at.',
    },
    {
      id: 'start-back', chapter: 'start', route: HOME, click: OPS, selector: t('dash-tabs'),
      title: 'Back to your day',
      say: 'I’ve switched you back to your day, the first view. That’s where we’ll start.',
    },

    // ---------- Your day: what needs you ----------
    {
      id: 'today-needs', chapter: 'today', route: HOME, open: 'goto:/', click: OPS, selector: t('dash-needs-you'),
      title: 'Needs you',
      say: 'In the Easy layouts, Needs you comes first: three queues that want a person. Each card shows how many are waiting, and opens the list where you deal with them.',
    },
    {
      id: 'today-needs-schedule', chapter: 'today', route: HOME, click: OPS, selector: t('dash-needs-you-schedule'),
      title: 'Choose a date',
      say: 'Choose a date counts jobs waiting to be scheduled. It opens the Schedule page, where you drag them onto the calendar.',
    },
    {
      id: 'today-needs-overdue', chapter: 'today', route: HOME, click: OPS, selector: t('dash-needs-you-overdue'),
      title: 'Check overdue work',
      say: 'Check overdue work counts jobs past their scheduled time that are still open. It opens the Jobs board showing just those.',
    },
    {
      id: 'today-needs-billing', chapter: 'today', route: HOME, click: OPS, selector: t('dash-needs-you-billing'),
      title: 'Review billing',
      say: 'Review billing counts finished jobs with no invoice yet. It opens the Jobs board on Completed but unbilled, ready for you to bill them.',
    },
    {
      id: 'today-workday', chapter: 'today', route: HOME, click: OPS, selector: t('dash-easy-workday'),
      title: 'Your workday',
      say: 'Your workday is a row of shortcuts into the Jobs board. They only open a list; they never change a job.',
    },
    {
      id: 'today-workday-find', chapter: 'today', route: HOME, click: OPS, selector: WORKDAY(1),
      title: 'Find a job',
      say: 'Find a job opens the Jobs board, where you can search for any job and open its customer, schedule and work.',
    },
    {
      id: 'today-workday-parts', chapter: 'today', route: HOME, click: OPS, selector: WORKDAY(2),
      title: 'Waiting on parts',
      say: 'Waiting on parts counts jobs flagged as needing parts, and opens them on the Jobs board.',
    },
    {
      id: 'today-workday-billing', chapter: 'today', route: HOME, click: OPS, selector: WORKDAY(3),
      title: 'Ready for billing',
      say: 'Ready for billing is the same finished, unbilled list, one tap away while you’re working.',
    },
    {
      id: 'today-error', chapter: 'today', route: HOME, click: OPS, selector: t('dash-load-error'),
      title: 'Something didn’t load',
      say: 'If part of the dashboard couldn’t load, this yellow bar tells you the totals may be short. Retry failed sections tries again.',
    },
    {
      id: 'today-stats', chapter: 'today', route: HOME, click: OPS, selector: t('dash-stats'),
      title: 'Today’s numbers',
      say: 'These five tiles are today in numbers. A color means something is waiting, and a link under the number takes you to it.',
    },
    {
      id: 'today-stat-jobs', chapter: 'today', route: HOME, click: OPS, selector: t('dash-stat-jobs-today'),
      title: 'Jobs today',
      say: 'Jobs today counts every job on today’s calendar, leaving out cancelled ones. Done is jobs in a finished status, and remaining is the rest.',
    },
    {
      id: 'today-stat-unscheduled', chapter: 'today', route: HOME, click: OPS, selector: t('dash-stat-unscheduled'),
      title: 'Unscheduled',
      say: 'Unscheduled is jobs with no date yet. It turns red when any are waiting, and Schedule now opens the Schedule page. All scheduled means you’re clear.',
    },
    {
      id: 'today-stat-calls', chapter: 'today', route: HOME, click: OPS, selector: t('dash-stat-calls'),
      title: 'Unanswered calls',
      say: 'Unanswered calls is people waiting to hear back. The line underneath counts numbers that don’t match a customer yet. Open calls goes to Calls, or to Messages if you can’t open Calls.',
    },
    {
      id: 'today-stat-invoice', chapter: 'today', route: HOME, click: OPS, selector: t('dash-stat-ready-to-invoice'),
      title: 'Ready to invoice',
      say: 'Ready to invoice is finished jobs with no invoice, with the dollars waiting to be billed. Send invoices opens those jobs on the Jobs board.',
    },
    {
      id: 'today-stat-intake', chapter: 'today', route: HOME, click: OPS, selector: t('dash-stat-intake'),
      title: 'AI Intake',
      say: 'AI Intake is new leads from calls and texts, held for someone to review. Review queue opens the Intake page. It stays at zero if you can’t view customers.',
    },

    // ---------- Your day: notes, crew and lists ----------
    {
      id: 'lists-mix', chapter: 'lists', route: HOME, open: 'goto:/', click: OPS, selector: t('dash-customer-mix'),
      title: 'New vs returning customers',
      say: 'New vs returning customers shows how many new customers you got, and how many jobs came from new and returning ones. Under each number is the period before, to compare.',
    },
    {
      id: 'lists-mix-new', chapter: 'lists', route: HOME, click: OPS, selector: t('dash-customer-mix'),
      title: 'Who counts as new',
      say: 'A customer counts as new when their very first job falls in that period. Customers you brought in from an old system keep their history, so they don’t look new.',
    },
    {
      id: 'lists-mix-range', chapter: 'lists', route: HOME, click: OPS, selector: t('dash-customer-mix-range'),
      wait: { click: true }, doIt: `${t('dash-customer-mix-range')} button:nth-child(2)`,
      yourTurn: 'Click Week.',
      title: 'Day, Week, Month, Year',
      say: 'Day, Week, Month and Year set how long a period is. Click Week.',
    },
    {
      id: 'lists-mix-period', chapter: 'lists', route: HOME, click: OPS, selector: t('dash-customer-mix-period'),
      title: 'Which period',
      say: 'This list picks which one. The first is the current period, marked to date; the rest are earlier ones, so you can look back.',
    },
    {
      id: 'lists-mix-month', chapter: 'lists', route: HOME, click: `${t('dash-customer-mix-range')} button:nth-child(3)`, selector: t('dash-customer-mix-range'),
      title: 'Back to Month',
      say: 'I’ve put it back on Month. Whatever you pick here is remembered for next time.',
    },
    {
      id: 'lists-sticky', chapter: 'lists', route: HOME, click: OPS, selector: t('dash-sticky-notes'),
      title: 'Sticky notes',
      say: 'Sticky notes are for the team, like a whiteboard by the door. The number shows how many are up right now.',
    },
    {
      id: 'lists-sticky-add', chapter: 'lists', route: HOME, click: OPS, selector: t('dash-sticky-add'),
      wait: { appear: t('dash-sticky-form') }, doIt: t('dash-sticky-add'),
      yourTurn: 'Click + Add note.',
      title: '+ Add note',
      say: 'Let’s look at a new one. Click Add note. You can also right-click anywhere on this view and pick Add sticky note.',
    },
    {
      id: 'lists-sticky-form', chapter: 'lists', route: HOME, selector: t('dash-sticky-form'),
      hold: true, yourTurn: 'Type a note if you like. It won’t be pinned.',
      title: 'Write the note',
      say: 'Write what your crew needs to know. The dots pick its color, yellow, blue, green or pink, and the list beside them sets how long it stays up: no expiry, today, three days or a week.',
    },
    {
      id: 'lists-sticky-show-to', chapter: 'lists', route: HOME, selector: t('dash-sticky-show-to'),
      title: 'Show to',
      say: 'Show to is All crew, or Specific people, ticked from your staff list. Only they’ll see it.',
    },
    {
      id: 'lists-sticky-save', chapter: 'lists', route: HOME, selector: t('dash-sticky-save'),
      title: 'Pin to board',
      say: 'Pin to board puts it up for everyone it’s meant for. We’ll leave it this time.',
    },
    {
      id: 'lists-sticky-cancel', chapter: 'lists', route: HOME, selector: t('dash-sticky-cancel'),
      wait: { gone: t('dash-sticky-form') }, doIt: t('dash-sticky-cancel'),
      yourTurn: 'Click Cancel.',
      title: 'Cancel',
      say: 'Click Cancel to close it without pinning anything.',
    },
    {
      id: 'lists-sticky-done', chapter: 'lists', route: HOME, click: OPS, selector: t('dash-sticky-notes'),
      title: 'Done, and who read it',
      say: 'Hover a note to read all of it. A green tick lists who has read it, and an arrow with a number means it was shown to only a few people. Done takes it down for everyone, so it asks first.',
    },
    {
      id: 'lists-supervised', chapter: 'lists', route: HOME, click: OPS, selector: t('dash-supervised'),
      title: 'My supervised projects',
      say: 'If you look after work other people are doing, it’s listed here. Red counts jobs with nobody going and ones past due. If you can see every job, this stays hidden.',
    },
    {
      id: 'lists-crew', chapter: 'lists', route: HOME, click: OPS, selector: t('dash-crew'),
      title: 'Crew right now',
      say: 'Crew right now is each field tech: their status, what they’re working on, when their location last came in, and what’s next.',
    },
    {
      id: 'lists-crew-counts', chapter: 'lists', route: HOME, click: OPS, selector: t('dash-crew-counts'),
      title: 'On site, driving, idle',
      say: 'Green is on site, blue is driving, amber is idle. No ping turns red only when a tech has work today but their phone hasn’t reported in 15 minutes. Tracker off means a truck tracker went quiet, and No app means they haven’t set up the app.',
    },
    {
      id: 'lists-crew-buttons', chapter: 'lists', route: HOME, click: OPS, selector: t('dash-crew'),
      title: 'Message, open, assign',
      say: 'Each row has Message, which opens Messages, and a second button: Open job when they’re on one, Track when they’re driving, or Assign job when they’re free, which opens the Schedule.',
    },
    {
      id: 'lists-incoming', chapter: 'lists', route: HOME, click: OPS, selector: `${t('dash-incoming-portal')}, ${t('dash-incoming-marketplace')}`,
      title: 'New requests',
      say: 'Work customers asked for through your customer portal, and quote requests from the marketplace, wait here until someone answers. They show on Dispatch too, so they’re seen wherever the day starts.',
    },
    {
      id: 'lists-spotlight', chapter: 'lists', route: HOME, click: OPS, selector: t('dash-spotlight'),
      title: 'Dormant job spotlight',
      say: 'The spotlight lists jobs more than a minute past their arrival time that are still open, in progress or blocked, with how late each one is. Click one to open it and move it along.',
    },
    {
      id: 'lists-spotlight-filter', chapter: 'lists', route: HOME, click: OPS, selector: t('dash-spotlight-filter'),
      title: 'Filter by status',
      say: 'Status narrows the spotlight to one of your job statuses, like only the blocked ones.',
    },
    {
      id: 'lists-next', chapter: 'lists', route: HOME, click: OPS, selector: t('dash-next'),
      title: 'Next',
      say: 'The Next bar is the job coming up after the one underway, with its time and status. Click it to open the job.',
    },
    {
      id: 'lists-queues', chapter: 'lists', route: HOME, click: OPS, when: FOCUS, selector: t('dash-queue-tabs'),
      title: 'One list at a time',
      say: 'In the Focus look, the lists below show one at a time. Today, Needs a quote, Needs attention and Callbacks each show how many are waiting. Pick one and its list opens underneath.',
    },
    {
      id: 'lists-schedule', open: QUEUE('schedule'), chapter: 'lists', route: HOME, click: OPS, selector: t('dash-schedule'),
      title: 'Today’s schedule',
      say: 'Today’s schedule lists today’s jobs in start-time order, each with its status color. Click a job to open it.',
    },
    {
      id: 'lists-schedule-clear', chapter: 'lists', route: HOME, click: OPS, selector: `${t('dash-schedule')} h2 + div > button:not(:last-child)`,
      title: 'Clear done',
      say: 'Clear done takes today’s finished jobs off this list, to keep it short. We’ll leave it.',
    },
    {
      id: 'lists-quote', open: QUEUE('quotes'), chapter: 'lists', route: HOME, click: OPS, selector: t('dash-needs-quote'),
      title: 'Waiting on a quote',
      say: 'When a tech logs work that still needs a price, the visit waits here with how many items to price. Critical and High mark the urgent ones, and On a service plan means the visit itself is covered, so nothing else will remind you.',
    },
    {
      id: 'lists-quote-parts', chapter: 'lists', route: HOME, click: OPS, selector: t('dash-quote-parts'),
      title: 'Quote the parts',
      say: 'Quote the parts builds a draft estimate from what the tech logged and opens it for you to check and send. We’ll leave it this time.',
    },
    {
      id: 'lists-attention', open: QUEUE('attention'), chapter: 'lists', route: HOME, click: OPS, selector: t('dash-attention'),
      title: 'Needs attention',
      say: 'Needs attention is your cleanup list. A line only shows up when something needs it, and the dot says how urgent: red is pressing, amber soon, blue a heads-up.',
    },
    {
      id: 'lists-attention-lines', open: QUEUE('attention'), chapter: 'lists', route: HOME, click: OPS, selector: t('dash-attention'),
      title: 'What the lines mean',
      say: 'You might see unscheduled jobs, jobs past their time, time off to approve, needs parts, parts ordered, payment not collected, no photos, ready to invoice, overdue invoices, and estimates waiting on a reply. Click a line to open that exact list.',
    },
    {
      id: 'lists-calls', open: QUEUE('calls'), chapter: 'lists', route: HOME, click: OPS, selector: t('dash-calls'),
      title: 'Callers to ring back',
      say: 'These are the people behind the Unanswered calls number, with the customer’s name or No customer match. Click one to go to Calls and ring them back.',
    },

    // ---------- Money overview ----------
    {
      id: 'money-range', chapter: 'money', route: HOME, open: 'goto:/', click: CASH, selector: t('dash-cashflow-range'),
      title: 'Cash Flow',
      say: 'This is the money view, Cash Flow, or Money overview in the Easy layouts. It reads live from your invoices and payments. Day, Month, Quarter and Year set the period, and it starts on Month.',
    },
    {
      id: 'money-try', chapter: 'money', route: HOME, click: CASH, selector: t('dash-cashflow-range'),
      wait: { click: true }, doIt: `${t('dash-cashflow-range')} button:nth-child(4)`,
      yourTurn: 'Click Year.',
      title: 'Try Year',
      say: 'Click Year, and every block below switches to the year.',
    },
    {
      id: 'money-metrics', chapter: 'money', route: HOME, click: CASH, selector: t('dash-cash-company-metrics'),
      title: 'Company metrics',
      say: 'Company metrics is the headline: collected, spent and the net between them, then outstanding, open invoices, and accepted estimates. The side shows your average job and money in against out.',
    },
    {
      id: 'money-revenue', chapter: 'money', route: HOME, click: CASH, selector: t('dash-cash-revenue-gauge'),
      title: 'Revenue',
      say: 'Revenue is a gauge: of what you invoiced this period, how much has come in. Underneath are Invoiced, Collected, and what’s still open. Money opens the Money desk.',
    },
    {
      id: 'money-avg', chapter: 'money', route: HOME, click: CASH, selector: t('dash-cash-avg-job-revenue'),
      title: 'Average revenue per job',
      say: 'Avg revenue per job is the average for completed jobs in the period, with a small chart of money collected over time. Jobs opens the Jobs board.',
    },
    {
      id: 'money-flow', chapter: 'money', route: HOME, click: CASH, selector: t('dash-cash-money-flow'),
      title: 'Money in / out',
      say: 'Invoiced is what you billed, In is what you were paid, and Out is what went to subcontractors and purchase orders. Net is green when you came out ahead. You can show it as bars or lines.',
    },
    {
      id: 'money-receivables', chapter: 'money', route: HOME, click: CASH, selector: t('dash-cash-receivables'),
      title: 'Receivables',
      say: 'Receivables is everything customers owe on open invoices. Aging sorts it from not due to 90 days late, vs Collected compares what came due with what came in, and By term splits it by payment terms.',
    },
    {
      id: 'money-collected', chapter: 'money', route: HOME, click: CASH, selector: t('dash-cash-cash-collected'),
      title: 'Cash collected',
      say: 'Cash collected is payments received, stacked by who collected them or how they paid. Cash drawer opens the page where you confirm money your crew turns in.',
    },
    {
      id: 'money-outstanding', chapter: 'money', route: HOME, click: CASH, selector: t('dash-cash-outstanding-balance'),
      title: 'Outstanding balance',
      say: 'Outstanding balance is what’s still owed right now, split into current and overdue. It doesn’t change with the period.',
    },

    // ---------- Dispatch ----------
    {
      id: 'dispatch-board', chapter: 'dispatch', route: HOME, open: 'goto:/', click: DISPATCH, selector: t('dash-dispatch-board'),
      title: 'Today’s crew board',
      say: 'Owners, admins and dispatchers see today’s crew board: one row for each tech with work today, on a 7 am to 7 pm timeline. Click a block to open the job.',
    },
    {
      id: 'dispatch-legend', chapter: 'dispatch', route: HOME, click: DISPATCH, selector: t('dash-dispatch-legend'),
      title: 'Reading the blocks',
      say: 'Green blocks are done, amber are on site now, grey are still to come, and the amber line is the time right now.',
    },
    {
      id: 'dispatch-unscheduled', chapter: 'dispatch', route: HOME, click: DISPATCH, selector: t('dash-unscheduled'),
      title: 'Unscheduled',
      say: 'Down the side are jobs with no date. Click one to see suggested techs, or right-click to drop it into one of the next open time slots. Assessments open their estimate instead.',
    },
    {
      id: 'dispatch-more', chapter: 'dispatch', route: HOME, click: DISPATCH, selector: t('dash-unscheduled'),
      title: 'More than 25',
      say: 'This side list shows up to 25. Past that, a link at the bottom takes you to the Schedule for the rest.',
    },
    {
      id: 'dispatch-myday', chapter: 'dispatch', route: HOME, click: DISPATCH, selector: t('dash-myday'),
      title: 'My day',
      say: 'Everyone else sees My day here: just your own jobs today on a small timeline, with how many are done.',
    },
    {
      id: 'dispatch-myday-list', chapter: 'dispatch', route: HOME, click: DISPATCH, selector: t('dash-myday-list'),
      title: 'Your jobs',
      say: 'Then a card for each of your jobs. Now marks the one you’re on site at, and tapping a card opens it.',
    },

    // ---------- Your custom board ----------
    {
      id: 'custom-grid', chapter: 'custom', route: HOME, open: 'goto:/', click: CUSTOM, selector: t('dash-board-grid'),
      title: 'Your own board',
      say: 'This is your custom board, made of blocks you choose. A new board starts with 14: the money blocks, new vs returning customers, needs attention, techs on the map, messages, accepted estimates, cash to turn in, and quick actions.',
    },
    {
      id: 'custom-range', chapter: 'custom', route: HOME, click: CUSTOM, selector: t('dash-range'),
      title: 'Period',
      say: 'Day, Month, Quarter or Year sets the period for every money block on the board.',
    },
    {
      id: 'custom-period', chapter: 'custom', route: HOME, click: CUSTOM, selector: t('dash-period'),
      title: 'Look back',
      say: 'This list picks which period: the current one, marked to date, or an earlier one that’s closed, so its numbers are final.',
    },
    {
      id: 'custom-size', chapter: 'custom', route: HOME, click: CUSTOM, selector: t('dash-size'),
      title: 'Card size',
      say: 'S, M and L make all the cards smaller or bigger at once, so you fit more or read easier.',
    },
    {
      id: 'custom-customize', chapter: 'custom', route: HOME, click: CUSTOM, selector: t('dashboard-customize'),
      wait: { appear: t('dash-add-block') }, doIt: t('dashboard-customize'),
      yourTurn: 'Click Customize.',
      title: 'Customize',
      say: 'Customize is where you change what’s on it. Click it.',
    },
    {
      id: 'custom-tray', chapter: 'custom', route: HOME, selector: t('dash-add-block'),
      title: 'Add a block',
      say: 'Add a block lists everything not on your board yet. Hover one to see what it shows; clicking it adds it to the end right away. We won’t add one now.',
    },
    {
      id: 'custom-reset', chapter: 'custom', route: HOME, selector: t('dash-reset-board'),
      title: 'Reset to default',
      say: 'Reset to default puts the starting 14 blocks back in their first order. We’ll leave it.',
    },
    {
      id: 'custom-drag', chapter: 'custom', route: HOME, selector: t('dash-block-drag'),
      title: 'Drag to move',
      say: 'While you’re customizing, drag a block by this handle to move it somewhere else on the board.',
    },
    {
      id: 'custom-remove', chapter: 'custom', route: HOME, selector: t('dash-block-remove'),
      title: 'Remove block',
      say: 'The X takes a block off your board. You can always add it back from the tray.',
    },
    {
      id: 'custom-saved', chapter: 'custom', route: HOME, selector: t('dash-add-block'),
      title: 'Saved as you go',
      say: 'Every change saves the moment you make it, on this computer only. Another computer, or another browser, starts with the default board.',
    },
    {
      id: 'custom-done', chapter: 'custom', route: HOME, selector: t('dashboard-customize'),
      wait: { gone: t('dash-add-block') }, doIt: t('dashboard-customize'),
      yourTurn: 'Click Done.',
      title: 'Done',
      say: 'Click Done to put the handles away.',
    },
    {
      id: 'custom-access', chapter: 'custom', route: HOME, click: CUSTOM, selector: t('dash-board-grid'),
      title: 'Which blocks you get',
      say: 'Your office can limit which blocks a role, or one person, may use. Blocks you can’t use don’t show up in the tray.',
    },
    {
      id: 'custom-roles', chapter: 'custom', route: ROLES, open: 'goto:/tool-shed/roles', selector: t('roles-header'),
      title: 'Where that’s set',
      say: 'That’s set in Tool Shed, Roles and Permissions, under Dashboard widgets. For one person, edit them in Staff and Crews and tick Restrict dashboard widgets.',
    },

    // ---------- Where each number leads ----------
    {
      id: 'leads-intro', chapter: 'leads', route: HOME, open: 'goto:/', click: OPS, selector: t('dash-stats'),
      title: 'Every number is a door',
      say: 'Almost every number and list here opens the real page where the work happens. Let’s follow one.',
    },
    {
      id: 'leads-try', chapter: 'leads', route: HOME, click: OPS, selector: SCHEDULE_LINK,
      wait: { route: SCHEDULE }, doIt: SCHEDULE_LINK,
      yourTurn: 'Click full view.',
      title: 'Follow one',
      say: 'On Today’s schedule, click full view.',
    },
    {
      id: 'leads-schedule', chapter: 'leads', route: SCHEDULE, selector: t('schedule-queue'),
      title: 'The Schedule',
      say: 'Here’s the Schedule. To Schedule down the side is the same list Unscheduled and Choose a date count. Drag one onto the calendar to give it a date.',
    },
    {
      id: 'leads-jobs', chapter: 'leads', route: JOBS, open: 'goto:/jobs?stale=unbilled_completed', selector: t('jobs-active-filters'),
      title: 'The Jobs board, filtered',
      say: 'Ready to invoice, Review billing, Check overdue work and Waiting on parts all land on the Jobs board like this, already filtered. The chip says what you’re seeing; click it to see every job again.',
    },
    {
      id: 'leads-calls', chapter: 'leads', route: HOME, open: 'goto:/',
      title: 'Calls, messages and intake',
      say: 'Unanswered calls opens Calls, or Messages if you can’t open Calls. Unanswered messages opens the Messages inbox, and AI Intake opens the Intake queue, where a lead becomes a job.',
    },
    {
      id: 'leads-money', chapter: 'leads', route: HOME,
      title: 'The money blocks',
      say: 'Money on the money blocks opens the Money desk in Accounting. Cash collected and Cash to turn in open the Cash drawer, and the estimate blocks open your estimates, filtered to accepted or waiting.',
    },
    {
      id: 'leads-crew', chapter: 'leads', route: HOME,
      title: 'The crew',
      say: 'From Crew right now, Open job opens the job, Track opens Dispatch, and Assign job opens the Schedule. Techs on the map opens the full map on Dispatch.',
    },
    {
      id: 'leads-elsewhere', chapter: 'leads', route: HOME,
      title: 'Seen elsewhere too',
      say: 'The same lists show up where you work: the Jobs board has its own cards for past their date, ready to bill and waiting on parts, and Dispatch shows the same new requests from the portal and marketplace.',
    },

    // ---------- Getting around: the top bar ----------
    {
      id: 'top-brand', chapter: 'topbar', route: HOME, open: 'goto:/', selector: t('shell-brand'),
      title: 'Back home',
      say: 'Now the bar across the top, which follows you to every page. Click the CrewBarn name any time to come back to this dashboard.',
    },
    {
      id: 'top-menu', chapter: 'topbar', route: HOME, selector: `${t('nav-dashboard')}, ${t('sidebar-nav')}, ${t('rail-categories')}`,
      title: 'Your main menu',
      say: 'The main menu holds the places you use every day, like Jobs, Schedule, Dispatch and Customers. You only see the ones your role can open.',
    },
    {
      id: 'top-messages', chapter: 'topbar', route: HOME, selector: `${t('topbar-comms')}[href="/communications"]`,
      title: 'Messages',
      say: 'Messages is your inbox for customer texts and emails.',
    },
    {
      id: 'top-calls', chapter: 'topbar', route: HOME, selector: `${t('topbar-comms')}[href="/calls"]`,
      title: 'Calls',
      say: 'Calls is your phone log. The amber number is calls waiting on you.',
    },
    {
      id: 'top-intake', chapter: 'topbar', route: HOME, selector: `${t('topbar-comms')}[href="/intake"]`,
      title: 'Intake',
      say: 'Intake is where calls and texts become draft jobs for you to check. Its number matches the AI Intake tile.',
    },
    {
      id: 'top-cbi', chapter: 'topbar', route: HOME, selector: t('topbar-cbi'),
      title: 'CBI',
      say: 'CBI is your AI helper. Ask about jobs, customers, money or the schedule in plain words. If it wants to change something, you confirm first.',
    },
    {
      id: 'top-search', chapter: 'topbar', route: HOME, selector: t('topbar-search'),
      title: 'Search',
      say: 'The magnifying glass finds a customer, job, estimate or catalog by name or number. Press Ctrl or Cmd plus K from anywhere.',
    },
    {
      id: 'top-catalogs', chapter: 'topbar', route: HOME, selector: '[data-header-actions] [aria-label="Catalogs"]',
      title: 'Catalogs',
      say: 'The book opens your shop’s catalogs, the parts and price books you keep. Alt plus C opens it from anywhere.',
    },
    {
      id: 'top-create', chapter: 'topbar', route: HOME, selector: t('topbar-create'),
      wait: { appear: t('topbar-create-menu') }, doIt: `${t('topbar-create')} button`,
      yourTurn: 'Click the orange plus.',
      title: 'Start something new',
      say: 'The orange plus starts something new from any page. Click it.',
    },
    {
      id: 'top-create-menu', chapter: 'topbar', route: HOME, selector: t('topbar-create-menu'),
      title: 'What you can start',
      say: 'New Job, New Task, New Estimate, New Service Agreement, New Customer and New Asset. It only lists what you’re allowed to make.',
    },
    {
      id: 'top-create-close', chapter: 'topbar', route: HOME, selector: t('topbar-create'),
      wait: { gone: t('topbar-create-menu') }, doIt: 'menu:close',
      yourTurn: 'Click anywhere outside the menu.',
      title: 'Close it',
      say: 'Click anywhere outside the menu to close it.',
    },
    {
      id: 'top-bell', chapter: 'topbar', route: HOME, selector: t('topbar-bell'),
      title: 'Notifications',
      say: 'The bell is the office’s shared notifications, for money events like disputes and refunds. Click one to go straight to it.',
    },
    {
      id: 'top-tutorial', chapter: 'topbar', route: HOME, selector: t('tutorial-launch'),
      title: 'Tutorial',
      say: 'Every page with a tutorial has this button, the graduation cap with a gold dot, right here in the top bar. On Jobs it teaches Jobs, on Schedule it teaches the Schedule, and here it plays this one again.',
    },
    {
      id: 'top-help', chapter: 'topbar', route: HOME, selector: t('topbar-help'),
      wait: { appear: t('tutorial-help') }, doIt: t('topbar-help'),
      yourTurn: 'Click the question mark.',
      title: 'Help',
      say: 'The question mark opens Help for the page you’re on. You can also press the question mark key. Click it.',
    },
    {
      id: 'top-help-tutorials', chapter: 'topbar', route: HOME, selector: t('tutorial-help'),
      title: 'Show tutorials on pages',
      say: 'Help can start this page’s tutorial too. Show tutorials on pages puts the Tutorial button on every page that has one. Untick it to hide them, and tick it to bring them back.',
    },
    {
      id: 'top-help-close', chapter: 'topbar', route: HOME, selector: '[aria-label="Close help"]',
      wait: { gone: t('tutorial-help') }, doIt: '[aria-label="Close help"]',
      yourTurn: 'Close Help.',
      title: 'Close Help',
      say: 'Close Help with the X, or press Escape.',
    },
    {
      id: 'top-account', chapter: 'topbar', route: HOME, selector: t('user-menu'),
      title: 'Your account',
      say: 'Your initials open your own menu: your account, your time off, and the layout switcher, where you can try the Easy layouts.',
    },
    {
      id: 'top-done', chapter: 'topbar', route: HOME, click: OPS,
      title: 'That’s the dashboard',
      say: 'That’s your dashboard: your day, the money, dispatch, your own board, and where every number leads. Take this tutorial again any time from the Tutorial button at the top.',
    },
  ],
}
